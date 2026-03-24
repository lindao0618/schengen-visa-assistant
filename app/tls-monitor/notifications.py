import smtplib
import logging
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, List
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class NotificationManager:
    """通知管理器"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.notifications_config = config.get('notifications', {})
        self.email_enabled = self.notifications_config.get('enable_email', False)
        self.email_config = self.notifications_config.get('email_config', {})
        
        # 从前端API获取用户邮箱配置
        self.user_notifications = {}
        
        # 邮件发送频率控制
        self.last_email_time = None
        self.email_cooldown = 300  # 5分钟冷却时间
        self.sent_slots_cache = set()  # 已发送的slot缓存，避免重复发送
        self.email_stats = {
            'total_sent': 0,
            'last_sent_time': None,
            'failed_attempts': 0
        }
        
    def set_user_notifications(self, notifications: Dict[str, Any]):
        """设置用户通知配置（从前端API接收）"""
        self.user_notifications = notifications
        logger.info(f"📧 [邮件配置] 用户通知设置: {notifications}")
    
    async def send_slot_notification(self, slots: List[Dict[str, Any]], source: str = "TLS Monitor"):
        """发送slot匹配通知（带频率控制和去重）"""
        if not slots:
            return
        
        # 🚀 [用户要求] 移除冷却时间和去重限制，检测到就立即发送
        current_time = datetime.now()
        logger.info(f"📨 [通知] 准备发送 {len(slots)} 个匹配slot的邮件通知（无冷却限制）")
        
        # 发送邮件通知
        if self.email_enabled or self.user_notifications.get('email'):
            await self._send_email_notification(slots, source)
        
        # TODO: 实现短信通知
        if self.user_notifications.get('sms'):
            logger.info(f"📱 [短信通知] 暂未实现，目标号码: {self.user_notifications.get('sms')}")
    
    async def _send_email_notification(self, slots: List[Dict[str, Any]], source: str):
        """发送邮件通知"""
        try:
            # 确定收件人邮箱
            to_email = self.user_notifications.get('email') or self.email_config.get('to_email')
            if not to_email:
                logger.warning("📧 [邮件] 未配置收件人邮箱，跳过邮件发送")
                return
            
            # 确定发件人配置
            smtp_server = self.email_config.get('smtp_server', 'smtp.gmail.com')
            smtp_port = self.email_config.get('smtp_port', 587)
            username = self.email_config.get('username')
            password = self.email_config.get('password')
            
            if not username or not password:
                logger.warning("📧 [邮件] 未配置SMTP用户名或密码，使用测试模式")
                await self._send_test_email_notification(slots, to_email)
                return
            
            # 创建邮件内容
            subject = f"🎯 TLS签证预约匹配通知 - 发现 {len(slots)} 个可用时段"
            body = self._create_email_body(slots, source)
            
            # 创建邮件
            msg = MIMEMultipart()
            msg['From'] = username
            msg['To'] = to_email
            msg['Subject'] = subject
            
            msg.attach(MIMEText(body, 'html', 'utf-8'))
            
            # 发送邮件
            logger.info(f"📧 [邮件] 连接SMTP服务器: {smtp_server}:{smtp_port}")
            
            # 根据端口选择连接方式
            if smtp_port == 465:
                # SSL连接
                logger.info(f"🔒 [邮件] 使用SSL连接 (端口465)")
                with smtplib.SMTP_SSL(smtp_server, smtp_port, timeout=30) as server:
                    logger.info(f"🔐 [邮件] 开始登录验证")
                    server.login(username, password)
                    logger.info(f"📤 [邮件] 发送邮件中...")
                    server.send_message(msg)
            else:
                # STARTTLS连接
                logger.info(f"🔓 [邮件] 使用STARTTLS连接 (端口{smtp_port})")
                with smtplib.SMTP(smtp_server, smtp_port, timeout=30) as server:
                    server.starttls()
                    logger.info(f"🔐 [邮件] 开始登录验证")
                    server.login(username, password)
                    logger.info(f"📤 [邮件] 发送邮件中...")
                    server.send_message(msg)
            
            logger.info(f"✅ [邮件] 成功发送通知到: {to_email}")
            
            # 更新发送统计
            self.last_email_time = datetime.now()
            self.email_stats['total_sent'] += 1
            self.email_stats['last_sent_time'] = self.last_email_time.isoformat()
            
        except Exception as e:
            logger.error(f"❌ [邮件] 发送失败: {e}")
            self.email_stats['failed_attempts'] += 1
            # 降级到测试模式
            await self._send_test_email_notification(slots, to_email)
    
    async def _send_test_email_notification(self, slots: List[Dict[str, Any]], to_email: str):
        """测试模式邮件通知（仅记录日志）"""
        logger.info("📧 [邮件测试] 进入测试模式，仅记录邮件内容")
        
        subject = f"🎯 TLS签证预约匹配通知 - 发现 {len(slots)} 个可用时段"
        body = self._create_email_body(slots, "TLS Monitor (测试模式)")
        
        logger.info(f"📧 [邮件测试] 收件人: {to_email}")
        logger.info(f"📧 [邮件测试] 主题: {subject}")
        logger.info(f"📧 [邮件测试] 内容预览: {body[:500]}...")
        
        # 模拟发送成功
        logger.info("✅ [邮件测试] 测试模式邮件通知完成")
    
    def _create_email_body(self, slots: List[Dict[str, Any]], source: str) -> str:
        """创建邮件正文"""
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        html_body = f"""
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .header {{ background: #4CAF50; color: white; padding: 20px; text-align: center; }}
                .content {{ padding: 20px; }}
                .slot {{ border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }}
                .slot-header {{ font-weight: bold; color: #2196F3; }}
                .datetime {{ color: #FF5722; font-weight: bold; }}
                .footer {{ background: #f5f5f5; padding: 10px; text-align: center; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🎯 TLS签证预约匹配通知</h1>
                <p>发现 {len(slots)} 个符合您条件的可用时段</p>
            </div>
            
            <div class="content">
                <p><strong>通知时间:</strong> {current_time}</p>
                <p><strong>数据源:</strong> {source}</p>
                <p><strong>匹配数量:</strong> {len(slots)} 个时段</p>
                
                <h2>📅 可用时段详情：</h2>
        """
        
        for i, slot in enumerate(slots, 1):
            # 获取所有可用时间段
            datetimes = slot.get('datetimes', [])
            
            # 格式化时间段列表
            datetime_list = []
            display_datetimes = datetimes[:10]  # 最多显示前10个
            
            for dt in display_datetimes:
                date_str = dt.get('date', 'N/A')
                time_str = dt.get('time', 'N/A')
                datetime_list.append(f"{date_str} {time_str}")
            
            # 构建时间段显示字符串
            datetime_display = "<br>".join([f"• {dt}" for dt in datetime_list])
            
            # 如果超过10个时间段，添加提示
            truncated_notice = ""
            if len(datetimes) > 10:
                truncated_notice = f"<p style='color: #ff6b35; font-style: italic; margin-top: 10px;'>⚠️ 共有 {len(datetimes)} 个时间段，仅显示前10个</p>"
            
            html_body += f"""
                <div class="slot">
                    <div class="slot-header">时段 {i}</div>
                    <p><strong>🌍 申请地:</strong> {slot.get('application_country', 'N/A')} {slot.get('application_city', 'N/A')}</p>
                    <p><strong>🎯 签证国:</strong> {slot.get('visa_country', 'N/A').upper()}</p>
                    <p><strong>🛂 签证类型:</strong> {slot.get('visa_type', 'N/A')}</p>
                    <p><strong>✈️ 旅行目的:</strong> {slot.get('travel_purpose', 'N/A')}</p>
                    <p><strong>📋 预约类型:</strong> {slot.get('appointment_type', 'N/A')}</p>
                    <div style="margin-top: 15px;">
                        <p><strong>📅 可用时间段:</strong></p>
                        <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; margin-top: 5px;">
                            {datetime_display}
                        </div>
                        {truncated_notice}
                    </div>
                </div>
            """
        
        html_body += f"""
            </div>
            
            <div class="footer">
                <p>此邮件由TLS签证监控系统自动发送</p>
                <p>如需停止监控，请登录系统进行设置</p>
            </div>
        </body>
        </html>
        """
        
        return html_body
    
    def _generate_slot_id(self, slot: Dict[str, Any]) -> str:
        """生成slot的唯一ID用于去重"""
        # 使用关键字段生成唯一ID
        country = slot.get('application_country', '')
        city = slot.get('application_city', '')
        visa_country = slot.get('visa_country', '')
        
        # 获取第一个时间段作为标识
        datetimes = slot.get('datetimes', [])
        if datetimes:
            first_datetime = datetimes[0]
            date_str = first_datetime.get('date', '')
            time_str = first_datetime.get('time', '')
        else:
            date_str = ''
            time_str = ''
        
        # 生成唯一ID
        slot_id = f"{country}_{city}_{visa_country}_{date_str}_{time_str}"
        return slot_id
    
    def get_email_stats(self) -> Dict[str, Any]:
        """获取邮件发送统计信息"""
        return {
            "total_sent": self.email_sent_count,
            "total_failed": self.email_failed_count,
            "last_sent_time": self.last_email_time.isoformat() if self.last_email_time else None,
            "sent_slots_count": len(self.sent_slots_cache),
            "cooldown_seconds": self.email_cooldown,
            "is_in_cooldown": self._is_in_cooldown(),
            "next_available_time": self._get_next_available_time()
        }
    
    def _is_in_cooldown(self) -> bool:
        """检查是否在冷却期内"""
        if not self.last_email_time:
            return False
        current_time = datetime.now()
        return (current_time - self.last_email_time).total_seconds() < self.email_cooldown
    
    def _get_next_available_time(self) -> str:
        """获取下次可发送邮件的时间"""
        if not self.last_email_time:
            return "立即可用"
        current_time = datetime.now()
        elapsed = (current_time - self.last_email_time).total_seconds()
        if elapsed >= self.email_cooldown:
            return "立即可用"
        remaining = self.email_cooldown - elapsed
        return f"{int(remaining)}秒后可用"
    
    def _get_cooldown_remaining(self) -> int:
        """获取剩余冷却时间（秒）"""
        if not self.last_email_time:
            return 0
        
        elapsed = (datetime.now() - self.last_email_time).total_seconds()
        remaining = max(0, self.email_cooldown - elapsed)
        return int(remaining)
