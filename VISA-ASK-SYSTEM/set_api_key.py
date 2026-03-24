"""
设置DeepSeek API密钥
"""

import os
import sys

def set_api_key(api_key: str):
    """设置API密钥到.env文件"""
    env_file = ".env"
    
    # 读取现有的.env文件内容
    env_content = {}
    if os.path.exists(env_file):
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_content[key.strip()] = value.strip()
    
    # 更新API密钥
    env_content['DEEPSEEK_API_KEY'] = api_key
    
    # 写回.env文件
    with open(env_file, 'w', encoding='utf-8') as f:
        f.write("# DeepSeek API密钥\n")
        for key, value in env_content.items():
            f.write(f"{key}={value}\n")
    
    print(f"✓ API密钥已保存到 {env_file}")
    
    # 同时设置环境变量（当前会话）
    os.environ['DEEPSEEK_API_KEY'] = api_key
    print("✓ 环境变量已设置")

def main():
    """主函数"""
    if len(sys.argv) < 2:
        print("使用方法：python set_api_key.py YOUR_API_KEY")
        
        # 交互式输入
        api_key = input("\n请输入你的DeepSeek API密钥: ").strip()
        if not api_key:
            print("错误：API密钥不能为空")
            sys.exit(1)
    else:
        api_key = sys.argv[1]
    
    # 验证API密钥格式
    if not api_key.startswith('sk-'):
        print("警告：API密钥通常以'sk-'开头，请确认密钥是否正确")
    
    # 设置API密钥
    set_api_key(api_key)
    
    print("\n下一步：")
    print("1. 运行 python create_sample_data.py 创建示例FAQ数据")
    print("2. 运行 python main_chat.py 启动命令行聊天")
    print("3. 运行 python main_api.py 启动API服务")

if __name__ == "__main__":
    main() 