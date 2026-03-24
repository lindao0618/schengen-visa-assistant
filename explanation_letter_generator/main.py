"""
解释信生成主程序
用于生成符合签证要求的解释信文档
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
from typing import Optional
import base64
import os
import re
from datetime import datetime
import tempfile

from deepseek_api import DeepSeekAPI


def strip_markdown(text: str) -> str:
    """移除 Markdown 格式符号（**粗体** *斜体*），保留纯文本"""
    if not text:
        return text
    # 先处理 ** 再处理 *，避免遗漏
    for _ in range(3):
        text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
        text = re.sub(r'\*([^*]+)\*', r'\1', text)
    # 移除剩余孤立 *
    text = re.sub(r'\*+', '', text)
    text = re.sub(r'^#+\s*', '', text, flags=re.MULTILINE)
    return text.strip()
from explanation_letter_generator import ExplanationLetterGenerator

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="解释信生成服务", description="专业的签证解释信生成API")

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ExplanationLetterRequest(BaseModel):
    chinese_name: str
    english_name: str
    organization: str
    passport_number: str
    visa_country: str
    visa_type: str
    applicant_type: str
    departure_date: str
    problem_type: str
    detailed_explanation: str
    additional_info: Optional[str] = ""

class TranslatePhotoErrorRequest(BaseModel):
    text: str

@app.post("/generate-explanation-letter")
async def generate_explanation_letter(req: ExplanationLetterRequest):
    """
    生成解释信
    """
    try:
        logger.info(f"开始生成解释信，申请人：{req.chinese_name}")
        
        # 初始化DeepSeek API
        deepseek_api = DeepSeekAPI()
        
        # 生成中文解释信
        explanation_content = await deepseek_api.generate_explanation_letter(
            chinese_name=req.chinese_name,
            english_name=req.english_name,
            organization=req.organization,
            passport_number=req.passport_number,
            visa_country=req.visa_country,
            visa_type=req.visa_type,
            applicant_type=req.applicant_type,
            departure_date=req.departure_date,
            problem_type=req.problem_type,
            detailed_explanation=req.detailed_explanation,
            additional_info=req.additional_info,
        )

        # 生成英文解释信（全文英文，用户中文说明由 AI 翻译整合）
        explanation_content_en = await deepseek_api.generate_explanation_letter_english(
            english_name=req.english_name,
            organization=req.organization,
            passport_number=req.passport_number,
            visa_country=req.visa_country,
            visa_type=req.visa_type,
            applicant_type=req.applicant_type,
            departure_date=req.departure_date,
            problem_type=req.problem_type,
            detailed_explanation=req.detailed_explanation,
            additional_info=req.additional_info,
        )

        # 初始化文档生成器
        doc_generator = ExplanationLetterGenerator()
        
        # 创建临时文件
        with tempfile.NamedTemporaryFile(suffix='.docx', delete=False) as temp_docx:
            output_docx = temp_docx.name
        
        with tempfile.NamedTemporaryFile(suffix='_cn.pdf', delete=False) as temp_pdf_cn:
            output_pdf_cn = temp_pdf_cn.name

        with tempfile.NamedTemporaryFile(suffix='_en.pdf', delete=False) as temp_pdf_en:
            output_pdf_en = temp_pdf_en.name

        with tempfile.NamedTemporaryFile(suffix='_cn.docx', delete=False) as temp_docx_cn:
            output_docx_cn = temp_docx_cn.name

        with tempfile.NamedTemporaryFile(suffix='_en.docx', delete=False) as temp_docx_en:
            output_docx_en = temp_docx_en.name

        try:
            explanation_content = strip_markdown(explanation_content)
            if explanation_content_en:
                explanation_content_en = strip_markdown(explanation_content_en)
                if not explanation_content_en.strip().lower().startswith("dear"):
                    explanation_content_en = "Dear Visa Officer,\n\n" + explanation_content_en

            # 中文版：若未以尊敬的签证官开头则自动添加
            if not explanation_content.strip().startswith("尊敬的签证官"):
                explanation_content = "尊敬的签证官：\n\n" + explanation_content

            # 生成中文版 Word
            doc_generator.create_explanation_letter_document(
                content=explanation_content,
                chinese_name=req.chinese_name,
                english_name=req.english_name,
                passport_number=req.passport_number,
                output_path=output_docx_cn,
                english_content=None,
            )

            # 生成英文版 Word
            if explanation_content_en:
                doc_generator.create_english_document(
                    content=explanation_content_en,
                    english_name=req.english_name,
                    passport_number=req.passport_number,
                    output_path=output_docx_en,
                )

            # 转换为 PDF（中英文分开）
            doc_generator.convert_to_pdf(output_docx_cn, output_pdf_cn)
            if explanation_content_en and os.path.exists(output_docx_en):
                import time
                time.sleep(2)  # 间隔 2 秒，避免 Word COM 连续转换冲突
                doc_generator.convert_to_pdf(output_docx_en, output_pdf_en)
            
            # 读取生成的文件并转换为 base64
            with open(output_docx_cn, 'rb') as f:
                word_chinese_base64 = base64.b64encode(f.read()).decode('utf-8')

            with open(output_pdf_cn, 'rb') as f:
                pdf_chinese_base64 = base64.b64encode(f.read()).decode('utf-8')

            word_english_base64 = None
            pdf_english_base64 = None
            if explanation_content_en and os.path.exists(output_docx_en):
                with open(output_docx_en, 'rb') as f:
                    word_english_base64 = base64.b64encode(f.read()).decode('utf-8')
            if explanation_content_en and os.path.exists(output_pdf_en):
                with open(output_pdf_en, 'rb') as f:
                    pdf_english_base64 = base64.b64encode(f.read()).decode('utf-8')

            logger.info(f"解释信生成成功，申请人：{req.chinese_name}")

            return {
                "success": True,
                "message": "解释信生成成功",
                "word_chinese_base64": word_chinese_base64,
                "word_english_base64": word_english_base64,
                "pdf_chinese_base64": pdf_chinese_base64,
                "pdf_english_base64": pdf_english_base64,
                "content_chinese": explanation_content,
                "content_english": explanation_content_en if explanation_content_en else None,
                "filename": f"解释信_{req.chinese_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            }
            
        finally:
            # 清理临时文件
            try:
                for p in [output_docx_cn, output_docx_en, output_pdf_cn, output_pdf_en]:
                    if p and os.path.exists(p):
                        os.unlink(p)
            except Exception as e:
                logger.warning(f"清理临时文件失败: {e}")
        
    except Exception as e:
        logger.error(f"生成解释信失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"生成解释信失败: {str(e)}")

@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy", "service": "explanation-letter-generator"}

@app.post("/translate-photo-error")
async def translate_photo_error(req: TranslatePhotoErrorRequest):
    """
    翻译照片检测错误 + 精简建议
    """
    try:
        deepseek_api = DeepSeekAPI()
        result = await deepseek_api.translate_photo_error(req.text)
        return {"success": True, **result}
    except Exception as e:
        logger.error(f"翻译照片错误失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"翻译失败: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003, log_level="info")