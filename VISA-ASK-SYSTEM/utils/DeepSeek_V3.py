"""
DeepSeek Chat API 封装
专门为留学签证问答系统优化的AI对话接口
"""

import os
import re
import json
import requests
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

class DeepSeekChat:
    """DeepSeek Chat API 客户端"""
    
    def __init__(self, api_key: Optional[str] = None, base_url: str = "https://api.deepseek.com"):
        """
        初始化DeepSeek客户端
        
        Args:
            api_key: API密钥，如果不提供则从环境变量DEEPSEEK_API_KEY获取
            base_url: API基础URL
        """
        self.api_key = api_key or os.getenv("DEEPSEEK_API_KEY")
        if not self.api_key:
            raise ValueError("DeepSeek API密钥未设置。请设置环境变量DEEPSEEK_API_KEY或传入api_key参数")
        
        self.base_url = base_url.rstrip('/')
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        # 签证问答专用配置
        self.default_model = "deepseek-chat"
        self.max_tokens = 2000
        self.temperature = 0.7
        
    def _make_request(self, messages: List[Dict], **kwargs) -> str:
        """
        发送请求到DeepSeek API
        
        Args:
            messages: 对话消息列表
            **kwargs: 其他参数
            
        Returns:
            AI回复内容
        """
        payload = {
            "model": kwargs.get("model", self.default_model),
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", self.max_tokens),
            "temperature": kwargs.get("temperature", self.temperature),
            "stream": False
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/v1/chat/completions",
                headers=self.headers,
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            return result["choices"][0]["message"]["content"]
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"DeepSeek API请求失败: {e}")
        except KeyError as e:
            raise Exception(f"DeepSeek API响应格式错误: {e}")
    
    def generate_answer(self, 
                       question: str, 
                       context: str = "", 
                       system_prompt: str = "",
                       **kwargs) -> str:
        """
        生成签证问题的回答
        
        Args:
            question: 用户问题
            context: RAG检索到的相关上下文
            system_prompt: 系统提示词
            **kwargs: 其他参数
            
        Returns:
            AI生成的回答
        """
        # 默认系统提示词
        default_system = """你是一位专业的签证顾问，擅长解答各类签证问题。

第一步：签证类型确认
- 如果用户没有明确指定签证类型，请先礼貌地询问："请问您想咨询哪种签证呢？比如旅游签证、工作签证、学生签证等？"
- 在用户明确签证类型之前，不要直接回答具体问题
- 如果用户已明确签证类型，再进行下一步回答

你的专业领域包括：
1. 学生签证（如英国Tier 4、美国F-1/J-1等）
2. 旅游签证
3. 商务签证
4. 工作签证
5. 家庭团聚签证
6. 过境签证

回答要求：
1. 信息准确，基于可靠的签证政策
2. 语言简洁明了，易于理解
3. 提供具体的操作步骤
4. 指出重要的注意事项和常见错误
5. 像人一样幽默风趣一些
6. 如涉及具体费用，说明"仅供参考，具体费用请以官方为准"
7. 不要提到具体的年份或时间，使用"当前"、"目前"等词语代替

常见问题解答方向：
- 申请条件（护照有效期、资产证明等）
- 所需材料清单与准备建议
- 预约流程与注意事项
- 常见拒签原因与补救措施
- 特殊情况（签证即将到期、多人同行、在他国递签等）
- 入境规则与落地流程
- 行程规划建议（行程单、机酒订单等）

注意事项：
1. 如涉及具体费用，请注明"仅供参考，具体费用请以官方为准"
2. 不要提到具体的年份或时间，使用"当前"、"目前"等词语代替
3. 保持友好和专业的语气，适当幽默风趣"""
        
        # 构建消息
        messages = []
        
        # 系统消息
        system_content = system_prompt or default_system
        if context:
            system_content += f"\n\n参考信息：\n{context}"
        
        messages.append({
            "role": "system",
            "content": system_content
        })
        
        # 用户问题
        messages.append({
            "role": "user",
            "content": question
        })
        
        return self._make_request(messages, **kwargs)
    
    def generate_answer_stream(self, question: str, context: str = "", system_prompt: str = "", **kwargs):
        messages = []
        default_system = """你是一个专业的签证顾问助手，擅长解答各类签证问题。

第一步：签证类型确认
- 如果用户没有明确指定签证类型，请先礼貌地询问："请问您想咨询哪种签证呢？比如旅游签证、工作签证、学生签证等？"
- 在用户明确签证类型之前，不要直接回答具体问题
- 如果用户已明确签证类型，再进行下一步回答

请基于可靠的签证政策，给出简洁、准确、实用的建议。用户可能关心以下内容：

- 申请条件（护照有效期、资产证明等）
- 所需材料清单与准备建议
- 预约流程与注意事项
- 常见拒签原因与补救措施
- 特殊情况（签证即将到期、多人同行、在他国递签等）
- 入境规则与落地流程
- 行程规划建议（行程单、机酒订单等）

注意事项：
1. 如涉及具体费用，请注明"仅供参考，具体费用请以官方为准"
2. 不要提到具体的年份或时间，使用"当前"、"目前"等词语代替
3. 保持友好和专业的语气，适当幽默风趣"""
        system_content = system_prompt or default_system
        if context:
            system_content += f"\n\n参考信息：\n{context}"
        messages.append({"role": "system", "content": system_content})
        messages.append({"role": "user", "content": question})

        payload = {
            "model": kwargs.get("model", self.default_model),
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", self.max_tokens),
            "temperature": kwargs.get("temperature", self.temperature),
            "stream": True
        }

        response = requests.post(
            f"{self.base_url}/v1/chat/completions",
            headers=self.headers,
            json=payload,
            stream=True,
            timeout=60
        )
        
        for line in response.iter_lines():
            if line:
                # 解码字节流
                line_text = line.decode('utf-8')
                print("原始流：", line_text)
                
                # 跳过空行
                if not line_text.strip():
                    continue
                    
                # 检查是否是结束标记
                if line_text.strip() == "data: [DONE]":
                    break
                    
                # 移除 "data: " 前缀
                if line_text.startswith("data: "):
                    json_str = line_text[6:]  # 去掉 "data: "
                    
                    try:
                        data = json.loads(json_str)
                        content = data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        if content:
                            print("流式内容：", content)
                            yield content
                    except json.JSONDecodeError as e:
                        print(f"JSON解析错误: {e}, 原始数据: {json_str}")
                        continue
    
    def extract_topics(self, text: str, max_topics: int = 5) -> List[str]:
        """
        从文本中提取相关话题
        
        Args:
            text: 输入文本
            max_topics: 最大话题数量
            
        Returns:
            相关话题列表
        """
        prompt = f"""请从以下文本中提取{max_topics}个最相关的签证话题关键词。
要求：
1. 每个话题用简短的词组表示（2-6个字）
2. 话题应该与留学签证相关
3. 按重要性排序
4. 只返回话题列表，每行一个，不要其他内容
5、默认解决旅游签证问题


文本：
{text}"""
        
        messages = [
            {"role": "user", "content": prompt}
        ]
        
        try:
            response = self._make_request(messages, temperature=0.3)
            # 解析话题列表
            topics = []
            for line in response.strip().split('\n'):
                topic = line.strip().strip('-').strip('•').strip()
                if topic and len(topics) < max_topics:
                    topics.append(topic)
            return topics
        except Exception:
            # 如果提取失败，返回默认话题
            return ["签证申请", "材料准备", "面试技巧", "政策更新", "常见问题"]
    
    def categorize_question(self, question: str) -> Dict[str, Any]:
        """
        对问题进行分类和分析
        
        Args:
            question: 用户问题
            
        Returns:
            分类结果字典
        """
        prompt = f"""请分析以下签证相关问题，并返回JSON格式的分类结果：

问题：{question}

请返回包含以下字段的JSON：
{{
    "visa_type": "签证类型（如：英国、美国、申根等）",
    "category": "问题类别（如：申请流程、材料准备、面试、政策等）",
    "urgency": "紧急程度（低/中/高）",
    "complexity": "复杂程度（简单/中等/复杂）",
    "keywords": ["关键词1", "关键词2", "关键词3"]
}}"""
        
        messages = [
            {"role": "user", "content": prompt}
        ]
        
        try:
            response = self._make_request(messages, temperature=0.2)
            # 尝试解析JSON
            result = json.loads(response.strip())
            return result
        except Exception:
            # 如果解析失败，返回默认分类
            return {
                "visa_type": "未知",
                "category": "一般咨询",
                "urgency": "中",
                "complexity": "中等",
                "keywords": ["签证", "申请"]
            }
    
    def generate_follow_up_questions(self, question: str, answer: str, count: int = 3) -> List[str]:
        """
        生成后续问题建议
        
        Args:
            question: 原始问题
            answer: AI回答
            count: 生成问题数量
            
        Returns:
            后续问题列表
        """
        prompt = f"""基于以下对话，生成{count}个相关的后续问题：

原问题：{question}
回答：{answer}

请生成{count}个用户可能感兴趣的相关问题，要求：
1. 与原问题相关但不重复
2. 具有实用价值
3. 适合留学生关心的话题
4. 每行一个问题，不要编号

后续问题："""
        
        messages = [
            {"role": "user", "content": prompt}
        ]
        
        try:
            response = self._make_request(messages, temperature=0.6)
            questions = []
            for line in response.strip().split('\n'):
                question = line.strip().strip('-').strip('•').strip()
                if question and len(questions) < count:
                    questions.append(question)
            return questions
        except Exception:
            return ["如何准备签证材料？", "签证面试有什么技巧？", "签证被拒怎么办？"]
    
    def test_connection(self) -> bool:
        """
        测试API连接
        
        Returns:
            连接是否成功
        """
        try:
            messages = [
                {"role": "user", "content": "你好"}
            ]
            response = self._make_request(messages, max_tokens=10)
            return bool(response)
        except Exception:
            return False 