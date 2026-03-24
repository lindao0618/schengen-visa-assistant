#!/usr/bin/env python3
"""
留学生签证AI问答系统测试脚本
"""

import os
import sys
import asyncio
from dotenv import load_dotenv

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from utils import DeepSeekChat, ExcelFAQLoader, RAGEngine

def test_deepseek_api():
    """测试DeepSeek API连接"""
    print("🧪 测试DeepSeek API连接...")
    
    try:
        client = DeepSeekChat()
        if client.test_connection():
            print("✅ DeepSeek API连接成功")
            return True
        else:
            print("❌ DeepSeek API连接失败")
            return False
    except Exception as e:
        print(f"❌ DeepSeek API测试失败: {e}")
        return False

def test_excel_loader():
    """测试Excel加载器"""
    print("\n📊 测试Excel FAQ加载器...")
    
    try:
        # 检查示例文件是否存在
        sample_file = "visa_faq_sample.xlsx"
        if not os.path.exists(sample_file):
            print("📝 创建示例Excel文件...")
            from utils.excel_loader import create_sample_excel
            create_sample_excel(sample_file)
        
        # 加载数据
        loader = ExcelFAQLoader(sample_file)
        data = loader.load()
        
        print(f"✅ 成功加载{len(data)}条FAQ数据")
        print(f"📂 类别: {loader.get_categories()}")
        
        # 验证数据质量
        validation = loader.validate_data()
        if validation["valid"]:
            print("✅ 数据质量验证通过")
        else:
            print(f"⚠️ 数据质量问题: {validation['issues']}")
        
        return data
        
    except Exception as e:
        print(f"❌ Excel加载器测试失败: {e}")
        return None

def test_rag_engine(faq_data):
    """测试RAG检索引擎"""
    print("\n🔍 测试RAG检索引擎...")
    
    try:
        # 初始化RAG引擎
        engine = RAGEngine()
        
        # 建立索引
        print("🏗️ 建立FAQ索引...")
        engine.index_faqs(faq_data)
        
        # 测试搜索
        test_queries = [
            "英国签证需要什么材料",
            "美国面试技巧",
            "申根签证国家",
            "签证被拒怎么办"
        ]
        
        for query in test_queries:
            print(f"\n🔎 搜索: '{query}'")
            results = engine.search(query, top_k=2)
            
            if results:
                for i, result in enumerate(results):
                    print(f"  {i+1}. {result['question']} (相似度: {result['similarity']:.3f})")
            else:
                print("  未找到相关结果")
        
        # 获取统计信息
        stats = engine.get_statistics()
        print(f"\n📈 索引统计: {stats['total_faqs']}条FAQ, {stats['embedding_dimension']}维向量")
        
        print("✅ RAG引擎测试成功")
        return True
        
    except Exception as e:
        print(f"❌ RAG引擎测试失败: {e}")
        return False

def test_integration():
    """测试系统集成"""
    print("\n🔗 测试系统集成...")
    
    try:
        # 初始化组件
        chat_client = DeepSeekChat()
        
        # 加载FAQ数据
        sample_file = "visa_faq_sample.xlsx"
        if os.path.exists(sample_file):
            loader = ExcelFAQLoader(sample_file)
            faq_data = loader.load()
            
            # 初始化RAG引擎
            rag_engine = RAGEngine()
            rag_engine.index_faqs(faq_data)
            
            # 测试完整问答流程
            test_question = "英国学生签证需要准备哪些材料？"
            print(f"❓ 测试问题: {test_question}")
            
            # RAG检索
            results = rag_engine.search(test_question, top_k=3)
            context = rag_engine.get_context_from_results(results)
            
            # 生成回答
            answer = chat_client.generate_answer(
                question=test_question,
                context=context
            )
            
            print(f"🤖 AI回答: {answer[:200]}...")
            
            # 提取相关话题
            topics = chat_client.extract_topics(answer)
            print(f"🏷️ 相关话题: {topics}")
            
            print("✅ 系统集成测试成功")
            return True
        else:
            print("❌ 未找到FAQ数据文件")
            return False
            
    except Exception as e:
        print(f"❌ 系统集成测试失败: {e}")
        return False

def main():
    """主测试函数"""
    print("🧪 留学生签证AI问答系统测试")
    print("=" * 50)
    
    # 加载环境变量
    load_dotenv()
    
    # 检查API密钥
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        print("❌ 错误：未设置DEEPSEEK_API_KEY环境变量")
        print("请先运行 python set_api_key.py 设置API密钥")
        return False
    
    test_results = []
    
    # 1. 测试DeepSeek API
    test_results.append(test_deepseek_api())
    
    # 2. 测试Excel加载器
    faq_data = test_excel_loader()
    test_results.append(faq_data is not None)
    
    # 3. 测试RAG引擎
    if faq_data:
        test_results.append(test_rag_engine(faq_data))
    else:
        test_results.append(False)
    
    # 4. 测试系统集成
    test_results.append(test_integration())
    
    # 总结测试结果
    print("\n" + "=" * 50)
    print("📊 测试结果总结:")
    
    test_names = [
        "DeepSeek API连接",
        "Excel FAQ加载器",
        "RAG检索引擎",
        "系统集成"
    ]
    
    for name, result in zip(test_names, test_results):
        status = "✅ 通过" if result else "❌ 失败"
        print(f"  {name}: {status}")
    
    success_count = sum(test_results)
    total_count = len(test_results)
    
    print(f"\n🎯 测试通过率: {success_count}/{total_count} ({success_count/total_count*100:.1f}%)")
    
    if success_count == total_count:
        print("🎉 所有测试通过！系统可以正常使用。")
        print("💡 运行 python start_server.py 启动API服务器")
        print("💡 运行 python main_chat.py 启动命令行聊天")
        return True
    else:
        print("⚠️ 部分测试失败，请检查配置和依赖。")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 