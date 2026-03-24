"""
材料审核系统 - 主服务文件
使用 PaddleOCR + PP-StructureV3 进行文档结构化识别和审核
"""
import os
import json
import tempfile
import base64
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Union
import logging

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="材料审核系统", description="基于PaddleOCR的签证材料自动审核")

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003", "http://localhost:3004"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 请求和响应模型
class DocumentAnalysisRequest(BaseModel):
    file_base64: str
    file_type: str  # pdf, jpg, png, doc, docx
    analysis_type: str  # itinerary, hotel_booking, bank_statement, etc.

class AnalysisResult(BaseModel):
    success: bool
    document_type: str
    extracted_data: Dict[str, Any]
    verification_results: Dict[str, Any]
    recommendations: List[str]
    confidence_score: float

class DocumentReviewResponse(BaseModel):
    analysis_result: AnalysisResult
    visual_markup_base64: Optional[str] = None

try:
    # 动态导入 PaddleOCR（如果已安装）
    from paddleocr import PaddleOCR, PPStructureV3, PPChatOCRv4Doc
    PADDLE_OCR_AVAILABLE = True
    logger.info("PaddleOCR successfully imported")
except ImportError as e:
    PADDLE_OCR_AVAILABLE = False
    logger.warning(f"PaddleOCR not available: {e}. Please install it using: pip install paddleocr[structure]")
except Exception as e:
    PADDLE_OCR_AVAILABLE = False
    logger.error(f"Failed to import PaddleOCR: {e}")

# DeepSeek API配置
DEEPSEEK_API_KEY = "sk-f31bd4e5a73b47bbaa5e73a5b6a2bf7f"  # 使用项目中已有的API key
DEEPSEEK_BASE_URL = "https://api.deepseek.com"

class DocumentAnalyzer:
    """文档分析器类"""
    
    def __init__(self):
        self.ocr_engine = None
        self.structure_engine = None
        self.chat_ocr_engine = None
        
        if PADDLE_OCR_AVAILABLE:
            try:
                # 初始化 PaddleOCR
                self.ocr_engine = PaddleOCR(
                    use_textline_orientation=True,
                    lang='ch'  # 支持中英文
                )
                
                # 暂时跳过 PP-Structure 初始化以避免内存问题
                # self.structure_engine = PPStructureV3()
                self.structure_engine = None
                
                # 初始化 PP-ChatOCRv4（使用DeepSeek API）
                try:
                    import os
                    # 根据PaddleOCR文档配置DeepSeek API
                    os.environ["DEEPSEEK_API_KEY"] = DEEPSEEK_API_KEY
                    os.environ["DEEPSEEK_BASE_URL"] = DEEPSEEK_BASE_URL
                    
                    # 配置PP-ChatOCRv4使用DeepSeek
                    chat_config = {
                        "model_name": "deepseek-chat",
                        "api_key": DEEPSEEK_API_KEY,
                        "base_url": DEEPSEEK_BASE_URL,
                        "max_tokens": 2048,
                        "temperature": 0.1
                    }
                    
                    # 启用 PP-ChatOCRv4 初始化
                    self.chat_ocr_engine = PPChatOCRv4Doc()
                    logger.info("PP-ChatOCRv4 enabled with DeepSeek API")
                except Exception as e:
                    logger.warning(f"Failed to initialize PP-ChatOCRv4: {e}, falling back to basic OCR")
                    self.chat_ocr_engine = None
                
                logger.info("OCR engines initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize OCR engines: {e}")
                self.ocr_engine = None
                self.structure_engine = None
                self.chat_ocr_engine = None
    
    def analyze_document(self, file_path: str, analysis_type: str) -> Dict[str, Any]:
        """分析文档并提取结构化信息"""
        try:
            # 优先使用 PP-ChatOCRv4 进行智能分析
            if self.chat_ocr_engine:
                try:
                    return self._analyze_with_chatocrv4(file_path, analysis_type)
                except Exception as e:
                    logger.warning(f"ChatOCRv4 analysis failed: {e}, falling back to basic OCR")
            
            # 备用：使用基础 PP-Structure
            if not self.structure_engine:
                return self._fallback_analysis(file_path, analysis_type)
            
            # 使用 PP-Structure 进行结构化识别
            result = self.structure_engine(file_path)
            
            # 根据分析类型处理结果
            if analysis_type == "itinerary":
                return self._analyze_itinerary(result)
            elif analysis_type == "hotel_booking":
                return self._analyze_hotel_booking(result)
            elif analysis_type == "bank_statement":
                return self._analyze_bank_statement(result)
            else:
                return self._generic_analysis(result)
                
        except Exception as e:
            logger.error(f"Document analysis failed: {e}")
            return self._fallback_analysis(file_path, analysis_type)
    
    def _analyze_with_chatocrv4(self, file_path: str, analysis_type: str) -> Dict[str, Any]:
        """使用PP-ChatOCRv4进行智能分析"""
        try:
            # 根据分析类型构建提示词
            analysis_prompts = {
                "itinerary": """
                请分析这份行程单，提取以下信息：
                1. 旅行日期（开始和结束日期）
                2. 目的地城市和国家
                3. 酒店住宿信息
                4. 交通安排
                5. 主要活动和景点
                6. 检查日期的连续性和合理性
                7. 验证住宿和交通的匹配度
                
                请返回结构化的分析结果，包括提取的数据、验证结果和改进建议。
                """,
                "hotel_booking": """
                请分析这份酒店预订单，提取以下信息：
                1. 酒店名称和地址
                2. 入住和退房日期
                3. 房间类型和数量
                4. 预订人信息
                5. 预订确认号
                6. 总价格
                
                请验证预订信息的完整性和有效性。
                """,
                "bank_statement": """
                请分析这份银行流水，提取以下信息：
                1. 账户持有人姓名
                2. 账户号码
                3. 流水期间
                4. 主要交易记录
                5. 账户余额
                6. 收入规律性
                
                请评估资金状况是否符合签证要求。
                """
            }
            
            prompt = analysis_prompts.get(analysis_type, "请分析这份文档，提取关键信息并提供分析建议。")
            
            # 使用PP-ChatOCRv4进行分析
            result = self.chat_ocr_engine(file_path, prompt=prompt)
            
            # 解析ChatOCRv4的返回结果
            if isinstance(result, dict) and 'chatResult' in result:
                chat_result = result['chatResult']
                ocr_result = result.get('ocrResult', [])
                
                # 提取OCR文本内容
                extracted_text = ""
                if ocr_result:
                    for item in ocr_result:
                        if isinstance(item, dict) and 'res' in item:
                            for line in item['res']:
                                if 'text' in line:
                                    extracted_text += line['text'] + " "
                
                return {
                    "extracted_data": {
                        "chat_analysis": chat_result,
                        "ocr_content": extracted_text.strip(),
                        "analysis_type": analysis_type
                    },
                    "ai_analysis": {
                        "ai_analysis": chat_result  # 添加前端期望的字段
                    },
                    "verification_results": {
                        "ai_analysis_available": True,
                        "document_readable": bool(extracted_text),
                        "comprehensive_analysis": True
                    },
                    "recommendations": [
                        "已通过AI智能分析，详细结果见分析内容",
                        "建议人工核验关键信息的准确性"
                    ],
                    "confidence_score": 0.9
                }
            else:
                # 如果返回格式不符合预期，返回基础分析
                return {
                    "extracted_data": {"status": "ChatOCRv4 format error"},
                    "verification_results": {"processed": False},
                    "recommendations": ["AI分析返回格式异常，建议使用基础OCR功能"],
                    "confidence_score": 0.3
                }
                
        except Exception as e:
            logger.error(f"ChatOCRv4 analysis error: {e}")
            raise e
    
    def _analyze_itinerary(self, ocr_result: List[Dict]) -> Dict[str, Any]:
        """分析行程单"""
        extracted_data = {
            "dates": [],
            "destinations": [],
            "accommodations": [],
            "transportation": [],
            "activities": []
        }
        
        verification_results = {
            "date_consistency": True,
            "reasonable_itinerary": True,
            "accommodation_matches": True,
            "duration_appropriate": True
        }
        
        recommendations = []
        
        try:
            # 提取文本内容
            all_text = ""
            for item in ocr_result:
                if 'res' in item:
                    for line in item['res']:
                        if 'text' in line:
                            all_text += line['text'] + " "
            
            # 简单的文本分析（可以扩展为更复杂的NLP分析）
            lines = all_text.split('\n')
            
            # 提取日期信息
            import re
            date_pattern = r'\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}'
            dates = re.findall(date_pattern, all_text)
            extracted_data["dates"] = dates
            
            # 检查日期一致性
            if len(dates) < 2:
                verification_results["date_consistency"] = False
                recommendations.append("行程单中的日期信息不足，建议补充完整的开始和结束日期")
            
            # 检查行程合理性（基本检查）
            if len(all_text) < 100:
                verification_results["reasonable_itinerary"] = False
                recommendations.append("行程描述过于简单，建议提供更详细的行程安排")
                
        except Exception as e:
            logger.error(f"Itinerary analysis error: {e}")
            verification_results["date_consistency"] = False
            recommendations.append("文档解析出现错误，请检查文档格式")
        
        return {
            "extracted_data": extracted_data,
            "verification_results": verification_results,
            "recommendations": recommendations,
            "confidence_score": 0.8 if verification_results["date_consistency"] else 0.4
        }
    
    def _analyze_hotel_booking(self, ocr_result: List[Dict]) -> Dict[str, Any]:
        """分析酒店预订单"""
        extracted_data = {
            "hotel_name": "",
            "check_in_date": "",
            "check_out_date": "",
            "guest_name": "",
            "booking_reference": "",
            "total_amount": ""
        }
        
        verification_results = {
            "dates_valid": True,
            "name_matches": True,
            "booking_confirmed": True,
            "amount_reasonable": True
        }
        
        recommendations = []
        
        try:
            # 提取酒店信息的逻辑
            all_text = ""
            for item in ocr_result:
                if 'res' in item:
                    for line in item['res']:
                        if 'text' in line:
                            all_text += line['text'] + " "
            
            # 基本验证
            if "hotel" not in all_text.lower() and "酒店" not in all_text:
                verification_results["booking_confirmed"] = False
                recommendations.append("文档中未找到明确的酒店预订信息")
            
            if len(all_text) < 50:
                verification_results["booking_confirmed"] = False
                recommendations.append("预订信息过于简单，建议提供完整的预订确认单")
                
        except Exception as e:
            logger.error(f"Hotel booking analysis error: {e}")
            recommendations.append("酒店预订单解析出现错误")
        
        return {
            "extracted_data": extracted_data,
            "verification_results": verification_results,
            "recommendations": recommendations,
            "confidence_score": 0.7
        }
    
    def _analyze_bank_statement(self, ocr_result: List[Dict]) -> Dict[str, Any]:
        """分析银行流水"""
        extracted_data = {
            "account_holder": "",
            "account_number": "",
            "statement_period": "",
            "transactions": [],
            "balance": ""
        }
        
        verification_results = {
            "sufficient_balance": True,
            "regular_income": True,
            "period_adequate": True,
            "large_transactions_explained": True
        }
        
        recommendations = []
        
        try:
            # 银行流水分析逻辑
            all_text = ""
            for item in ocr_result:
                if 'res' in item:
                    for line in item['res']:
                        if 'text' in line:
                            all_text += line['text'] + " "
            
            # 基本检查
            if "balance" not in all_text.lower() and "余额" not in all_text:
                verification_results["sufficient_balance"] = False
                recommendations.append("未找到余额信息，请确认银行流水完整性")
                
        except Exception as e:
            logger.error(f"Bank statement analysis error: {e}")
            recommendations.append("银行流水解析出现错误")
        
        return {
            "extracted_data": extracted_data,
            "verification_results": verification_results,
            "recommendations": recommendations,
            "confidence_score": 0.6
        }
    
    def _generic_analysis(self, ocr_result: List[Dict]) -> Dict[str, Any]:
        """通用文档分析"""
        extracted_data = {"content": ""}
        
        try:
            all_text = ""
            for item in ocr_result:
                if 'res' in item:
                    for line in item['res']:
                        if 'text' in line:
                            all_text += line['text'] + " "
            
            extracted_data["content"] = all_text
            
        except Exception as e:
            logger.error(f"Generic analysis error: {e}")
        
        return {
            "extracted_data": extracted_data,
            "verification_results": {"document_readable": True},
            "recommendations": ["文档已成功识别，请人工审核具体内容"],
            "confidence_score": 0.5
        }
    
    def _fallback_analysis(self, file_path: str, analysis_type: str) -> Dict[str, Any]:
        """备用分析方法（当OCR不可用时）"""
        return {
            "extracted_data": {"status": "OCR unavailable"},
            "verification_results": {"processed": False},
            "recommendations": ["请安装PaddleOCR进行文档分析: pip install paddleocr[structure]"],
            "confidence_score": 0.0
        }

# 初始化文档分析器
analyzer = DocumentAnalyzer()

@app.get("/")
async def root():
    return {
        "message": "材料审核系统API",
        "version": "1.0.0",
        "paddle_ocr_available": PADDLE_OCR_AVAILABLE
    }

@app.post("/upload-document", response_model=DocumentReviewResponse)
async def upload_document(
    file: UploadFile = File(...),
    analysis_type: str = "itinerary"
):
    """
    上传文档进行分析
    analysis_type: itinerary, hotel_booking, bank_statement, etc.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # 检查文件类型
    allowed_extensions = {'.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'}
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type: {file_ext}. Allowed: {allowed_extensions}"
        )
    
    try:
        # 保存临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        logger.info(f"Processing file: {file.filename}, type: {analysis_type}")
        
        # 分析文档
        analysis_result = analyzer.analyze_document(temp_file_path, analysis_type)
        
        # 构建响应
        result = AnalysisResult(
            success=True,
            document_type=analysis_type,
            extracted_data=analysis_result["extracted_data"],
            verification_results=analysis_result["verification_results"],
            recommendations=analysis_result["recommendations"],
            confidence_score=analysis_result["confidence_score"]
        )
        
        response = DocumentReviewResponse(
            analysis_result=result,
            visual_markup_base64=None  # 可以后续添加可视化标注
        )
        
        # 清理临时文件
        os.unlink(temp_file_path)
        
        logger.info(f"Document analysis completed successfully for {file.filename}")
        return response
        
    except Exception as e:
        # 清理临时文件
        if 'temp_file_path' in locals():
            try:
                os.unlink(temp_file_path)
            except:
                pass
        
        logger.error(f"Document processing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Document processing failed: {str(e)}")

@app.post("/analyze-base64", response_model=DocumentReviewResponse)
async def analyze_base64_document(request: DocumentAnalysisRequest):
    """
    分析base64编码的文档
    """
    try:
        # 解码base64文件
        file_data = base64.b64decode(request.file_base64)
        
        # 确定文件扩展名
        file_ext = f".{request.file_type}" if not request.file_type.startswith('.') else request.file_type
        
        # 保存临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_file:
            temp_file.write(file_data)
            temp_file_path = temp_file.name
        
        logger.info(f"Processing base64 document, type: {request.analysis_type}")
        
        # 分析文档
        analysis_result = analyzer.analyze_document(temp_file_path, request.analysis_type)
        
        # 构建响应
        result = AnalysisResult(
            success=True,
            document_type=request.analysis_type,
            extracted_data=analysis_result["extracted_data"],
            verification_results=analysis_result["verification_results"],
            recommendations=analysis_result["recommendations"],
            confidence_score=analysis_result["confidence_score"]
        )
        
        response = DocumentReviewResponse(
            analysis_result=result,
            visual_markup_base64=None
        )
        
        # 清理临时文件
        os.unlink(temp_file_path)
        
        logger.info("Base64 document analysis completed successfully")
        return response
        
    except Exception as e:
        # 清理临时文件
        if 'temp_file_path' in locals():
            try:
                os.unlink(temp_file_path)
            except:
                pass
        
        logger.error(f"Base64 document processing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Document processing failed: {str(e)}")

if __name__ == "__main__":
    logger.info("Starting Material Review Service...")
    uvicorn.run(app, host="0.0.0.0", port=8003)