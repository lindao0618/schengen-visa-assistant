#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
完整的材料审核系统
流程：文件 → 图片转换 → 腾讯云OCR → DeepSeek AI分析 → 返回结果
"""

import os
import json
import tempfile
import base64
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
import uvicorn

# 导入配置
from config import Config

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 尝试导入腾讯云OCR SDK
TENCENT_OCR_AVAILABLE = False
try:
    from tencentcloud.common import credential
    from tencentcloud.common.profile.client_profile import ClientProfile
    from tencentcloud.common.profile.http_profile import HttpProfile
    from tencentcloud.common.exception.tencent_cloud_sdk_exception import TencentCloudSDKException
    from tencentcloud.ocr.v20181119 import ocr_client, models
    TENCENT_OCR_AVAILABLE = True
    logger.info("✅ 腾讯云OCR SDK已导入")
except ImportError as e:
    logger.warning(f"❌ 腾讯云OCR SDK未安装: {e}")
    logger.warning("请安装: pip install tencentcloud-sdk-python")

# 导入文件处理库
try:
    from PIL import Image
    import fitz  # PyMuPDF
    from docx import Document
    PIL_AVAILABLE = True
    logger.info("✅ 文件处理库已导入")
except ImportError as e:
    logger.warning(f"❌ 文件处理库未安装: {e}")
    PIL_AVAILABLE = False

# 导入HTTP请求库
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    logger.warning("❌ requests库未安装")
    REQUESTS_AVAILABLE = False

app = FastAPI(
    title="完整材料审核系统",
    description="文件 → 图片转换 → 腾讯云OCR → DeepSeek AI分析 → 返回结果",
    version="1.0.0"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class FileProcessor:
    """文件处理器 - 将各种格式文件转换为图片"""
    
    @staticmethod
    def pdf_to_images(pdf_path: str) -> List[bytes]:
        """将PDF转换为图片列表"""
        if not PIL_AVAILABLE:
            raise Exception("PIL库未安装，无法处理PDF文件")
        
        images = []
        try:
            # 打开PDF文件
            pdf_document = fitz.open(pdf_path)
            
            for page_num in range(pdf_document.page_count):
                # 获取页面
                page = pdf_document[page_num]
                
                # 设置渲染参数
                mat = fitz.Matrix(2.0, 2.0)  # 2倍缩放提高清晰度
                pix = page.get_pixmap(matrix=mat)
                
                # 转换为PIL Image
                img_data = pix.tobytes("png")
                images.append(img_data)
            
            pdf_document.close()
            logger.info(f"PDF转换为{len(images)}张图片")
            return images
            
        except Exception as e:
            logger.error(f"PDF转换失败: {e}")
            raise
    
    @staticmethod
    def docx_to_images(docx_path: str) -> List[bytes]:
        """将DOCX转换为图片（简化实现）"""
        # 这里可以实现更复杂的DOCX转图片逻辑
        # 目前返回空列表，提示用户使用PDF格式
        logger.warning("DOCX转图片功能暂未实现，建议使用PDF格式")
        return []
    
    @staticmethod
    def image_to_bytes(image_path: str) -> bytes:
        """将图片文件转换为字节数据"""
        try:
            with open(image_path, 'rb') as f:
                return f.read()
        except Exception as e:
            logger.error(f"读取图片失败: {e}")
            raise

class TencentOCRAnalyzer:
    """腾讯云OCR分析器"""
    
    def __init__(self):
        self.ocr_client = None
        self.init_client()
    
    def init_client(self):
        """初始化腾讯云OCR客户端"""
        if not TENCENT_OCR_AVAILABLE:
            logger.warning("腾讯云OCR SDK不可用")
            return
        
        if not Config.is_tencent_configured():
            logger.warning("腾讯云API密钥未配置")
            return
        
        try:
            # 创建认证对象
            cred = credential.Credential(
                Config.TENCENTCLOUD_SECRET_ID,
                Config.TENCENTCLOUD_SECRET_KEY
            )
            
            # 配置HTTP选项
            httpProfile = HttpProfile()
            httpProfile.endpoint = "ocr.tencentcloudapi.com"
            
            # 配置客户端选项
            clientProfile = ClientProfile()
            clientProfile.httpProfile = httpProfile
            
            # 创建OCR客户端
            self.ocr_client = ocr_client.OcrClient(
                cred, 
                Config.TENCENTCLOUD_REGION, 
                clientProfile
            )
            
            logger.info("✅ 腾讯云OCR客户端初始化成功")
            
        except Exception as e:
            logger.error(f"❌ 腾讯云OCR客户端初始化失败: {e}")
            self.ocr_client = None
    
    def extract_text_from_image(self, image_data: bytes) -> Dict[str, Any]:
        """从图片中提取文字"""
        if not self.ocr_client:
            return {
                "success": False,
                "error": "腾讯云OCR客户端未初始化",
                "text": "",
                "confidence": 0.0
            }
        
        try:
            # 将图片转换为base64
            base64_content = base64.b64encode(image_data).decode('utf-8')
            
            # 创建OCR请求
            req = models.GeneralBasicOCRRequest()
            params = {
                "ImageBase64": base64_content
            }
            req.from_json_string(json.dumps(params))
            
            # 调用OCR API
            resp = self.ocr_client.GeneralBasicOCR(req)
            
            # 解析响应
            response_dict = json.loads(resp.to_json_string())
            
            # 提取文本内容
            extracted_text = ""
            confidence_scores = []
            
            if "TextDetections" in response_dict:
                for detection in response_dict["TextDetections"]:
                    if "DetectedText" in detection:
                        extracted_text += detection["DetectedText"] + "\n"
                    if "Confidence" in detection:
                        confidence_scores.append(detection["Confidence"])
            
            # 计算平均置信度
            avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0.0
            
            logger.info(f"OCR识别完成，文本长度: {len(extracted_text)}, 置信度: {avg_confidence:.2f}")
            
            return {
                "success": True,
                "text": extracted_text.strip(),
                "confidence": avg_confidence,
                "text_count": len(confidence_scores)
            }
            
        except TencentCloudSDKException as e:
            logger.error(f"腾讯云OCR API调用失败: {e}")
            return {
                "success": False,
                "error": f"腾讯云OCR API错误: {str(e)}",
                "text": "",
                "confidence": 0.0
            }
        except Exception as e:
            logger.error(f"OCR处理失败: {e}")
            return {
                "success": False,
                "error": f"OCR处理错误: {str(e)}",
                "text": "",
                "confidence": 0.0
            }

class DeepSeekAnalyzer:
    """DeepSeek AI分析器"""
    
    def __init__(self):
        self.api_key = Config.DEEPSEEK_API_KEY
        self.base_url = Config.DEEPSEEK_BASE_URL
    
    def analyze_document(self, text: str, document_type: str, visa_type: str = "schengen") -> Dict[str, Any]:
        """使用DeepSeek AI分析文档内容"""
        if not REQUESTS_AVAILABLE:
            return {
                "success": False,
                "error": "requests库未安装",
                "analysis": "",
                "recommendations": []
            }
        
        # 根据文档类型构建提示词
        prompts = {
            "itinerary": f"""
请分析这份{visa_type}签证的行程单，提取并验证以下信息：

1. 旅行日期（开始和结束日期）
2. 目的地城市和国家
3. 酒店住宿信息
4. 交通安排
5. 主要活动和景点
6. 检查日期的连续性和合理性
7. 验证住宿和交通的匹配度

请返回结构化的分析结果，包括：
- 提取的关键信息
- 验证结果（通过/不通过及原因）
- 改进建议

文档内容：
{text}
""",
            "hotel_booking": f"""
请分析这份{visa_type}签证的酒店预订单，提取并验证以下信息：

1. 酒店名称和地址
2. 入住和退房日期
3. 房间类型和数量
4. 预订人信息
5. 预订确认号
6. 总价格

请返回结构化的分析结果，包括：
- 提取的关键信息
- 验证结果（通过/不通过及原因）
- 改进建议

文档内容：
{text}
""",
            "bank_statement": f"""
请分析这份{visa_type}签证的银行流水，提取并验证以下信息：

1. 账户持有人姓名
2. 账户号码
3. 流水期间
4. 主要交易记录
5. 账户余额
6. 收入规律性

请返回结构化的分析结果，包括：
- 提取的关键信息
- 验证结果（通过/不通过及原因）
- 改进建议

文档内容：
{text}
"""
        }
        
        prompt = prompts.get(document_type, f"请分析这份{visa_type}签证的{document_type}文档，提取关键信息并提供分析建议。\n\n文档内容：\n{text}")
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            data = {
                "model": "deepseek-chat",
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.1,
                "max_tokens": 2048
            }
            
            response = requests.post(self.base_url, headers=headers, json=data, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                ai_analysis = result["choices"][0]["message"]["content"]
                
                logger.info("✅ DeepSeek AI分析完成")
                
                return {
                    "success": True,
                    "analysis": ai_analysis,
                    "recommendations": self._extract_recommendations(ai_analysis)
                }
            else:
                logger.error(f"DeepSeek API调用失败: {response.status_code} - {response.text}")
                return {
                    "success": False,
                    "error": f"DeepSeek API错误: {response.status_code}",
                    "analysis": "",
                    "recommendations": []
                }
                
        except Exception as e:
            logger.error(f"DeepSeek AI分析失败: {e}")
            return {
                "success": False,
                "error": f"DeepSeek AI分析错误: {str(e)}",
                "analysis": "",
                "recommendations": []
            }
    
    def _extract_recommendations(self, analysis: str) -> List[str]:
        """从AI分析结果中提取建议"""
        recommendations = []
        lines = analysis.split('\n')
        
        for line in lines:
            line = line.strip()
            if any(keyword in line for keyword in ['建议', '推荐', '应该', '需要', '注意']):
                if line and not line.startswith('#'):
                    recommendations.append(line)
        
        return recommendations[:5]  # 最多返回5条建议

class CompleteMaterialReviewer:
    """完整的材料审核器"""
    
    def __init__(self):
        self.file_processor = FileProcessor()
        self.ocr_analyzer = TencentOCRAnalyzer()
        self.ai_analyzer = DeepSeekAnalyzer()
    
    def analyze_document(self, file_path: str, document_type: str, original_filename: str, visa_type: str = "schengen") -> Dict[str, Any]:
        """完整的文档分析流程"""
        try:
            logger.info(f"开始分析文档: {original_filename}, 类型: {document_type}")
            
            # 步骤1: 文件转图片
            images = self._convert_file_to_images(file_path, original_filename)
            if not images:
                return {
                    "success": False,
                    "error": "文件转换失败",
                    "analysis_result": {}
                }
            
            # 步骤2: OCR识别
            all_text = ""
            total_confidence = 0.0
            successful_pages = 0
            
            for i, image_data in enumerate(images):
                logger.info(f"处理第{i+1}页...")
                ocr_result = self.ocr_analyzer.extract_text_from_image(image_data)
                
                if ocr_result["success"]:
                    all_text += f"\n--- 第{i+1}页 ---\n"
                    all_text += ocr_result["text"]
                    total_confidence += ocr_result["confidence"]
                    successful_pages += 1
                else:
                    logger.warning(f"第{i+1}页OCR识别失败: {ocr_result.get('error', '未知错误')}")
            
            if not all_text.strip():
                return {
                    "success": False,
                    "error": "OCR识别失败，未提取到文本内容",
                    "analysis_result": {}
                }
            
            avg_confidence = total_confidence / successful_pages if successful_pages > 0 else 0.0
            
            # 步骤3: DeepSeek AI分析
            ai_result = self.ai_analyzer.analyze_document(all_text, document_type, visa_type)
            
            # 步骤4: 构建分析结果
            analysis_result = {
                "ocr_info": {
                    "engine": "腾讯云OCR",
                    "confidence": avg_confidence,
                    "text_length": len(all_text),
                    "pages_processed": len(images),
                    "successful_pages": successful_pages
                },
                "extracted_data": {
                    "raw_text": all_text[:500] + "..." if len(all_text) > 500 else all_text,
                    "full_text_length": len(all_text)
                },
                "ai_analysis": {
                    "ai_analysis": ai_result.get("analysis", ""),
                    "success": ai_result.get("success", False)
                },
                "verification_results": {
                    "text_extracted": "通过" if all_text.strip() else "未通过",
                    "content_relevant": "通过" if len(all_text) > 10 else "未通过",
                    "ai_analysis_available": ai_result.get("success", False)
                },
                "recommendations": ai_result.get("recommendations", [])
            }
            
            logger.info(f"文档分析完成: {original_filename}")
            
            return {
                "success": True,
                "analysis_result": analysis_result
            }
            
        except Exception as e:
            logger.error(f"文档分析失败: {e}")
            return {
                "success": False,
                "error": f"文档分析失败: {str(e)}",
                "analysis_result": {}
            }
    
    def _convert_file_to_images(self, file_path: str, filename: str) -> List[bytes]:
        """将文件转换为图片列表"""
        file_ext = os.path.splitext(filename)[1].lower()
        
        if file_ext == '.pdf':
            return self.file_processor.pdf_to_images(file_path)
        elif file_ext in ['.jpg', '.jpeg', '.png']:
            return [self.file_processor.image_to_bytes(file_path)]
        elif file_ext == '.docx':
            return self.file_processor.docx_to_images(file_path)
        else:
            raise Exception(f"不支持的文件格式: {file_ext}")

# 初始化分析器
reviewer = CompleteMaterialReviewer()

@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "完整材料审核系统API",
        "version": "1.0.0",
        "flow": "文件 → 图片转换 → 腾讯云OCR → DeepSeek AI分析 → 返回结果",
        "tencent_ocr_available": TENCENT_OCR_AVAILABLE,
        "tencent_configured": Config.is_tencent_configured(),
        "file_processing_available": PIL_AVAILABLE,
        "deepseek_configured": bool(Config.DEEPSEEK_API_KEY)
    }

@app.post("/upload-document")
async def upload_document(
    file: UploadFile = File(...),
    document_type: str = Form(default="itinerary"),
    visa_type: str = Form(default="schengen")
):
    """上传文档进行完整分析"""
    try:
        logger.info(f"收到文件上传: {file.filename}, 类型: {document_type}")
        
        # 检查文件类型
        file_extension = os.path.splitext(file.filename)[1].lower()
        if file_extension not in Config.ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的文件类型: {file_extension}. 支持的类型: {', '.join(Config.ALLOWED_EXTENSIONS)}"
            )
        
        # 检查文件大小
        content = await file.read()
        if len(content) > Config.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"文件过大: {len(content)} bytes. 最大允许: {Config.MAX_FILE_SIZE} bytes"
            )
        
        # 保存临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_file:
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        logger.info(f"文件已保存到临时路径: {temp_file_path}")
        
        # 分析文档
        analysis_result = reviewer.analyze_document(
            temp_file_path,
            document_type,
            file.filename,
            visa_type
        )
        
        # 清理临时文件
        try:
            os.unlink(temp_file_path)
        except Exception as e:
            logger.warning(f"删除临时文件失败: {e}")
        
        if analysis_result["success"]:
            return JSONResponse(content=analysis_result)
        else:
            raise HTTPException(
                status_code=500,
                detail=analysis_result.get("error", "文档分析失败")
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"上传处理失败: {e}")
        raise HTTPException(status_code=500, detail=f"上传处理失败: {str(e)}")

@app.post("/configure-tencent")
async def configure_tencent(
    secret_id: str = Form(...),
    secret_key: str = Form(...)
):
    """配置腾讯云API密钥"""
    try:
        Config.save_to_file(secret_id, secret_key)
        Config.TENCENTCLOUD_SECRET_ID = secret_id
        Config.TENCENTCLOUD_SECRET_KEY = secret_key
        
        # 重新初始化OCR客户端
        reviewer.ocr_analyzer.init_client()
        
        return {
            "success": True,
            "message": "腾讯云配置已保存并生效"
        }
    except Exception as e:
        logger.error(f"配置腾讯云失败: {e}")
        raise HTTPException(status_code=500, detail=f"配置失败: {str(e)}")

if __name__ == "__main__":
    logger.info("🚀 启动完整材料审核系统...")
    logger.info(f"服务地址: http://{Config.HOST}:{Config.PORT}")
    logger.info("流程: 文件 → 图片转换 → 腾讯云OCR → DeepSeek AI分析 → 返回结果")
    
    uvicorn.run(app, host=Config.HOST, port=Config.PORT)






















