# email_config_example.py
"""
邮件配置示例 - 163邮箱配置
"""

# 163邮箱配置（基于你之前使用的配置）
EMAIL_CONFIG = {
    "smtp_server": "smtp.163.com",
    "smtp_port": 465,  # 163邮箱SSL端口
    "sender_email": "19857174374@163.com",  # 你的163邮箱
    "sender_password": "FTn7LTc27jfmi2rv",  # 163邮箱授权码
    "recipient_email": "yidianmeile@gmail.com"  # 收件人邮箱
}

"""
163邮箱设置说明：

1. 登录163邮箱网页版
2. 设置 -> POP3/SMTP/IMAP
3. 开启SMTP服务
4. 获取授权码（不是登录密码）
5. 将上面的配置复制到 main.py 中替换 EMAIL_CONFIG

注意：
- 使用授权码，不是登录密码
- 端口使用465（SSL）或587（STARTTLS）
- 确保网络环境允许SMTP连接
- 这是你之前成功使用的配置
"""
