"""
解释信提示词模板
包含各种常见签证问题的专业提示词
"""

from typing import Dict, Optional

class ExplanationLetterPrompts:
    def __init__(self):
        self.problem_type_prompts = {
            "insufficient_bank_statement": {
                "title": "银行流水不足",
                "template": """
请为以下签证申请人生成一份专业的解释信，解释银行流水不足的问题：

申请人信息：
- 英文姓名：{english_name}
- 工作单位：{organization}
- 护照号码：{passport_number}
- 签证国家：{visa_country}
- 签证类型：{visa_type}
- 申请人类型：{applicant_type}
- 出行日期：{departure_date}

问题详情：
{detailed_explanation}

额外信息：
{additional_info}

请生成一份正式、专业的解释信，格式要求：以"尊敬的签证官："开头；结尾只需"此致 敬礼"，不要写申请人、护照号码等（姓名和日期会自动添加）。需要包含以下要点：
1. 详细解释银行流水不足的原因
2. 说明申请人的实际财务状况和支付能力
4. 提及其他财务证明材料
5. 表达对签证审核的理解和配合态度
6. 语言要正式、诚恳、有说服力
7. 根据用户的问题详情整合润色，不要直接照抄用户原文，整封信由你撰写

请确保内容符合{visa_country}签证要求的格式和标准。
"""
            },
            
            "large_deposit": {
                "title": "大额存款说明",
                "template": """
请为以下签证申请人生成一份专业的解释信，解释银行账户中大额存款的来源：

申请人信息：
- 英文姓名：{english_name}
- 工作单位：{organization}
- 护照号码：{passport_number}
- 签证国家：{visa_country}
- 签证类型：{visa_type}
- 申请人类型：{applicant_type}
- 出行日期：{departure_date}

问题详情：
{detailed_explanation}

额外信息：
{additional_info}

请生成一份正式、专业的解释信，格式要求：以"尊敬的签证官："开头；结尾只需"此致 敬礼"，不要写申请人、护照号码等。根据用户的问题详情整合润色，不要直接照抄用户原文。需要包含以下要点：
1. 详细说明大额存款的合法来源
2. 提供相关证明材料的说明
3. 解释资金的用途和性质
4. 强调资金来源的合法性
5. 表达配合审核的态度

请确保内容符合{visa_country}签证要求的格式和标准。
"""
            },
            
            "temporary_deposit": {
                "title": "临时存款说明",
                "template": """
请为以下签证申请人生成一份专业的解释信，解释银行账户中临时大额存款的情况：

申请人信息：
- 英文姓名：{english_name}
- 工作单位：{organization}
- 护照号码：{passport_number}
- 签证国家：{visa_country}
- 签证类型：{visa_type}
- 申请人类型：{applicant_type}
- 出行日期：{departure_date}

问题详情：
{detailed_explanation}

额外信息：
{additional_info}

请生成一份正式、专业的解释信，格式要求：以"尊敬的签证官："开头；结尾只需"此致 敬礼"，不要写申请人、护照号码等。根据用户的问题详情整合润色，不要直接照抄用户原文。需要包含以下要点：
1. 解释临时存款的具体原因和背景
2. 说明资金的真实来源和用途
3. 强调这是正常的资金调配
4. 提及相关的证明文件
5. 表达对审核流程的理解和支持

请确保内容符合{visa_country}签证要求的格式和标准。
"""
            },
            
            "employment_gap": {
                "title": "就业空白期说明",
                "template": """
请为以下签证申请人生成一份专业的解释信，解释就业履历中的空白期：

申请人信息：
- 英文姓名：{english_name}
- 工作单位：{organization}
- 护照号码：{passport_number}
- 签证国家：{visa_country}
- 签证类型：{visa_type}
- 申请人类型：{applicant_type}
- 出行日期：{departure_date}

问题详情：
{detailed_explanation}

额外信息：
{additional_info}

请生成一份正式、专业的解释信，格式要求：以"尊敬的签证官："开头；结尾只需"此致 敬礼"，不要写申请人、护照号码等。根据用户的问题详情整合润色，不要直接照抄用户原文。需要包含以下要点：
1. 详细解释空白期的具体原因
2. 说明空白期间的活动或状况
3. 解释对职业发展的影响
4. 强调目前的稳定就业状况
5. 表达出行目的的合理性

请确保内容符合{visa_country}签证要求的格式和标准。
"""
            },
            
            "travel_purpose": {
                "title": "出行目的说明",
                "template": """
请为以下签证申请人生成一份专业的解释信，详细说明出行目的：

申请人信息：
- 中文姓名：{chinese_name}
- 英文姓名：{english_name}
- 工作单位：{organization}
- 护照号码：{passport_number}
- 签证国家：{visa_country}
- 签证类型：{visa_type}
- 申请人类型：{applicant_type}
- 出行日期：{departure_date}

问题详情：
{detailed_explanation}

额外信息：
{additional_info}

请生成一份正式、专业的解释信，格式要求：以"尊敬的签证官："开头；结尾只需"此致 敬礼"，不要写申请人、护照号码等。根据用户的问题详情整合润色，不要直接照抄用户原文。需要包含以下要点：
1. 详细阐述出行的具体目的
2. 说明行程安排的合理性
3. 解释选择该国家/地区的原因
4. 强调按时返回的意愿和保证
5. 提及相关的支持材料

请确保内容符合{visa_country}签证要求的格式和标准。
"""
            },
            
            "document_discrepancy": {
                "title": "材料不一致说明",
                "template": """
请为以下签证申请人生成一份专业的解释信，解释申请材料中的不一致之处：

申请人信息：
- 中文姓名：{chinese_name}
- 英文姓名：{english_name}
- 工作单位：{organization}
- 护照号码：{passport_number}
- 签证国家：{visa_country}
- 签证类型：{visa_type}
- 申请人类型：{applicant_type}
- 出行日期：{departure_date}

问题详情：
{detailed_explanation}

额外信息：
{additional_info}

请生成一份正式、专业的解释信，格式要求：以"尊敬的签证官："开头；结尾只需"此致 敬礼"，不要写申请人、护照号码等。根据用户的问题详情整合润色，不要直接照抄用户原文。需要包含以下要点：
1. 承认并详细解释不一致的具体情况
2. 说明造成不一致的客观原因
3. 提供正确信息的澄清
4. 强调其他材料的真实性
5. 表达改正错误的诚意

请确保内容符合{visa_country}签证要求的格式和标准。
"""
            }
        }
    
    def get_explanation_prompt(
        self,
        problem_type: str,
        chinese_name: str,
        english_name: str,
        organization: str,
        passport_number: str,
        visa_country: str,
        visa_type: str,
        applicant_type: str,
        departure_date: str,
        detailed_explanation: str,
        additional_info: Optional[str] = ""
    ) -> str:
        """
        根据问题类型获取相应的提示词模板
        """
        if problem_type in self.problem_type_prompts:
            template = self.problem_type_prompts[problem_type]["template"]
        else:
            # 通用模板
            template = """
请为以下签证申请人生成一份专业的解释信：

申请人信息：
- 中文姓名：{chinese_name}
- 英文姓名：{english_name}
- 工作单位：{organization}
- 护照号码：{passport_number}
- 签证国家：{visa_country}
- 签证类型：{visa_type}
- 申请人类型：{applicant_type}
- 出行日期：{departure_date}

需要说明的问题：
{detailed_explanation}

额外信息：
{additional_info}

请生成一份正式、专业的解释信，格式要求：以"尊敬的签证官："开头；结尾只需"此致 敬礼"，不要写申请人、护照号码等。根据用户的问题详情整合润色，不要直接照抄用户原文。语言要正式、诚恳、有说服力，符合{visa_country}签证要求的格式和标准。
"""
        
        return template.format(
            chinese_name=chinese_name,
            english_name=english_name,
            organization=organization,
            passport_number=passport_number,
            visa_country=visa_country,
            visa_type=visa_type,
            applicant_type=applicant_type,
            departure_date=departure_date,
            detailed_explanation=detailed_explanation,
            additional_info=additional_info if additional_info else "无"
        )
    
    def get_explanation_prompt_english(
        self,
        problem_type: str,
        english_name: str,
        organization: str,
        passport_number: str,
        visa_country: str,
        visa_type: str,
        applicant_type: str,
        departure_date: str,
        detailed_explanation: str,
        additional_info: Optional[str] = "",
    ) -> str:
        """
        获取英文解释信提示词 - 要求 AI 全部用英文生成，不直接插入用户原文
        用户可能用中文写说明，AI 需翻译并整合成专业英文信
        """
        _en_titles = {
            "insufficient_bank_statement": "Insufficient bank statement",
            "bank_balance": "Insufficient bank statement",
            "large_deposit": "Large deposit explanation",
            "large_transfer": "Large transfer explanation",
            "temporary_deposit": "Temporary deposit explanation",
            "employment_gap": "Employment gap explanation",
            "travel_purpose": "Travel purpose explanation",
            "document_discrepancy": "Document discrepancy explanation",
        }
        problem_title = _en_titles.get(
            problem_type,
            self.problem_type_prompts.get(problem_type, {}).get("title", "Visa document explanation"),
        )
        return f"""Generate a professional Cover Letter in English for a visa application. The applicant may have provided information in Chinese - you MUST translate EVERYTHING to English.

Applicant context (translate any Chinese to English, e.g. 曼切斯特大学 -> University of Manchester):
- Name: {english_name}
- Organization: {organization}
- Passport number: {passport_number}
- Visa country: {visa_country}
- Visa type: {visa_type}
- Applicant type: {applicant_type}
- Departure date: {departure_date}
- Issue type: {problem_title}

The applicant's explanation (translate to professional English if in Chinese):
{detailed_explanation}

Additional information (translate if in Chinese):
{additional_info if additional_info else "None"}

FORMAT REQUIREMENTS:
- Start with "Dear Visa Officer," (or "Dear Sir/Madam,").
- Do NOT include a Subject line, Applicant line, or Passport Number line at the top. Integrate name and passport naturally into the letter body.
- Do NOT include [Date], [Contact Information], or any placeholder at the end. End with "Sincerely" or "Yours sincerely" followed by the applicant's name only.
- Output 100% in English. No Chinese characters. Use plain text only, no Markdown."""

    def get_available_problem_types(self) -> Dict[str, str]:
        """
        获取所有可用的问题类型
        """
        return {
            key: value["title"]
            for key, value in self.problem_type_prompts.items()
        }