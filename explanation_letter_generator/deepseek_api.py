"""
DeepSeek API调用模块
用于生成解释信内容
"""

import os
import logging
import json
from typing import Optional
from openai import OpenAI
from prompt_templates import ExplanationLetterPrompts

logger = logging.getLogger(__name__)


class DeepSeekAPI:
    def __init__(self):
        api_key = os.environ.get("DEEPSEEK_API_KEY")
        if not api_key:
            raise RuntimeError("DEEPSEEK_API_KEY is required")
        self.client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")
        self.prompts = ExplanationLetterPrompts()

    async def generate_explanation_letter(
        self,
        chinese_name: str,
        english_name: str,
        organization: str,
        passport_number: str,
        visa_country: str,
        visa_type: str,
        applicant_type: str,
        departure_date: str,
        problem_type: str,
        detailed_explanation: str,
        additional_info: Optional[str] = ""
    ) -> str:
        """
        使用DeepSeek API生成解释信内容
        """
        try:
            # 获取对应的提示词模板
            prompt = self.prompts.get_explanation_prompt(
                problem_type=problem_type,
                chinese_name=chinese_name,
                english_name=english_name,
                organization=organization,
                passport_number=passport_number,
                visa_country=visa_country,
                visa_type=visa_type,
                applicant_type=applicant_type,
                departure_date=departure_date,
                detailed_explanation=detailed_explanation,
                additional_info=additional_info
            )
            
            logger.info(f"调用DeepSeek API生成解释信，问题类型：{problem_type}")

            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {
                        "role": "system",
                        "content": "你是一位专业的签证顾问，擅长撰写各类签证解释信。请根据用户提供的信息，生成完整、专业、正式的解释信。整封信应由你撰写，将用户的说明整合润色成正式文书，不要直接照抄或逐字插入用户原文。输出全文使用中文，纯文本格式，不要使用任何 Markdown 符号（如 **、*、# 等）。"
                    },
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.3,
            )
            explanation_content = response.choices[0].message.content.strip()
            
            logger.info(f"DeepSeek API调用成功，生成内容长度：{len(explanation_content)}")
            
            return explanation_content
            
        except Exception as e:
            logger.error(f"DeepSeek API调用失败: {str(e)}")
            # 如果API调用失败，返回一个基础的解释信模板
            return self._get_fallback_explanation(
                chinese_name, english_name, organization,
                passport_number, visa_country, visa_type,
                applicant_type, departure_date, problem_type,
                detailed_explanation, additional_info
            )

    async def generate_explanation_letter_english(
        self,
        english_name: str,
        organization: str,
        passport_number: str,
        visa_country: str,
        visa_type: str,
        applicant_type: str,
        departure_date: str,
        problem_type: str,
        detailed_explanation: str,
        additional_info: Optional[str] = "",
    ) -> str:
        """
        使用 DeepSeek 生成英文解释信 - 全文英文，用户中文说明由 AI 翻译整合
        """
        try:
            prompt = self.prompts.get_explanation_prompt_english(
                problem_type=problem_type,
                english_name=english_name,
                organization=organization,
                passport_number=passport_number,
                visa_country=visa_country,
                visa_type=visa_type,
                applicant_type=applicant_type,
                departure_date=departure_date,
                detailed_explanation=detailed_explanation,
                additional_info=additional_info,
            )
            logger.info(f"调用 DeepSeek 生成英文解释信，问题类型：{problem_type}")

            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a professional visa consultant. Generate the complete explanation letter in English ONLY. Translate ALL Chinese text to English - including organization names (e.g. 曼切斯特大学 -> University of Manchester), place names, and any other fields. Your entire output must be in English - absolutely no Chinese characters allowed. Use plain text only, no Markdown symbols (**, *, #, etc.).",
                    },
                    {"role": "user", "content": prompt},
                ],
                max_tokens=2000,
                temperature=0.3,
            )
            content = response.choices[0].message.content.strip()
            logger.info(f"英文解释信生成成功，长度：{len(content)}")
            return content
        except Exception as e:
            logger.error(f"英文解释信 DeepSeek 调用失败: {str(e)}")
            return ""

    async def translate_photo_error(self, text: str) -> dict:
        """
        翻译照片检测错误并给出精简建议
        返回: {"translation": "...", "suggestion": "..."}
        """
        try:
            prompt = f"""请将以下报错翻译为中文，并给出一句精简建议。
输出JSON，格式：
{{"translation":"...","suggestion":"..."}}
报错内容：
{text}
"""
            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {
                        "role": "system",
                        "content": "你是技术客服助手。必须输出严格JSON，不要代码块，不要多余文本。翻译要准确，建议要简短可执行。",
                    },
                    {"role": "user", "content": prompt},
                ],
                max_tokens=200,
                temperature=0.2,
            )
            content = response.choices[0].message.content.strip()
            data = json.loads(content)
            if not isinstance(data, dict):
                raise ValueError("Invalid JSON")
            return {
                "translation": str(data.get("translation", "")).strip(),
                "suggestion": str(data.get("suggestion", "")).strip(),
            }
        except Exception as e:
            logger.error(f"照片错误翻译失败: {str(e)}")
            return {"translation": str(text).strip(), "suggestion": ""}

    def _get_fallback_explanation(
        self,
        chinese_name: str,
        english_name: str,
        organization: str,
        passport_number: str,
        visa_country: str,
        visa_type: str,
        applicant_type: str,
        departure_date: str,
        problem_type: str,
        detailed_explanation: str,
        additional_info: str
    ) -> str:
        """
        当API调用失败时的备用解释信模板
        """
        return f"""致{visa_country}签证中心：

我是（{english_name}），护照号码：{passport_number}，现在在{organization}。

我计划于{departure_date}前往{visa_country}，申请{visa_type}签证。在准备签证材料过程中，发现以下问题需要向贵处说明：

问题类型：{problem_type}

具体说明：

{additional_info}

我理解这一情况可能会对签证审核造成疑虑，特此提供详细说明，并承诺所有信息真实有效。如需进一步材料或说明，我将积极配合提供。

恳请贵处理解我的实际情况，批准我的签证申请。

敬礼！

申请人：（{english_name}）
护照号码：{passport_number}
日期：{departure_date}"""
