import os

from openai import OpenAI


api_key = os.getenv("DEEPSEEK_API_KEY")
if not api_key:
    raise RuntimeError("DEEPSEEK_API_KEY is required")


client = OpenAI(
    api_key=api_key,
    base_url="https://api.deepseek.com",
)


def call_deepseek(prompt, lang="zh"):
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {
                "role": "system",
                "content": "你是一个专业的签证行程单生成助手。" if lang == "zh" else "You are a professional travel itinerary assistant.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.6,
    )
    return response.choices[0].message.content
