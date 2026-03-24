"""
RAG检索引擎
使用向量相似度搜索来检索最相关的FAQ条目
"""

import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any, Optional
import logging
import pickle
import os
import torch

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 设置环境变量以限制 CUDA 设备内存使用
os.environ['CUDA_VISIBLE_DEVICES'] = ''  # 禁用 GPU
os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'max_split_size_mb:512'

class RAGEngine:
    """RAG检索增强生成引擎"""
    
    def __init__(self, 
                 model_name: str = "BAAI/bge-m3",
                 index_file: str = "faq_index.faiss",
                 embeddings_file: str = "faq_embeddings.pkl"):
        """
        初始化RAG引擎
        
        Args:
            model_name: 句子嵌入模型名称
            index_file: FAISS索引文件路径
            embeddings_file: 嵌入向量文件路径
        """
        self.model_name = model_name
        self.index_file = index_file
        self.embeddings_file = embeddings_file
        
        # 设置模型加载配置
        device = "cpu"  # 强制使用 CPU
        torch.set_num_threads(4)  # 限制线程数
        
        self.model = SentenceTransformer(model_name, device=device)
        self.model.max_seq_length = 256  # 限制序列长度
        
        # 清理缓存
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        self.faiss_index = None
        self.faq_data = []
        self.embeddings = None
        
        # 尝试加载已有的索引
        self.load_index()
    
    def encode_texts(self, texts: List[str]) -> np.ndarray:
        """
        将文本编码为向量
        
        Args:
            texts: 文本列表
            
        Returns:
            嵌入向量数组
        """
        try:
            embeddings = self.model.encode(texts, convert_to_numpy=True)
            return embeddings.astype('float32')
        except Exception as e:
            logger.error(f"文本编码失败: {e}")
            raise
    
    def build_index(self, embeddings: np.ndarray):
        """
        构建FAISS索引
        
        Args:
            embeddings: 嵌入向量数组
        """
        try:
            dimension = embeddings.shape[1]
            
            # 使用内积索引（适合归一化向量）
            self.faiss_index = faiss.IndexFlatIP(dimension)
            
            # 归一化向量
            faiss.normalize_L2(embeddings)
            
            # 添加向量到索引
            self.faiss_index.add(embeddings)
            
            logger.info(f"成功构建FAISS索引，包含{self.faiss_index.ntotal}个向量")
            
        except Exception as e:
            logger.error(f"构建FAISS索引失败: {e}")
            raise
    
    def index_faqs(self, faq_data: List[Dict[str, Any]]):
        """
        为FAQ数据建立索引
        
        Args:
            faq_data: FAQ数据列表
        """
        if not faq_data:
            logger.warning("FAQ数据为空，跳过索引构建")
            return
        
        try:
            logger.info(f"开始为{len(faq_data)}条FAQ数据建立索引")
            
            # 保存FAQ数据
            self.faq_data = faq_data
            
            # 提取问题文本
            questions = [item["question"] for item in faq_data]
            
            # 编码问题
            logger.info("正在编码问题文本...")
            self.embeddings = self.encode_texts(questions)
            
            # 构建索引
            logger.info("正在构建FAISS索引...")
            self.build_index(self.embeddings)
            
            # 保存索引和嵌入向量
            self.save_index()
            
            logger.info("FAQ索引构建完成")
            
        except Exception as e:
            logger.error(f"FAQ索引构建失败: {e}")
            raise
    
    def search(self, query: str, top_k: int = 5, threshold: float = 0.3) -> List[Dict[str, Any]]:
        """
        搜索相关的FAQ条目
        
        Args:
            query: 查询问题
            top_k: 返回结果数量
            threshold: 相似度阈值
            
        Returns:
            相关FAQ条目列表
        """
        if not self.faiss_index or not self.faq_data:
            logger.warning("索引未构建或FAQ数据为空")
            return []
        
        try:
            # 编码查询
            query_embedding = self.encode_texts([query])
            faiss.normalize_L2(query_embedding)
            
            # 搜索
            scores, indices = self.faiss_index.search(query_embedding, top_k)
            
            # 构建结果
            results = []
            for i, (score, idx) in enumerate(zip(scores[0], indices[0])):
                if score >= threshold:  # 过滤低相似度结果
                    result = self.faq_data[idx].copy()
                    result["similarity"] = float(score)
                    result["rank"] = i + 1
                    results.append(result)
            
            logger.info(f"搜索查询'{query}'，返回{len(results)}个结果")
            return results
            
        except Exception as e:
            logger.error(f"搜索失败: {e}")
            return []
    
    def get_context_from_results(self, results: List[Dict[str, Any]], max_length: int = 1000) -> str:
        """
        从搜索结果构建上下文
        
        Args:
            results: 搜索结果
            max_length: 最大上下文长度
            
        Returns:
            上下文字符串
        """
        if not results:
            return ""
        
        context_parts = []
        current_length = 0
        
        for i, result in enumerate(results):
            question = result["question"]
            answer = result["answer"]
            similarity = result.get("similarity", 0)
            
            part = f"相关问题{i+1}（相似度：{similarity:.2f}）：\n问：{question}\n答：{answer}\n"
            
            if current_length + len(part) > max_length:
                break
            
            context_parts.append(part)
            current_length += len(part)
        
        return "\n".join(context_parts)
    
    def save_index(self):
        """保存索引和嵌入向量"""
        try:
            if self.faiss_index:
                faiss.write_index(self.faiss_index, self.index_file)
                logger.info(f"FAISS索引已保存到: {self.index_file}")
            
            if self.embeddings is not None and self.faq_data:
                with open(self.embeddings_file, 'wb') as f:
                    pickle.dump({
                        'embeddings': self.embeddings,
                        'faq_data': self.faq_data
                    }, f)
                logger.info(f"嵌入向量已保存到: {self.embeddings_file}")
                
        except Exception as e:
            logger.error(f"保存索引失败: {e}")
    
    def load_index(self):
        """加载已有的索引和嵌入向量"""
        try:
            # 加载FAISS索引
            if os.path.exists(self.index_file):
                self.faiss_index = faiss.read_index(self.index_file)
                logger.info(f"已加载FAISS索引: {self.index_file}")
            
            # 加载嵌入向量和FAQ数据
            if os.path.exists(self.embeddings_file):
                with open(self.embeddings_file, 'rb') as f:
                    data = pickle.load(f)
                    self.embeddings = data['embeddings']
                    self.faq_data = data['faq_data']
                logger.info(f"已加载嵌入向量和FAQ数据: {self.embeddings_file}")
                
        except Exception as e:
            logger.warning(f"加载索引失败: {e}")
    
    def update_faq(self, new_faq_data: List[Dict[str, Any]]):
        """
        更新FAQ数据并重建索引
        
        Args:
            new_faq_data: 新的FAQ数据
        """
        logger.info("正在更新FAQ数据...")
        self.index_faqs(new_faq_data)
    
    def get_similar_questions(self, question: str, top_k: int = 3) -> List[str]:
        """
        获取相似问题
        
        Args:
            question: 输入问题
            top_k: 返回数量
            
        Returns:
            相似问题列表
        """
        results = self.search(question, top_k=top_k, threshold=0.5)
        return [result["question"] for result in results]
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        获取索引统计信息
        
        Returns:
            统计信息字典
        """
        stats = {
            "total_faqs": len(self.faq_data),
            "index_size": self.faiss_index.ntotal if self.faiss_index else 0,
            "embedding_dimension": self.embeddings.shape[1] if self.embeddings is not None else 0,
            "model_name": self.model_name,
            "index_file_exists": os.path.exists(self.index_file),
            "embeddings_file_exists": os.path.exists(self.embeddings_file)
        }
        
        # 统计类别
        if self.faq_data:
            categories = {}
            for item in self.faq_data:
                category = item.get("category", "未分类")
                categories[category] = categories.get(category, 0) + 1
            stats["categories"] = categories
        
        return stats
    
    def clear_index(self):
        """清除索引和数据"""
        self.faiss_index = None
        self.faq_data = []
        self.embeddings = None
        
        # 删除文件
        for file_path in [self.index_file, self.embeddings_file]:
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"已删除文件: {file_path}")
        
        logger.info("索引和数据已清除")

def test_rag_engine():
    """测试RAG引擎"""
    # 创建测试数据
    test_faqs = [
        {
            "question": "英国学生签证需要什么材料？",
            "answer": "需要护照、CAS、资金证明等材料。",
            "category": "英国签证"
        },
        {
            "question": "美国F1签证面试技巧有哪些？",
            "answer": "要诚实回答，准备充分，表现自信。",
            "category": "美国签证"
        },
        {
            "question": "申根签证可以去哪些国家？",
            "answer": "可以去26个申根国家。",
            "category": "申根签证"
        }
    ]
    
    # 初始化引擎
    engine = RAGEngine()
    
    # 建立索引
    engine.index_faqs(test_faqs)
    
    # 测试搜索
    results = engine.search("英国签证材料", top_k=2)
    print(f"搜索结果: {results}")
    
    # 获取统计信息
    stats = engine.get_statistics()
    print(f"统计信息: {stats}")

if __name__ == "__main__":
    test_rag_engine() 