#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
材料审核系统配置文件
"""

import os
from typing import Optional


class Config:
    """配置类"""

    # 腾讯云 OCR 配置
    TENCENTCLOUD_SECRET_ID: Optional[str] = os.getenv("TENCENTCLOUD_SECRET_ID")
    TENCENTCLOUD_SECRET_KEY: Optional[str] = os.getenv("TENCENTCLOUD_SECRET_KEY")
    TENCENTCLOUD_REGION: str = "ap-guangzhou"

    # DeepSeek API 配置
    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "")
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com/v1/chat/completions"

    # 服务配置
    HOST: str = "0.0.0.0"
    PORT: int = 8003

    # 文件处理配置
    MAX_FILE_SIZE: int = 10 * 1024 * 1024
    ALLOWED_EXTENSIONS: list = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"]
    TEMP_DIR: str = "temp"

    @classmethod
    def load_from_env(cls):
        """从环境变量加载配置"""
        env_secret_id = os.getenv("TENCENTCLOUD_SECRET_ID")
        env_secret_key = os.getenv("TENCENTCLOUD_SECRET_KEY")

        if env_secret_id and env_secret_key:
            cls.TENCENTCLOUD_SECRET_ID = env_secret_id
            cls.TENCENTCLOUD_SECRET_KEY = env_secret_key
            print(f"使用环境变量中的密钥: {env_secret_id[:10]}...")
        elif cls.TENCENTCLOUD_SECRET_ID:
            print(f"使用配置中的密钥: {cls.TENCENTCLOUD_SECRET_ID[:10]}...")
        else:
            print("未配置 TENCENTCLOUD_SECRET_ID / TENCENTCLOUD_SECRET_KEY")

        if not cls.TENCENTCLOUD_SECRET_ID or not cls.TENCENTCLOUD_SECRET_KEY:
            cls.load_from_file()

    @classmethod
    def load_from_file(cls):
        """从配置文件加载"""
        config_file = os.path.join(os.path.dirname(__file__), "tencent_config.json")
        if os.path.exists(config_file):
            try:
                import json

                with open(config_file, "r", encoding="utf-8") as f:
                    config_data = json.load(f)
                    cls.TENCENTCLOUD_SECRET_ID = config_data.get("secret_id")
                    cls.TENCENTCLOUD_SECRET_KEY = config_data.get("secret_key")
            except Exception as e:
                print(f"读取配置文件失败: {e}")

    @classmethod
    def save_to_file(cls, secret_id: str, secret_key: str):
        """保存配置到文件"""
        import json

        config_file = os.path.join(os.path.dirname(__file__), "tencent_config.json")
        config_data = {
            "secret_id": secret_id,
            "secret_key": secret_key,
        }
        try:
            with open(config_file, "w", encoding="utf-8") as f:
                json.dump(config_data, f, ensure_ascii=False, indent=2)
            print("Tencent 云配置已保存到 tencent_config.json")
        except Exception as e:
            print(f"保存配置失败: {e}")

    @classmethod
    def is_tencent_configured(cls) -> bool:
        """检查腾讯云是否已配置"""
        return bool(cls.TENCENTCLOUD_SECRET_ID and cls.TENCENTCLOUD_SECRET_KEY)


Config.load_from_env()
