import json
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Set, Any, Optional
from collections import defaultdict
from utils import create_slot_id, is_valid_slot, get_slot_priority

logger = logging.getLogger(__name__)

class SlotCache:
    """TLS Slot缓存管理器"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.cache_config = config.get('cache', {})
        self.max_slots = self.cache_config.get('max_slots', 1000)
        self.persist_file = self.cache_config.get('persist_file', 'slots_cache.json')
        self.cleanup_interval = self.cache_config.get('cleanup_interval', 3600)
        
        # 缓存数据
        self.slots: Dict[str, Dict[str, Any]] = {}
        self.slot_ids: Set[str] = set()
        self.country_stats: Dict[str, int] = defaultdict(int)
        self.city_stats: Dict[str, int] = defaultdict(int)
        self.last_cleanup = datetime.now()
        
        # 加载持久化数据
        self.load_persisted_data()
        
        # 清理任务标志
        self._cleanup_task_started = False
    
    def add_slots(self, slots: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """添加新的slots到缓存"""
        new_slots = []
        
        for slot in slots:
            if not is_valid_slot(slot):
                continue
                
            slot_id = create_slot_id(slot)
            
            # 检查是否是新slot
            if slot_id not in self.slot_ids:
                # 添加时间戳
                slot['discovered_at'] = datetime.now().isoformat()
                slot['priority'] = get_slot_priority(slot)
                
                self.slots[slot_id] = slot
                self.slot_ids.add(slot_id)
                
                # 更新统计
                country = slot.get('country', '').lower()
                city = slot.get('city', '').lower()
                self.country_stats[country] += 1
                self.city_stats[city] += 1
                
                new_slots.append(slot)
                logger.info(f"新slot发现: {slot.get('country', '')} - {slot.get('city', '')} - {slot.get('date', '')}")
        
        # 如果超过最大数量，清理旧数据
        if len(self.slots) > self.max_slots:
            self._cleanup_old_slots()
        
        return new_slots
    
    def get_slots(self, 
                  country: Optional[str] = None,
                  city: Optional[str] = None,
                  limit: int = 50,
                  sort_by_priority: bool = True) -> List[Dict[str, Any]]:
        """获取缓存的slots"""
        filtered_slots = []
        
        for slot in self.slots.values():
            # 国家过滤
            if country and slot.get('country', '').lower() != country.lower():
                continue
            
            # 城市过滤
            if city and slot.get('city', '').lower() != city.lower():
                continue
            
            filtered_slots.append(slot)
        
        # 排序
        if sort_by_priority:
            filtered_slots.sort(key=lambda x: x.get('priority', 0), reverse=True)
        else:
            filtered_slots.sort(key=lambda x: x.get('discovered_at', ''), reverse=True)
        
        return filtered_slots[:limit]
    
    def get_stats(self) -> Dict[str, Any]:
        """获取缓存统计信息"""
        return {
            'total_slots': len(self.slots),
            'countries': dict(self.country_stats),
            'cities': dict(self.city_stats),
            'last_cleanup': self.last_cleanup.isoformat(),
            'cache_size': len(self.slots)
        }
    
    def clear_cache(self) -> None:
        """清空缓存"""
        self.slots.clear()
        self.slot_ids.clear()
        self.country_stats.clear()
        self.city_stats.clear()
        logger.info("缓存已清空")
    
    def _cleanup_old_slots(self) -> None:
        """清理旧的slots"""
        if len(self.slots) <= self.max_slots:
            return
        
        # 按优先级排序，保留优先级高的
        sorted_slots = sorted(
            self.slots.items(),
            key=lambda x: x[1].get('priority', 0),
            reverse=True
        )
        
        # 保留前max_slots个
        self.slots = dict(sorted_slots[:self.max_slots])
        self.slot_ids = set(self.slots.keys())
        
        # 重新计算统计
        self._recalculate_stats()
        
        logger.info(f"缓存清理完成，保留 {len(self.slots)} 个slots")
    
    def _recalculate_stats(self) -> None:
        """重新计算统计信息"""
        self.country_stats.clear()
        self.city_stats.clear()
        
        for slot in self.slots.values():
            country = slot.get('country', '').lower()
            city = slot.get('city', '').lower()
            self.country_stats[country] += 1
            self.city_stats[city] += 1
    
    def load_persisted_data(self) -> None:
        """加载持久化数据"""
        try:
            with open(self.persist_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.slots = data.get('slots', {})
                self.slot_ids = set(self.slots.keys())
                self._recalculate_stats()
                logger.info(f"从 {self.persist_file} 加载了 {len(self.slots)} 个slots")
        except FileNotFoundError:
            logger.info(f"持久化文件 {self.persist_file} 不存在，使用空缓存")
        except Exception as e:
            logger.error(f"加载持久化数据失败: {e}")
    
    def save_persisted_data(self) -> None:
        """保存数据到持久化文件"""
        try:
            data = {
                'slots': self.slots,
                'saved_at': datetime.now().isoformat()
            }
            with open(self.persist_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            logger.info(f"缓存数据已保存到 {self.persist_file}")
        except Exception as e:
            logger.error(f"保存持久化数据失败: {e}")
    
    async def _cleanup_task(self) -> None:
        """定期清理任务"""
        while True:
            try:
                await asyncio.sleep(self.cleanup_interval)
                self._cleanup_old_slots()
                self.save_persisted_data()
                self.last_cleanup = datetime.now()
            except Exception as e:
                logger.error(f"清理任务失败: {e}")
    
    def get_recent_slots(self, hours: int = 24) -> List[Dict[str, Any]]:
        """获取最近N小时内发现的slots"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        recent_slots = []
        
        for slot in self.slots.values():
            discovered_at = slot.get('discovered_at')
            if discovered_at:
                try:
                    slot_time = datetime.fromisoformat(discovered_at)
                    if slot_time >= cutoff_time:
                        recent_slots.append(slot)
                except ValueError:
                    continue
        
        return sorted(recent_slots, key=lambda x: x.get('discovered_at', ''), reverse=True) 