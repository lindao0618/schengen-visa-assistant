"""
slot_monitor.py

通用签证预约slot监控服务
- 负责处理slot数据、筛选、通知等
- 可用于美国/英国等签证预约slot监控
"""

import asyncio
import traceback
import json
from datetime import datetime
from typing import List, Dict

class SlotMonitorService:
    """
    通用slot监控服务
    """

    def __init__(self):
        # 监控任务内存存储
        self.monitoring_tasks = {}  # {task_id: {settings, created_at, status}}
        # 已通知记录，避免重复发送
        self.notification_records = {}  # {key: timestamp}

    async def start_monitor(self, settings):
        """
        启动slot监控任务
        Args:
            settings: 监控设置对象，需包含openid, country, city, visa_type, start_date, end_date等
        Returns:
            dict: 任务ID和状态
        """
        task_id = f"{settings.country}_{settings.city}_{settings.openid}"
        self.monitoring_tasks[task_id] = {
            "settings": settings,
            "created_at": datetime.now(),
            "status": "active"
        }
        print(f"[SlotMonitor] 启动监控: {task_id} ({settings.country}/{settings.city})")
        return {
            "status": "success",
            "data": {
                "task_id": task_id,
                "message": "监控任务已启动"
            }
        }

    async def stop_monitor(self, task_id):
        """
        停止slot监控任务
        """
        if task_id in self.monitoring_tasks:
            del self.monitoring_tasks[task_id]
            print(f"[SlotMonitor] 停止监控: {task_id}")
            return True
        else:
            print(f"[SlotMonitor] 停止失败，未找到任务: {task_id}")
            return False

    async def slot_callback(self, slot_data):
        """
        处理slot推送数据（如来自WebSocket或测试接口）
        """
        try:
            print(f"[SlotMonitor] 收到slot数据: {slot_data}")
            processed = self._process_slot_data(slot_data)
            if not processed:
                print("[SlotMonitor] 无有效slot，跳过通知")
                return True
            await self._handle_slot_notification(processed)
            return True
        except Exception as e:
            print(f"[SlotMonitor] slot_callback异常: {e}")
            traceback.print_exc()
            return False

    def _process_slot_data(self, data):
        """
        解析slot数据，筛选出有效日期
        支持dict/list/json字符串
        """
        try:
            if isinstance(data, str):
                try:
                    data = json.loads(data)
                except Exception:
                    print("[SlotMonitor] JSON解析失败")
                    return None

            slot_list = None
            if isinstance(data, dict):
                for key in ["data", "slots", "results", "items"]:
                    if key in data and isinstance(data[key], list):
                        slot_list = data[key]
                        break
                if slot_list is None and "country" in data:
                    slot_list = [data]
            elif isinstance(data, list):
                slot_list = data
            else:
                print(f"[SlotMonitor] 未知数据类型: {type(data)}")
                return None

            if not slot_list:
                print("[SlotMonitor] slot列表为空")
                return None

            # 日期范围
            date_range = data.get("date_range", {})
            start_date_str = date_range.get("start", "")
            end_date_str = date_range.get("end", "")
            start_date_obj = None
            end_date_obj = None
            if start_date_str:
                try:
                    start_date_obj = datetime.strptime(start_date_str, "%Y.%m.%d")
                except:
                    pass
            if end_date_str:
                try:
                    end_date_obj = datetime.strptime(end_date_str, "%Y.%m.%d")
                except:
                    pass

            filtered_dates = []
            matched_item = None
            for item in slot_list:
                if not isinstance(item, dict):
                    continue
                # 筛选国家/城市/签证类型
                country = item.get("country", "").lower()
                city = item.get("city", "").lower()
                visa_type = item.get("visa", "")
                req_country = data.get("country", "").lower()
                req_city = data.get("city", "").lower()
                req_visa = data.get("visa", "")
                if (req_country and country and req_country != country) or \
                   (req_city and city and req_city != city) or \
                   (req_visa and visa_type and req_visa != visa_type):
                    continue
                matched_item = item
                dates = item.get("dates", [])
                for date_num in dates:
                    try:
                        date_str = str(date_num)
                        if len(date_str) != 8:
                            continue
                        date_obj = datetime(
                            year=int(date_str[:4]),
                            month=int(date_str[4:6]),
                            day=int(date_str[6:8])
                        )
                        in_range = True
                        if start_date_obj and date_obj < start_date_obj:
                            in_range = False
                        if end_date_obj and date_obj > end_date_obj:
                            in_range = False
                        if in_range:
                            filtered_dates.append(date_num)
                    except Exception:
                        continue

            if not filtered_dates or not matched_item:
                return None

            notification = data.get("notification", {})
            email = notification.get("email", "")
            phone = notification.get("phone", "")
            wechat = notification.get("wechat", "")

            return {
                "country": matched_item.get("country", req_country),
                "city": matched_item.get("city", req_city),
                "visa": matched_item.get("visa", req_visa),
                "dates": filtered_dates,
                "notification": {
                    "email": email,
                    "phone": phone,
                    "wechat": wechat
                }
            }
        except Exception as e:
            print(f"[SlotMonitor] 处理slot数据异常: {e}")
            traceback.print_exc()
            return None

    async def _handle_slot_notification(self, slot_data: dict):
        """
        处理slot监控通知（如推送邮件/微信/短信等）
        """
        try:
            print(f"[SlotMonitor] 处理slot通知: {slot_data}")
            country = slot_data.get("country", "")
            city = slot_data.get("city", "")
            visa_type = slot_data.get("visa", "")
            dates = slot_data.get("dates", [])
            notification = slot_data.get("notification", {})
            available_slots = []
            for date_num in dates:
                try:
                    date_str = str(date_num)
                    if len(date_str) != 8:
                        continue
                    formatted_date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"
                    available_slots.append({
                        "date": formatted_date,
                        "time": "全天"
                    })
                except Exception:
                    continue
            if not available_slots:
                print("[SlotMonitor] 无可用slot，跳过通知")
                return

            # 邮件通知
            email = notification.get("email")
            if email:
                print(f"[SlotMonitor] 发送邮件通知: {email}")
                await self._send_email_notification(
                    email=email,
                    country=country,
                    city=city,
                    available_slots=available_slots,
                    visa_type=visa_type
                )
            # 微信/短信等可扩展
        except Exception as e:
            print(f"[SlotMonitor] 处理slot通知异常: {e}")
            traceback.print_exc()

    async def _send_email_notification(self, email, country, city, available_slots, visa_type=None):
        """
        发送邮件通知（多slot）
        """
        try:
            # 这里假设有email_service_instance
            from app.services.instance import email_service_instance
            subject = f"签证预约提醒 - {country}/{city} 有新的预约slot"
            # 构建简单文本内容
            slot_lines = "\n".join([f"{slot['date']} {slot['time']}" for slot in available_slots])
            message = (
                f"签证预约监控提醒\n"
                f"国家: {country}\n"
                f"城市: {city}\n"
                f"签证类型: {visa_type or '未指定'}\n"
                f"可预约时间:\n{slot_lines}\n"
                f"请尽快前往预约系统进行预约。"
            )
            await email_service_instance.send_email(
                recipient_email=email,
                subject=subject,
                message=message,
                html_message=None  # 可扩展为html模板
            )
            print(f"[SlotMonitor] 邮件已发送: {email}")
            return True
        except Exception as e:
            print(f"[SlotMonitor] 邮件发送失败: {e}")
            traceback.print_exc()
            return False

    # 可扩展：微信/短信通知等
# End of class

