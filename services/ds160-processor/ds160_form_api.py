from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import shutil
import uuid
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from email.mime.text import MIMEText
import os
from ds160_server import process_excel_data, load_country_map, DS160Filler

app = FastAPI()

# 允许跨域（前端可直接访问）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 可替换为指定前端域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 创建必要目录
os.makedirs("excel_files", exist_ok=True)
os.makedirs("photos", exist_ok=True)
os.makedirs("output", exist_ok=True)
os.makedirs("logs", exist_ok=True)

# 邮件发送函数（支持多个 PDF 附件）
def send_email_with_attachments(to_email, subject, body_text, attachment_paths):
    msg = MIMEMultipart()
    msg['From'] = "19857174374@163.com"
    msg['To'] = to_email
    msg['Subject'] = subject

    msg.attach(MIMEText(body_text, 'html'))

    for i, path in enumerate(attachment_paths, 1):
        with open(path, "rb") as f:
            filename = f"ds160_page_{i}.pdf"
            part = MIMEApplication(f.read(), Name=filename)
            part['Content-Disposition'] = f'attachment; filename="{filename}"'
            msg.attach(part)

    with smtplib.SMTP_SSL('smtp.163.com', 465) as server:
        server.login("19857174374@163.com", "FTn7LTc27jfmi2rv")
        server.send_message(msg)

# ✅ 后台处理函数（填表 + 邮件）
def process_and_send(excel_path, photo_path, email):
    try:
        country_dict = load_country_map("country_map.xlsx")
        personal_info_list = process_excel_data(excel_path, country_dict)
        if not personal_info_list:
            print("No valid data in Excel.")
            return

        personal_info = personal_info_list[0]
        filler = DS160Filler(api_key=os.getenv("CAPTCHA_API_KEY", ""))
        result = filler.run(personal_info, photo_path)

        if not isinstance(result, dict):
            print("No valid data returned from form filling.")
            return

        pdf_dir = result.get("pdf_dir")
        aa_code = result.get("aa_code", "")
        surname = result.get("surname", "")

        if not pdf_dir or not os.path.isdir(pdf_dir):
            print("Invalid PDF directory.")
            return

        pdf_files = [os.path.join(pdf_dir, f) for f in os.listdir(pdf_dir) if f.endswith(".pdf")]
        pdf_files.sort()
        if not pdf_files:
            print("No PDF files found.")
            return

        body_html = f"""
        <html>
          <body style="font-family: Arial, sans-serif; color: #333; padding: 10px;">
            <h2 style="color: #007bff;">DS-160 Form Filled Successfully 🎉</h2>
            <p>Hello <strong>{surname}</strong>,</p>
            <p>Your <strong>DS-160 Form</strong> has been filled successfully.</p>
            <p><b>AA Code:</b><span style="color: #d63384;">{aa_code}</span></p>
            <p>Please check the <span style="color: #28a745;">PDF Confirmation Pages</span> in the attached multiple files.</p>
            <hr style="margin: 20px 0;">
            <p style="font-size: 14px; color: #888;">Good luck with your visa!<br>From Vistoria Visa Team 💼</p>
          </body>
        </html>
        """

        send_email_with_attachments(email, f"DS-160 Form Filled | AA Code: {aa_code}", body_html, pdf_files)
        print(f"Email sent successfully: {email} | AA: {aa_code}")

    except Exception as e:
        print("Background task execution failed:", str(e))

# ✅ 接口：接收上传并立即返回
@app.post("/submit_form/")
def submit_form_api(
    background_tasks: BackgroundTasks,
    excel: UploadFile = File(...),
    photo: UploadFile = File(...),
    email: str = Form(...)
):
    try:
        excel_path = f"excel_files/{uuid.uuid4()}.xlsx"
        photo_path = f"photos/{uuid.uuid4()}.jpg"

        with open(excel_path, "wb") as f1:
            shutil.copyfileobj(excel.file, f1)
        with open(photo_path, "wb") as f2:
            shutil.copyfileobj(photo.file, f2)

        background_tasks.add_task(process_and_send, excel_path, photo_path, email)

        return {"status": "received", "message": "File received, processing"}

    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})
