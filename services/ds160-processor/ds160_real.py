#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
DS160真实自动填写脚本
调用原始的完整DS160自动填写功能
"""

import sys
import json
import os
import argparse
import shutil
from pathlib import Path
import time
from datetime import datetime

# 设置UTF-8编码输出
if sys.platform.startswith('win'):
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# 导入原始的DS160功能
from ds160_server import DS160Filler, process_excel_data, load_country_map
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from email.mime.text import MIMEText

def log_progress(step, message, status="INFO"):
    """打印带时间戳的进度日志，确保Windows兼容性"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Windows兼容的状态图标 - 使用纯ASCII
    status_icon = {
        "INFO": "[INFO]",
        "SUCCESS": "[OK]", 
        "WARNING": "[WARN]",
        "ERROR": "[ERROR]",
        "PROGRESS": "[PROC]",
        "PDF": "[PDF]",
        "FILE": "[FILE]"
    }.get(status, "[INFO]")
    
    try:
        # 移除消息中的任何非ASCII字符
        safe_message = message.encode('ascii', 'ignore').decode('ascii')
        log_message = f"[{timestamp}] {status_icon} [{step:02d}] {safe_message}"
        print(log_message, flush=True)
    except Exception as e:
        # 最终安全输出
        fallback_message = f"[{timestamp}] [INFO] [{step:02d}] Log message encoding error"
        print(fallback_message, flush=True)

def send_email_with_attachments(to_email, subject, body_text, attachment_paths):
    """发送带附件的邮件"""
    try:
        msg = MIMEMultipart()
        msg['From'] = "19857174374@163.com"
        msg['To'] = to_email
        msg['Subject'] = subject

        msg.attach(MIMEText(body_text, 'html'))

        attachment_count = 0
        for i, path in enumerate(attachment_paths, 1):
            if os.path.exists(path):
                with open(path, "rb") as f:
                    filename = f"ds160_page_{i}.pdf"
                    part = MIMEApplication(f.read(), Name=filename)
                    part['Content-Disposition'] = f'attachment; filename="{filename}"'
                    msg.attach(part)
                    attachment_count += 1

        with smtplib.SMTP_SSL('smtp.163.com', 465) as server:
            server.login("19857174374@163.com", "FTn7LTc27jfmi2rv")
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"Email sending error: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description='DS-160自动填写功能')
    parser.add_argument('--excel', required=True, help='Excel文件路径')
    parser.add_argument('--photo', required=True, help='照片文件路径')
    parser.add_argument('--output', required=True, help='输出目录路径')
    parser.add_argument('--email', help='邮箱地址（可选）')
    parser.add_argument('--api_key', default='', help='2Captcha API密钥')
    parser.add_argument('--debug', action='store_true', help='启用调试模式')
    
    args = parser.parse_args()
    
    try:
        log_progress(1, "DS160 Auto-Fill Program Starting")
        log_progress(2, f"Target Email: {args.email}" if args.email else "No email specified")
        
        # 验证输入文件
        log_progress(3, "Validating input files...")
        if not os.path.exists(args.excel):
            raise FileNotFoundError(f"Excel file not found: {args.excel}")
        log_progress(4, f"Excel file found: {os.path.basename(args.excel)}", "SUCCESS")
        
        if not os.path.exists(args.photo):
            raise FileNotFoundError(f"Photo file not found: {args.photo}")
        log_progress(5, f"Photo file found: {os.path.basename(args.photo)}", "SUCCESS")
        
        # 创建输出目录
        log_progress(6, "Creating output directory...")
        os.makedirs(args.output, exist_ok=True)
        log_progress(7, f"Output directory ready: {args.output}", "SUCCESS")
        
        # 复制照片到输出目录
        log_progress(8, "Copying photo to output directory...")
        photo_dest = os.path.join(args.output, "passport_photo.jpg")
        shutil.copy2(args.photo, photo_dest)
        log_progress(9, "Photo copied successfully", "SUCCESS")
        
        # 处理Excel数据
        log_progress(10, "Processing Excel data...")
        start_time = time.time()
        
        # 加载国家映射
        log_progress(11, "Loading country mapping...")
        country_map_path = os.path.join(os.path.dirname(__file__), 'country_map.xlsx')
        if os.path.exists(country_map_path):
            country_map = load_country_map(country_map_path)
            log_progress(12, f"Country map loaded: {len(country_map)} entries", "SUCCESS")
        else:
            country_map = {}
            log_progress(12, "Country map file not found, using original values", "WARNING")
        
        # 加载并处理Excel数据
        form_data = process_excel_data(args.excel, country_map)
        if not form_data:
            raise ValueError("No valid data found in Excel file")
        
        log_progress(13, f"Excel data processed successfully", "SUCCESS")
        
        # 初始化DS160填写器
        log_progress(14, "Initializing DS160 filler...")
        filler = DS160Filler(args.api_key)
        log_progress(15, "DS160 filler initialized", "SUCCESS")
        
        # 执行DS160填写
        log_progress(16, "Starting DS160 form filling process...")
        
        personal_info = form_data  # form_data 已经是单个字典
        
        # Debug: 显示加载的数据
        print("=" * 50)
        print("DEBUG: 加载的Excel数据:")
        for key, value in personal_info.items():
            print(f"  {key}: {value}")
        print("=" * 50)
        
        log_progress(16, f"Processing applicant: {personal_info.get('surname', 'Unknown')} {personal_info.get('given_name', 'Unknown')}", "INFO")
        
        # 使用改进后的DS160处理逻辑
        print("🚀 开始调用DS160 filler.run()方法...")
        try:
            result = filler.run(personal_info, photo_dest, args.debug)
            print(f"✅ DS160 filler.run()执行完成，结果: {result}")
        except Exception as e:
            print(f"❌ DS160 filler.run()执行失败: {e}")
            import traceback
            traceback.print_exc()
            result = None
        
        processing_time = time.time() - start_time
        
        if result and result.get('success'):
            log_progress(17, f"DS160 form filling completed in {processing_time:.1f} seconds", "SUCCESS")
            
            # 处理成功的结果
            log_progress(18, "Collecting PDF files from generated folder...", "PROGRESS")
            pdf_files = []
            important_files = []
            
            # 获取结果信息
            aa_code = result.get('aa_code', '')
            pdf_directory = result.get('pdf_directory', '')
            log_progress(18, f"PDF directory from result: {pdf_directory}", "INFO")
            log_progress(18, f"AA Code from result: {aa_code}", "INFO")
            
            # 检查PDF目录
            if not pdf_directory or not os.path.exists(pdf_directory):
                log_progress(19, f"PDF directory not found or empty: {pdf_directory}", "WARNING")
                # 尝试替代PDF目录
                alt_pdf_dir = os.path.join(os.path.dirname(__file__), 'photo')
                log_progress(19, f"Trying alternative PDF directory: {alt_pdf_dir}", "INFO")
                if os.path.exists(alt_pdf_dir):
                    pdf_directory = alt_pdf_dir
                else:
                    pdf_directory = None
            
            # 收集PDF文件
            if pdf_directory and os.path.exists(pdf_directory):
                log_progress(20, f"Searching for PDF files in: {pdf_directory}", "INFO")
                try:
                    pdf_dir_files = os.listdir(pdf_directory)
                    
                    for file in pdf_dir_files:
                        if file.endswith('.pdf'):
                            file_path = os.path.join(pdf_directory, file)
                            # 直接复制到输出目录
                            dest_path = os.path.join(args.output, file)
                            try:
                                shutil.copy2(file_path, dest_path)
                                file_size = os.path.getsize(dest_path)
                                
                                # 收集PDF文件信息
                                file_info = {
                                    "filename": file,
                                    "size": file_size,
                                    "path": dest_path,
                                    "type": "pdf",
                                    "downloadUrl": f"/api/usa-visa/ds160/download/{os.path.basename(args.output)}/{file}"
                                }
                                pdf_files.append(dest_path)
                                important_files.append(file_info)
                                
                                log_progress(21, f"Found PDF file: {file} ({file_size} bytes)", "PDF")
                            except Exception as e:
                                log_progress(22, f"Cannot copy PDF file {file}: {e}", "WARNING")
                except Exception as e:
                    log_progress(23, f"Error listing PDF directory: {e}", "WARNING")
            
            log_progress(22, f"PDF collection complete! Found {len(pdf_files)} PDF files", "SUCCESS")
            log_progress(23, f"PDF files ready for download: {len(pdf_files)}", "SUCCESS")
            
            # 检查AA Code
            if not aa_code:
                log_progress(24, "AA Code not found in result, checking alternatives", "WARNING")
                # 尝试从文件名中提取AA Code
                for file in os.listdir(args.output):
                    if file.endswith('.png') and file.startswith('AA'):
                        aa_code = file.split('.')[0]
                        log_progress(24, f"Found AA Code from filename: {aa_code}", "INFO")
                        break
            
            # 最终AA Code处理
            if aa_code:
                log_progress(24, f"AA Confirmation Code: {aa_code}", "SUCCESS")
            else:
                log_progress(24, "AA Code not found", "WARNING")
            
            # 发送邮件（如果提供了邮箱）
            email_sent = False
            log_progress(25, f"Email check: email={args.email}, pdf_files_count={len(pdf_files)}", "INFO")
            
            if args.email:
                try:
                    log_progress(26, f"Sending email to {args.email}...", "PROGRESS")
                    
                    # 获取申请人姓名
                    surname = personal_info.get('surname', 'Applicant')
                    
                    # 创建邮件内容
                    body_html = f"""
                    <html>
                      <body style="font-family: Arial, sans-serif; color: #333; padding: 10px;">
                        <h2 style="color: #007bff;">DS-160 Form Completion Success</h2>
                        <p>Dear <strong>{surname}</strong>,</p>
                        <p>Your <strong>DS-160 Form</strong> has been successfully completed.</p>
                        <p><b>AA Code:</b> <span style="color: #d63384;">{aa_code}</span></p>
                        <p><b>PDF Files Generated:</b> {len(pdf_files)}</p>
                        <p><b>Total Files:</b> {len(important_files)}</p>
                        <hr style="margin: 20px 0;">
                        <p style="font-size: 14px; color: #888;">Best wishes for your visa application!<br>From Vistoria Visa Team</p>
                      </body>
                    </html>
                    """
                    
                    # 发送邮件（有PDF文件就带附件，没有就发纯文本）
                    try:
                        if pdf_files:
                            log_progress(27, f"Attempting to send email with {len(pdf_files)} PDF attachments", "INFO")
                            email_sent = send_email_with_attachments(
                                args.email, 
                                f"DS-160 Form Complete | AA Code: {aa_code}", 
                                body_html, 
                                pdf_files
                            )
                        else:
                            log_progress(27, f"No PDF files found, sending plain text email", "INFO")
                            # 发送纯文本邮件
                            msg = MIMEMultipart()
                            msg['From'] = "19857174374@163.com"
                            msg['To'] = args.email
                            msg['Subject'] = f"DS-160 Form Complete | AA Code: {aa_code}"
                            msg.attach(MIMEText(body_html, 'html'))
                            
                            with smtplib.SMTP_SSL('smtp.163.com', 465) as server:
                                server.login("19857174374@163.com", "FTn7LTc27jfmi2rv")
                                server.send_message(msg)
                            email_sent = True
                    except Exception as e:
                        log_progress(27, f"Email sending failed: {str(e)}", "ERROR")
                        email_sent = False
                    
                    if email_sent:
                        log_progress(27, f"Email sent successfully to {args.email}", "SUCCESS")
                    else:
                        log_progress(27, f"Email sending failed", "ERROR")
                    
                except Exception as e:
                    log_progress(27, f"Email sending failed: {str(e)}", "ERROR")
            else:
                log_progress(26, f"Email not sent: email={bool(args.email)}, pdf_files={bool(pdf_files)}", "WARNING")
            
            # 按文件名排序PDF文件
            important_files.sort(key=lambda x: x['filename'])
            
            success_response = {
                "success": True,
                "message": "DS160 form completed successfully",
                "totalFiles": len(important_files),  # 只计算PDF文件
                "pdfFiles": len(pdf_files),
                "aaCode": aa_code,
                "processedAt": datetime.now().isoformat(),
                "processing_time": f"{processing_time:.1f} seconds",
                "email": args.email,
                "emailSent": email_sent,
                "files": important_files  # 只返回PDF文件
            }
            
            print("\n" + "="*80)
            print("Processing Complete:")
            print("="*80)
            print(json.dumps(success_response, ensure_ascii=False, indent=2))
            return 0
            
        else:
            log_progress(28, "DS160 form filling failed", "ERROR")
            error_response = {
                "success": False,
                "message": "DS160 form filling failed",
                "error": "Error occurred during filling process",
                "processing_time": f"{processing_time:.1f} seconds"
            }
            print(json.dumps(error_response, ensure_ascii=False, indent=2))
            return 1
            
    except Exception as e:
        log_progress(99, f"Program execution failed: {str(e)}", "ERROR")
        error_response = {
            "success": False,
            "message": f"DS160 processing failed: {str(e)}",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }
        print("\n" + "="*80)
        print("Error Report:")
        print("="*80)
        print(json.dumps(error_response, ensure_ascii=False, indent=2))
        return 1

if __name__ == "__main__":
    sys.exit(main()) 