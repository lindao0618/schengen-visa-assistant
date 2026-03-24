#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import logging
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from typing import Dict, Any

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 创建FastAPI应用
app = FastAPI(title="Material Review Service", version="1.0.0")

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3004"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SimpleDocumentAnalyzer:
    """简化版文档分析器，用于测试前后端连接"""
    
    def __init__(self):
        self.available = True
        logger.info("Simple Document Analyzer initialized")
    
    def analyze_document(self, file_path: str, analysis_type: str) -> Dict[str, Any]:
        """简单分析文档（模拟分析）"""
        try:
            # 检查文件是否存在
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"文件不存在: {file_path}")
            
            file_size = os.path.getsize(file_path)
            file_name = os.path.basename(file_path)
            
            # 根据文档类型返回不同的模拟分析结果
            if analysis_type == "itinerary":
                analysis_result = {
                    "extracted_data": {
                        "document_type": "行程单",
                        "file_name": file_name,
                        "file_size": f"{file_size} bytes",
                        "destinations": ["巴黎", "罗马", "柏林"],
                        "travel_dates": "2024-06-01 至 2024-06-15",
                        "total_days": 14
                    },
                    "verification_results": {
                        "date_consistency": "通过",
                        "destination_valid": "通过", 
                        "duration_reasonable": "通过"
                    },
                    "recommendations": [
                        "行程安排合理，时间充足",
                        "建议准备相关城市的住宿证明",
                        "确保交通衔接顺畅"
                    ],
                    "confidence_score": 0.85
                }
            elif analysis_type == "hotel_booking":
                analysis_result = {
                    "extracted_data": {
                        "document_type": "酒店预订单",
                        "file_name": file_name,
                        "file_size": f"{file_size} bytes",
                        "hotel_name": "巴黎春天酒店",
                        "check_in": "2024-06-01",
                        "check_out": "2024-06-05",
                        "guest_name": "张三"
                    },
                    "verification_results": {
                        "booking_valid": "通过",
                        "dates_match": "通过",
                        "guest_info": "通过"
                    },
                    "recommendations": [
                        "预订信息完整",
                        "建议打印确认函",
                        "核实酒店联系方式"
                    ],
                    "confidence_score": 0.90
                }
            else:  # bank_statement
                analysis_result = {
                    "extracted_data": {
                        "document_type": "银行流水",
                        "file_name": file_name,
                        "file_size": f"{file_size} bytes",
                        "account_balance": "¥50,000",
                        "statement_period": "2024-03-01 至 2024-05-31",
                        "average_balance": "¥45,000"
                    },
                    "verification_results": {
                        "balance_sufficient": "通过",
                        "income_stable": "通过",
                        "period_valid": "通过"
                    },
                    "recommendations": [
                        "资金充足，符合签证要求",
                        "收入稳定，有利于申请",
                        "建议提供工资明细补充"
                    ],
                    "confidence_score": 0.88
                }
            
            logger.info(f"Document analysis completed for {file_name}")
            return analysis_result
            
        except Exception as e:
            logger.error(f"Analysis failed: {str(e)}")
            return {
                "extracted_data": {
                    "error": f"分析失败: {str(e)}"
                },
                "verification_results": {
                    "processed": "未通过"
                },
                "recommendations": [
                    "请检查文件格式是否正确",
                    "确保文件未损坏",
                    "重新上传文件"
                ],
                "confidence_score": 0.0
            }

# 初始化分析器
analyzer = SimpleDocumentAnalyzer()

@app.get("/")
async def root():
    """健康检查接口"""
    return {
        "status": "ok",
        "message": "Material Review Service is running",
        "analyzer_available": analyzer.available
    }

@app.post("/upload-document")
async def upload_document(
    file: UploadFile = File(...),
    document_type: str = Form(...)
):
    """文档上传和分析接口"""
    try:
        logger.info(f"Received file upload: {file.filename}, type: {document_type}")
        
        # 检查文件类型
        allowed_extensions = {'.pdf', '.jpg', '.jpeg', '.png'}
        file_extension = os.path.splitext(file.filename.lower())[1]
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的文件类型: {file_extension}。支持的格式: PDF, JPG, PNG"
            )
        
        # 保存上传的文件
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)
        
        file_path = os.path.join(upload_dir, file.filename)
        
        # 写入文件
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        logger.info(f"File saved to: {file_path}")
        
        # 分析文档
        analysis_result = analyzer.analyze_document(file_path, document_type)
        
        # 清理临时文件
        try:
            os.remove(file_path)
        except:
            pass
        
        return JSONResponse(content={
            "success": True,
            "message": "文档分析完成",
            "analysis_result": analysis_result
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"文档处理失败: {str(e)}")

if __name__ == "__main__":
    logger.info("Starting Material Review Service...")
    uvicorn.run(app, host="0.0.0.0", port=8003)