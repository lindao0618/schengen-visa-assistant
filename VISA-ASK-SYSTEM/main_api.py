"""
FastAPI 服务主程序
提供签证问答系统的RESTful API接口
"""

from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict
import uvicorn
import os
import tempfile
import shutil
import time
import json
import subprocess
import sys

from utils import DeepSeekChat, ExcelFAQLoader, RAGEngine

# 创建FastAPI应用
app = FastAPI(
    title="留学生签证AI问答系统",
    description="基于DeepSeek和RAG技术的智能签证问答API",
    version="1.0.0"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载静态文件
if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")

# 全局变量
chat_client = None
rag_engine = None
faq_data = []

# 签证类型映射
VISA_TYPES = {
    "student": "学生签证",
    "tourist": "旅游签证", 
    "business": "商务签证",
    "work": "工作签证",
    "family": "家庭团聚签证",
    "other": "其他签证"
}

# 国家映射
COUNTRIES = {
    "germany": "德国",
    "france": "法国",
    "italy": "意大利",
    "spain": "西班牙",
    "netherlands": "荷兰",
    "austria": "奥地利",
    "belgium": "比利时",
    "denmark": "丹麦",
    "finland": "芬兰",
    "greece": "希腊",
    "norway": "挪威",
    "portugal": "葡萄牙",
    "sweden": "瑞典",
    "switzerland": "瑞士",
    "uk": "英国",
    "usa": "美国",
    "canada": "加拿大",
    "australia": "澳大利亚",
    "other": "其他国家"
}

# 申请人所在地映射
LOCATIONS = {
    "mainland": "中国大陆",
    "hongkong": "香港",
    "macau": "澳门",
    "taiwan": "台湾",
    "other": "其他地区"
}

# 申请人身份映射
APPLICANT_STATUS = {
    "student": "学生",
    "employee": "在职人员",
    "unemployed": "无业",
    "retired": "退休人员",
    "self_employed": "自由职业者",
    "other": "其他"
}

# 系统提示词模板
SYSTEM_PROMPT_TEMPLATE = """
你是一个专业的{visa_type}申请顾问，专门为计划前往{visa_country}的{location}{applicant_status}提供咨询服务。

你的职责是：
1. 提供准确、实用的签证申请指导
2. 解答关于签证材料、流程、时间等相关问题
3. 给出个性化的申请建议
4. 帮助申请人避免常见错误

回答时请注意：
- 基于提供的上下文信息回答
- 语言简洁明了，条理清晰
- 提供具体可行的建议
- 如果不确定，明确告知并建议咨询官方渠道
- 始终保持专业和友善的语调

请根据用户的具体问题，结合提供的上下文信息，给出最适合的回答。
"""

# 数据模型定义
class QuestionRequest(BaseModel):
    question: str
    visa_type: Optional[str] = None
    country: Optional[str] = None  
    applicant_location: Optional[str] = None
    applicant_status: Optional[str] = None
    use_rag: bool = True

class AnswerResponse(BaseModel):
    question: str
    answer: str
    visa_type: Optional[str] = None
    related_topics: List[str] = []
    references: List[Dict] = []
    elapsed_time: float = 0.0
    retrieval_time: float = 0.0
    generation_time: float = 0.0
    topic_time: float = 0.0

class FAQItem(BaseModel):
    id: Optional[int] = None
    question: str
    answer: str
    category: str = "未分类"
    tags: List[str] = []
    country: Optional[str] = None
    visa_type: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class SearchRequest(BaseModel):
    query: str
    category: Optional[str] = None
    country: Optional[str] = None
    visa_type: Optional[str] = None
    top_k: int = 5

class SimpleRequest(BaseModel):
    question: str

class ItineraryRequest(BaseModel):
    country: str
    departure_city: str
    arrival_city: str
    start_date: str
    end_date: str
    hotel_name: str
    hotel_address: str
    hotel_phone: str

class ItineraryResponse(BaseModel):
    success: bool
    pdf_base64: Optional[str] = None
    analysis: Optional[str] = None
    message: str

# API路由
@app.get("/")
async def root():
    """根路径，返回API信息"""
    return {
        "message": "留学生签证AI问答系统API",
        "version": "1.0.0",
        "status": "running",
        "ai_status": "ready" if chat_client else "not_ready",
        "rag_status": "ready" if rag_engine else "not_ready"
    }

@app.get("/health")
async def health_check():
    """健康检查接口"""
    return {"status": "healthy", "timestamp": time.time()}

@app.get("/visa-types")
async def get_visa_types():
    """获取支持的签证类型"""
    return {"visa_types": VISA_TYPES}

@app.get("/countries")
async def get_countries():
    """获取支持的国家"""
    return {"countries": COUNTRIES}

@app.get("/locations")
async def get_locations():
    """获取支持的申请人所在地"""
    return {"locations": LOCATIONS}

@app.get("/applicant-status")
async def get_applicant_status():
    """获取支持的申请人身份"""
    return {"applicant_status": APPLICANT_STATUS}


@app.post("/ask", response_model=AnswerResponse)
async def ask_question(request: QuestionRequest):
    """主要的问答接口"""
    start_time = time.time()  # 记录开始时间

    if not chat_client:
        raise HTTPException(status_code=503, detail="AI服务未就绪")
    
    try:
        # 准备系统提示词
        # 获取签证类型名称，如果未指定则使用"通用签证"
        visa_type_name = VISA_TYPES.get(request.visa_type, "通用签证") if request.visa_type else "通用签证"
        
        # 获取目标国家名称，如果未指定则使用"通用国家"
        country_name = COUNTRIES.get(request.country, "通用国家") if request.country else "通用国家"
        
        # 获取申请人所在地，如果未指定则默认为"中国大陆"
        location = LOCATIONS.get(request.applicant_location, "中国大陆") if request.applicant_location else "中国大陆"
        
        # 获取申请人身份，如果未指定则默认为"学生"
        applicant_status = APPLICANT_STATUS.get(request.applicant_status, "学生") if request.applicant_status else "学生"
        
        system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
            visa_type=visa_type_name,
            visa_country=country_name,
            location=location,
            applicant_status=applicant_status
        )
        
        # RAG检索
        t0 = time.time()
        context = ""

        if request.use_rag and rag_engine and faq_data:
            results = rag_engine.search(request.question, top_k=3)
            t1 = time.time()
            if results:
                context = rag_engine.get_context_from_results(results)
                references = [
                    {
                        "question": r["question"],
                        "answer": r["answer"],
                        "category": r.get("category", "未分类"),
                        "similarity": r["similarity"]
                    }
                    for r in results
                ]
        else:
            t1 = time.time()
        
        # 生成回答
        t2 = time.time()
        answer = chat_client.generate_answer(
            question=request.question,
            context=context,
            system_prompt=system_prompt
        )
        t3 = time.time()
        
        # 提取相关话题
        related_topics = chat_client.extract_topics(answer, max_topics=5)
        t4 = time.time()
        
        # 统计各阶段耗时
        retrieval_time = t1 - t0
        generation_time = t3 - t2
        topic_time = t4 - t3
        total_time = t4 - start_time

        print(f"检索耗时：{retrieval_time:.2f} 秒，生成耗时：{generation_time:.2f} 秒，话题提取耗时：{topic_time:.2f} 秒，总耗时：{total_time:.2f} 秒")

        return AnswerResponse(
            question=request.question,
            answer=answer,
            visa_type=request.visa_type,
            related_topics=related_topics,
            references=references,
            elapsed_time=total_time,
            retrieval_time=retrieval_time,
            generation_time=generation_time,
            topic_time=topic_time
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理请求时出错: {str(e)}")

@app.post("/search", response_model=List[FAQItem])
async def search_faqs(request: SearchRequest):
    """搜索FAQ"""
    if not rag_engine or not faq_data:
        return []
    
    try:
        results = rag_engine.search(request.query, top_k=request.top_k)
        faqs = []
        for result in results:
            faq = FAQItem(
                question=result["question"],
                answer=result["answer"],
                category=result.get("category", "未分类"),
                country=result.get("country"),
                visa_type=result.get("visa_type")
            )
            faqs.append(faq)
        return faqs
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"搜索失败: {str(e)}")

@app.post("/upload-faq")
async def upload_faq_file(file: UploadFile = File(...)):
    """上传FAQ文件"""
    global faq_data, rag_engine
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="请上传Excel文件")
    
    try:
        # 保存上传的文件
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx')
        shutil.copyfileobj(file.file, temp_file)
        temp_file.close()
        
        # 加载FAQ数据
        loader = ExcelFAQLoader()
        faq_data = loader.load_from_file(temp_file.name)
        
        # 重新初始化RAG引擎
        if faq_data:
            rag_engine = RAGEngine()
            rag_engine.build_index(faq_data)
            
        # 清理临时文件
        os.unlink(temp_file.name)
        
        return {
            "message": f"成功上传并加载了 {len(faq_data)} 条FAQ",
            "count": len(faq_data)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")

@app.get("/faqs", response_model=List[FAQItem])
async def get_all_faqs():
    """获取所有FAQ"""
    if not faq_data:
        return []
    
    faqs = []
    for item in faq_data:
        faq = FAQItem(
            question=item["question"],
            answer=item["answer"],
            category=item.get("category", "未分类"),
            country=item.get("country"),
            visa_type=item.get("visa_type")
        )
        faqs.append(faq)
    return faqs

@app.get("/faq-categories")
async def get_faq_categories():
    """获取FAQ分类"""
    if not faq_data:
        return {"categories": []}
    
    categories = set()
    for item in faq_data:
        categories.add(item.get("category", "未分类"))
    
    return {"categories": list(categories)}

@app.post("/simple-ask")
async def simple_ask(request: SimpleRequest):
    """简化的问答接口"""
    if not chat_client:
        raise HTTPException(status_code=503, detail="AI服务未就绪")
    
    try:
        answer = chat_client.generate_answer(request.question)
        return {"question": request.question, "answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理请求时出错: {str(e)}")

@app.post("/ask-stream")
async def ask_stream(request: QuestionRequest):
    """流式问答接口"""
    if not chat_client:
        raise HTTPException(status_code=503, detail="AI服务未就绪")
    
    try:
        # 准备系统提示词
        visa_type_name = VISA_TYPES.get(request.visa_type, "通用签证") if request.visa_type else "通用签证"
        country_name = COUNTRIES.get(request.country, "通用国家") if request.country else "通用国家"
        location = LOCATIONS.get(request.applicant_location, "中国大陆") if request.applicant_location else "中国大陆"
        applicant_status = APPLICANT_STATUS.get(request.applicant_status, "学生") if request.applicant_status else "学生"
        
        system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
            visa_type=visa_type_name,
            visa_country=country_name,
            location=location,
            applicant_status=applicant_status
        )
        
        # RAG检索
        context = ""
        if request.use_rag and rag_engine and faq_data:
            results = rag_engine.search(request.question, top_k=3)
            if results:
                context = rag_engine.get_context_from_results(results)
        
        # 流式生成回答
        def generate():
            for chunk in chat_client.generate_answer_stream(
                question=request.question,
                context=context,
                system_prompt=system_prompt
            ):
                yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        
        return StreamingResponse(generate(), media_type="text/plain")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理请求时出错: {str(e)}")

@app.post("/generate-itinerary", response_model=ItineraryResponse)
async def generate_itinerary(request: ItineraryRequest):
    """生成行程单"""
    try:
        # 准备Python脚本路径
        script_path = os.path.join(os.path.dirname(__file__), "..", "services", "itinerary-generator", "itinerary_generator.py")
        
        if not os.path.exists(script_path):
            raise HTTPException(status_code=500, detail="行程单生成服务不可用")
        
        # 准备输入数据
        input_data = {
            "country": request.country,
            "departure_city": request.departure_city,
            "arrival_city": request.arrival_city,
            "start_date": request.start_date,
            "end_date": request.end_date,
            "hotel_name": request.hotel_name,
            "hotel_address": request.hotel_address,
            "hotel_phone": request.hotel_phone
        }
        
        # 调用Python脚本
        result = subprocess.run(
            [sys.executable, script_path, json.dumps(input_data)],
            capture_output=True,
            text=True,
            encoding='utf-8'
        )
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"生成失败: {result.stderr}")
        
        # 解析结果
        try:
            response_data = json.loads(result.stdout)
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="生成结果格式错误")
        
        if not response_data.get("success"):
            raise HTTPException(status_code=500, detail=response_data.get("message", "生成失败"))
        
        return ItineraryResponse(
            success=True,
            pdf_base64=response_data.get("pdf_base64"),
            analysis=response_data.get("analysis"),
            message=response_data.get("message", "行程单生成成功")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成行程单时出错: {str(e)}")

# 启动时初始化
async def startup_event():
    global chat_client, rag_engine, faq_data
    
    try:
        # 初始化DeepSeek聊天客户端
        print("正在初始化DeepSeek聊天客户端...")
        chat_client = DeepSeekChat()
        print("DeepSeek聊天客户端初始化成功!")
        
        # 加载FAQ数据
        print("正在加载FAQ数据...")
        loader = ExcelFAQLoader()
        
        # 尝试加载本地FAQ文件
        local_faq_file = "data/visa_faq.xlsx"
        if os.path.exists(local_faq_file):
            faq_data = loader.load_from_file(local_faq_file)
            print(f"成功加载 {len(faq_data)} 条FAQ数据")
            
            # 初始化RAG引擎
            print("正在初始化RAG引擎...")
            rag_engine = RAGEngine()
            rag_engine.build_index(faq_data)
            print("RAG引擎初始化成功!")
        else:
            print("未找到本地FAQ文件，将等待用户上传")
            
    except Exception as e:
        print(f"启动时初始化失败: {e}")
        # 不阻止服务启动，允许稍后重试

app.add_event_handler("startup", startup_event)

if __name__ == "__main__":
    uvicorn.run(
        "main_api:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        workers=1,  # 限制工作进程数
        limit_concurrency=20,  # 限制并发连接数
        limit_max_requests=1000,  # 限制最大请求数
        timeout_keep_alive=30,  # 保持连接超时时间
        log_level="info"
    ) 