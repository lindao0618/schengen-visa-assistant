"""
命令行交互式聊天程序
用于测试签证问答系统
"""

import os
import sys
from utils import DeepSeekChat, ExcelFAQLoader, RAGEngine
from typing import Optional

# 系统提示词
SYSTEM_PROMPT = """你是一位专业的留学签证顾问，专门帮助留学生解答各种签证申请相关的问题。

你的专业领域包括：
1. 英国留学签证（Tier 4/Student Visa）
2. 美国留学签证（F-1/J-1）
3. 申根区留学签证
4. 法国留学签证
5. 其他主要留学目的地签证

请根据用户的问题，提供准确、专业、实用的签证申请建议。如果有相关的FAQ信息，请优先参考。
回答时请注意：
- 提供具体、可操作的建议
- 说明重要的注意事项
- 必要时提醒可能的风险或常见错误
- 保持友好和专业的语气"""

class VisaChatbot:
    """签证问答聊天机器人"""
    
    def __init__(self, faq_file: Optional[str] = None):
        """
        初始化聊天机器人
        
        Args:
            faq_file: FAQ Excel文件路径
        """
        print("正在初始化签证问答系统...")
        
        # 初始化DeepSeek客户端
        try:
            self.chat_client = DeepSeekChat()
            print("✓ DeepSeek API 连接成功")
        except Exception as e:
            print(f"✗ DeepSeek API 连接失败: {e}")
            sys.exit(1)
        
        # 初始化RAG引擎
        self.rag_engine = None
        if faq_file and os.path.exists(faq_file):
            try:
                print(f"正在加载FAQ数据: {faq_file}")
                loader = ExcelFAQLoader(faq_file)
                faqs = loader.load()
                
                self.rag_engine = RAGEngine()
                self.rag_engine.index_faqs(faqs)
                print(f"✓ 成功加载 {len(faqs)} 条FAQ记录")
            except Exception as e:
                print(f"✗ FAQ加载失败: {e}")
                print("  将继续运行，但不使用RAG功能")
        else:
            print("! 未指定FAQ文件或文件不存在，RAG功能已禁用")
        
        print("\n系统初始化完成！\n")
    
    def chat(self, question: str) -> str:
        """
        处理用户问题并返回回答
        
        Args:
            question: 用户问题
            
        Returns:
            AI生成的回答
        """
        # 使用RAG检索相关FAQ
        context = ""
        if self.rag_engine:
            try:
                results = self.rag_engine.search(question, top_k=3)
                if results:
                    context = self.rag_engine.get_context_from_results(results)
                    print(f"\n找到 {len(results)} 条相关FAQ")
            except Exception as e:
                print(f"RAG检索出错: {e}")
        
        # 生成回答
        answer = self.chat_client.generate_answer(
            question=question,
            context=context,
            system_prompt=SYSTEM_PROMPT
        )
        
        return answer
    
    def run_interactive(self):
        """运行交互式聊天会话"""
        print("="*50)
        print("欢迎使用留学生签证AI问答系统！")
        print("="*50)
        print("\n我是您的签证顾问助手，可以帮您解答：")
        print("- 英国、美国、申根、法国等国家的留学签证问题")
        print("- 签证申请材料准备")
        print("- 签证申请流程和注意事项")
        print("- 签证面试技巧等")
        print("\n输入 'exit' 或 'quit' 退出程序")
        print("输入 'clear' 清屏")
        print("-"*50)
        
        while True:
            try:
                # 获取用户输入
                question = input("\n您的问题: ").strip()
                
                # 处理特殊命令
                if question.lower() in ['exit', 'quit', '退出']:
                    print("\n感谢使用！祝您签证申请顺利！")
                    break
                elif question.lower() == 'clear':
                    os.system('cls' if os.name == 'nt' else 'clear')
                    continue
                elif not question:
                    print("请输入您的问题。")
                    continue
                
                # 显示思考中的提示
                print("\n正在思考回答...\n")
                
                # 获取回答
                answer = self.chat(question)
                
                # 显示回答
                print("回答:")
                print("-"*50)
                print(answer)
                print("-"*50)
                
                # 提取并显示相关话题
                try:
                    topics = self.chat_client.extract_topics(answer, max_topics=3)
                    if topics:
                        print("\n相关话题：", " | ".join(topics))
                except:
                    pass
                
            except KeyboardInterrupt:
                print("\n\n程序被中断。")
                break
            except Exception as e:
                print(f"\n出现错误: {e}")
                print("请重试或输入其他问题。")

def main():
    """主函数"""
    # 检查FAQ文件
    faq_file = "visa_faq_sample.xlsx"
    if not os.path.exists(faq_file):
        print(f"FAQ文件 {faq_file} 不存在。")
        print("您可以：")
        print("1. 运行 python create_sample_data.py 创建示例FAQ")
        print("2. 继续运行（不使用RAG功能）")
        
        choice = input("\n是否继续运行？(y/n): ").lower()
        if choice != 'y':
            return
        faq_file = None
    
    # 创建聊天机器人
    chatbot = VisaChatbot(faq_file)
    
    # 运行交互式会话
    chatbot.run_interactive()

if __name__ == "__main__":
    main() 