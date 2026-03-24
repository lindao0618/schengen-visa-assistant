#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
腾讯云OCR环境变量设置脚本
使用前请确保设置正确的腾讯云API密钥
"""

import os

def setup_environment():
    """设置腾讯云OCR所需的环境变量"""
    
    print("=== 腾讯云OCR环境设置 ===")
    print()
    print("请输入您的腾讯云API密钥信息：")
    print("(可以在腾讯云控制台 https://console.cloud.tencent.com/cam/capi 获取)")
    print()
    
    # 获取用户输入
    secret_id = input("请输入 SecretId: ").strip()
    secret_key = input("请输入 SecretKey: ").strip()
    
    if not secret_id or not secret_key:
        print("错误：SecretId 和 SecretKey 不能为空！")
        return False
    
    # 设置环境变量
    os.environ["TENCENTCLOUD_SECRET_ID"] = secret_id
    os.environ["TENCENTCLOUD_SECRET_KEY"] = secret_key
    
    print()
    print("✅ 环境变量设置成功！")
    print(f"TENCENTCLOUD_SECRET_ID = {secret_id[:8]}...")
    print(f"TENCENTCLOUD_SECRET_KEY = {secret_key[:8]}...")
    print()
    print("注意：这些环境变量仅在当前会话中有效。")
    print("如需永久设置，请将它们添加到系统环境变量中。")
    
    return True

def check_environment():
    """检查环境变量是否已设置"""
    secret_id = os.getenv("TENCENTCLOUD_SECRET_ID")
    secret_key = os.getenv("TENCENTCLOUD_SECRET_KEY")
    
    if secret_id and secret_key:
        print("✅ 腾讯云环境变量已设置")
        print(f"TENCENTCLOUD_SECRET_ID = {secret_id[:8]}...")
        print(f"TENCENTCLOUD_SECRET_KEY = {secret_key[:8]}...")
        return True
    else:
        print("❌ 腾讯云环境变量未设置")
        return False

if __name__ == "__main__":
    print("检查当前环境变量状态...")
    if not check_environment():
        print("\n需要设置腾讯云API密钥...")
        setup_environment()
    else:
        print("\n环境变量已设置，无需重新配置。")