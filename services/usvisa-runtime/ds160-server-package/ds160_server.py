import pandas as pd
import os
from datetime import datetime
from pathlib import Path
import logging
from playwright.sync_api import sync_playwright
import requests
import time
import json
import argparse
import sys
import platform
from pdf2image import convert_from_path
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from email.mime.text import MIMEText
import unicodedata
import re
import base64

# 设置输出编码为UTF-8
import io
import locale

# 设置环境变量
os.environ['PYTHONIOENCODING'] = 'utf-8'

# 尝试设置标准输出编码
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    else:
        # 对于较老的Python版本
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
except:
    # 如果设置失败，继续执行
    pass

"""
DS-160自动填表程序 - 无头模式服务器版本
此版本设计用于在Ubuntu服务器等无GUI环境中运行
支持通过命令行参数控制运行
增强了错误处理和自动重试功能
"""

# 日志：写入 ds160.log 便于排查（路径：ds160-server-package/ds160.log）
_ds160_logger = None
_ds160_log_path = None
def _get_logger():
    global _ds160_logger, _ds160_log_path
    if _ds160_logger is not None:
        return _ds160_logger
    _ds160_logger = logging.getLogger("ds160")
    if not _ds160_logger.handlers:
        _ds160_logger.setLevel(logging.DEBUG)
        log_dir = Path(__file__).parent
        _ds160_log_path = log_dir / "ds160.log"
        fh = logging.FileHandler(_ds160_log_path, mode="a", encoding="utf-8")
        fh.setLevel(logging.DEBUG)
        fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
        fh.setFormatter(fmt)
        _ds160_logger.addHandler(fh)
        print(f"[DS160] 日志输出到: {_ds160_log_path}", file=sys.stderr)
    return _ds160_logger

# 默认配置
DEFAULT_API_KEY = ""

# 进度计时：记录每个阶段耗时，供进度条优化。默认启用，DS160_TIMING=0 可关闭
_timing_enabled = os.environ.get("DS160_TIMING", "1").lower() not in ("0", "false", "no")
_timing_last = None  # (pct, msg, timestamp)
_timing_records = []  # [(from_pct, from_msg, to_pct, to_msg, elapsed), ...]
_timing_start = None

# 当前步骤，异常时用于输出失败位置
_current_step = "Init"

def _step_log(msg):
    """输出步骤日志到 stderr 和 ds160.log，便于定位错误。同时更新 _current_step 供异常时使用"""
    global _current_step
    # 从 msg 提取 step=XXX 作为当前步骤标识
    if "step=" in msg:
        part = msg.split("step=", 1)[1].strip()
        _current_step = part.split()[0] if part else "Unknown"
    print(f"[DS160] {msg}", file=sys.stderr, flush=True)
    # 输出 STEP: 供 Node 解析，便于任务列表显示「当前步骤」
    if "step=" in msg:
        print(f"STEP:{_current_step}:{msg}", file=sys.stderr, flush=True)
    try:
        _get_logger().info(msg)
    except Exception:
        pass

def _error_log(step, reason, detail=""):
    """异常时输出结构化错误信息，便于前端展示和排查"""
    lines = [
        f"[DS160-ERROR] 失败步骤: {step}",
        f"[DS160-ERROR] 失败原因: {reason}",
    ]
    if detail:
        lines.append(f"[DS160-ERROR] 详细: {detail[:500]}")
    for line in lines:
        print(line, file=sys.stderr, flush=True)
        try:
            _get_logger().error(line)
        except Exception:
            pass

def _progress(pct, msg):
    """输出进度供 Node 解析，格式 PROGRESS:百分比:消息。使用 stderr 避免与 stdout 混在一起"""
    global _timing_last, _timing_records, _timing_start
    now = time.time()
    if _timing_enabled:
        if _timing_start is None:
            _timing_start = now
        if _timing_last is not None:
            elapsed = now - _timing_last[2]
            prev_pct, prev_msg = _timing_last[0], _timing_last[1]
            _timing_records.append((prev_pct, prev_msg, pct, msg, elapsed))
            # 格式: TIMING:上一进度:当前进度:耗时(秒):当前消息
            print(f"TIMING:{prev_pct}:{pct}:{elapsed:.2f}:{msg}", file=sys.stderr, flush=True)
        _timing_last = (pct, msg, now)
    print(f"PROGRESS:{pct}:{msg}", file=sys.stderr, flush=True)


def _write_timing_summary(success=True):
    """流程结束时写入计时汇总文件"""
    global _timing_records, _timing_start
    if not _timing_enabled or not _timing_records:
        return
    total = time.time() - _timing_start if _timing_start else 0
    log_dir = os.path.dirname(os.path.abspath(__file__))
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = os.path.join(log_dir, f"ds160_timing_{ts}.txt")
    try:
        with open(log_path, "w", encoding="utf-8") as f:
            f.write(f"# DS-160 各阶段耗时统计 (成功={success})\n")
            f.write(f"# 总耗时: {total:.2f} 秒\n")
            f.write(f"# 格式: 上一进度 -> 当前进度 | 耗时(秒) | 消息\n")
            f.write("-" * 80 + "\n")
            for prev_pct, prev_msg, to_pct, to_msg, elapsed in _timing_records:
                f.write(f"{prev_pct} -> {to_pct} | {elapsed:>8.2f}s | {to_msg}\n")
            f.write("-" * 80 + "\n")
            # 按进度区间汇总
            phases = {}
            for prev_pct, prev_msg, to_pct, to_msg, elapsed in _timing_records:
                if to_pct <= 3:
                    phase = "0-3 初始化"
                elif to_pct <= 12:
                    phase = "3-12 首页+验证码"
                elif to_pct <= 62:
                    phase = "12-62 表单填写"
                elif to_pct <= 96:
                    phase = "62-96 PDF+Save+Exit"
                else:
                    phase = "96-100 邮件+完成"
                phases[phase] = phases.get(phase, 0) + elapsed
            f.write("\n# 按阶段汇总(秒):\n")
            for phase, sec in sorted(phases.items(), key=lambda x: x[1], reverse=True):
                pct = (sec / total * 100) if total > 0 else 0
                f.write(f"  {phase}: {sec:.2f}s ({pct:.1f}%)\n")
        print(f"[TIMING] 耗时统计已写入: {log_path}", file=sys.stderr, flush=True)
    except Exception as e:
        print(f"[TIMING] 写入耗时文件失败: {e}", file=sys.stderr, flush=True)

# 邮件发送函数
def send_email_with_attachments(to_email, subject, body_text, attachment_paths, aa_code=""):
    """发送带附件的邮件"""
    try:
        msg = MIMEMultipart()
        msg['From'] = os.environ.get("SMTP_USER", "ukvisa20242024@163.com")
        msg['To'] = to_email
        msg['Subject'] = subject

        # 构建邮件正文
        body_html = f"""
        <html>
          <body style="font-family: Arial, sans-serif; color: #333; padding: 12px;">
            <h2 style="color: #2f6fed; margin: 0 0 8px;">DS-160 填表完成</h2>
            <p style="margin: 6px 0;">您好，您的 DS-160 表单已填写完成，请查收附件。</p>
            {f'<p style="margin: 6px 0;"><b>AA码：</b><span style="color: #d63384;">{aa_code}</span></p>' if aa_code else ''}
            <hr style="margin: 16px 0; border: none; border-top: 1px solid #eee;">
            <h3 style="margin: 0 0 6px;">生成文件</h3>
            <ul style="margin: 6px 0 0; padding-left: 18px;">
            {''.join([f'<li>{os.path.basename(path)}</li>' for path in attachment_paths])}
            </ul>
            <hr style="margin: 16px 0; border: none; border-top: 1px solid #eee;">
            <h3 style="margin: 0 0 6px;">下一步</h3>
            <ol style="margin: 6px 0 0; padding-left: 18px;">
              <li>打印确认页</li>
              <li>预约签证面试</li>
              <li>携带确认页参加面试</li>
            </ol>
            <p style="font-size: 12px; color: #888; margin-top: 12px;">此邮件由系统自动发送，请勿直接回复。</p>
          </body>
        </html>
        """
        
        msg.attach(MIMEText(body_html, 'html'))

        # 添加PDF附件
        for i, path in enumerate(attachment_paths, 1):
            if os.path.exists(path):
                with open(path, "rb") as f:
                    filename = f"ds160_page_{i:02d}.pdf"
                    part = MIMEApplication(f.read(), Name=filename)
                    part['Content-Disposition'] = f'attachment; filename="{filename}"'
                    msg.attach(part)

        # 发送邮件
        smtp_user = os.environ.get("SMTP_USER", "ukvisa20242024@163.com")
        smtp_pass = os.environ.get("SMTP_PASSWORD") or os.environ.get("SMTP_PASS", "")
        with smtplib.SMTP_SSL('smtp.163.com', 465) as server:
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        
        print(f"[SUCCESS] 邮件发送成功：{to_email}")
        return True
        
    except Exception as e:
        print(f"[ERROR] 邮件发送失败：{e}")
        return False

# Helper functions
def convert_pdf_to_images(pdf_path, output_folder, base_name):
    """Convert PDF to images"""
    try:
        print(f"Processing: {pdf_path}")
        # No need for Windows-specific Poppler path on Ubuntu
        images = convert_from_path(pdf_path, dpi=200)
        
        for i, image in enumerate(images):
            image_filename = f"{base_name}_page_{i + 1}.png"
            image_path = os.path.join(output_folder, image_filename)
            image.save(image_path, "PNG")
            print(f"[SUCCESS] Generated image: {image_filename}")
        return True
    except Exception as e:
        print(f"[ERROR] Conversion failed: {str(e)}")
        return False

def format_date(date_str):
    """Format date string to YYYY-MM-DD format，支持 Excel 日期、YYYY/MM/DD、YYYY-MM-DD 等"""
    try:
        if pd.isna(date_str) or date_str == '':
            return ''
        if isinstance(date_str, (pd.Timestamp, datetime)):
            return date_str.strftime('%Y-%m-%d')
        s = str(date_str).strip()
        # 优先处理年份在前的格式（YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD），
        # 避免 pd.to_datetime 在日≤12时将日和月互换（如 1990/05/06 被误解析为5月6日）
        if re.match(r'^\d{4}[/\-\.]\d{1,2}[/\-\.]\d{1,2}', s):
            parts = re.split(r'[/\-\.]', s[:10])
            if len(parts) >= 3:
                y, m, d = parts[0], parts[1].zfill(2), parts[2].zfill(2)
                return f"{y}-{m}-{d}"
        date_obj = pd.to_datetime(date_str)
        return date_obj.strftime('%Y-%m-%d')
    except Exception as e:
        print(f"Date formatting error: {date_str}, Error: {e}", file=sys.stderr)
        return ''

def format_month(month_str):
    """Convert month to uppercase three-letter format (JAN, FEB, ...)"""
    try:
        if pd.isna(month_str) or month_str == '':
            return ''
        month_str = str(month_str).strip()
        if month_str.isdigit():
            month_str = month_str.zfill(2)
        month_map = {
            '1': 'JAN', '2': 'FEB', '3': 'MAR', '4': 'APR',
            '5': 'MAY', '6': 'JUN', '7': 'JUL', '8': 'AUG',
            '9': 'SEP', '10': 'OCT', '11': 'NOV', '12': 'DEC',
            '01': 'JAN', '02': 'FEB', '03': 'MAR', '04': 'APR',
            '05': 'MAY', '06': 'JUN', '07': 'JUL', '08': 'AUG',
            '09': 'SEP', '10': 'OCT', '11': 'NOV', '12': 'DEC'
        }
        return month_map.get(month_str, month_str)
    except Exception as e:
        print(f"Month formatting error: {month_str}, Error: {str(e)}")
        return str(month_str)

def _sanitize_ceac_explain(text):
    """CEAC 的 Explain/Reason 文本框仅允许: A-Z, 0-9, #, $, *, %, &, (, ), ;, !, @, ^, ?, >, <, ., ', comma, hyphen, space.
    若有中文等非法字符会触发校验失败。此处移除非法字符，保留 ASCII 安全字符。"""
    if not text or not isinstance(text, str):
        return ''
    s = str(text).strip()
    allowed = set(
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        ' #$*%&();!@^?><.\',-'
    )
    return ''.join(c for c in s if c in allowed)


def _normalize_ds160_field_text(value):
    if value is None:
        return ''
    if not isinstance(value, str):
        value = str(value)
    text = value.replace('\r', ' ').replace('\n', ' ').replace('\t', ' ')
    return re.sub(r'\s+', ' ', text).strip()


def _truncate_ds160_field_text(value, max_len):
    text = _normalize_ds160_field_text(value)
    if not text or len(text) <= max_len:
        return text
    candidate = text[:max_len]
    split_at = candidate.rfind(' ')
    if split_at >= max_len // 2:
        candidate = candidate[:split_at]
    return candidate.strip(" ,;-")


def _split_ds160_address_lines(value, line1_max=40, line2_max=40):
    text = _normalize_ds160_field_text(value)
    if not text:
        return '', ''
    if len(text) <= line1_max:
        return text, ''

    first = text[:line1_max]
    split_at = first.rfind(' ')
    if split_at >= line1_max // 2:
        line1 = first[:split_at].strip(" ,;-")
        remainder = text[split_at + 1 :].strip()
    else:
        line1 = first.strip(" ,;-")
        remainder = text[line1_max:].strip()

    if len(remainder) <= line2_max:
        return line1, remainder

    second = remainder[:line2_max]
    split_at = second.rfind(' ')
    if split_at >= line2_max // 2:
        line2 = second[:split_at].strip(" ,;-")
    else:
        line2 = second.strip(" ,;-")
    return line1, line2


def _normalize_ds160_ascii_text(value):
    if value is None:
        return ''
    if not isinstance(value, str):
        value = str(value)
    normalized = unicodedata.normalize('NFKD', value)
    return ''.join(ch for ch in normalized if not unicodedata.combining(ch))


def _sanitize_ds160_safe_text(value):
    """Normalize Excel text into a DS-160 friendly ASCII subset."""
    if value is None:
        return ''
    text = _normalize_ds160_ascii_text(value).upper().strip()
    if not text:
        return ''

    replacements = {
        ',': ' ',
        '，': ' ',
        '、': ' ',
        ';': ' ',
        '；': ' ',
        ':': ' ',
        '：': ' ',
        '/': ' ',
        '\\': ' ',
        '.': ' ',
        '。': ' ',
        '·': ' ',
        '•': ' ',
        '(': ' ',
        ')': ' ',
        '[': ' ',
        ']': ' ',
        '{': ' ',
        '}': ' ',
        '"': ' ',
        '“': ' ',
        '”': ' ',
        '‘': "'",
        '’': "'",
        '`': "'",
        '´': "'",
        '—': '-',
        '–': '-',
        '－': '-',
        '_': '-',
        '#': ' ',
        '@': ' ',
        '!': ' ',
        '?': ' ',
        '*': ' ',
        '%': ' ',
        '$': ' ',
        '+': ' ',
        '=': ' ',
        '|': ' ',
        '<': ' ',
        '>': ' ',
        '^': ' ',
        '~': ' ',
        '\n': ' ',
        '\r': ' ',
        '\t': ' ',
    }
    for source, target in replacements.items():
        text = text.replace(source, target)

    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"[^A-Z0-9&' -]", ' ', text)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s*-\s*", "-", text)
    text = re.sub(r"\s*&\s*", " & ", text)
    text = re.sub(r"\s*'\s*", "'", text)
    return re.sub(r"\s+", " ", text).strip()


def _sanitize_ds160_phone(value):
    if value is None:
        return ''
    text = _normalize_ds160_ascii_text(value).upper()
    text = re.sub(r"[^0-9 -]", ' ', text)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s*-\s*", "-", text)
    return re.sub(r"\s+", " ", text).strip()


def _sanitize_ds160_country_text(value):
    if value is None:
        return ''

    raw = str(value).strip()
    if not raw:
        return ''

    raw_upper = _normalize_ds160_ascii_text(raw).upper().strip()
    compact = re.sub(r"[\s\.\-_,'’`]+", "", raw_upper)

    aliases = {
        "中国": "CHINA",
        "中华人民共和国": "CHINA",
        "中國": "CHINA",
        "CHINA": "CHINA",
        "PRC": "CHINA",
        "PEOPLESREPUBLICOFCHINA": "CHINA",
        "UNITEDKINGDOM": "UNITED KINGDOM",
        "UK": "UNITED KINGDOM",
        "U K": "UNITED KINGDOM",
        "GREATBRITAIN": "UNITED KINGDOM",
        "BRITAIN": "UNITED KINGDOM",
        "ENGLAND": "UNITED KINGDOM",
        "英国": "UNITED KINGDOM",
        "英國": "UNITED KINGDOM",
        "UNITEDSTATES": "UNITED STATES",
        "UNITEDSTATESOFAMERICA": "UNITED STATES",
        "USA": "UNITED STATES",
        "US": "UNITED STATES",
        "U S A": "UNITED STATES",
        "美国": "UNITED STATES",
        "美國": "UNITED STATES",
        "FRANCE": "FRANCE",
        "法国": "FRANCE",
        "法國": "FRANCE",
        "CANADA": "CANADA",
        "加拿大": "CANADA",
        "JAPAN": "JAPAN",
        "日本": "JAPAN",
        "SOUTHKOREA": "SOUTH KOREA",
        "KOREAREPUBLICOF": "SOUTH KOREA",
        "韩国": "SOUTH KOREA",
        "韓國": "SOUTH KOREA",
        "HONGKONG": "HONG KONG",
        "HONGKONGSAR": "HONG KONG",
        "香港": "HONG KONG",
        "TAIWAN": "TAIWAN",
        "台湾": "TAIWAN",
        "臺灣": "TAIWAN",
    }

    if raw in aliases:
        return aliases[raw]
    if compact in aliases:
        return aliases[compact]
    if raw_upper in aliases:
        return aliases[raw_upper]

    sanitized = _sanitize_ds160_safe_text(raw_upper)
    return sanitized


def _sanitize_ds160_excel_fields(result):
    text_fields = (
        'home_address',
        'home_city',
        'home_state',
        'home_zip',
        'Present Employer or School Name',
        'Present Employer or School Address',
        'Present Employer or School City',
        'Present Employer or School State',
        'Present Employer or School Zip',
        'Previous Employer or School Name',
        'Previous Employer or School Address',
        'Previous Employer or School City',
        'Previous Employer or School State',
        'Previous Employer or School Zip',
        'Name of the educational institution',
        'Educational Institution Address',
        'Educational Institution City',
        'Educational Institution State',
        'Educational Institution Zip',
        'Job Title',
        'Briefly describe your duties',
        'previous_employer_describe_duties',
        'Course of Study',
        'Previous Employer or School Supervisor Surname',
        'Previous Employer or School Supervisor Given Name',
        'Language Name 1',
        'Language Name 2',
    )
    country_fields = (
        'Present Employer or School Country',
        'Previous Employer or School Country',
        'Educational Institution Country',
        'home_country',
        'birth_country',
        'trip_payer_country',
        'hotel_country',
    )
    phone_fields = (
        'Present Employer or School Phone',
        'Previous Employer or School Phone',
        'Educational Institution Phone',
    )

    for field_name in text_fields:
        if field_name in result and result[field_name]:
            result[field_name] = _sanitize_ds160_safe_text(result[field_name])

    for field_name in country_fields:
        if field_name in result and result[field_name]:
            result[field_name] = _sanitize_ds160_country_text(result[field_name])

    for field_name in phone_fields:
        if field_name in result and result[field_name]:
            result[field_name] = _sanitize_ds160_phone(result[field_name])

    return result


def _parse_month_to_int(month_str):
    """解析月份字符串为 1-12，支持：8、08、8月、八月、8.0、AUG 等"""
    if pd.isna(month_str) or month_str == '':
        return None
    s = str(month_str).strip().upper()
    # 去掉 "月" 后缀（8月、08月）
    if s.endswith('月'):
        s = s[:-1].strip()
    # 英文月份缩写（format_month 可能已转换）
    en_map = {'JAN':1,'FEB':2,'MAR':3,'APR':4,'MAY':5,'JUN':6,'JUL':7,'AUG':8,'SEP':9,'OCT':10,'NOV':11,'DEC':12}
    if s in en_map:
        return en_map[s]
    # 中文数字
    cn_map = {'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'十二':12}
    if s in cn_map:
        return cn_map[s]
    # 纯数字（含 8.0 等 Excel 浮点）
    s_clean = s.replace('.0', '').split('.')[0].strip()
    if s_clean.isdigit():
        m = int(s_clean)
        if 1 <= m <= 12:
            return m
    return None

def month_for_travel_dropdown(month_str):
    """DS-160 Travel 日期月份下拉框使用 value=1..12（无前导零）"""
    try:
        m = _parse_month_to_int(month_str)
        return str(m) if m else '1'
    except Exception:
        return '1'

def day_for_travel_dropdown(day_str):
    """DS-160 Travel 日期日下拉框使用 value=1..31（无前导零）"""
    try:
        if pd.isna(day_str) or day_str == '':
            return '1'
        s = str(day_str).strip()
        if s.isdigit():
            d = int(s)
            if 1 <= d <= 31:
                return str(d)
        return str(int(s)) if s.isdigit() else '1'
    except Exception:
        return '1'

def format_day(day_str):
    """Zero-pad day to two digits (01-31) for DS-160 dropdowns"""
    try:
        if pd.isna(day_str) or day_str == '':
            return ''
        day_str = str(day_str).strip()
        if day_str.isdigit():
            d = int(day_str)
            if 1 <= d <= 31:
                return str(d).zfill(2)
        return day_str.zfill(2) if day_str.isdigit() else day_str
    except Exception as e:
        print(f"Day formatting error: {day_str}, Error: {str(e)}")
        return str(day_str)

def get_country_code(country_name):
    """Convert country name to DS-160 country code"""
    country_code_map = {
        'CHINA': 'CHIN',
        'UNITED KINGDOM': 'GRBR',
        'UNITED STATES': 'USA',
        'CANADA': 'CAN',
        'AUSTRALIA': 'ASTL',
        'JAPAN': 'JPN',
        'SOUTH KOREA': 'KOR',
        'GERMANY': 'GER',
        'FRANCE': 'FRAN',
        'ITALY': 'ITLY',
        'SPAIN': 'SPN',
        'NETHERLANDS': 'NETH',
        'SWITZERLAND': 'SWTZ',
        'SWEDEN': 'SWDN',
        'NORWAY': 'NORW',
        'DENMARK': 'DEN',
        'FINLAND': 'FIN',
        'SINGAPORE': 'SING',
        'HONG KONG': 'HNK',
        'TAIWAN': 'TWAN',
        'THAILAND': 'THAI',
        'VIETNAM': 'VTNM',
        'PHILIPPINES': 'PHIL',
        'INDONESIA': 'IDSA',
        'MALAYSIA': 'MLAS',
        'INDIA': 'IND',
        'BRAZIL': 'BRZL',
        'MEXICO': 'MEX',
        'ARGENTINA': 'ARG',
        'CHILE': 'CHIL',
        'RUSSIA': 'RUS',
        'UKRAINE': 'UKR',
        'POLAND': 'POL',
        'CZECH REPUBLIC': 'CZEC',
        'HUNGARY': 'HUNG',
        'ROMANIA': 'ROM',
        'BULGARIA': 'BULG',
        'GREECE': 'GRC',
        'TURKEY': 'TRKY',
        'ISRAEL': 'ISRL',
        'SAUDI ARABIA': 'SARB',
        'UNITED ARAB EMIRATES': 'UAE',
        'EGYPT': 'EGYP',
        'SOUTH AFRICA': 'SAFR',
        'NIGERIA': 'NRA',
        'KENYA': 'KENY',
        'MOROCCO': 'MORO',
        'TUNISIA': 'TNSA',
        'ALGERIA': 'ALGR',
        'LIBYA': 'LBYA',
        'SUDAN': 'SUDA',
        'ETHIOPIA': 'ETH',
        'GHANA': 'GHAN',
        'UGANDA': 'UGAN',
        'TANZANIA': 'TAZN',
        'ZAMBIA': 'ZAMB',
        'ZIMBABWE': 'ZIMB',
        'BOTSWANA': 'BOT',
        'NAMIBIA': 'NAMB',
        'MOZAMBIQUE': 'MOZ',
        'MADAGASCAR': 'MADG',
        'MAURITIUS': 'MRTS',
        'SEYCHELLES': 'SEYC',
        'RWANDA': 'RWND',
        'BURUNDI': 'BRND',
        'MALAWI': 'MALW',
        'LESOTHO': 'LES',
        'SWAZILAND': 'SZLD',
        'COMOROS': 'COMO',
        'DJIBOUTI': 'DJI',
        'ERITREA': 'ERI',
        'SOMALIA': 'SOMA',
        'CENTRAL AFRICAN REPUBLIC': 'CAFR',
        'CHAD': 'CHAD',
        'CAMEROON': 'CMRN',
        'EQUATORIAL GUINEA': 'EGN',
        'GABON': 'GABN',
        'CONGO': 'CONB',
        'DEMOCRATIC REPUBLIC OF THE CONGO': 'COD',
        'ANGOLA': 'ANGL',
        'SAO TOME AND PRINCIPE': 'STPR',
        'CAPE VERDE': 'CAVI',
        'GUINEA': 'GNEA',
        'GUINEA-BISSAU': 'GUIB',
        'SIERRA LEONE': 'SLEO',
        'LIBERIA': 'LIBR',
        'IVORY COAST': 'IVCO',
        'BURKINA FASO': 'BURK',
        'MALI': 'MALI',
        'NIGER': 'NIR',
        'MAURITANIA': 'MAUR',
        'SENEGAL': 'SENG',
        'GAMBIA': 'GAM',
        'BENIN': 'BENN',
        'TOGO': 'TOGO'
    }
    
    country_name_upper = str(country_name).strip().upper()
    return country_code_map.get(country_name_upper, 'CHIN')  # 默认使用中国

# DS-160 婚姻状况：Excel 填写值 → 表单下拉框选项（需与 DS-160 页面完全一致）
DS160_MARITAL_STATUS = {
    "SINGLE": "SINGLE",
    "MARRIED": "MARRIED",
    "COMMON LAW MARRIAGE": "COMMON LAW MARRIAGE",
    "CIVIL UNION/DOMESTIC PARTNERSHIP": "CIVIL UNION/DOMESTIC PARTNERSHIP",
    "WIDOWED": "WIDOWED",
    "DIVORCED": "DIVORCED",
    "LEGALLY SEPARATED": "LEGALLY SEPARATED",
    "OTHER": "OTHER",
    # 中文映射
    "单身": "SINGLE",
    "未婚": "SINGLE",
    "已婚": "MARRIED",
    "丧偶": "WIDOWED",
    "离异": "DIVORCED",
    "离婚": "DIVORCED",
    "合法分居": "LEGALLY SEPARATED",
    "事实婚姻": "COMMON LAW MARRIAGE",
    "民事结合": "CIVIL UNION/DOMESTIC PARTNERSHIP",
    "其他": "OTHER",
}

# DS-160 美国驾照颁发州：Excel 填写值 → 表单下拉框 value（2 字母州代码）
US_STATE_DRIVERS_LICENSE = {
    "AL": "AL", "ALABAMA": "AL", "阿拉巴马": "AL", "亚拉巴马": "AL",
    "AK": "AK", "ALASKA": "AK", "阿拉斯加": "AK",
    "AS": "AS", "AMERICAN SAMOA": "AS", "美属萨摩亚": "AS",
    "AZ": "AZ", "ARIZONA": "AZ", "亚利桑那": "AZ",
    "AR": "AR", "ARKANSAS": "AR", "阿肯色": "AR",
    "CA": "CA", "CALIFORNIA": "CA", "加州": "CA", "加利福尼亚": "CA",
    "CO": "CO", "COLORADO": "CO", "科罗拉多": "CO",
    "CT": "CT", "CONNECTICUT": "CT", "康涅狄格": "CT",
    "DE": "DE", "DELAWARE": "DE", "特拉华": "DE",
    "DC": "DC", "DISTRICT OF COLUMBIA": "DC", "华盛顿特区": "DC", "哥伦比亚特区": "DC",
    "FL": "FL", "FLORIDA": "FL", "佛罗里达": "FL",
    "GA": "GA", "GEORGIA": "GA", "佐治亚": "GA", "乔治亚": "GA",
    "GU": "GU", "GUAM": "GU", "关岛": "GU",
    "HI": "HI", "HAWAII": "HI", "夏威夷": "HI",
    "ID": "ID", "IDAHO": "ID", "爱达荷": "ID",
    "IL": "IL", "ILLINOIS": "IL", "伊利诺伊": "IL",
    "IN": "IN", "INDIANA": "IN", "印第安纳": "IN",
    "IA": "IA", "IOWA": "IA", "艾奥瓦": "IA", "爱荷华": "IA",
    "KS": "KS", "KANSAS": "KS", "堪萨斯": "KS",
    "KY": "KY", "KENTUCKY": "KY", "肯塔基": "KY",
    "LA": "LA", "LOUISIANA": "LA", "路易斯安那": "LA",
    "ME": "ME", "MAINE": "ME", "缅因": "ME",
    "MD": "MD", "MARYLAND": "MD", "马里兰": "MD",
    "MA": "MA", "MASSACHUSETTS": "MA", "马萨诸塞": "MA", "麻省": "MA",
    "MI": "MI", "MICHIGAN": "MI", "密歇根": "MI", "密西根": "MI",
    "MN": "MN", "MINNESOTA": "MN", "明尼苏达": "MN",
    "MS": "MS", "MISSISSIPPI": "MS", "密西西比": "MS",
    "MO": "MO", "MISSOURI": "MO", "密苏里": "MO",
    "MT": "MT", "MONTANA": "MT", "蒙大拿": "MT",
    "NE": "NE", "NEBRASKA": "NE", "内布拉斯加": "NE",
    "NV": "NV", "NEVADA": "NV", "内华达": "NV",
    "NH": "NH", "NEW HAMPSHIRE": "NH", "新罕布什尔": "NH",
    "NJ": "NJ", "NEW JERSEY": "NJ", "新泽西": "NJ",
    "NM": "NM", "NEW MEXICO": "NM", "新墨西哥": "NM",
    "NY": "NY", "NEW YORK": "NY", "纽约": "NY",
    "NC": "NC", "NORTH CAROLINA": "NC", "北卡罗来纳": "NC", "北卡": "NC",
    "ND": "ND", "NORTH DAKOTA": "ND", "北达科他": "ND",
    "MP": "MP", "NORTHERN MARIANA ISLANDS": "MP", "北马里亚纳": "MP",
    "OH": "OH", "OHIO": "OH", "俄亥俄": "OH",
    "OK": "OK", "OKLAHOMA": "OK", "俄克拉何马": "OK",
    "OR": "OR", "OREGON": "OR", "俄勒冈": "OR",
    "PA": "PA", "PENNSYLVANIA": "PA", "宾夕法尼亚": "PA", "宾州": "PA",
    "PR": "PR", "PUERTO RICO": "PR", "波多黎各": "PR",
    "RI": "RI", "RHODE ISLAND": "RI", "罗德岛": "RI",
    "SC": "SC", "SOUTH CAROLINA": "SC", "南卡罗来纳": "SC", "南卡": "SC",
    "SD": "SD", "SOUTH DAKOTA": "SD", "南达科他": "SD",
    "TN": "TN", "TENNESSEE": "TN", "田纳西": "TN",
    "TX": "TX", "TEXAS": "TX", "德州": "TX", "得克萨斯": "TX",
    "UT": "UT", "UTAH": "UT", "犹他": "UT",
    "VT": "VT", "VERMONT": "VT", "佛蒙特": "VT",
    "VI": "VI", "VIRGIN ISLANDS": "VI", "维尔京群岛": "VI",
    "VA": "VA", "VIRGINIA": "VA", "弗吉尼亚": "VA", "维吉尼亚": "VA",
    "WA": "WA", "WASHINGTON": "WA", "华盛顿州": "WA", "华盛顿": "WA",
    "WV": "WV", "WEST VIRGINIA": "WV", "西弗吉尼亚": "WV",
    "WI": "WI", "WISCONSIN": "WI", "威斯康星": "WI",
    "WY": "WY", "WYOMING": "WY", "怀俄明": "WY",
}

def _resolve_us_state_for_ds160(state_raw):
    """将州名（中文/英文全称/缩写）转为 DS-160 驾照州下拉框 value（2 字母代码）"""
    s = str(state_raw or "").strip()
    if not s:
        return ""
    key = s.upper()
    if key in US_STATE_DRIVERS_LICENSE:
        return US_STATE_DRIVERS_LICENSE[key]
    # 中文匹配
    if s in US_STATE_DRIVERS_LICENSE:
        return US_STATE_DRIVERS_LICENSE[s]
    return key if len(key) == 2 else ""

# DS-160 国家下拉框常用别名（用户 country_map 可能缺失或格式不一致）
DS160_COUNTRY_ALIASES = {
    "KOREA SOUTH": "KOREA, REPUBLIC OF",
    "SOUTH KOREA": "KOREA, REPUBLIC OF",
    "KOREA": "KOREA, REPUBLIC OF",
    "KOREA REPUBLIC OF": "KOREA, REPUBLIC OF",
    "KOREA NORTH": "KOREA, DEMOCRATIC PEOPLE'S REPUBLIC OF",
    "NORTH KOREA": "KOREA, DEMOCRATIC PEOPLE'S REPUBLIC OF",
    "TAIWAN": "TAIWAN",
    "HONG KONG": "HONG KONG SAR",
    "MACAU": "MACAO SAR",
    "MACAO": "MACAO SAR",
    "VIETNAM": "VIET NAM",
    "VIET NAM": "VIET NAM",
    "RUSSIA": "RUSSIAN FEDERATION",
    "BOLIVIA": "BOLIVIA, PLURINATIONAL STATE OF",
    "IRAN": "IRAN, ISLAMIC REPUBLIC OF",
    "LAOS": "LAO PEOPLE'S DEMOCRATIC REPUBLIC",
    "SYRIA": "SYRIAN ARAB REPUBLIC",
    "VENEZUELA": "VENEZUELA, BOLIVARIAN REPUBLIC OF",
}
def _resolve_country_for_ds160(country_raw, country_dict=None):
    """将国家名转为 DS-160 下拉框可识别的格式。优先使用用户 country_map.xlsx，再用别名修正格式"""
    s = str(country_raw).strip()
    if not s:
        return None
    en = (country_dict or {}).get(s, s)
    en = str(en).strip().upper()
    return DS160_COUNTRY_ALIASES.get(en, en)

def _do_select_country(page, selector, country, log, idx, total):
    """选择国家下拉框，支持 label 失败时尝试 value 或模糊匹配，并验证是否选中"""
    labels_to_try = [country]
    if "," in country:
        labels_to_try.append(country.replace(", ", ", "))  # 保持原样
    for attempt in range(2):
        for lbl in labels_to_try:
            try:
                page.select_option(selector, label=lbl)
                page.wait_for_timeout(300)
                sel = page.query_selector(selector)
                if sel:
                    val = sel.evaluate("el => el.value")
                    opts = sel.evaluate("el => Array.from(el.options).map(o => o.value)")
                    if val and str(val) and "-SELECT" not in str(val).upper():
                        log.info(f"[国家] 第 {idx} 个选择成功: {country}")
                        print(f"已选择去过的国家 {idx}/{total}: {country}")
                        return
                if attempt == 0:
                    page.wait_for_timeout(400)
            except Exception as e:
                log.debug(f"[国家] label={lbl} 失败: {e}")
        try:
            opts = page.evaluate(f"""() => {{
                const el = document.querySelector('{selector}');
                if (!el) return [];
                return Array.from(el.options).slice(1).map(o => ({{label: o.text.trim(), value: o.value}}));
            }}""") or []
            for opt in opts:
                if country.upper() in str(opt.get("label", "")).upper():
                    page.select_option(selector, value=opt.get("value"))
                    page.wait_for_timeout(300)
                    print(f"已选择去过的国家 {idx}/{total}: {country} (value匹配)")
                    return
        except Exception:
            pass
    raise ValueError(f"无法选择国家: {country}")

def load_country_map(country_map_path):
    """Load Chinese-English country mapping table, return {Chinese: English} dictionary. 使用用户提供的 country_map.xlsx"""
    country_dict = {}
    if not country_map_path or not os.path.exists(country_map_path):
        return country_dict
    try:
        df = pd.read_excel(country_map_path)
        for _, row in df.iterrows():
            en = str(row["English Name"]).strip().upper()
            cn = str(row["Chinese Name"]).strip()
            country_dict[cn] = en
        print(f"[INFO] 已加载用户映射表: {country_map_path}，共 {len(country_dict)} 个国家", file=sys.stderr)
    except Exception as e:
        print(f"[WARN] 加载 country_map 失败: {e}", file=sys.stderr)
    return country_dict

def process_excel_data(excel_path, country_dict=None):
    """Process Excel data and return DS-160 required format"""
    try:
        # Read Excel file
        df = pd.read_excel(excel_path)
        
        # Field mapping
        field_mapping = {
            '姓': 'surname',
            '名': 'given_name',
            '中文名': 'chinese_name',
            '照片文件名': 'photo_filename',
            '是否有曾用名': 'has_former_name',
            '曾用名姓氏': 'former_name_surname',
            '曾用名名字': 'former_name_given_name',
            '姓(拼音）': 'former_name_surname',   # 2026 模板用此表示曾用名姓氏
            '名(拼音）': 'former_name_given_name',  # 2026 模板用此表示曾用名名字
            '姓(拼音)': 'former_name_surname',
            '名(拼音)': 'former_name_given_name',
            '姓氏电报码': 'telecode_surname',
            '名字电报码': 'telecode_given_name',
            '性别': 'gender',
            '婚姻状况': 'marital_status',
            '出生年月日': 'birth_date',
            '出生省份': 'birth_province',
            '出生城市': 'birth_city',
            '出生国家': 'birth_country',
            '国籍': 'nationality',
            '身份证号': 'id_number',
            '计划到达年份': 'intended_arrival_year',
            '计划到达月份': 'intended_arrival_month',
            '计划到达日期': 'intended_arrival_day',
            '计划停留天数': 'intended_stay_days',
            '酒店地址': 'hotel_address',
            '酒店名称': 'hotel_name',
            '酒店城市': 'hotel_city',
            '酒店州': 'hotel_state',
            '酒店邮编': 'hotel_zip',
            '酒店国家': 'hotel_country',
            '酒店电话': 'hotel_phone',
            '酒店邮箱': 'hotel_email',
            '入住日期': 'hotel_checkin_date',
            '退房日期': 'hotel_checkout_date',
            '旅行费用支付人': 'trip_payer',
            '其他支付者': 'trip_payer_other',
            '与支付者关系': 'trip_payer_relationship',
            '支付者地址': 'trip_payer_address',
            '支付者城市': 'trip_payer_city',
            '支付者州': 'trip_payer_state',
            '支付者国家': 'trip_payer_country',
            '支付者邮编': 'trip_payer_zip',
            '支付者电话': 'trip_payer_phone',
            '支付者邮箱': 'trip_payer_email',
            '是否去过美国': 'previous_us_travel',
            '去美年份': 'previous_us_travel_year',
            '去美月份': 'previous_us_travel_month',
            '去美日期': 'previous_us_travel_day',
            '去美国家': 'previous_us_travel_country',
            '去美城市': 'previous_us_travel_city',
            '去美州': 'previous_us_travel_state',
            '到达美国的日期': 'previous_us_travel_arrival_date',
            '在美国呆的数量': 'previous_us_travel_los_number',
            '在美国呆的单位': 'previous_us_travel_los_unit',
            '是否有美国驾照': 'has_us_drivers_license',
            '美国驾照号码': 'us_drivers_license_number',
            '驾照颁发州': 'us_drivers_license_state',
            '是否曾有美国签证': 'has_us_visa',
            '美国签证号': 'us_visa_number',
            '签证签发日期': 'us_visa_issue_date',
            '签证到期日期': 'us_visa_expiration_date',
            '签证签发地': 'us_visa_place_of_issue',
            '签证类型': 'us_visa_type',
            '签证状态': 'us_visa_status',
            '签证签发日': 'us_visa_issue_date',
            '签证有效期': 'us_visa_expiration_date',
            '签证有效日期': 'us_visa_expiration_date',
            '是否申请同类型签证': 'apply_same_visa_type',
            '是否在同一签发地申请': 'apply_same_country_location',
            '是否采集过十指指纹': 'has_been_ten_printed',
            '签证是否遗失或被盗': 'visa_lost_or_stolen',
            '签证遗失或被盗年份': 'visa_lost_or_stolen_year',
            '签证遗失或被盗说明': 'visa_lost_or_stolen_explanation',
            '签证是否被取消或吊销': 'visa_cancelled_or_revoked',
            '签证被取消或吊销说明': 'visa_cancelled_or_revoked_explanation',
            '是否被拒签': 'has_been_refused_visa',
            '被拒签原因': 'has_been_refused_reason',
            '是否有人为您提交移民签证申请': 'has_immigrant_petition',
            '移民签证申请说明': 'immigrant_petition_explanation',
            '（目前）家庭地址': 'home_address',
            '家庭城市': 'home_city',
            '家庭省/州': 'home_state',
            '家庭所在国': 'home_country',
            '家庭邮编': 'home_zip',
            '主要电话': 'Primary Phone Number',
            '近五年电话': 'last five years phone number',
            '个人邮箱': 'Personal Email Address',
            '近五年邮箱': 'last five years email address',
            'QQ': 'qq',
            'YouTube': 'youtube',
            '抖音': 'tiktok',
            'Instagram': 'instagram',
            '新浪微博': 'sina_weibo',
            '护照号': 'passport_number',
            '护照类型': 'passport_type',
            '护照本编号': 'Passport Book Number',
            '护照签发国家': 'passport_place_of_issue',
            '护照签发城市': 'passport_issue_city',
            '护照签发省/州': 'passport_issue_state',
            '护照签发日期': 'passport_issue_date',
            '护照到期日期': 'passport_expiration_date',
            '父亲姓': 'father_surname',
            '父亲名': 'father_given_name',
            '父亲出生日期': 'father_birth_date',
            '母亲姓': 'mother_surname',
            '母亲名': 'mother_given_name',
            '母亲出生日期': 'mother_birth_date',
            '主要职业': 'Primary Occupation',   
            '当前学校/单位': 'Present Employer or School Name',
            '当前学校/单位地址': 'Present Employer or School Address',
            '当前城市': 'Present Employer or School City',
            '当前州/省': 'Present Employer or School State',
            '当前邮编': 'Present Employer or School Zip',
            '当前学校电话': 'Present Employer or School Phone',
            '当前学校所在国家': 'Present Employer or School Country',
            '入学日期': 'Present Employer or School Start Date',
            '专业描述': 'Briefly describe your duties',
            '是否有工作经历': 'Were you previously employed',
            '前学校/单位': 'Previous Employer or School Name',
            '前单位职位': 'Job Title',
            '职位': 'Job Title',
            'Job Title': 'Job Title',
            '前学校/单位地址': 'Previous Employer or School Address',
            '前城市': 'Previous Employer or School City',
            '前州/省': 'Previous Employer or School State',
            '前邮编': 'Previous Employer or School Zip',
            '前单位电话': 'Previous Employer or School Phone',
            '前单位国家': 'Previous Employer or School Country',
            '前单位开始日期': 'Previous Employer or School Start Date',
            '前单位结束日期': 'Previous Employer or School End Date',
            '前主管姓': 'Previous Employer or School Supervisor Surname',
            '前主管名': 'Previous Employer or School Supervisor Given Name',
            '前单位工作内容': 'previous_employer_describe_duties',
            '是否接受过中学以上教育': 'Have you attended any educational institutions at a secondary level or above?',
            '学校名称': 'Name of the educational institution',
            '学校地址': 'Educational Institution Address',
            '学校城市': 'Educational Institution City',
            '学校州/省': 'Educational Institution State',
            '学校邮编': 'Educational Institution Zip',
            '学校电话': 'Educational Institution Phone',
            '学校所在国家': 'Educational Institution Country',
            '教育开始时间': 'Educational Institution Start Date',
            '教育结束时间': 'Educational Institution End Date',
            '所学专业/课程': 'Course of Study',
            '语言1': 'Language Name 1',
            '语言2': 'Language Name 2',
            '是否去过其他国家': 'have you traveled to any other countries',
            '国家数量': 'total number of countries',
            '去过的国家1': 'Country of travel 1',
            '去过的国家2': 'Country of travel 2',
            '去过的国家3': 'Country of travel 3',
            '去过的国家4': 'Country of travel 4',
            '去过的国家5': 'Country of travel 5',
            '去过的国家6': 'Country of travel 6',
            '去过的国家7': 'Country of travel 7',
            '去过的国家8': 'Country of travel 8',
            '去过的国家9': 'Country of travel 9',
            '去过的国家10': 'Country of travel 10',
            'Application ID': 'application_id',
        }
        
        # Create result dictionary
        result = {}
        print("字段映射和数据预处理开始！")
        
        
        # Process each row of data
        for index, row in df.iterrows():
            try:
                # Handle different Excel formats
                if "Field" in df.columns:
                    # New format with Field column
                    cn_field = str(row["基本信息"]).strip()
                    value = row["填写内容"]
                else:
                    # Original format
                    cn_field = str(row["基本信息"]).strip()
                    value = row["填写内容"]
                
                # Get corresponding English field name
                en_field = field_mapping.get(cn_field)
                if en_field:
                    # Handle special fields
                    if pd.isna(value):
                        value = ''
                    elif isinstance(value, bool):
                        value = 'Yes' if value else 'No'
                    elif en_field.startswith('Country of travel') and country_dict:
                        # Auto Chinese-English conversion
                        value = country_dict.get(str(value).strip(), str(value).strip())
                    elif 'country' in en_field.lower() and country_dict:
                        # 处理所有包含country的字段
                        chinese_country = str(value).strip()
                        english_country = country_dict.get(chinese_country, chinese_country)
                        print(f"国家转换: {chinese_country} -> {english_country}")
                        value = english_country
                    elif 'date' in en_field.lower():
                        value = format_date(value)
                    elif 'month' in en_field.lower():
                        value = format_month(value)
                    elif 'gender' in en_field.lower():
                        value = str(value).upper()
                    elif 'marital_status' in en_field.lower():
                        raw = str(value).strip()
                        raw_upper = raw.upper()
                        value = DS160_MARITAL_STATUS.get(raw_upper) or DS160_MARITAL_STATUS.get(raw) or raw_upper
                    elif en_field == 'us_drivers_license_state':
                        value = _resolve_us_state_for_ds160(value)
                    elif 'state' in en_field.lower():
                        value = str(value).upper()
                    elif 'occupation' in en_field.lower():
                        value = str(value).upper()
                    else:
                        value = str(value)
                    
                    result[en_field] = value
            except Exception as e:
                print(f"Error processing row {index}: {str(e)}")
                continue

        # 若计划到达日期为完整 YYYY-MM-DD，解析到 year/month/day
        arrival_day = result.get('intended_arrival_day', '')
        if arrival_day and re.match(r'^\d{4}-\d{1,2}-\d{1,2}', str(arrival_day)):
            try:
                parts = str(arrival_day).strip().split('-')
                if len(parts) >= 3:
                    result['intended_arrival_year'] = result.get('intended_arrival_year') or str(parts[0])
                    result['intended_arrival_month'] = result.get('intended_arrival_month') or format_month(parts[1])
                    result['intended_arrival_day'] = format_day(parts[2])
            except Exception:
                pass
        # 若「到达美国的日期」为完整日期，解析到 previous_us_travel_year/month/day
        prev_arrival = result.get('previous_us_travel_arrival_date', '')
        if prev_arrival and re.match(r'^\d{4}[-/\.]\d{1,2}[-/\.]\d{1,2}', str(prev_arrival)):
            try:
                parts = re.split(r'[-/\.]', str(prev_arrival).strip()[:10])
                if len(parts) >= 3:
                    result['previous_us_travel_year'] = result.get('previous_us_travel_year') or str(parts[0])
                    result['previous_us_travel_month'] = result.get('previous_us_travel_month') or str(parts[1]).zfill(2)
                    result['previous_us_travel_day'] = result.get('previous_us_travel_day') or str(int(float(parts[2])))
            except Exception:
                pass

        # 为 day 类型字段补零（计划到达日期等）
        for day_key in ('intended_arrival_day',):
            if day_key in result and result[day_key]:
                result[day_key] = format_day(result[day_key])
        
        return [result]  # Return a list containing a single dictionary to maintain compatibility with previous code
        print(f"📝 当前 result 字典内容如下：{result}")
    except Exception as e:
        print(f"Error processing Excel data: {str(e)}")
        raise

class DS160Filler:
    def __init__(self, api_key, capsolver_key=None):
        self.api_key = api_key
        self.capsolver_key = capsolver_key or os.environ.get("CAPSOLVER_API_KEY", "").strip() or os.environ.get("CAPSOLVER_KEY", "").strip()

    def solve_captcha(self, image_path):
        """识别验证码：优先 2Captcha（美签历史行为），失败再试 Capsolver。"""
        if not os.path.exists(image_path):
            print(f"Error: CAPTCHA image file does not exist: {image_path}")
            return None

        if self.api_key:
            result = self._solve_captcha_2captcha(image_path)
            if result:
                return result
            if self.capsolver_key:
                print("Warning: 2Captcha failed, trying Capsolver...")

        if self.capsolver_key:
            result = self._solve_captcha_capsolver(image_path)
            if result:
                return result
            if self.api_key:
                print("Warning: Capsolver failed after 2Captcha was already attempted.")
            else:
                print("Error: Capsolver failed and no 2Captcha key configured")
            return None

        if not self.api_key:
            print("Error: CAPTCHA API key not set (CAPTCHA_API_KEY/2CAPTCHA_API_KEY or CAPSOLVER_API_KEY)")
        return None

    def _solve_captcha_2captcha(self, image_path):
        """使用 2Captcha 识别图片验证码（DS-160 登录页）。"""
        if not self.api_key:
            return None
        # 代理设置：优先 CAPTCHA_PROXY，其次 TLS_PROXY/HTTPS_PROXY
        proxy_url = (
            os.environ.get("CAPTCHA_PROXY", "").strip()
            or os.environ.get("TLS_PROXY", "").strip()
            or os.environ.get("HTTPS_PROXY", "").strip()
        )
        if proxy_url:
            proxies = {"http": proxy_url, "https": proxy_url}
        else:
            proxies = {"http": None, "https": None}
        # 可选的备用域名（部分网络环境下 2captcha.com 连不通时可尝试）
        api_base = os.environ.get("CAPTCHA_API_BASE", "https://2captcha.com").rstrip("/")

        def _post_captcha():
            with open(image_path, 'rb') as f:
                return requests.post(
                    f'{api_base}/in.php',
                    files={'file': f},
                    data={'key': self.api_key, 'json': 1, 'regsense': 1},
                    timeout=30,
                    proxies=proxies
                )

        def _get_result(captcha_id):
            return requests.get(
                f'{api_base}/res.php?key={self.api_key}&action=get&id={captcha_id}&json=1',
                timeout=30,
                proxies=proxies
            )

        # 提交验证码：SSL/连接错误时重试最多 3 次
        response = None
        for attempt in range(3):
            try:
                response = _post_captcha()
                break
            except (requests.exceptions.SSLError, requests.exceptions.ConnectionError, OSError) as e:
                _get_logger().warning(f"[2captcha] 提交验证码 SSL/连接错误 (尝试 {attempt + 1}/3): {e}")
                if attempt < 2:
                    time.sleep(2 + attempt)
                else:
                    raise

        if response is None or response.status_code != 200:
            print(f"Error: 2captcha API request failed, status code: {response.status_code if response else 'N/A'}")
            return None

        response_data = response.json()
        if response_data.get('status') != 1:
            print(f"Error: 2captcha returned error status: {response_data.get('request', 'Unknown error')}")
            return None

        captcha_id = response_data.get('request')
        for attempt in range(10):
            time.sleep(1)
            try:
                result = _get_result(captcha_id)
            except (requests.exceptions.SSLError, requests.exceptions.ConnectionError, OSError) as e:
                _get_logger().warning(f"[2captcha] 获取结果 SSL/连接错误 (尝试 {attempt + 1}/10): {e}")
                if attempt < 9:
                    time.sleep(2)
                    continue
            if result.status_code != 200:
                continue

            data = result.json()
            if data.get('status') == 1:
                return data.get('request')
            elif data.get('request') == 'CAPCHA_NOT_READY':
                print(f"Waiting for CAPTCHA result... Attempt {attempt + 1}/10")
            else:
                print(f"CAPTCHA recognition failed: {data.get('request')}")
                return None

        print("CAPTCHA recognition timeout")
        return None

    def _solve_captcha_capsolver(self, image_path):
        """使用 Capsolver ImageToTextTask 识别图片验证码"""
        proxy_url = (
            os.environ.get("CAPTCHA_PROXY", "").strip()
            or os.environ.get("TLS_PROXY", "").strip()
            or os.environ.get("HTTPS_PROXY", "").strip()
        )
        proxies = {"http": proxy_url, "https": proxy_url} if proxy_url else {"http": None, "https": None}
        try:
            with open(image_path, 'rb') as f:
                img_b64 = base64.b64encode(f.read()).decode()
            print(f"Using Capsolver API ({self.capsolver_key[:10]}...)")
            for task_attempt in range(3):
                create_resp = requests.post(
                    'https://api.capsolver.com/createTask',
                    json={
                        "clientKey": self.capsolver_key,
                        "task": {
                            "type": "ImageToTextTask",
                            "body": img_b64,
                        },
                    },
                    timeout=30,
                    proxies=proxies,
                )
                create_data = create_resp.json()
                if create_data.get("errorId") != 0:
                    print(f"Error: Capsolver createTask failed: {create_data.get('errorDescription', create_data)}")
                    if task_attempt < 2:
                        time.sleep(1)
                        continue
                    return None

                task_id = create_data.get("taskId")
                if not task_id:
                    print("Error: Capsolver did not return taskId")
                    if task_attempt < 2:
                        time.sleep(1)
                        continue
                    return None

                should_retry_task = False
                for attempt in range(12):
                    time.sleep(1)
                    result_resp = requests.post(
                        'https://api.capsolver.com/getTaskResult',
                        json={"clientKey": self.capsolver_key, "taskId": task_id},
                        timeout=30,
                        proxies=proxies,
                    )
                    result_data = result_resp.json()
                    if result_data.get("errorId") != 0:
                        description = str(result_data.get("errorDescription", result_data))
                        if "expired" in description.lower() or "invalid" in description.lower():
                            print(f"Warning: Capsolver task expired/invalid, retrying with a new task ({task_attempt + 1}/3)")
                            should_retry_task = True
                            break
                        print(f"Error: Capsolver getTaskResult failed: {description}")
                        return None
                    if result_data.get("status") == "ready":
                        code = result_data.get("solution", {}).get("text", "")
                        if code:
                            return code
                        print("Error: Capsolver returned empty captcha text")
                        return None
                    print(f"Waiting for Capsolver result... Attempt {attempt + 1}/12")

                if not should_retry_task:
                    print(f"Warning: Capsolver task {task_attempt + 1}/3 timed out, creating a new task...")
                if task_attempt < 2:
                    time.sleep(1)
                    continue
            print("Capsolver recognition timeout")
            return None
        except Exception as e:
            print(f"Error: Capsolver exception: {e}")
            return None

    def run(self, personal_info, photo_file, user_email, country_dict=None, debug=False):
        """Run automated form filling program"""
        log = _get_logger()
        log_path = Path(__file__).parent / "ds160.log"
        log.info(f"=== DS160 run start: {personal_info.get('surname','')} {personal_info.get('given_name','')} ===")
        print(f"[DS160] 日志文件: {log_path}", file=sys.stderr, flush=True)
        _step_log("step=Init 启动浏览器...")
        _progress(3, "启动浏览器...")
        with sync_playwright() as p:
            # Configure browser（与 visa-automation-system 对齐，精简参数避免代理/扩展干扰）
            browser_args = [
                "--disable-web-security",
                "--disable-features=IsolateOrigins,site-per-process",
                "--disable-site-isolation-trials",
                "--disable-dev-shm-usage",
                "--disable-setuid-sandbox",
                "--disable-extensions",
                "--disable-popup-blocking",
                "--window-size=1920,1080",
                "--no-proxy-server",
                "--disable-background-networking",
                "--disable-background-timer-throttling",
            ]
            
            import os
            is_headless = True
            browser_args.extend([
                "--headless=new",
                "--disable-gpu",
                "--no-sandbox",
            ])
            
            # 尝试使用 Playwright 自带的 Chromium，若未安装则回退到系统 Chrome
            chrome_path = None
            if platform.system() == "Windows":
                local_app_data = os.environ.get("LOCALAPPDATA", "")
                for path in [
                    os.environ.get("CHROME_PATH"),
                    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                    os.path.join(local_app_data, r"Google\Chrome\Application\chrome.exe") if local_app_data else "",
                ]:
                    if path and os.path.isfile(path):
                        chrome_path = path
                        break

            try:
                browser = p.chromium.launch(
                    headless=is_headless,
                    args=browser_args,
                    slow_mo=0,
                    executable_path=chrome_path if chrome_path else None,
                )
            except Exception as e:
                if "Executable doesn't exist" in str(e) and platform.system() == "Windows" and not chrome_path:
                    # 再次尝试查找系统 Chrome
                    local_app_data = os.environ.get("LOCALAPPDATA", "")
                    for path in [
                        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                        os.path.join(local_app_data, r"Google\Chrome\Application\chrome.exe") if local_app_data else "",
                    ]:
                        if os.path.isfile(path):
                            browser = p.chromium.launch(
                                headless=is_headless,
                                args=browser_args,
                                executable_path=path,
                                slow_mo=0,
                            )
                            break
                    else:
                        raise RuntimeError(
                            "Playwright Chromium 未安装。请运行: python -m playwright install chromium\n"
                            "若已安装 Chrome，可设置环境变量 CHROME_PATH 指向 chrome.exe"
                        ) from e
                else:
                    raise
            
            browser_context = browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                ignore_https_errors=True,
                bypass_csp=True,
                java_script_enabled=True,
                accept_downloads=True,
            )
            
            # Enable additional capabilities for headed mode
            page = browser_context.new_page()
            current_dir = os.path.dirname(os.path.abspath(__file__))
            email_folder_name = user_email.replace('@', '_').replace('.', '_').replace('+', '_')
            new_folder_path = os.path.join(current_dir, email_folder_name)
            os.makedirs(new_folder_path, exist_ok=True)
            for existing_name in os.listdir(new_folder_path):
                if (
                    existing_name.startswith("guide_")
                    and existing_name.lower().endswith(".png")
                ) or (
                    existing_name.startswith("DS160_Review_")
                    and existing_name.lower().endswith(".pdf")
                ) or existing_name in {"recipient_email.txt", "applicant_info.json"}:
                    try:
                        os.remove(os.path.join(new_folder_path, existing_name))
                    except Exception:
                        pass
            guide_capture_index = 1

            def capture_guide_page(label):
                nonlocal guide_capture_index
                safe_label = re.sub(r'[^A-Za-z0-9]+', '_', str(label or '').strip()).strip('_') or 'page'
                screenshot_name = f"guide_{guide_capture_index:02d}_{safe_label}.png"
                screenshot_path = os.path.join(new_folder_path, screenshot_name)
                try:
                    page.wait_for_timeout(300)
                    page.screenshot(path=screenshot_path, full_page=True)
                    print(f"[GUIDE] Saved page screenshot: {screenshot_name}")
                    guide_capture_index += 1
                except Exception as capture_err:
                    print(f"[WARN] Failed to save guide screenshot {screenshot_name}: {capture_err}", file=sys.stderr)

            def save_debug_snapshot(label):
                safe_label = re.sub(r'[^A-Za-z0-9]+', '_', str(label or '').strip()).strip('_') or 'debug'
                ts = int(time.time())
                screenshot_name = f"debug_{ts}_{safe_label}.png"
                html_name = f"debug_{ts}_{safe_label}.html"
                screenshot_path = os.path.join(new_folder_path, screenshot_name)
                html_path = os.path.join(new_folder_path, html_name)
                try:
                    page.screenshot(path=screenshot_path, full_page=True)
                except Exception as shot_err:
                    print(f"[WARN] Failed to save debug screenshot {screenshot_name}: {shot_err}", file=sys.stderr)
                try:
                    with open(html_path, "w", encoding="utf-8") as f:
                        f.write(page.content())
                except Exception as html_err:
                    print(f"[WARN] Failed to save debug html {html_name}: {html_err}", file=sys.stderr)
                return screenshot_name, html_name

            def save_debug_json(label, data):
                safe_label = re.sub(r'[^A-Za-z0-9]+', '_', str(label or '').strip()).strip('_') or 'debug'
                ts = int(time.time())
                json_name = f"debug_{ts}_{safe_label}.json"
                json_path = os.path.join(new_folder_path, json_name)
                try:
                    with open(json_path, "w", encoding="utf-8") as f:
                        json.dump(data, f, ensure_ascii=False, indent=2)
                except Exception as json_err:
                    print(f"[WARN] Failed to save debug json {json_name}: {json_err}", file=sys.stderr)
                return json_name

            def save_work_education_previous_values(label):
                try:
                    data = page.evaluate(
                        """() => {
                            const getField = (selector) => {
                                const el = document.querySelector(selector);
                                if (!el) return null;
                                const tag = (el.tagName || '').toLowerCase();
                                if (tag === 'select') {
                                    const selected = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
                                    return {
                                        selector,
                                        tag,
                                        value: el.value || '',
                                        text: selected ? (selected.text || '').trim() : '',
                                    };
                                }
                                return {
                                    selector,
                                    tag,
                                    value: 'value' in el ? (el.value || '') : ((el.innerText || el.textContent || '').trim()),
                                };
                            };
                            return {
                                previousEmployerName: getField('#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbEmployerName'),
                                previousEmployerAddress1: getField('#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbEmployerStreetAddress1'),
                                previousEmployerAddress2: getField('#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbEmployerStreetAddress2'),
                                previousEmployerCity: getField('#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbEmployerCity'),
                                previousEmployerState: getField('#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbxPREV_EMPL_ADDR_STATE'),
                                previousEmployerPostalCode: getField('#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbxPREV_EMPL_ADDR_POSTAL_CD'),
                                previousEmployerCountry: getField('#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_DropDownList2'),
                                previousEmployerPhone: getField('#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbEmployerPhone'),
                                previousEmployerJobTitle: getField('#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbJobTitle'),
                                previousEmployerDuties: getField('#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbDescribeDuties'),
                                schoolName: getField('#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolName'),
                                schoolAddress1: getField('#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolAddr1'),
                                schoolAddress2: getField('#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolAddr2'),
                                schoolCity: getField('#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolCity'),
                                schoolState: getField('#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxEDUC_INST_ADDR_STATE'),
                                schoolPostalCode: getField('#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxEDUC_INST_POSTAL_CD'),
                                schoolCountry: getField('#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_ddlSchoolCountry'),
                                courseOfStudy: getField('#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolCourseOfStudy'),
                                validationSummary: (document.querySelector('#ctl00_SiteContentPlaceHolder_FormView1_ValidationSummary')?.innerText || '').trim(),
                            };
                        }"""
                    )
                except Exception as dump_err:
                    data = {"error": str(dump_err)}
                return save_debug_json(label, data)

            def is_application_error_page():
                try:
                    html = page.content() or ""
                except Exception:
                    html = ""
                if "Application Error" in html:
                    return True
                try:
                    title = (page.title() or "").strip()
                    if "Application Error" in title:
                        return True
                except Exception:
                    pass
                return False

            def extract_ceac_error_text():
                selectors = [
                    ".error",
                    ".ErrorLabel",
                    ".validation-summary-errors",
                    "span[id*='lblError']",
                    "span[style*='color:Red']",
                    "span[style*='color:red']",
                    "td.errorMessage",
                    "span.errorMessage",
                    "[id*='ValidationSummary']",
                ]
                texts = []
                for selector in selectors:
                    try:
                        locator = page.locator(selector)
                        count = min(locator.count(), 8)
                        for idx in range(count):
                            try:
                                txt = (locator.nth(idx).inner_text(timeout=500) or "").strip()
                            except Exception:
                                txt = ""
                            if txt and txt not in texts:
                                texts.append(txt)
                    except Exception:
                        continue
                return " | ".join(texts[:5]).strip()

            def recover_from_application_error(aa_code, personal_info):
                try:
                    page.wait_for_selector(
                        "#ctl00_SiteContentPlaceHolder_ApplicationRecovery1_tbxApplicationID",
                        state="visible",
                        timeout=8000,
                    )
                except Exception as recover_entry_err:
                    raise RuntimeError("检测到 CEAC Application Error，但未找到恢复表单") from recover_entry_err

                surname_val = re.sub(r"[^A-Z]", "", str(personal_info.get("surname", "") or "").upper())[:5]
                birth_date_raw = personal_info.get("birth_date") or ""
                birth_date_fmt = format_date(birth_date_raw) if birth_date_raw else ""
                birth_year = birth_date_fmt.split("-")[0] if birth_date_fmt else ""

                if not surname_val or not birth_year:
                    raise RuntimeError("恢复申请缺少姓氏前5位或出生年份，无法自动 Retrieve Application")

                page.fill("#ctl00_SiteContentPlaceHolder_ApplicationRecovery1_tbxApplicationID", aa_code)
                page.click("#ctl00_SiteContentPlaceHolder_ApplicationRecovery1_btnBarcodeSubmit")
                page.wait_for_timeout(1200)

                if page.locator("#ctl00_SiteContentPlaceHolder_ApplicationRecovery1_btnRequestSubmit").count() > 0:
                    try:
                        page.click("#ctl00_SiteContentPlaceHolder_ApplicationRecovery1_btnRequestSubmit")
                        page.wait_for_timeout(1200)
                    except Exception:
                        pass

                page.wait_for_selector(
                    "#ctl00_SiteContentPlaceHolder_ApplicationRecovery1_txbAnswer1",
                    state="visible",
                    timeout=15000,
                )
                try:
                    page.select_option("#ctl00_SiteContentPlaceHolder_ApplicationRecovery1_ddlLocation", value="LND")
                except Exception:
                    pass
                page.fill("#ctl00_SiteContentPlaceHolder_ApplicationRecovery1_txbSname", surname_val)
                page.fill("#ctl00_SiteContentPlaceHolder_ApplicationRecovery1_txbYear", birth_year)
                page.fill("#ctl00_SiteContentPlaceHolder_ApplicationRecovery1_txbAnswer1", "MOTHER")
                with page.expect_navigation(wait_until="domcontentloaded", timeout=30000):
                    page.click("#ctl00_SiteContentPlaceHolder_ApplicationRecovery1_Button1")
                page.wait_for_timeout(1500)

            def is_save_confirmation_page():
                try:
                    return page.locator("#ctl00_btnContinueApp").count() > 0
                except Exception:
                    return False

            def continue_from_save_confirmation():
                if not is_save_confirmation_page():
                    return False
                try:
                    with page.expect_navigation(wait_until="domcontentloaded", timeout=30000):
                        page.click("#ctl00_btnContinueApp")
                except Exception:
                    try:
                        page.click("#ctl00_btnContinueApp")
                        page.wait_for_timeout(1500)
                    except Exception:
                        return False
                try:
                    page.wait_for_selector("#ctl00_SiteContentPlaceHolder_FormView1_rblPreviouslyEmployed_0", state="visible", timeout=15000)
                except Exception:
                    return False
                return True
            
            try:
                # Enable JavaScript console logging if in debug mode
                if debug:
                    page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
                
                _step_log("step=Goto 访问 DS-160 网站...")
                _progress(3, "浏览器已启动，正在访问网站...")
                # Navigate to DS-160 form
                _progress(3, "访问 DS-160 网站...")
                print("Navigating to DS-160 website...")
                max_retries = 3
                for attempt in range(max_retries):
                    try:
                        page.goto(
                            "https://ceac.state.gov/GenNIV/Default.aspx",
                            timeout=120000,
                            wait_until="domcontentloaded",
                        )
                        _progress(3, "网站加载成功")
                        print("Website loaded successfully")
                        break
                    except Exception as e:
                        if attempt < max_retries - 1:
                            _progress(3, f"访问失败，重试中 ({attempt + 1}/{max_retries})...")
                            print(f"Load failed, retrying ({attempt + 1}/{max_retries}) in 10s...")
                            page.wait_for_timeout(10000)
                        else:
                            raise Exception(f"无法访问DS-160网站: {e}") from e
                
                # Save the initial page state for debugging
                if debug:
                    page.screenshot(path=f"initial_page_{int(time.time())}.png")
                    with open(f"initial_html_{int(time.time())}.html", "w", encoding="utf-8") as f:
                        f.write(page.content())
                
                # Select country ENGLAND, LONDON
                _step_log("step=Location 选择地点和验证码...")
                _progress(5, "选择地点...")
                print("Selecting location...")
                page.select_option("select[name='ctl00$SiteContentPlaceHolder$ucLocation$ddlLocation']", value="LND")
                
                # Download CAPTCHA
                captcha_path = f"captcha_{int(time.time())}.png"
                print(f"Capturing CAPTCHA image to {captcha_path}...")
                
                # Multiple strategies for getting the CAPTCHA
                try:
                    # Strategy 1: Direct image locator
                    captcha_selector = "#c_default_ctl00_sitecontentplaceholder_uclocation_identifycaptcha1_defaultcaptcha_CaptchaImage"
                    page.wait_for_selector(captcha_selector, state="visible", timeout=10000)
                    page.locator(captcha_selector).screenshot(path=captcha_path)
                except Exception as e:
                    print(f"Direct CAPTCHA selector failed: {e}")
                    try:
                        # Strategy 2: Try with different selector
                        alt_selector = "img[alt='CAPTCHA']"
                        page.wait_for_selector(alt_selector, state="visible", timeout=5000)
                        page.locator(alt_selector).screenshot(path=captcha_path)
                    except Exception as e2:
                        print(f"Alternative CAPTCHA selector failed: {e2}")
                        # Strategy 3: Take full page screenshot and save HTML for debugging
                        page.screenshot(path=f"full_page_for_captcha_{int(time.time())}.png")
                        with open(f"page_html_for_captcha_{int(time.time())}.html", "w", encoding="utf-8") as f:
                            f.write(page.content())
                        print("Saved full page screenshot and HTML for debugging")
                        raise Exception("Failed to capture CAPTCHA image")
                
                # Process CAPTCHA with 2Captcha
                _progress(6, "处理验证码...")
                print("Solving CAPTCHA...")
                captcha_code = self.solve_captcha(captcha_path)
                os.remove(captcha_path)
                
                if not captcha_code:
                    print("CAPTCHA recognition failed")
                    _get_logger().error("[CAPTCHA] 验证码识别失败")
                    return
                
                # Fill CAPTCHA and click start application
                _get_logger().info(f"[CAPTCHA] 验证码识别成功: {captcha_code}")
                _progress(7, f"验证码识别成功: {captcha_code}")
                print(f"CAPTCHA recognized: {captcha_code}")
                page.fill("#ctl00_SiteContentPlaceHolder_ucLocation_IdentifyCaptcha1_txtCodeTextBox", captcha_code)
                page.click("#ctl00_SiteContentPlaceHolder_lnkNew")
                
                # Click I agree checkbox
                _progress(8, "同意条款...")
                print("Agreeing to terms...")
                page.wait_for_selector("#ctl00_SiteContentPlaceHolder_chkbxPrivacyAct", state="visible", timeout=20000)
                page.click("#ctl00_SiteContentPlaceHolder_chkbxPrivacyAct")
                page.wait_for_timeout(1000)
                
                # Fill answer to security question
                print("Answering security question...")
                page.fill("#ctl00_SiteContentPlaceHolder_txtAnswer", "MOTHER")
                page.wait_for_timeout(1000)
                
                # Get barcode and save
                _progress(9, "回答安全问题...")
                barcode_element = page.locator("#ctl00_SiteContentPlaceHolder_lblBarcode")
                barcode_text = barcode_element.inner_text()
                aa_code = barcode_text[:10]
                _progress(10, f"获取到 AA 码: {aa_code}")
                
                # Screenshot entire page
                screenshot_path = f"{aa_code}.png"
                page.screenshot(path=screenshot_path)
                print(f"Saved screenshot: {screenshot_path}")
                capture_guide_page("location")
                
                # Click Continue 进入 Personal 1：延长等待避免 postback 未完成，使用 expect_navigation 正确等待跳转
                _step_log("step=Location_Continue 等待 2 秒后点击 Continue...")
                page.wait_for_timeout(2000)
                print("Continuing to personal information page...")
                try:
                    with page.expect_navigation(timeout=25000, wait_until="domcontentloaded"):
                        page.click("#ctl00_SiteContentPlaceHolder_btnContinue")
                except Exception as nav_err:
                    _step_log(f"step=Location_Continue 导航异常: {nav_err}")
                    raise
                page.wait_for_timeout(1500)
                # 检测是否误入 CEAC Application Error 页（点击过快或服务器问题）
                if "Application Error" in (page.content() or ""):
                    _step_log("step=Location_Continue 检测到 CEAC Application Error 页")
                    _error_log("Location_Continue", "CEAC 返回 Application Error，点击 Continue 后未进入个人信息页",
                               f"AA码 {aa_code} 已生成，可使用该 ID 在 CEAC 官网「Retrieve Application」恢复申请。建议稍后重试或间隔几分钟再运行。")
                    raise RuntimeError(
                        f"CEAC Application Error。AA码 {aa_code} 已保存，请至 CEAC 官网用该 ID 恢复申请。建议稍后重试。"
                    )
                try:
                    page.wait_for_selector("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_SURNAME", state="visible", timeout=15000)
                except Exception as sel_err:
                    if "Application Error" in (page.content() or ""):
                        _error_log("Location_Continue", "CEAC Application Error，未进入个人信息页",
                                   f"AA码 {aa_code}，请用该 ID 在 CEAC 官网恢复。原因: {sel_err}")
                        raise RuntimeError(f"CEAC Application Error。AA码 {aa_code} 已保存，请至官网恢复申请。") from sel_err
                    raise
                
                # Form filling for Personal Information
                _progress(12, "填写个人信息...")
                _step_log("step=Personal1_Start 开始填写 Personal 1")
                # Fill personal info
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_SURNAME", personal_info['surname'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_GIVEN_NAME", personal_info['given_name'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_FULL_NAME_NATIVE", personal_info['chinese_name'])
                
                # 选择是否有曾用名：No 不填曾用名，Yes 需填写曾用名姓氏和名字
                # 重要：若 Excel 填了 Yes 但曾用名姓氏/名字为空，CEAC 会在后续步骤报 Application Error，故自动改为 No
                has_former = str(personal_info.get('has_former_name', '') or 'No').strip().upper()
                fn_surname = (personal_info.get('former_name_surname') or '').strip()
                fn_given = (personal_info.get('former_name_given_name') or '').strip()
                is_former_yes = has_former in ('YES', 'Y', '1', 'TRUE', '是', '有') and (fn_surname or fn_given)
                if is_former_yes:
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblOtherNames_0")
                    page.wait_for_timeout(800)
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_DListAlias_ctl00_tbxSURNAME", fn_surname)
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_DListAlias_ctl00_tbxGIVEN_NAME", fn_given)
                    page.wait_for_timeout(300)
                else:
                    if has_former in ('YES', 'Y', '1', 'TRUE', '是', '有') and not (fn_surname or fn_given):
                        _step_log("step=Personal1 曾有明=Yes 但曾用名姓氏/名字为空，已自动改为 No（避免 CEAC Application Error）")
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblOtherNames_1")

                # 填写电码
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblTelecodeQuestion_0")
                page.wait_for_timeout(200)
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_TelecodeSURNAME", personal_info['telecode_surname'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_TelecodeGIVEN_NAME", personal_info['telecode_given_name'])

                # 选择性别
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlAPP_GENDER", value=personal_info['gender'])

                # 选择婚姻状况（支持 value 或 label 匹配）
                ms = personal_info.get('marital_status', 'SINGLE')
                try:
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlAPP_MARITAL_STATUS", value=ms)
                except Exception:
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlAPP_MARITAL_STATUS", label=ms)

                # 填写出生日期
                birth_date_str = personal_info.get('birth_date', '') or ''
                birth_date = (format_date(birth_date_str) if birth_date_str else '').split('-')
                if len(birth_date) >= 3:
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlDOBMonth", value=format_month(birth_date[1]))
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlDOBDay", value=format_day(birth_date[2]))
                    page.wait_for_timeout(200)
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxDOBYear", birth_date[0])

                # 填写出生地点
                # 选择出生国家
                birth_country_code = get_country_code(personal_info['birth_country'])
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlAPP_POB_CNTRY", value=birth_country_code)
                page.wait_for_timeout(200)
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_POB_ST_PROVINCE", personal_info['birth_province'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_POB_CITY", personal_info['birth_city'])
                capture_guide_page("personal_1")
                _step_log("step=Personal1_Done Personal 1 填写完成")

                # 点击"Next: Personal 2"按钮（与原 ds160-processor 一致：click + 等待 + goto）
                _progress(15, "填写基本信息...")
                _step_log("step=Personal1_Next 点击 Next: Personal 2")
                page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_timeout(2000)
                _step_log("step=Personal1_Next 等待2秒完成")

                # 直接访问 Personal2 页面（原项目做法）。用 domcontentloaded 避免因第三方资源 404/超时导致 load 永不触发
                _step_log("step=Personal2_Goto 开始 goto Personal2")
                page.goto(
                    "https://ceac.state.gov/GenNIV/General/complete/complete_personalcont.aspx?node=Personal2",
                    wait_until="domcontentloaded",
                    timeout=60000
                )
                page.wait_for_timeout(800)
                _step_log("step=Personal2_Goto goto 完成，等待500ms")
                _progress(18, "进入个人信息第二部分...")

                # 选择国籍
                _step_log("step=Personal2_SelectNatl 选择国籍 CHIN")
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlAPP_NATL", value="CHIN")
                _step_log("step=Personal2_OtherNatl 选择无其他国籍")
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_OTH_NATL_IND_1")

                _step_log("step=Personal2_PermRes 选择非永久居民")
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblPermResOtherCntryInd_1")

                _step_log("step=Personal2_NationalID 填写身份证号")
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_NATIONAL_ID", personal_info['id_number'])
                page.wait_for_timeout(200)

                # 等待SSN选项加载并点击
                _step_log("step=Personal2_SSN 等待并勾选 SSN Does Not Apply")
                ssn_selector = "#ctl00_SiteContentPlaceHolder_FormView1_cbexAPP_SSN_NA"
                page.wait_for_selector(ssn_selector, state="visible", timeout=500)
                if not page.is_checked(ssn_selector):
                    page.click(ssn_selector)
                    page.wait_for_timeout(200)

                # 等待Tax ID选项加载并点击
                _step_log("step=Personal2_TaxID 等待并勾选 Tax ID Does Not Apply")
                tax_id_selector = "#ctl00_SiteContentPlaceHolder_FormView1_cbexAPP_TAX_ID_NA"
                page.wait_for_selector(tax_id_selector, state="visible", timeout=500)
                if not page.is_checked(tax_id_selector):
                    page.click(tax_id_selector)
                    page.wait_for_timeout(200)

                capture_guide_page("personal_2")
                _step_log("step=Personal2_Done Personal2 填写完成")
                # 点击"Next: Travel"按钮
                _progress(20, "旅行信息...")
                _step_log("step=Personal2_Next 点击 Next: Travel")
                with page.expect_navigation(wait_until="domcontentloaded", timeout=30000):
                    page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_selector("#ctl00_SiteContentPlaceHolder_FormView1_dlPrincipalAppTravel_ctl00_ddlPurposeOfTrip", state="visible", timeout=15000)
                _step_log("step=Travel_Enter 进入 Travel 页面")
                _progress(23, "进入Travel页面...")

                #第三页
                _step_log("step=Travel_Purpose 选择签证类型 B/B1-B2")
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_dlPrincipalAppTravel_ctl00_ddlPurposeOfTrip", "B")
                page.wait_for_timeout(1500)  # 等待 ddlPurposeOfTrip postback 完成
                # 选择具体的B类签证类型为B1/B2（onchange 触发 __doPostBack）
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_dlPrincipalAppTravel_ctl00_ddlOtherPurpose", "B1-B2")
                _step_log("step=Travel_OtherPurpose 已选 B1-B2，等待 postback 完成...")
                # 轮询等待 rblSpecificTravel_1 出现（即 postback 完成后才出现），最多 20 秒
                rbl_ok = False
                for _ in range(40):
                    page.wait_for_timeout(500)
                    el = page.query_selector("#ctl00_SiteContentPlaceHolder_FormView1_rblSpecificTravel_1")
                    if el and el.is_visible():
                        rbl_ok = True
                        _step_log("step=Travel_OtherPurpose postback 完成，rblSpecificTravel 已出现")
                        break
                if not rbl_ok:
                    _step_log("step=Travel_OtherPurpose 警告：rblSpecificTravel_1 未出现，postback 可能未完成")
                page.wait_for_timeout(500)
                # 仅当元素存在且可见时才点击
                rbl = page.query_selector("#ctl00_SiteContentPlaceHolder_FormView1_rblSpecificTravel_1")
                if rbl and rbl.is_visible():
                    rbl.click()
                    _step_log("step=Travel_SpecificTravel 已点击 No（无具体旅行计划）")
                else:
                    _step_log("step=Travel_SpecificTravel 跳过点击：rblSpecificTravel_1 不可用")
                _step_log("step=Travel_SpecificTravel 等待停留时长等字段出现...")
                page.wait_for_timeout(1500)  # rblSpecificTravel 点击可能触发 postback
                # 轮询等待 ddlTRAVEL_LOS_CD 或 ddlWhoIsPaying 出现（最多 20 秒）
                for _ in range(40):
                    page.wait_for_timeout(500)
                    los = page.query_selector("#ctl00_SiteContentPlaceHolder_FormView1_ddlTRAVEL_LOS_CD")
                    payer = page.query_selector("#ctl00_SiteContentPlaceHolder_FormView1_ddlWhoIsPaying")
                    if los or payer:
                        break
                else:
                    _step_log("step=Travel_Postback 等待超时，尝试继续...")
                # 顺序：先完成所有会触发 postback 的下拉/选择，再填文本，避免被清空
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlTRAVEL_LOS_CD", "D")
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlTravelState", personal_info['hotel_state'])
                page.wait_for_timeout(600)
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxStreetAddress1", personal_info['hotel_address'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxCity", personal_info['hotel_city'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbZIPCode", personal_info['hotel_zip'])
                page.wait_for_timeout(300)
                raw_payer = str(personal_info.get('trip_payer', 'S')).strip().upper() or 'S'
                payer_map = {'自己': 'S', 'SELF': 'S', '他人': 'O', 'OTHER': 'O', '雇主': 'P', '公司': 'C'}
                trip_payer_val = payer_map.get(raw_payer, raw_payer) if len(raw_payer) > 1 else raw_payer
                if len(trip_payer_val) != 1:
                    trip_payer_val = 'S'
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlWhoIsPaying", trip_payer_val)
                page.wait_for_timeout(1200)
                # 等待日期字段就绪（ddlWhoIsPaying 可能触发 postback）
                try:
                    page.wait_for_selector("#ctl00_SiteContentPlaceHolder_FormView1_ddlTRAVEL_DTEDay", state="visible", timeout=5000)
                except Exception:
                    pass
                # 所有 postback 完成后，最后填日期和停留。顺序：Year(文本)→Month→Day，避免 Month 的 postback 清空 Day
                arr_year = str(personal_info.get('intended_arrival_year', '')).strip() or '2025'
                arr_month = month_for_travel_dropdown(personal_info.get('intended_arrival_month', '01'))
                arr_day = day_for_travel_dropdown(personal_info.get('intended_arrival_day', '01'))
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxTRAVEL_LOS", str(personal_info.get('intended_stay_days', '6')))
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxTRAVEL_DTEYear", arr_year)
                page.wait_for_timeout(300)
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlTRAVEL_DTEMonth", value=arr_month)
                page.wait_for_timeout(800)
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlTRAVEL_DTEDay", value=arr_day)
                page.wait_for_timeout(400)
                # 补救机制：验证日期是否被正确选中，若被 postback 清空则重试（最多 3 次）
                for retry in range(3):
                    day_sel = page.query_selector("#ctl00_SiteContentPlaceHolder_FormView1_ddlTRAVEL_DTEDay")
                    month_sel = page.query_selector("#ctl00_SiteContentPlaceHolder_FormView1_ddlTRAVEL_DTEMonth")
                    day_ok = bool(day_sel and day_sel.evaluate("(el, expected) => el.value === expected", arr_day))
                    month_ok = bool(month_sel and month_sel.evaluate("(el, expected) => el.value === expected", arr_month))
                    if day_ok and month_ok:
                        break
                    _step_log(f"step=Travel_Date 日期未选中(day_ok={day_ok}, month_ok={month_ok})，重试 {retry + 1}/3")
                    page.wait_for_timeout(1000 + retry * 500)
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlTRAVEL_DTEMonth", value=arr_month)
                    page.wait_for_timeout(600)
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlTRAVEL_DTEDay", value=arr_day)
                    page.wait_for_timeout(500)
                page.wait_for_timeout(300)
                # 支付者非本人时：先下拉选择（避免 postback 清空），再填文本
                if trip_payer_val != 'S':
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlWhoIsPayingState", personal_info['trip_payer_state'])
                    page.wait_for_timeout(400)
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxWhoIsPayingOther", personal_info['trip_payer_other'])
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxWhoIsPayingRelationship", personal_info['trip_payer_relationship'])
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxWhoIsPayingAddress", personal_info['trip_payer_address'])
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxWhoIsPayingCity", personal_info['trip_payer_city'])
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxWhoIsPayingCountry", personal_info['trip_payer_country'])
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxWhoIsPayingZip", personal_info['trip_payer_zip'])
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxWhoIsPayingPhone", personal_info['trip_payer_phone'])
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxWhoIsPayingEmail", personal_info['trip_payer_email'])
                capture_guide_page("travel")
                
                # 点击"Next: Travel Companions"按钮，进入下一页
                _step_log("step=TravelCompanions_Goto 点击 Next 进入 Travel Companions...")
                with page.expect_navigation(timeout=25000, wait_until="domcontentloaded"):
                    page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_timeout(2500)  # 等待 Travel Companions 页完全渲染
                _step_log("step=TravelCompanions_Enter 进入 Travel Companions 页面")
                print("成功进入Travel Companions页面")
                _progress(25, "进入Travel Companions页面...")
                
                # 选择是否有同行人 - 默认选择"No"（该点击可能触发 __doPostBack，需等待完成后再点 Next）
                try:
                    try:
                        page.wait_for_selector("#ctl00_SiteContentPlaceHolder_FormView1_rblOtherPersonsTravelingWithYou_1", state="visible", timeout=12000)
                        page.wait_for_timeout(500)  # 页面稳定后再点
                        page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblOtherPersonsTravelingWithYou_1")
                        print("已选择：没有同行人")
                    except Exception:
                        result = page.evaluate("""
                            (function() {
                                var el = document.querySelector('#ctl00_SiteContentPlaceHolder_FormView1_rblOtherPersonsTravelingWithYou_1');
                                if (el) { el.click(); return true; }
                                return false;
                            })();
                        """)
                        if result:
                            print("已选择：没有同行人（JavaScript方式）")
                        else:
                            print("警告：无法找到同行人选项，继续执行")
                except Exception as e:
                    print(f"选择同行人选项失败: {e}")
                
                # 关键：点击 No 会触发 postback，必须等 CEAC 响应完成后再点 Next，否则易出现 Application Error
                _step_log("step=TravelCompanions 等待 postback 完成（5 秒）...")
                page.wait_for_timeout(5000)
                capture_guide_page("travel_companions")
                _step_log("step=TravelCompanions_Next 点击 Next: Previous U.S. Travel")
                try:
                    with page.expect_navigation(timeout=25000, wait_until="domcontentloaded"):
                        page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                except Exception as nav_err:
                    _step_log(f"step=TravelCompanions_Next 导航异常: {nav_err}")
                    raise
                page.wait_for_timeout(1500)
                # 检测是否误入 Application Error 页（常因 曾有明=Yes 但曾用名空、或点击过快）
                if "Application Error" in (page.content() or ""):
                    _step_log("step=TravelCompanions_Next 检测到 CEAC Application Error 页")
                    _error_log("TravelCompanions_Next", "CEAC Application Error，从 Travel Companions 进入 Previous U.S. Travel 失败",
                               "可能原因：1) 曾有明=Yes 但曾用名未填（程序已自动修正） 2) 点击过快 3) CEAC 服务器异常。请检查 Excel 中 曾有明 与 曾用名姓氏/名字 是否一致，或稍后重试。")
                    raise RuntimeError("CEAC Application Error（Travel Companions→Previous U.S. Travel），请检查 Excel 曾有明/曾用名填写，或稍后重试")
                _step_log("step=PrevUSTravel_Enter 进入 Previous U.S. Travel 页面")
                _progress(28, "进入Previous U.S. Travel页面...")
                # 等待表单加载（兼容两种可能的控件 ID）
                try:
                    page.wait_for_selector("#ctl00_SiteContentPlaceHolder_FormView1_rblPREV_US_TRAVEL_IND_0, #ctl00_SiteContentPlaceHolder_FormView1_rblPrevUSVisit_0", state="visible", timeout=15000)
                except Exception:
                    page.wait_for_timeout(2000)

                # 选择是否有之前的美国旅行（兼容 是/否 Yes/No，以及 rblPREV_US_TRAVEL_IND / rblPrevUSVisit 两种控件 ID）
                raw_prev = str(personal_info.get('previous_us_travel', '') or '').strip()
                raw_upper = raw_prev.upper()
                is_prev_yes = raw_upper in ('YES', 'Y', '1') or raw_prev in ('是', '有')
                sel_yes = "#ctl00_SiteContentPlaceHolder_FormView1_rblPREV_US_TRAVEL_IND_0, #ctl00_SiteContentPlaceHolder_FormView1_rblPrevUSVisit_0"
                sel_no = "#ctl00_SiteContentPlaceHolder_FormView1_rblPREV_US_TRAVEL_IND_1, #ctl00_SiteContentPlaceHolder_FormView1_rblPrevUSVisit_1"
                if is_prev_yes:
                    _step_log("step=PrevUSTravel 选择 Yes（曾去过美国）")
                    page.locator(sel_yes).first.click()
                    # 等待 postback 完成，dtlPREV_US_VISIT 签证明细区出现
                    try:
                        page.wait_for_selector("#ctl00_SiteContentPlaceHolder_FormView1_dtlPREV_US_VISIT_ctl00_tbxPREV_US_VISIT_DTEYear, #ctl00_SiteContentPlaceHolder_FormView1_dtlPREV_US_VISIT_ctl00_ddlPREV_US_VISIT_DTEDay", state="visible", timeout=8000)
                    except Exception:
                        page.wait_for_timeout(2500)
                    page.wait_for_timeout(500)
                    
                    # 解析日期：支持 去美年月日 或 到达美国的日期
                    prev_year = str(personal_info.get('previous_us_travel_year', '') or '').strip()
                    prev_month_raw = str(personal_info.get('previous_us_travel_month', '01') or '01').strip()
                    prev_day_raw = str(personal_info.get('previous_us_travel_day', '01') or '01').strip()
                    prev_arrival = personal_info.get('previous_us_travel_arrival_date', '') or ''
                    if not prev_year and prev_arrival:
                        fd = format_date(prev_arrival)
                        if fd and '-' in fd:
                            parts = fd.split('-')
                            if len(parts) >= 3:
                                prev_year, prev_month_raw, prev_day_raw = parts[0], parts[1], parts[2]
                    prev_month_val = str(_parse_month_to_int(prev_month_raw) or 1)
                    prev_day_val = str(int(float(prev_day_raw))) if str(prev_day_raw).replace('.', '').isdigit() else prev_day_raw
                    if prev_day_val and int(prev_day_val) < 10 and len(prev_day_val) == 1:
                        prev_day_alt = prev_day_val
                    else:
                        prev_day_alt = prev_day_val.lstrip('0') or prev_day_val
                    
                    # Date Arrived - 使用 dtlPREV_US_VISIT_ctl00_*（CEAC 实际结构）
                    base = "#ctl00_SiteContentPlaceHolder_FormView1_dtlPREV_US_VISIT_ctl00"
                    if prev_year:
                        try:
                            page.locator(f"{base}_tbxPREV_US_VISIT_DTEYear").fill(prev_year)
                            page.wait_for_timeout(300)
                        except Exception:
                            pass
                    try:
                        page.select_option(f"{base}_ddlPREV_US_VISIT_DTEMonth", value=prev_month_val)
                        page.wait_for_timeout(300)
                    except Exception:
                        pass
                    for dval in (prev_day_val, prev_day_alt):
                        try:
                            page.select_option(f"{base}_ddlPREV_US_VISIT_DTEDay", value=str(dval))
                            break
                        except Exception:
                            pass
                    page.wait_for_timeout(400)
                    
                    # Length of Stay（停留时长 + 单位）
                    los_num = str(personal_info.get('previous_us_travel_los_number', '') or personal_info.get('intended_stay_days', '7') or '7').strip()
                    los_unit_raw = str(personal_info.get('previous_us_travel_los_unit', 'D') or 'D').strip().upper()
                    los_unit_map = {'DAY': 'D', 'DAYS': 'D', 'DAY(S)': 'D', 'D': 'D', 'WEEK': 'W', 'WEEKS': 'W', 'W': 'W', 'MONTH': 'M', 'MONTHS': 'M', 'M': 'M', 'YEAR': 'Y', 'YEARS': 'Y', 'Y': 'Y'}
                    los_unit = los_unit_map.get(los_unit_raw, los_unit_raw[:1] if los_unit_raw else 'D') or 'D'
                    try:
                        page.locator(f"{base}_tbxPREV_US_VISIT_LOS").fill(los_num)
                        page.wait_for_timeout(200)
                        page.select_option(f"{base}_ddlPREV_US_VISIT_LOS_CD", value=los_unit)
                        page.wait_for_timeout(300)
                    except Exception:
                        pass
                    _step_log("step=PrevUSTravel 已填写到达日期和停留时长")
                else:
                    _step_log("step=PrevUSTravel 选择 No（未曾去过美国）")
                    try:
                        page.locator(sel_no).first.click()
                    except Exception as e:
                        _step_log(f"step=PrevUSTravel 点击 No 失败，用 JS 重试: {e}")
                        page.evaluate("document.querySelector('[id$=rblPREV_US_TRAVEL_IND_1], [id$=rblPrevUSVisit_1]')?.click()")
                    page.wait_for_timeout(500)
                
                # 是否有美国驾照（仅在曾入境美国时才会显示此题）
                if is_prev_yes:
                    dl_raw = str(personal_info.get('has_us_drivers_license', '') or 'No').strip().upper()
                    is_dl_yes = dl_raw in ('YES', 'Y', '1') or str(personal_info.get('has_us_drivers_license', '')).strip() in ('是', '有')
                    if is_dl_yes:
                        page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblPREV_US_DRIVER_LIC_IND_0")
                        page.wait_for_timeout(500)  # 等待驾照号、州输入框出现
                        page.fill("#ctl00_SiteContentPlaceHolder_FormView1_dtlUS_DRIVER_LICENSE_ctl00_tbxUS_DRIVER_LICENSE", personal_info.get('us_drivers_license_number', '') or '')
                        page.wait_for_timeout(200)
                        state_code = personal_info.get('us_drivers_license_state', '') or ''
                        if state_code:
                            try:
                                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_dtlUS_DRIVER_LICENSE_ctl00_ddlUS_DRIVER_LICENSE_STATE", value=state_code)
                            except Exception:
                                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_dtlUS_DRIVER_LICENSE_ctl00_ddlUS_DRIVER_LICENSE_STATE", label=state_code)
                        page.wait_for_timeout(200)
                    else:
                        page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblPREV_US_DRIVER_LIC_IND_1")
                        page.wait_for_timeout(200)
                
                # 选择是否持有美国签证（支持 Yes/No/是/有 等）
                has_visa_raw = str(personal_info.get('has_us_visa', '') or 'No').strip().upper()
                is_visa_yes = has_visa_raw in ('YES', 'Y', '1') or str(personal_info.get('has_us_visa', '')).strip() in ('是', '有')
                if is_visa_yes:
                    _step_log("step=PrevVisa 选择有美国签证，等待签证明细区加载...")
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblPREV_VISA_IND_0")
                    # 等待 postback 完成，签证号码/日期等输入框出现
                    try:
                        page.wait_for_selector("input[id*='PREV_VISA'][id*='Number'], input[id*='PREV_VISA'][id*='FOIL'], input[id*='PREV_VISA'][id*='Year']", state="visible", timeout=8000)
                    except Exception:
                        page.wait_for_timeout(2000)
                    page.wait_for_timeout(500)
                    
                    # 填写美国签证号码（VISA FOIL NUMBER）
                    visa_num = personal_info.get('us_visa_number', '') or ''
                    for sel in ("#ctl00_SiteContentPlaceHolder_FormView1_tbxPREV_VISA_FOIL_NUMBER", "#ctl00_SiteContentPlaceHolder_FormView1_tbxPREV_VISA_NUMBER", "input[id*='PREV_VISA'][id*='NUMBER']"):
                        try:
                            loc = page.locator(sel).first
                            if loc.is_visible():
                                loc.fill(str(visa_num))
                                break
                        except Exception:
                            pass
                    page.wait_for_timeout(400)
                    
                    # 填写美国签证颁发日期 us_visa_issue_date
                    visa_issue_raw = (personal_info.get('us_visa_issue_date', '') or '')
                    visa_issue_fmt = format_date(visa_issue_raw) if visa_issue_raw else ''
                    visa_issue_date = visa_issue_fmt.split('-') if visa_issue_fmt and '-' in visa_issue_fmt else []
                    if len(visa_issue_date) >= 3:
                        yr, mo_raw, dy_raw = visa_issue_date[0], visa_issue_date[1], visa_issue_date[2]
                        mo = format_month(mo_raw)
                        dy = str(int(float(dy_raw))) if str(dy_raw).replace('.', '').isdigit() else format_day(dy_raw)
                        # 年份输入框
                        for yr_sel in ("#ctl00_SiteContentPlaceHolder_FormView1_tbxPREV_VISA_ISSUED_DTEYear", "#ctl00_SiteContentPlaceHolder_FormView1_tbxPREV_VISA_ISSUE_DATE_YEAR", "input[id*='PREV_VISA'][id*='ISSUED'][id*='Year']", "input[id*='VISA_ISSUE'][id*='Year']"):
                            try:
                                el = page.locator(yr_sel).first
                                if el.is_visible():
                                    el.fill(yr)
                                    break
                            except Exception:
                                pass
                        page.wait_for_timeout(300)
                        # 月份下拉
                        for mo_sel in ("#ctl00_SiteContentPlaceHolder_FormView1_ddlPREV_VISA_ISSUED_DTEMonth", "#ctl00_SiteContentPlaceHolder_FormView1_ddlPREV_VISA_ISSUE_DATE_MONTH", "select[id*='PREV_VISA'][id*='Month']"):
                            try:
                                page.select_option(mo_sel, value=mo)
                                break
                            except Exception:
                                pass
                        page.wait_for_timeout(300)
                        # 日期（可能是 select 或 input，select 的 value 常为 1-31 无前导零）
                        dy_vals = [dy]
                        if dy.lstrip('0'):
                            dy_vals.append(dy.lstrip('0'))
                        for dy_sel in ("#ctl00_SiteContentPlaceHolder_FormView1_ddlPREV_VISA_ISSUED_DTEDay", "#ctl00_SiteContentPlaceHolder_FormView1_tbxPREV_VISA_ISSUE_DATE_DAY", "select[id*='PREV_VISA'][id*='Day']", "input[id*='PREV_VISA'][id*='Day']"):
                            try:
                                el = page.locator(dy_sel).first
                                if el.is_visible():
                                    tag = el.evaluate("e => e.tagName")
                                    if tag and str(tag).upper() == 'SELECT':
                                        for dv in dy_vals:
                                            try:
                                                page.select_option(dy_sel, value=str(dv))
                                                break
                                            except Exception:
                                                pass
                                    else:
                                        el.fill(dy)
                                    break
                            except Exception:
                                pass
                        page.wait_for_timeout(500)
                        _step_log("step=PrevVisa 已填写签证签发日期")
                    else:
                        _step_log(f"step=PrevVisa 签证签发日期未填写（Excel 值: {visa_issue_raw[:30] if visa_issue_raw else '空'}）")
                    
                    # 填写美国签证到期日期
                    visa_exp_raw = (personal_info.get('us_visa_expiration_date', '') or '')
                    visa_exp_fmt = format_date(visa_exp_raw) if visa_exp_raw else ''
                    visa_exp_date = visa_exp_fmt.split('-') if visa_exp_fmt and '-' in visa_exp_fmt else []
                    if len(visa_exp_date) >= 3:
                        yr, mo_raw, dy_raw = visa_exp_date[0], visa_exp_date[1], visa_exp_date[2]
                        mo = format_month(mo_raw)
                        dy_val = str(int(float(dy_raw))) if str(dy_raw).replace('.', '').isdigit() else format_day(dy_raw)
                        for yr_sel in ("#ctl00_SiteContentPlaceHolder_FormView1_tbxPREV_VISA_EXPIRATION_DATE_YEAR", "input[id*='PREV_VISA'][id*='EXPIRATION'][id*='Year']", "input[id*='EXPIRATION'][id*='Year']"):
                            try:
                                el = page.locator(yr_sel).first
                                if el.is_visible():
                                    el.fill(yr)
                                    break
                            except Exception:
                                pass
                        page.wait_for_timeout(400)
                        for mo_sel in ("#ctl00_SiteContentPlaceHolder_FormView1_ddlPREV_VISA_EXPIRATION_DATE_MONTH", "select[id*='EXPIRATION'][id*='Month']"):
                            try:
                                page.select_option(mo_sel, value=mo)
                                break
                            except Exception:
                                pass
                        page.wait_for_timeout(400)
                        dy_exp_vals = [dy_val]
                        if str(dy_val).lstrip('0'):
                            dy_exp_vals.append(str(dy_val).lstrip('0'))
                        for dy_sel in ("#ctl00_SiteContentPlaceHolder_FormView1_tbxPREV_VISA_EXPIRATION_DATE_DAY", "#ctl00_SiteContentPlaceHolder_FormView1_ddlPREV_VISA_EXPIRATION_DATE_DAY", "input[id*='EXPIRATION'][id*='Day']", "select[id*='EXPIRATION'][id*='Day']"):
                            try:
                                el = page.locator(dy_sel).first
                                if el.is_visible():
                                    tag = el.evaluate("e => e.tagName")
                                    if tag and str(tag).upper() == 'SELECT':
                                        for dv in dy_exp_vals:
                                            try:
                                                page.select_option(dy_sel, value=str(dv))
                                                break
                                            except Exception:
                                                pass
                                    else:
                                        el.fill(str(dy_val))
                                    break
                            except Exception:
                                pass
                        page.wait_for_timeout(500)
                        _step_log("step=PrevVisa 已填写签证到期日期")
                    else:
                        _step_log(f"step=PrevVisa 签证到期日期未填写（Excel 值: {visa_exp_raw[:30] if visa_exp_raw else '空'}）")
                    
                    # 填写美国签证颁发地点、类型、状态
                    for fkey, sels in [
                        ('us_visa_place_of_issue', ("#ctl00_SiteContentPlaceHolder_FormView1_tbxPREV_VISA_PLACE_OF_ISSUE", "input[id*='PLACE_OF_ISSUE']")),
                        ('us_visa_type', ("#ctl00_SiteContentPlaceHolder_FormView1_tbxPREV_VISA_TYPE", "input[id*='PREV_VISA'][id*='TYPE']")),
                        ('us_visa_status', ("#ctl00_SiteContentPlaceHolder_FormView1_tbxPREV_VISA_STATUS", "input[id*='PREV_VISA'][id*='STATUS']")),
                    ]:
                        val = str(personal_info.get(fkey, '') or '')
                        for sel in sels:
                            try:
                                loc = page.locator(sel).first
                                if loc.is_visible():
                                    loc.fill(val)
                                    page.wait_for_timeout(150)
                                    break
                            except Exception:
                                pass

                    # 签证补充问题：使用 CEAC 实际控件 ID（rblPREV_VISA_*_IND）直接定位
                    def _click_visa_radio(exact_id_suffix, is_yes):
                        suffix = '_0' if is_yes else '_1'
                        for sel in (
                            f"#ctl00_SiteContentPlaceHolder_FormView1_{exact_id_suffix}{suffix}",
                            f"[id*='{exact_id_suffix}'][id$='{suffix}']",
                        ):
                            try:
                                el = page.locator(sel).first
                                if el.is_visible(timeout=2000):
                                    el.click()
                                    page.wait_for_timeout(200)
                                    return True
                            except Exception:
                                pass
                        return False

                    def _sel_visa_yes_no(key):
                        raw = str(personal_info.get(key, '') or 'No').strip().upper()
                        return raw in ('YES', 'Y', '1') or str(personal_info.get(key, '')).strip() in ('是', '有')

                    _click_visa_radio('rblPREV_VISA_SAME_TYPE_IND', _sel_visa_yes_no('apply_same_visa_type'))
                    _click_visa_radio('rblPREV_VISA_SAME_CNTRY_IND', _sel_visa_yes_no('apply_same_country_location'))
                    _click_visa_radio('rblPREV_VISA_TEN_PRINT_IND', _sel_visa_yes_no('has_been_ten_printed'))

                    # Has your U.S. Visa ever been lost or stolen?
                    # CEAC 要求：若选 Yes，Year 必填；Explain 仅允许 A-Z, 0-9 及部分符号，禁止中文
                    is_lost_yes = _sel_visa_yes_no('visa_lost_or_stolen')
                    lost_year = str(personal_info.get('visa_lost_or_stolen_year', '') or '').strip()
                    if is_lost_yes and not lost_year:
                        _step_log("step=PrevVisa 签证遗失=Yes 但年份为空，CEAC 会报错，自动改为 No")
                        is_lost_yes = False
                    _click_visa_radio('rblPREV_VISA_LOST_IND', is_lost_yes)
                    if is_lost_yes:
                        page.wait_for_timeout(400)
                        lost_expl = _sanitize_ceac_explain(personal_info.get('visa_lost_or_stolen_explanation', '') or '')
                        try:
                            page.locator("#ctl00_SiteContentPlaceHolder_FormView1_tbxPREV_VISA_LOST_YEAR").fill(lost_year)
                            page.locator("#ctl00_SiteContentPlaceHolder_FormView1_tbxPREV_VISA_LOST_EXPL").fill(lost_expl)
                        except Exception:
                            pass
                        page.wait_for_timeout(200)

                    # Has your U.S. Visa ever been cancelled or revoked?
                    # Explain 仅允许 A-Z, 0-9 及部分符号，禁止中文
                    is_cancel_yes = _sel_visa_yes_no('visa_cancelled_or_revoked')
                    _click_visa_radio('rblPREV_VISA_CANCELLED_IND', is_cancel_yes)
                    if is_cancel_yes:
                        page.wait_for_timeout(400)
                        cancel_expl = _sanitize_ceac_explain(personal_info.get('visa_cancelled_or_revoked_explanation', '') or '')
                        try:
                            page.locator("#ctl00_SiteContentPlaceHolder_FormView1_tbxPREV_VISA_CANCELLED_EXPL").fill(cancel_expl)
                        except Exception:
                            pass
                        page.wait_for_timeout(200)
                else:
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblPREV_VISA_IND_1")
                    page.wait_for_timeout(200)
                
                # 选择是否曾被拒绝签证（支持 Yes/No/是/有）
                refused_raw = str(personal_info.get('has_been_refused_visa', '') or 'No').strip().upper()
                is_refused_yes = refused_raw in ('YES', 'Y', '1') or str(personal_info.get('has_been_refused_visa', '')).strip() in ('是', '有')
                if is_refused_yes:
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblPREV_VISA_REFUSED_IND_0")
                    page.wait_for_timeout(500)  # 等待 explain 文本框出现
                    refused_expl = _sanitize_ceac_explain(personal_info.get('has_been_refused_reason', '') or '')
                    for sel in ("#ctl00_SiteContentPlaceHolder_FormView1_tbxPREV_VISA_REFUSED_EXPL", "#ctl00_SiteContentPlaceHolder_FormView1_tbxPREV_VISA_REFUSED_REASON"):
                        try:
                            page.fill(sel, refused_expl)
                            break
                        except Exception:
                            pass
                    page.wait_for_timeout(200)
                else:
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblPREV_VISA_REFUSED_IND_1")
                    page.wait_for_timeout(200)
                
                # Has anyone ever filed an immigrant petition on your behalf?（支持 Yes/No）
                iv_raw = str(personal_info.get('has_immigrant_petition', '') or 'No').strip().upper()
                is_iv_yes = iv_raw in ('YES', 'Y', '1') or str(personal_info.get('has_immigrant_petition', '')).strip() in ('是', '有')
                if is_iv_yes:
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblIV_PETITION_IND_0")
                    page.wait_for_timeout(500)  # 等待 explain 文本框出现
                    iv_expl = _sanitize_ceac_explain(personal_info.get('immigrant_petition_explanation', '') or '')
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxIV_PETITION_EXPL", iv_expl)
                    page.wait_for_timeout(200)
                else:
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblIV_PETITION_IND_1")
                    page.wait_for_timeout(200)
                
                capture_guide_page("previous_us_travel")
                # 点击"Next: Address & Phone"按钮
                with page.expect_navigation(wait_until="domcontentloaded", timeout=30000):
                    page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_selector("#ctl00_SiteContentPlaceHolder_FormView1_ddlCountry", state="visible", timeout=15000)
                _step_log("step=AddressPhone_Enter 进入 Address & Phone 页面")
                print("成功进入Address & Phone页面")
                _progress(30, "进入Address & Phone页面...")
                
                # 选择家庭所在国家（下拉会触发 postback，先选避免清空）
                home_country_code = get_country_code(personal_info['home_country'])
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlCountry", value=home_country_code)
                page.wait_for_timeout(200)

                # 选择邮寄地址是否与家庭住址相同
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblMailingAddrSame_0")
                page.wait_for_timeout(200)  # 等待页面响应

                # 填写家庭住址/城市/州/邮编（文本在下拉/单选之后）
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_ADDR_LN1", personal_info['home_address'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_ADDR_CITY", personal_info['home_city'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_ADDR_STATE", personal_info['home_state'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_ADDR_POSTAL_CD", personal_info['home_zip'])

                # 填写家庭电话
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_HOME_TEL", personal_info['Primary Phone Number'])
                
                # 选择是否没有手机号码
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_cbexAPP_MOBILE_TEL_NA")

                # 选择是否没有工作电话
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_cbexAPP_BUS_TEL_NA")

                # 选择是否添加过去五年内用过的手机号码
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAddPhone_0")
                page.wait_for_timeout(200)  # 等待页面响应
                # 填写过去五年内用过的手机号码
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_dtlAddPhone_ctl00_tbxAddPhoneInfo", personal_info['last five years phone number'])

                # 填写个人邮箱
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_EMAIL_ADDR", personal_info['Personal Email Address'])

                # 选择是否添加过去五年内用过的邮箱
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAddEmail_0")
                page.wait_for_timeout(200)  # 等待页面响应
                # 填写过去五年内用过的邮箱
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_dtlAddEmail_ctl00_tbxAddEmailInfo", personal_info['last five years email address'])
                page.wait_for_timeout(200)  # 等待页面响应

                # 选择社交媒体平台为QQ
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_dtlSocial_ctl00_ddlSocialMedia", "QZNE")
                page.wait_for_timeout(200)  # 等待页面响应
                # 填写QQ号码
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_dtlSocial_ctl00_tbxSocialMediaIdent", personal_info['qq'])

                # 点击添加社交媒体按钮
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_dtlSocial_ctl00_InsertButtonSOCIAL_MEDIA_INFO")
                page.wait_for_timeout(200)  # 等待页面响应
                # 选择社交媒体平台为YouTube
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_dtlSocial_ctl01_ddlSocialMedia", "YTUB")
                page.wait_for_timeout(1000)  # 等待页面响应
                # 填写YouTube账号
                page.fill("input[name='ctl00$SiteContentPlaceHolder$FormView1$dtlSocial$ctl01$tbxSocialMediaIdent']", personal_info['youtube'])

                # 选择是否添加更多社交媒体账号
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAddSocial_1")
                capture_guide_page("address_phone")
                # 点击"Next: Passport"按钮
                with page.expect_navigation(wait_until="domcontentloaded", timeout=30000):
                    page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_selector("#ctl00_SiteContentPlaceHolder_FormView1_ddlPPT_TYPE", state="visible", timeout=15000)
                _step_log("step=Passport_Enter 进入 Passport 页面")
                print("成功进入Passport页面")
                _progress(33, "进入Passport页面...")
                
                # 护照页：先集中完成所有会触发 postback 的操作（下拉、单选），不逐个等待；最后统一等待一次，再填文本
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlPPT_TYPE", "R")
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlPPT_ISSUED_CNTRY", "CHIN")
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlPPT_ISSUED_IN_CNTRY", "CHIN")
                ppt_issue = (format_date(personal_info.get('passport_issue_date', '') or '') or '').split('-')
                ppt_expire = (format_date(personal_info.get('passport_expiration_date', '') or '') or '').split('-')
                if len(ppt_issue) >= 3:
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlPPT_ISSUED_DTEMonth", value=format_month(ppt_issue[1]))
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlPPT_ISSUED_DTEDay", value=format_day(ppt_issue[2]))
                if len(ppt_expire) >= 3:
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlPPT_EXPIRE_DTEMonth", value=format_month(ppt_expire[1]))
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlPPT_EXPIRE_DTEDay", value=format_day(ppt_expire[2]))
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblLOST_PPT_IND_1")
                try:
                    page.wait_for_load_state("networkidle", timeout=4000)
                except Exception:
                    page.wait_for_timeout(1200)
                if len(ppt_issue) >= 3:
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxPPT_ISSUEDYear", ppt_issue[0])
                if len(ppt_expire) >= 3:
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxPPT_EXPIREYear", ppt_expire[0])
                ppt_num = str(personal_info.get('passport_number') or '').strip()
                ppt_book = str(personal_info.get('Passport Book Number') or '').strip()
                ppt_city = str(personal_info.get('passport_issue_city') or '').strip()
                ppt_state = str(personal_info.get('passport_issue_state') or '').strip()
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxPPT_NUM", ppt_num)
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxPPT_BOOK_NUM", ppt_book)
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxPPT_ISSUED_IN_CITY", ppt_city)
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxPPT_ISSUED_IN_STATE", ppt_state)
                page.wait_for_timeout(300)
                ppt_issue_yr = ppt_issue[0] if len(ppt_issue) >= 3 else ''
                ppt_expire_yr = ppt_expire[0] if len(ppt_expire) >= 3 else ''
                def _ppt_ensure_filled():
                    for sel, val in [
                        ("#ctl00_SiteContentPlaceHolder_FormView1_tbxPPT_NUM", ppt_num),
                        ("#ctl00_SiteContentPlaceHolder_FormView1_tbxPPT_BOOK_NUM", ppt_book),
                        ("#ctl00_SiteContentPlaceHolder_FormView1_tbxPPT_ISSUED_IN_CITY", ppt_city),
                        ("#ctl00_SiteContentPlaceHolder_FormView1_tbxPPT_ISSUED_IN_STATE", ppt_state),
                        ("#ctl00_SiteContentPlaceHolder_FormView1_tbxPPT_ISSUEDYear", ppt_issue_yr),
                        ("#ctl00_SiteContentPlaceHolder_FormView1_tbxPPT_EXPIREYear", ppt_expire_yr),
                    ]:
                        if val:
                            try:
                                cur = page.locator(sel).input_value()
                                if (cur or '').strip() != val:
                                    page.locator(sel).fill(val)
                                    page.wait_for_timeout(100)
                            except Exception:
                                pass
                _ppt_ensure_filled()
                page.wait_for_timeout(200)
                _ppt_ensure_filled()
                capture_guide_page("passport")
                with page.expect_navigation(wait_until="domcontentloaded", timeout=30000):
                    page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_selector("#ctl00_SiteContentPlaceHolder_FormView1_cbxUS_POC_NAME_NA", state="visible", timeout=15000)
                _step_log("step=USContact_Enter 进入 U.S. Contact 页面")
                print("成功进入U.S. Contact页面")
                _progress(35, "进入U.S. Contact页面...")
                # 点击 "Do not know" 复选框（Contact Person 姓名）
                try:
                    page.wait_for_selector("#ctl00_SiteContentPlaceHolder_FormView1_cbxUS_POC_NAME_NA", timeout=10000)
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_cbxUS_POC_NAME_NA")
                    print("[SUCCESS] 成功点击US_POC_NAME_NA复选框")
                except Exception as e:
                    print(f"[ERROR] 点击US_POC_NAME_NA复选框失败: {e}")
                    page.evaluate("document.querySelector('#ctl00_SiteContentPlaceHolder_FormView1_cbxUS_POC_NAME_NA')?.click()")
                # 等待 UpdatePanel 加载，组织/酒店字段出现（勾选 Don't know 会触发异步刷新）
                try:
                    page.wait_for_selector("#ctl00_SiteContentPlaceHolder_FormView1_tbxUS_POC_ORGANIZATION", state="visible", timeout=8000)
                except Exception:
                    page.wait_for_timeout(3000)
                page.wait_for_timeout(500)

                # 先处理会触发 postback 的下拉框，再填文本（避免下拉导致清空 Organization）
                def _contact_fill(sel, key, default=""):
                    v = str((personal_info.get(key, '') or default) or '').strip()
                    if v:
                        try:
                            page.locator(sel).first.fill(v)
                            page.wait_for_timeout(80)
                        except Exception:
                            pass
                try:
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlUS_POC_REL_TO_APP", "O")
                except Exception:
                    pass
                page.wait_for_timeout(200)

                # 如果地址州需要下拉，会触发异步/重渲染；先选再填文本
                _hs = (personal_info.get('hotel_state') or '').strip()
                if _hs:
                    try:
                        page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlUS_POC_ADDR_STATE", _hs)
                    except Exception:
                        pass
                    page.wait_for_timeout(200)

                # 最后再填文本字段
                _contact_fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxUS_POC_ORGANIZATION", "hotel_name")
                _contact_fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxUS_POC_ADDR_LN1", "hotel_address")
                _contact_fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxUS_POC_ADDR_CITY", "hotel_city")
                _contact_fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxUS_POC_ADDR_POSTAL_CD", "hotel_zip")
                _contact_fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxUS_POC_HOME_TEL", "hotel_phone")
                _contact_fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxUS_POC_EMAIL_ADDR", "hotel_email")
                capture_guide_page("us_contact")
                # 点击"Next: Family"按钮
                with page.expect_navigation(wait_until="domcontentloaded", timeout=30000):
                    page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_selector("#ctl00_SiteContentPlaceHolder_FormView1_rblFATHER_LIVE_IN_US_IND_1", state="visible", timeout=15000)
                _step_log("step=Family_Enter 进入 Family 页面")
                print("成功进入Family页面")
                _progress(38, "进入Family页面...")
                # Family：严格遵守“先下拉/单选，再填文本”，避免后续 postback 清空已填字段
                def _fill_text(sel, val):
                    v = str((val or '')).strip()
                    if not v:
                        return
                    try:
                        page.evaluate("""
                            (args) => {
                                const sel = args[0];
                                const value = args[1];
                                const el = document.querySelector(sel);
                                if (!el || el.disabled) return false;
                                el.value = value;
                                el.dispatchEvent(new Event('input', { bubbles: true }));
                                el.dispatchEvent(new Event('change', { bubbles: true }));
                                return true;
                            }
                        """, [sel, v])
                        page.wait_for_timeout(80)
                    except Exception:
                        try:
                            page.fill(sel, v)
                            page.wait_for_timeout(80)
                        except Exception:
                            pass

                father_dob = (format_date(personal_info.get('father_birth_date', '') or '') or '').split('-')
                mother_dob = (format_date(personal_info.get('mother_birth_date', '') or '') or '').split('-')

                # === 阶段1：先完成所有触发 postback 的单选按钮，DOB 月/日下拉放到 postback 之后填 ===
                # 父亲是否在美国居住 → No
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblFATHER_LIVE_IN_US_IND_1")
                page.wait_for_timeout(500)

                # 母亲是否在美国居住 → No
                # 警告：此 postback 会刷新 UpdatePanel，在此之前填的 DOB 月/日下拉会被清空
                # 因此 DOB 月/日下拉必须等所有 postback 完成后再填
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblMOTHER_LIVE_IN_US_IND_1")
                page.wait_for_timeout(300)

                # 是否有美国直系亲属 → No（postback 完成后页面会显示 OTHER_RELATIVE 问题）
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblUS_IMMED_RELATIVE_IND_1")
                # 等待 OTHER_RELATIVE 问题出现后点 No（部分表单版本可能无此字段，用 try 兜底）
                try:
                    page.wait_for_selector("#ctl00_SiteContentPlaceHolder_FormView1_rblUS_OTHER_RELATIVE_IND_1", state="visible", timeout=10000)
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblUS_OTHER_RELATIVE_IND_1")
                except Exception:
                    pass

                # 轮询等待最后一次 postback 完成
                for _ in range(30):
                    page.wait_for_timeout(300)
                    try:
                        ajax_idle = page.evaluate("""
                            (typeof Sys === 'undefined') ||
                            !Sys.WebForms.PageRequestManager.getInstance().get_isInAsyncPostBack()
                        """)
                        if ajax_idle:
                            break
                    except Exception:
                        break
                page.wait_for_timeout(300)  # 额外稳定等待

                # === 阶段2：所有 postback 完成后再填 DOB 月/日下拉（防止被 postback 清空）===
                if len(father_dob) >= 3:
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlFathersDOBMonth", value=format_month(father_dob[1]))
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlFathersDOBDay", value=format_day(father_dob[2]))
                    page.wait_for_timeout(200)
                if len(mother_dob) >= 3:
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlMothersDOBMonth", value=format_month(mother_dob[1]))
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlMothersDOBDay", value=format_day(mother_dob[2]))
                    page.wait_for_timeout(200)

                # 最后统一填文本字段（父母姓名 + DOB 年份）
                father_surname_val = str(personal_info.get('father_surname', '') or '').strip()
                father_given_val = str(personal_info.get('father_given_name', '') or '').strip()
                mother_surname_val = str(personal_info.get('mother_surname', '') or '').strip()
                mother_given_val = str(personal_info.get('mother_given_name', '') or '').strip()

                father_year_val = father_dob[0] if len(father_dob) >= 3 else ''
                mother_year_val = mother_dob[0] if len(mother_dob) >= 3 else ''

                def _is_valid_yyyy(s):
                    return bool(re.match(r'^\d{4}$', str(s or '').strip()))

                if father_surname_val:
                    _fill_text("#ctl00_SiteContentPlaceHolder_FormView1_tbxFATHER_SURNAME", father_surname_val)
                if father_given_val:
                    _fill_text("#ctl00_SiteContentPlaceHolder_FormView1_tbxFATHER_GIVEN_NAME", father_given_val)
                if _is_valid_yyyy(father_year_val):
                    _fill_text("#ctl00_SiteContentPlaceHolder_FormView1_tbxFathersDOBYear", father_year_val)

                if mother_surname_val:
                    _fill_text("#ctl00_SiteContentPlaceHolder_FormView1_tbxMOTHER_SURNAME", mother_surname_val)
                if mother_given_val:
                    _fill_text("#ctl00_SiteContentPlaceHolder_FormView1_tbxMOTHER_GIVEN_NAME", mother_given_val)
                if _is_valid_yyyy(mother_year_val):
                    _fill_text("#ctl00_SiteContentPlaceHolder_FormView1_tbxMothersDOBYear", mother_year_val)
                capture_guide_page("family")
                # 点击"Next: Work/Education/Training"按钮
                # 用 expect_navigation 包裹，确保等待全页面 POST 导航完成后再操作
                with page.expect_navigation(wait_until="domcontentloaded", timeout=30000):
                    page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                _step_log("step=WorkEducation_Enter 进入 Work/Education 页面")
                print("成功进入Work/Education/Training页面")
                _progress(40, "进入Work/Education页面...")
                # 选择当前职业（选 S=Student 会触发 postback，必须等页面稳定后再操作）
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlPresentOccupation", "S")
                # 等待 postback 完成：学校名称输入框出现即代表表单已刷新
                page.wait_for_selector("#ctl00_SiteContentPlaceHolder_FormView1_tbxEmpSchName", state="visible", timeout=15000)
                page.wait_for_timeout(300)  # 额外稳定等待

                # 先设置国家下拉（可能触发 postback，用 select_option 而非 evaluate，避免 JS context 问题）
                present_country_code = get_country_code(personal_info['Present Employer or School Country'])
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlEmpSchCountry", value=present_country_code)
                page.wait_for_timeout(300)  # 等待国家 postback 完成

                # 先选择开始日期下拉，再填开始年份
                emp_start = (format_date(personal_info.get('Present Employer or School Start Date', '') or '') or '').split('-')
                if len(emp_start) >= 3:
                    # CEAC 日期下拉 option value 为纯数字（月 '1'-'12'，日 '1'-'31'）
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlEmpDateFromMonth", value=str(_parse_month_to_int(emp_start[1]) or ''))
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlEmpDateFromDay", value=str(int(float(emp_start[2]))))
                    page.wait_for_timeout(100)
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxEmpDateFromYear", emp_start[0])
                page.wait_for_timeout(100)  # 等待页面响应
                # 选择"Not Applicable"复选框
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_cbxCURR_MONTHLY_SALARY_NA")
                page.wait_for_timeout(100)  # 等待页面响应

                # 再填文本字段（在下拉/单选之后）
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxEmpSchName", personal_info['Present Employer or School Name'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxEmpSchAddr1", personal_info['Present Employer or School Address'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxEmpSchCity", personal_info['Present Employer or School City'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxWORK_EDUC_ADDR_STATE", personal_info['Present Employer or School State'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxWORK_EDUC_ADDR_POSTAL_CD", personal_info['Present Employer or School Zip'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxWORK_EDUC_TEL", personal_info['Present Employer or School Phone'])

                # 填写职责描述
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxDescribeDuties", personal_info['Briefly describe your duties'])
                page.wait_for_timeout(100)  # 等待页面响应
                capture_guide_page("work_education")
                
                # 点击"Next: Work/Education: Previous"按钮
                with page.expect_navigation(wait_until="domcontentloaded", timeout=30000):
                    page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_selector("#ctl00_SiteContentPlaceHolder_FormView1_rblPreviouslyEmployed_0", state="visible", timeout=15000)
                _step_log("step=WorkEducationPrev_Enter 进入 Work/Education: Previous 页面")
                print("成功进入Work/Education: Previous页面")
                _progress(43, "进入Work/Education: Previous页面...")

                # 选择是否曾经被雇佣（支持 Yes/No/是/有，Excel 列"是否有工作经历"/"Were you previously employed"）
                prev_emp_raw = str(personal_info.get('Were you previously employed', '') or personal_info.get('是否有工作经历', '') or 'No').strip().upper()
                is_prev_emp_yes = prev_emp_raw in ('YES', 'Y', '1') or str(prev_emp_raw) in ('是', '有')
                if is_prev_emp_yes:
                    try:
                        page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblPreviouslyEmployed_0", timeout=2000)
                    except Exception:
                        try:
                            page.evaluate("""() => {
                                const el = document.querySelector('#ctl00_SiteContentPlaceHolder_FormView1_rblPreviouslyEmployed_0');
                                if (el) el.click();
                            }""")
                        except Exception as click_err:
                            _get_logger().warning(f"[Employer] 鐐瑰嚮 Previously Employed=Yes 澶辫触: {click_err}")
                    # 等待 UpdatePanel 异步加载完成（雇主输入框出现）
                    sel_prev_input = "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbEmployerName"
                    sel_prev = "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_lblEmployerName"
                    # 先等输入框（更直接，10秒）；如仍超时则再点一次 Yes 再等 8 秒
                    try:
                        page.wait_for_selector(sel_prev_input, state="visible", timeout=10000)
                    except Exception:
                        _get_logger().warning("[Employer] 首次等待雇主字段超时，重新点击 Yes 再等 8 秒...")
                        try:
                            page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblPreviouslyEmployed_0")
                        except Exception:
                            pass
                        try:
                            page.wait_for_selector(sel_prev_input, state="visible", timeout=8000)
                        except Exception as we:
                            _get_logger().warning(f"[Employer] 二次等待仍超时: {we}")
                            try:
                                with open(f"employer_debug_{int(time.time())}.html", "w", encoding="utf-8") as f:
                                    f.write(page.content())
                                _get_logger().info("[Employer] 已保存 employer_debug_*.html 便于排查")
                            except Exception:
                                pass
                    page.wait_for_timeout(200)

                    # 使用 evaluate 直接查找并填写，规避 Playwright 选择器/visibility 问题
                    def _prev_eval(id_part, val):
                        v = str((val or '')).strip()
                        if not v:
                            return
                        try:
                            page.evaluate("""(args) => {
                                const part = args[0], val = args[1];
                                const sel = 'input[id*="' + part + '"], input[name*="' + part + '"]';
                                const el = document.querySelector(sel);
                                if (el && !el.disabled) { el.value = val; el.dispatchEvent(new Event('input', {bubbles: true})); return true; }
                                return false;
                            }""", [id_part, v])
                        except Exception:
                            pass

                    # 先完成会触发 postback 的操作（国家、日期），再填文本字段，避免 postback 清空
                    try:
                        page.locator(sel_prev_input).first.wait_for(state="visible", timeout=250)
                    except Exception:
                        pass
                    prev_employer_addr_1, prev_employer_addr_2 = _split_ds160_address_lines(
                        personal_info.get('Previous Employer or School Address', ''),
                        40,
                        40,
                    )
                    _prev_eval("tbEmployerName", personal_info.get('Previous Employer or School Name'))
                    _prev_eval("tbEmployerStreetAddress1", prev_employer_addr_1)
                    _prev_eval("tbEmployerStreetAddress2", prev_employer_addr_2)
                    _prev_eval("tbEmployerCity", personal_info.get('Previous Employer or School City'))
                    _prev_eval("tbxPREV_EMPL_ADDR_STATE", personal_info.get('Previous Employer or School State'))
                    _prev_eval("tbxPREV_EMPL_ADDR_POSTAL_CD", personal_info.get('Previous Employer or School Zip'))
                    _prev_eval("tbEmployerPhone", personal_info.get('Previous Employer or School Phone'))
                    _prev_eval("tbJobTitle", personal_info.get('Job Title', ''))
                    page.wait_for_timeout(20)

                    prev_country = personal_info.get('Previous Employer or School Country', '') or ''
                    if prev_country:
                        previous_country_code = get_country_code(prev_country)
                        try:
                            page.select_option("[id*='dtlPrevEmpl'][id*='DropDownList2']", value=previous_country_code)
                        except Exception:
                            try:
                                page.evaluate(f"""
                                    const select = document.querySelector('select[id*="dtlPrevEmpl"][id*="DropDownList2"]');
                                    if (select) {{ select.value = '{previous_country_code}'; select.dispatchEvent(new Event('change', {{ bubbles: true }})); }}
                                """)
                            except Exception:
                                pass
                    page.wait_for_timeout(80)
                    prev_start = (format_date(personal_info.get('Previous Employer or School Start Date', '') or '') or '').split('-')
                    prev_end = (format_date(personal_info.get('Previous Employer or School End Date', '') or '') or '').split('-')
                    if len(prev_start) >= 3:
                        try:
                            _prev_eval("tbxEmpDateFromYear", prev_start[0])
                            # CEAC ddlEmpDateFromMonth option values 为纯数字 '1'-'12'，非三字母缩写
                            page.select_option("[id*='ddlEmpDateFromMonth']", value=str(_parse_month_to_int(prev_start[1]) or ''))
                            # CEAC ddlEmpDateFromDay option values 为纯数字 '1'-'31'，无前导零
                            page.select_option("[id*='ddlEmpDateFromDay']", value=str(int(float(prev_start[2]))))
                        except Exception:
                            pass
                    if len(prev_end) >= 3:
                        try:
                            _prev_eval("tbxEmpDateToYear", prev_end[0])
                            page.select_option("[id*='ddlEmpDateToMonth']", value=str(_parse_month_to_int(prev_end[1]) or ''))
                            page.select_option("[id*='ddlEmpDateToDay']", value=str(int(float(prev_end[2]))))
                        except Exception:
                            pass
                    page.wait_for_timeout(80)
                    # 文本字段只填一次（CEAC: tbEmployerName, tbEmployerStreetAddress1, tbJobTitle 等）
                    _prev_eval("tbEmployerName", personal_info.get('Previous Employer or School Name'))
                    _prev_eval("tbEmployerStreetAddress1", prev_employer_addr_1)
                    _prev_eval("tbEmployerStreetAddress2", prev_employer_addr_2)
                    _prev_eval("tbEmployerCity", personal_info.get('Previous Employer or School City'))
                    _prev_eval("tbxPREV_EMPL_ADDR_STATE", personal_info.get('Previous Employer or School State'))
                    _prev_eval("tbxPREV_EMPL_ADDR_POSTAL_CD", personal_info.get('Previous Employer or School Zip'))
                    _prev_eval("tbEmployerPhone", personal_info.get('Previous Employer or School Phone'))
                    _prev_eval("tbJobTitle", personal_info.get('Job Title', ''))

                    # 填写前单位工作内容（CEAC: tbDescribeDuties，textarea）
                    prev_duties = personal_info.get('previous_employer_describe_duties', '') or personal_info.get('Briefly describe your duties', '') or ''
                    if prev_duties:
                        try:
                            page.evaluate("""(args) => {
                                const val = args[0];
                                const el = document.querySelector('textarea[id*="tbDescribeDuties"], textarea[id*="DescribeDuties"]');
                                if (el && !el.disabled) { el.value = val; el.dispatchEvent(new Event('input', {bubbles: true})); return true; }
                                return false;
                            }""", [str(prev_duties)])
                        except Exception:
                            pass
                    page.wait_for_timeout(80)

                    _prev_eval("tbSupervisorSurname", personal_info.get('Previous Employer or School Supervisor Surname'))
                    _prev_eval("tbSupervisorGivenName", personal_info.get('Previous Employer or School Supervisor Given Name'))
                else:
                    try:
                        page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblPreviouslyEmployed_1")
                    except Exception as e:
                        print(f"点击'否'选项失败: {str(e)}")
                        # 尝试使用JavaScript点击
                        page.evaluate("document.querySelector('#ctl00_SiteContentPlaceHolder_FormView1_rblPreviouslyEmployed_1').click()")
                    page.wait_for_timeout(200)
                # 选择是否参加过中学以上教育（支持 Yes/No/是/有）
                # 点击 Yes 同样触发 UpdatePanel 异步加载教育字段
                educ_key = 'Have you attended any educational institutions at a secondary level or above?'
                educ_raw = str(personal_info.get(educ_key, '') or 'Yes').strip().upper()
                is_educ_yes = educ_raw in ('YES', 'Y', '1') or str(personal_info.get(educ_key, '')).strip() in ('是', '有')
                if is_educ_yes:
                    school_addr_1, school_addr_2 = _split_ds160_address_lines(
                        personal_info.get('Educational Institution Address', ''),
                        40,
                        40,
                    )
                    course_of_study_value = _truncate_ds160_field_text(
                        personal_info.get('Course of Study', ''),
                        66,
                    )
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblOtherEduc_0")
                    try:
                        page.wait_for_selector("[id*='dtlPrevEduc'][id*='tbxSchoolName'], [id*='tbxSchoolName']", state="visible", timeout=10000)
                    except Exception:
                        page.wait_for_timeout(3000)
                    page.wait_for_timeout(300)
                    def _try_fill(selectors, val):
                        for sel in (selectors if isinstance(selectors, (list, tuple)) else [selectors]):
                            try:
                                page.locator(sel).first.fill(str(val or ''))
                                return
                            except Exception:
                                pass
                    _try_fill(["#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolName", "[id*='dtlPrevEduc'][id*='tbxSchoolName']"], personal_info.get('Name of the educational institution', ''))
                    _try_fill(["#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolAddr1", "[id*='tbxSchoolAddr1']"], school_addr_1)
                    _try_fill(["#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolAddr2", "[id*='tbxSchoolAddr2']"], school_addr_2)
                    _try_fill(["#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolCity", "[id*='tbxSchoolCity']"], personal_info.get('Educational Institution City', ''))
                    _try_fill(["#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxEDUC_INST_ADDR_STATE", "[id*='EDUC_INST_ADDR_STATE']"], personal_info.get('Educational Institution State', ''))
                    _try_fill(["#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxEDUC_INST_POSTAL_CD", "[id*='EDUC_INST_POSTAL_CD']"], personal_info.get('Educational Institution Zip', ''))
                else:
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblOtherEduc_1")
                    page.wait_for_timeout(200)
                if is_educ_yes:
                    print("教育机构国家下拉框 - 数据已在预处理阶段转换")
                    school_country = personal_info.get('Educational Institution Country', '').strip()
                    if school_country:
                        country_code = get_country_code(school_country)
                        try:
                            page.wait_for_selector("#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_ddlSchoolCountry", state="visible", timeout=10000)
                            page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_ddlSchoolCountry", value=country_code)
                            print(f"已选择教育机构国家: {school_country} (代码: {country_code})")
                        except Exception as e:
                            print(f"选择教育机构国家失败: {school_country}，错误信息: {str(e)}")
                            try:
                                page.evaluate(f"""
                                    (function() {{
                                        var select = document.querySelector("#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_ddlSchoolCountry");
                                        if (select) {{
                                            select.value = '{country_code}';
                                            select.dispatchEvent(new Event('change', {{ bubbles: true }}));
                                            return true;
                                        }}
                                        return false;
                                    }})();
                                """)
                            except Exception:
                                pass
                    else:
                        print("未找到教育机构国家信息，跳过选择。")
                    # 填写所学专业/课程及日期
                    try:
                        page.locator("#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolCourseOfStudy").fill(str(course_of_study_value or ''))
                    except Exception:
                        pass
                    edu_start = (format_date(personal_info.get('Educational Institution Start Date', '') or '') or '').split('-')
                    edu_end = (format_date(personal_info.get('Educational Institution End Date', '') or '') or '').split('-')
                    if len(edu_start) >= 3:
                        try:
                            page.locator("#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolFromYear").fill(edu_start[0])
                            # CEAC ddlSchoolFromMonth option values 为纯数字 '1'-'12'，非三字母缩写
                            page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_ddlSchoolFromMonth", value=str(_parse_month_to_int(edu_start[1]) or ''))
                            # CEAC ddlSchoolFromDay option values 为纯数字 '1'-'31'，无前导零
                            page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_ddlSchoolFromDay", value=str(int(float(edu_start[2]))))
                        except Exception:
                            pass
                    if len(edu_end) >= 3:
                        try:
                            page.locator("#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolToYear").fill(edu_end[0])
                            page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_ddlSchoolToMonth", value=str(_parse_month_to_int(edu_end[1]) or ''))
                            page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_ddlSchoolToDay", value=str(int(float(edu_end[2]))))
                        except Exception:
                            pass
                try:
                    page.evaluate(
                        """() => {
                            const active = document.activeElement;
                            if (active && typeof active.blur === 'function') {
                                active.blur();
                            }
                        }"""
                    )
                except Exception:
                    pass
                page.wait_for_timeout(1000)
                try:
                    page.wait_for_load_state("networkidle", timeout=5000)
                except Exception:
                    pass
                missing_fields = []

                def _read_input_value(selector):
                    try:
                        return (page.locator(selector).first.input_value(timeout=800) or "").strip()
                    except Exception:
                        return ""

                def _ensure_text_value(label, selector, value):
                    normalized = str(value or "").strip()
                    if not normalized:
                        return
                    if _read_input_value(selector):
                        return
                    try:
                        page.locator(selector).first.fill(normalized)
                    except Exception:
                        pass
                    page.wait_for_timeout(100)
                    if not _read_input_value(selector):
                        missing_fields.append(label)

                def _ensure_textarea_value(label, selector, value):
                    normalized = str(value or "").strip()
                    if not normalized:
                        return
                    if _read_input_value(selector):
                        return
                    try:
                        page.locator(selector).first.fill(normalized)
                    except Exception:
                        try:
                            page.evaluate(
                                """(args) => {
                                    const selector = args[0];
                                    const val = args[1];
                                    const el = document.querySelector(selector);
                                    if (el) {
                                        el.value = val;
                                        el.dispatchEvent(new Event('input', { bubbles: true }));
                                    }
                                }""",
                                [selector, normalized],
                            )
                        except Exception:
                            pass
                    page.wait_for_timeout(100)
                    if not _read_input_value(selector):
                        missing_fields.append(label)

                def _ensure_select_value(label, selector, value):
                    normalized = str(value or "").strip()
                    if not normalized:
                        return
                    if _read_input_value(selector) == normalized:
                        return
                    try:
                        page.select_option(selector, value=normalized)
                    except Exception:
                        pass
                    page.wait_for_timeout(100)
                    if _read_input_value(selector) != normalized:
                        missing_fields.append(label)

                def _dispatch_control_events(selector):
                    try:
                        page.evaluate(
                            """(selector) => {
                                const el = document.querySelector(selector);
                                if (!el) return false;
                                el.dispatchEvent(new Event('input', { bubbles: true }));
                                el.dispatchEvent(new Event('change', { bubbles: true }));
                                if (typeof el.blur === 'function') {
                                    el.blur();
                                }
                                return true;
                            }""",
                            selector,
                        )
                    except Exception:
                        pass

                def _collect_validator_failures():
                    try:
                        return page.evaluate(
                            """() => {
                                const result = {
                                    valid: true,
                                    summary: "",
                                    failed: [],
                                };
                                try {
                                    if (typeof Page_ClientValidate === 'function') {
                                        result.valid = !!Page_ClientValidate();
                                    }
                                } catch (err) {
                                    result.valid = false;
                                    result.failed.push({
                                        id: 'Page_ClientValidate',
                                        control: '',
                                        message: String(err),
                                    });
                                }

                                const summary = document.getElementById('ctl00_SiteContentPlaceHolder_FormView1_ValidationSummary');
                                if (summary) {
                                    result.summary = (summary.innerText || summary.textContent || '').trim();
                                }

                                const validators = Array.isArray(window.Page_Validators) ? window.Page_Validators : [];
                                for (const validator of validators) {
                                    if (!validator || validator.isvalid !== false) continue;
                                    result.failed.push({
                                        id: validator.id || '',
                                        control: validator.controltovalidate || '',
                                        message: validator.errormessage || validator.innerText || validator.textContent || '',
                                        visible: validator.style ? validator.style.visibility || validator.style.display || '' : '',
                                    });
                                }
                                return result;
                            }"""
                        )
                    except Exception as err:
                        return {
                            "valid": True,
                            "summary": "",
                            "failed": [],
                            "warn": str(err),
                        }

                if is_prev_emp_yes:
                    prev_employer_addr_1, prev_employer_addr_2 = _split_ds160_address_lines(
                        personal_info.get("Previous Employer or School Address"),
                        40,
                        40,
                    )
                    _ensure_text_value(
                        "前学校/单位",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbEmployerName",
                        personal_info.get("Previous Employer or School Name"),
                    )
                    _ensure_text_value(
                        "前学校/单位地址",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbEmployerStreetAddress1",
                        prev_employer_addr_1,
                    )
                    _ensure_text_value(
                        "鍓嶅鏍?鍗曚綅鍦板潃2",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbEmployerStreetAddress2",
                        prev_employer_addr_2,
                    )
                    _ensure_text_value(
                        "前城市",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbEmployerCity",
                        personal_info.get("Previous Employer or School City"),
                    )
                    _ensure_text_value(
                        "前州/省",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbxPREV_EMPL_ADDR_STATE",
                        personal_info.get("Previous Employer or School State"),
                    )
                    _ensure_text_value(
                        "前邮编",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbxPREV_EMPL_ADDR_POSTAL_CD",
                        personal_info.get("Previous Employer or School Zip"),
                    )
                    _ensure_text_value(
                        "前单位电话",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbEmployerPhone",
                        personal_info.get("Previous Employer or School Phone"),
                    )
                    _ensure_text_value(
                        "前单位职位",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbJobTitle",
                        personal_info.get("Job Title", ""),
                    )
                    _ensure_textarea_value(
                        "前单位职责",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbDescribeDuties",
                        prev_duties,
                    )
                    _ensure_text_value(
                        "前主管姓",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbSupervisorSurname",
                        personal_info.get("Previous Employer or School Supervisor Surname"),
                    )
                    _ensure_text_value(
                        "前主管名",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbSupervisorGivenName",
                        personal_info.get("Previous Employer or School Supervisor Given Name"),
                    )
                    if prev_country:
                        _ensure_select_value(
                            "前单位国家",
                            "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_DropDownList2",
                            previous_country_code,
                        )
                    else:
                        missing_fields.append("前单位国家")
                    if len(prev_start) >= 3:
                        _ensure_text_value(
                            "前单位开始年份",
                            "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbxEmpDateFromYear",
                            prev_start[0],
                        )
                        _ensure_select_value(
                            "前单位开始月份",
                            "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_ddlEmpDateFromMonth",
                            str(_parse_month_to_int(prev_start[1]) or ''),
                        )
                        _ensure_select_value(
                            "前单位开始日期",
                            "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_ddlEmpDateFromDay",
                            str(int(float(prev_start[2]))),
                        )
                    if len(prev_end) >= 3:
                        _ensure_text_value(
                            "前单位结束年份",
                            "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbxEmpDateToYear",
                            prev_end[0],
                        )
                        _ensure_select_value(
                            "前单位结束月份",
                            "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_ddlEmpDateToMonth",
                            str(_parse_month_to_int(prev_end[1]) or ''),
                        )
                        _ensure_select_value(
                            "前单位结束日期",
                            "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_ddlEmpDateToDay",
                            str(int(float(prev_end[2]))),
                        )

                    for selector in (
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbEmployerName",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbEmployerStreetAddress1",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbEmployerStreetAddress2",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbEmployerCity",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbxPREV_EMPL_ADDR_STATE",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbxPREV_EMPL_ADDR_POSTAL_CD",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_DropDownList2",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbEmployerPhone",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbJobTitle",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbSupervisorSurname",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbSupervisorGivenName",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbxEmpDateFromYear",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_ddlEmpDateFromMonth",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_ddlEmpDateFromDay",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbxEmpDateToYear",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_ddlEmpDateToMonth",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_ddlEmpDateToDay",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEmpl_ctl00_tbDescribeDuties",
                    ):
                        _dispatch_control_events(selector)

                if is_educ_yes:
                    school_addr_1, school_addr_2 = _split_ds160_address_lines(
                        personal_info.get("Educational Institution Address", ""),
                        40,
                        40,
                    )
                    course_of_study_value = _truncate_ds160_field_text(
                        personal_info.get("Course of Study", ""),
                        66,
                    )
                    _ensure_text_value(
                        "学校名称",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolName",
                        personal_info.get("Name of the educational institution", ""),
                    )
                    _ensure_text_value(
                        "学校地址",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolAddr1",
                        school_addr_1,
                    )
                    _ensure_text_value(
                        "瀛︽牎鍦板潃2",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolAddr2",
                        school_addr_2,
                    )
                    _ensure_text_value(
                        "学校城市",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolCity",
                        personal_info.get("Educational Institution City", ""),
                    )
                    _ensure_text_value(
                        "学校州/省",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxEDUC_INST_ADDR_STATE",
                        personal_info.get("Educational Institution State", ""),
                    )
                    _ensure_text_value(
                        "学校邮编",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxEDUC_INST_POSTAL_CD",
                        personal_info.get("Educational Institution Zip", ""),
                    )
                    if school_country:
                        _ensure_select_value(
                            "学校国家",
                            "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_ddlSchoolCountry",
                            country_code,
                        )
                    else:
                        missing_fields.append("学校国家")
                    _ensure_text_value(
                        "所学专业/课程",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolCourseOfStudy",
                        course_of_study_value,
                    )
                    if len(edu_start) >= 3:
                        _ensure_text_value(
                            "学校开始年份",
                            "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolFromYear",
                            edu_start[0],
                        )
                        _ensure_select_value(
                            "学校开始月份",
                            "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_ddlSchoolFromMonth",
                            str(_parse_month_to_int(edu_start[1]) or ''),
                        )
                        _ensure_select_value(
                            "学校开始日期",
                            "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_ddlSchoolFromDay",
                            str(int(float(edu_start[2]))),
                        )
                    if len(edu_end) >= 3:
                        _ensure_text_value(
                            "学校结束年份",
                            "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolToYear",
                            edu_end[0],
                        )
                        _ensure_select_value(
                            "学校结束月份",
                            "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_ddlSchoolToMonth",
                            str(_parse_month_to_int(edu_end[1]) or ''),
                        )
                        _ensure_select_value(
                            "学校结束日期",
                            "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_ddlSchoolToDay",
                            str(int(float(edu_end[2]))),
                        )

                    for selector in (
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolName",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolAddr1",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolAddr2",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolCity",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxEDUC_INST_ADDR_STATE",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxEDUC_INST_POSTAL_CD",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_ddlSchoolCountry",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolCourseOfStudy",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolFromYear",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_ddlSchoolFromMonth",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_ddlSchoolFromDay",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolToYear",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_ddlSchoolToMonth",
                        "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_ddlSchoolToDay",
                    ):
                        _dispatch_control_events(selector)

                if missing_fields:
                    debug_screenshot, debug_html = save_debug_snapshot("work_education_previous_missing_fields")
                    raise RuntimeError(
                        f"WorkEducationPrev 页面关键字段未稳定写入: {', '.join(dict.fromkeys(missing_fields))}。调试文件: {debug_screenshot}, {debug_html}"
                    )
                page.wait_for_timeout(300)
                validation_result = _collect_validator_failures()
                if not validation_result.get("valid", True):
                    debug_screenshot, debug_html = save_debug_snapshot("work_education_previous_client_validation")
                    failed = validation_result.get("failed") or []
                    failed_labels = []
                    for item in failed:
                        control = item.get("control") or item.get("id") or "unknown"
                        message = item.get("message") or ""
                        failed_labels.append(f"{control}{f' ({message})' if message else ''}")
                    summary = validation_result.get("summary") or ""
                    raise RuntimeError(
                        f"WorkEducationPrev 页面前端校验未通过: {'; '.join(failed_labels) or '未知字段'}"
                        f"{f'。摘要: {summary}' if summary else ''}。调试文件: {debug_screenshot}, {debug_html}"
                    )
                capture_guide_page("work_education_previous")
                pre_next_screenshot, pre_next_html = save_debug_snapshot("work_education_previous_before_next")
                pre_next_json = save_work_education_previous_values("work_education_previous_before_next_values")
                post_save_screenshot = post_save_html = None
                post_save_json = None
                try:
                    with page.expect_navigation(wait_until="domcontentloaded", timeout=30000):
                        page.click("#ctl00_SiteContentPlaceHolder_UpdateButton2")
                except Exception:
                    try:
                        page.click("#ctl00_SiteContentPlaceHolder_UpdateButton2")
                        page.wait_for_timeout(1500)
                    except Exception:
                        pass
                try:
                    page.wait_for_selector("#ctl00_SiteContentPlaceHolder_FormView1_rblPreviouslyEmployed_0", state="visible", timeout=15000)
                    post_save_screenshot, post_save_html = save_debug_snapshot("work_education_previous_after_save")
                    post_save_json = save_work_education_previous_values("work_education_previous_after_save_values")
                except Exception:
                    pass
                if is_save_confirmation_page():
                    save_continue_screenshot, save_continue_html = save_debug_snapshot("work_education_previous_save_confirmation")
                    save_continue_json = save_work_education_previous_values("work_education_previous_save_confirmation_values")
                    if not continue_from_save_confirmation():
                        raise RuntimeError(
                            f"WorkEducationPrev 保存后停在 Save Confirmation，且无法继续返回表单。调试文件: "
                            f"{save_continue_screenshot}, {save_continue_html}, {save_continue_json}"
                        )
                    post_save_screenshot, post_save_html = save_debug_snapshot("work_education_previous_after_save_continue")
                    post_save_json = save_work_education_previous_values("work_education_previous_after_save_continue_values")

                def _attempt_go_work_education_additional():
                    if is_save_confirmation_page():
                        if not continue_from_save_confirmation():
                            return False
                    try:
                        with page.expect_navigation(wait_until="domcontentloaded", timeout=30000):
                            page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                    except Exception:
                        # CEAC 验证失败时不会跳转，捕获后继续等目标元素
                        pass
                    page.wait_for_timeout(1500)
                    if is_application_error_page():
                        return False
                    page.wait_for_selector("#ctl00_SiteContentPlaceHolder_FormView1_rblCLAN_TRIBE_IND_1", state="visible", timeout=15000)
                    return True

                # 点击"Next: Work/Education: Additional"按钮
                try:
                    if not _attempt_go_work_education_additional():
                        first_error_screenshot, first_error_html = save_debug_snapshot("work_education_previous_application_error")
                        first_error_json = save_work_education_previous_values("work_education_previous_application_error_values")
                        _step_log("step=WorkEducationPrev_Next 检测到 CEAC Application Error 页，尝试自动恢复")
                        recover_from_application_error(aa_code, personal_info)
                        recovered_screenshot, recovered_html = save_debug_snapshot("work_education_previous_after_recover")
                        recovered_json = save_work_education_previous_values("work_education_previous_after_recover_values")
                        try:
                            page.wait_for_selector("#ctl00_SiteContentPlaceHolder_FormView1_rblPreviouslyEmployed_0", state="visible", timeout=15000)
                        except Exception:
                            pass
                        if not _attempt_go_work_education_additional():
                            debug_screenshot, debug_html = save_debug_snapshot("work_education_previous_application_error_after_recover")
                            debug_json = save_work_education_previous_values("work_education_previous_application_error_after_recover_values")
                            _step_log(
                                "step=WorkEducationPrev_Next 自动恢复后再次检测到 CEAC Application Error 页"
                            )
                            _error_log(
                                "WorkEducationPrev_Enter",
                                "CEAC Application Error，从 Work/Education: Previous 进入 Additional 失败",
                                f"AA码 {aa_code} 已保存，可在官网 Retrieve Application 恢复申请。"
                                f" 点 Next 前文件: {pre_next_screenshot}, {pre_next_html}。"
                                f"{f' Save 后文件: {post_save_screenshot}, {post_save_html}。' if post_save_screenshot and post_save_html else ''}"
                                f" 首次错误页文件: {first_error_screenshot}, {first_error_html}。"
                                f" 恢复后页面文件: {recovered_screenshot}, {recovered_html}。"
                                f" 再次错误页文件: {debug_screenshot}, {debug_html}",
                            )
                            raise RuntimeError(
                                f"CEAC Application Error（WorkEducationPrev → Additional，自动恢复后仍失败）。AA码 {aa_code} 已保存，请至官网恢复申请后重试。"
                            )
                except Exception as wait_err:
                    debug_screenshot, debug_html = save_debug_snapshot("work_education_previous_transition_failure")
                    if is_application_error_page():
                        _step_log(
                            "step=WorkEducationPrev_Next 等待 Additional 页时检测到 CEAC Application Error 页"
                        )
                        _error_log(
                            "WorkEducationPrev_Enter",
                            "CEAC Application Error，从 Work/Education: Previous 进入 Additional 失败",
                            f"AA码 {aa_code} 已保存，可在官网 Retrieve Application 恢复申请。点 Next 前文件: {pre_next_screenshot}, {pre_next_html}。"
                            f"{f' Save 后文件: {post_save_screenshot}, {post_save_html}。' if post_save_screenshot and post_save_html else ''}"
                            f"错误页文件: {debug_screenshot}, {debug_html}",
                        )
                        raise RuntimeError(
                            f"CEAC Application Error（WorkEducationPrev → Additional）。AA码 {aa_code} 已保存，请至官网恢复申请后重试。"
                        ) from wait_err
                    err_text = extract_ceac_error_text()
                    raise RuntimeError(
                        f"WorkEducationPrev → Additional 页面跳转失败，CEAC 可能有验证错误: {err_text or '未知'}。点 Next 前文件: {pre_next_screenshot}, {pre_next_html}。"
                        f"{f' Save 后文件: {post_save_screenshot}, {post_save_html}。' if post_save_screenshot and post_save_html else ''}"
                        f"错误页文件: {debug_screenshot}, {debug_html}"
                    ) from wait_err
                _step_log("step=WorkEducationAdd_Enter 进入 Work/Education: Additional 页面")
                print("成功进入Work/Education: Additional页面")
                _progress(45, "进入Work/Education: Additional页面...")
                
                # 点击"No"选项 - 是否属于部落或氏族
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblCLAN_TRIBE_IND_1")
                # 填写第一语言
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_dtlLANGUAGES_ctl00_tbxLANGUAGE_NAME", personal_info['Language Name 1'])
                # 点击"Add Another"按钮添加第二语言
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_dtlLANGUAGES_ctl00_InsertButtonLANGUAGE")
                page.wait_for_timeout(500)  # 等待页面响应         
                # 填写第二语言
                page.fill("input[name='ctl00$SiteContentPlaceHolder$FormView1$dtlLANGUAGES$ctl01$tbxLANGUAGE_NAME']", personal_info['Language Name 2'])

                # 点击"Yes"选项 - 是否去过其他国家
                _step_log("step=CountriesVisited_Enter 填写去过的国家...")
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblCOUNTRIES_VISITED_IND_0")
                page.wait_for_timeout(500)
                # 收集 Excel 中的去过的国家，并用 country_dict + 别名 转为 DS-160 下拉框可识别的格式
                log = _get_logger()
                countries_to_add = []
                for i in range(1, 11):
                    country_key = f"Country of travel {i}"
                    val = personal_info.get(country_key, "")
                    if val and str(val).strip():
                        resolved = _resolve_country_for_ds160(val, country_dict)
                        if resolved:
                            countries_to_add.append(resolved)
                log.info(f"[国家] 从 Excel 解析到 {len(countries_to_add)} 个国家: {countries_to_add}")
                if countries_to_add:
                    # 记录当前已有的下拉框数量，用于后续判断“新增”的那一行
                    existing_selects = page.evaluate("""
                        () => {
                            const selects = document.querySelectorAll('select[id*="dtlCountriesVisited"][id*="ddlCOUNTRIES_VISITED"]');
                            return Array.from(selects).map(el => el.id);
                        }
                    """) or []
                    log.info(f"[国家] 初始下拉框: {existing_selects}")

                    for i, country in enumerate(countries_to_add):
                        try:
                            # 第一个国家：直接用页面上已有的第一行（更稳定）
                            if i == 0:
                                target_selector = "#ctl00_SiteContentPlaceHolder_FormView1_dtlCountriesVisited_ctl00_ddlCOUNTRIES_VISITED"
                                log.info(f"[国家] 第 1/{len(countries_to_add)} 个: 使用 {target_selector} 选择 {country}")
                                page.wait_for_selector(target_selector, state="visible", timeout=10000)
                                _do_select_country(page, target_selector, country, log, 1, len(countries_to_add))
                                continue

                            # 其余国家：先点击 Add Another，再等待“下拉框数量 +1”
                            log.info(f"[国家] 第 {i+1}/{len(countries_to_add)} 个: 点击 InsertButton 添加新行...")
                            before_count = len(existing_selects)
                            page.click("#ctl00_SiteContentPlaceHolder_FormView1_dtlCountriesVisited_ctl00_InsertButtonCountriesVisited")

                            new_select_id = None
                            for poll in range(30):  # 最多轮询约 15 秒
                                page.wait_for_timeout(500)
                                ids = page.evaluate("""
                                    () => {
                                        const selects = document.querySelectorAll('select[id*="dtlCountriesVisited"][id*="ddlCOUNTRIES_VISITED"]');
                                        return Array.from(selects).map(el => el.id);
                                    }
                                """) or []
                                if len(ids) > before_count:
                                    # 认为新出现的那一个就是最后一个
                                    new_select_id = ids[-1]
                                    existing_selects = ids
                                    log.info(f"[国家] 轮询 {poll+1} 次后新行出现: {ids}")
                                    break

                            if not new_select_id:
                                log.warning(f"[国家] 第 {i+1} 个: 轮询后仍未发现新增下拉框，跳过 {country}")
                                continue

                            target_selector = f"#{new_select_id}"
                            log.info(f"[国家] 第 {i+1} 个: 使用新增行 selector={target_selector}, country={country}")
                            page.wait_for_selector(target_selector, state="visible", timeout=10000)
                            page.wait_for_timeout(200)
                            _do_select_country(page, target_selector, country, log, i + 1, len(countries_to_add))
                        except Exception as e:
                            log.error(f"[国家] 第 {i+1} 个失败 country={country}: {e}", exc_info=True)
                            _step_log(f"step=Country 第 {i+1} 个失败 {country}: {e}")
                            continue
                else:
                    log.info("[国家] 无数据，默认选择 UNITED KINGDOM")
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_dtlCountriesVisited_ctl00_ddlCOUNTRIES_VISITED", label="UNITED KINGDOM")
                    print("未找到去过的国家数据，已默认选择 UNITED KINGDOM")

                # 验证所有国家已选中，若有遗漏则报错（避免带 -SELECT ONE- 点 Next 导致下一页不加载）
                ids = page.evaluate("""
                    () => {
                        const selects = document.querySelectorAll('select[id*="dtlCountriesVisited"][id*="ddlCOUNTRIES_VISITED"]');
                        return Array.from(selects).map(el => ({ id: el.id, val: el.value }));
                    }
                """) or []
                if countries_to_add:
                    final_ids = page.evaluate("""
                        () => {
                            const selects = document.querySelectorAll('select[id*="dtlCountriesVisited"][id*="ddlCOUNTRIES_VISITED"]');
                            return Array.from(selects).map(el => el.id);
                        }
                    """) or []
                    if len(final_ids) >= len(countries_to_add):
                        for i, country in enumerate(countries_to_add):
                            target_selector = f"#{final_ids[i]}"
                            try:
                                log.info(f"[鍥藉] 鏈€缁堟牎姝?{i+1}/{len(countries_to_add)}: {country} -> {target_selector}")
                                page.wait_for_selector(target_selector, state="visible", timeout=10000)
                                _do_select_country(page, target_selector, country, log, i + 1, len(countries_to_add))
                                page.wait_for_timeout(200)
                            except Exception as e:
                                log.warning(f"[鍥藉] 鏈€缁堟牎姝ュけ璐?{i+1}/{len(countries_to_add)} {country}: {e}")
                    capture_guide_page("work_education_additional_country_review")
                    ids = page.evaluate("""
                        () => {
                            const selects = document.querySelectorAll('select[id*="dtlCountriesVisited"][id*="ddlCOUNTRIES_VISITED"]');
                            return Array.from(selects).map(el => ({ id: el.id, val: el.value }));
                        }
                    """) or []
                empty = [x for x in ids if not x.get("val") or "-SELECT" in str(x.get("val", "")).upper()]
                if empty and countries_to_add:
                    failed_msg = f"国家下拉框 {len(empty)}/{len(countries_to_add)} 个未选中，请检查 country_map.xlsx 是否包含: {countries_to_add}"
                    _step_log(f"step=Country 验证失败: {failed_msg}")
                    raise RuntimeError(failed_msg)

                # 点击"No"选项 - 是否属于任何组织
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblORGANIZATION_IND_1")
                # 点击"No"选项 - 是否具有特殊技能
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblSPECIALIZED_SKILLS_IND_1")
                # 点击"No"选项 - 是否服过兵役
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblMILITARY_SERVICE_IND_1")
                # 点击"No"选项 - 是否属于任何叛乱组织
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblINSURGENT_ORG_IND_1")
                capture_guide_page("work_education_additional")

                # 点击"Next: Security and Background"按钮
                _progress(48, "准备进入安全与背景...")
                with page.expect_navigation(wait_until="domcontentloaded", timeout=30000):
                    page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                # 等待新页面加载：先等关键元素出现再操作，避免定位不到
                page.wait_for_selector("#ctl00_SiteContentPlaceHolder_FormView1_rblDisease_1", state="visible", timeout=15000)
                page.wait_for_timeout(500)  # 额外稳定时间
                _step_log("step=Security_Enter 进入 Security and Background 页面")
                print("成功进入Security and Background页面")
                _progress(50, "进入Security and Background页面...")
                
                # 辅助：选中单选并确保 ASP.NET 验证能识别。CEAC 第一题(传染病)必须正确选中，否则会卡在 Next
                # 需触发 setDirty + ShowHideDiv 才能通过 CustomValidator
                _SHOW_HIDE_MAP = {
                    "rblDisease": "ctl00_SiteContentPlaceHolder_FormView1_disease",
                    "rblDisorder": "ctl00_SiteContentPlaceHolder_FormView1_disorder",
                    "rblDruguser": "ctl00_SiteContentPlaceHolder_FormView1_druguser",
                }
                def _check_radio_no(radio_id):
                    sel = f"#ctl00_SiteContentPlaceHolder_FormView1_{radio_id}_1"
                    div_id = _SHOW_HIDE_MAP.get(radio_id, "")
                    try:
                        loc = page.locator(sel)
                        loc.scroll_into_view_if_needed()
                        page.wait_for_timeout(250)
                        loc.click(timeout=5000)
                        page.wait_for_timeout(400)
                    except Exception as e:
                        print(f"[WARN] 点击 {radio_id} 失败: {e}")
                        _get_logger().warning(f"[Security] 点击 {radio_id} 失败: {e}")
                    # 若仍未选中，用 JS 设置并触发与 CEAC 页面相同的逻辑（setDirty + ShowHideDiv）
                    checked = page.evaluate(f"""() => {{
                        var el = document.querySelector('{sel}');
                        if (!el) return false;
                        var changed = !el.checked;
                        el.checked = true;
                        el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        el.dispatchEvent(new Event('click', {{ bubbles: true }}));
                        if (typeof setDirty === 'function') setDirty();
                        if ('{div_id}' && typeof ShowHideDiv === 'function') ShowHideDiv('{div_id}', 'off');
                        return !!el.checked;
                    }}""")
                    if not checked:
                        print(f"[WARN] {radio_id} 仍未选中")
                        _get_logger().warning(f"[Security] {radio_id} 仍未选中")
                    return checked

                # 第一个问题(传染病)必须先选且验证通过，否则 Next 会卡死
                _check_radio_no("rblDisease")
                print("已选择：不患有传染病")
                page.wait_for_timeout(400)

                _check_radio_no("rblDisorder")
                print("已选择：不患有精神障碍")
                page.wait_for_timeout(400)

                _check_radio_no("rblDruguser")
                print("已选择：不使用毒品")
                page.wait_for_timeout(500)

                # 点击 Next 前确认三题都已选中，避免验证失败导致卡死
                all_ok = page.evaluate("""() => {
                    var a = document.querySelector('#ctl00_SiteContentPlaceHolder_FormView1_rblDisease_1')?.checked;
                    var b = document.querySelector('#ctl00_SiteContentPlaceHolder_FormView1_rblDisorder_1')?.checked;
                    var c = document.querySelector('#ctl00_SiteContentPlaceHolder_FormView1_rblDruguser_1')?.checked;
                    return !!(a && b && c);
                }""")
                if not all_ok:
                    print("[WARN] 部分选项未选中，重新勾选...")
                    _get_logger().warning("[Security] 部分选项未选中，重新勾选")
                    _check_radio_no("rblDisease")
                    _check_radio_no("rblDisorder")
                    _check_radio_no("rblDruguser")
                    page.wait_for_timeout(500)
                capture_guide_page("security_part_1")

                def _check_radio_no_if_present(radio_id):
                    selector = f"#ctl00_SiteContentPlaceHolder_FormView1_{radio_id}_1"
                    if page.locator(selector).count() == 0:
                        _get_logger().info(f"[Security] 跳过未渲染题目: {radio_id}")
                        return False
                    return _check_radio_no(radio_id)

                def _fill_security_no_options(radio_ids, part_label):
                    checked_count = 0
                    for radio_id in radio_ids:
                        if _check_radio_no_if_present(radio_id):
                            checked_count += 1
                            page.wait_for_timeout(120)
                    if checked_count == 0:
                        raise RuntimeError(f"{part_label} 页面未找到任何可填写的 No 选项")
                    return checked_count

                # 点击"Next: Security/Background Part 2"按钮（CEAC postback 较慢，需等待导航完成）
                with page.expect_navigation(timeout=45000, wait_until="domcontentloaded"):
                    page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_selector("#ctl00_SiteContentPlaceHolder_FormView1_rblArrested_1", state="visible", timeout=30000)
                page.wait_for_timeout(500)
                print("成功进入Security/Background Part 2页面")
                _progress(52, "进入Security/Background Part 2页面...")

                # 点击"No"选项 - 是否被逮捕过
                _check_radio_no_if_present("rblArrested")
                # 点击"No"选项 - 是否违反过毒品法
                _check_radio_no_if_present("rblControlledSubstances")
                # 点击"No"选项 - 是否从事过卖淫活动
                _check_radio_no_if_present("rblProstitution")
                # 点击"No"选项 - 是否参与过洗钱活动
                _check_radio_no_if_present("rblMoneyLaundering")
                # 点击"No"选项 - 是否参与过人口贩卖
                _check_radio_no_if_present("rblHumanTrafficking")
                # 点击"No"选项 - 是否协助过严重的人口贩卖
                _check_radio_no_if_present("rblAssistedSevereTrafficking")
                # 点击"No"选项 - 是否参与过人口贩卖相关活动
                _check_radio_no_if_present("rblHumanTraffickingRelated")
                capture_guide_page("security_part_2")
                save_debug_snapshot("security_part_2_before_next")
                # 点击"Next: Security/Background Part 3"按钮
                with page.expect_navigation(timeout=45000, wait_until="domcontentloaded"):
                    page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_selector("#ctl00_SiteContentPlaceHolder_FormView1_rblIllegalActivity_1", state="visible", timeout=30000)
                page.wait_for_timeout(500)
                print("成功进入Security/Background Part 3页面")
                _progress(54, "进入Security/Background Part 3页面...")

                # 点击"No"选项 - 是否参与过非法活动
                _check_radio_no_if_present("rblIllegalActivity")

                # 点击"No"选项 - 是否参与过恐怖活动
                _check_radio_no_if_present("rblTerroristActivity")
                # 点击"No"选项 - 是否支持过恐怖活动
                _check_radio_no_if_present("rblTerroristSupport")
                # 点击"No"选项 - 是否属于恐怖组织
                _check_radio_no_if_present("rblTerroristOrg")
                # 点击"No"选项 - 是否与恐怖组织有关联
                _check_radio_no_if_present("rblTerroristRel")
                # 点击"No"选项 - 是否参与过种族灭绝活动
                _check_radio_no_if_present("rblGenocide")
                # 点击"No"选项 - 是否参与过酷刑活动
                _check_radio_no_if_present("rblTorture")
                # 点击"No"选项 - 是否参与过极端暴力活动
                _check_radio_no_if_present("rblExViolence")
                # 点击"No"选项 - 是否参与过儿童兵役活动
                _check_radio_no_if_present("rblChildSoldier")
                # 点击"No"选项 - 是否参与过宗教自由相关活动
                _check_radio_no_if_present("rblReligiousFreedom")
                # 点击"No"选项 - 是否参与过人口控制相关活动
                _check_radio_no_if_present("rblPopulationControls")
                # 点击"No"选项 - 是否参与过器官移植相关活动
                _check_radio_no_if_present("rblTransplant")
                capture_guide_page("security_part_3")
                save_debug_snapshot("security_part_3_before_next")


                # 点击"Next: Security/Background Part 4"按钮
                with page.expect_navigation(timeout=45000, wait_until="domcontentloaded"):
                    page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_selector("#ctl00_SiteContentPlaceHolder_FormView1_rblImmigrationFraud_1", state="visible", timeout=30000)
                page.wait_for_timeout(500)
                print("成功进入Security/Background Part 4页面")
                _progress(57, "进入Security/Background Part 4页面...")

                # Security Part 4 所有必答项选 No（CEAC 校验：未选中会报错）
                _fill_security_no_options([
                    "rblRemovalHearing",
                    "rblImmigrationFraud",
                    "rblFailToAttend",
                    "rblVisaViolation",
                    "rblDeport",
                ], "Security Part 4")
                capture_guide_page("security_part_4")
                save_debug_snapshot("security_part_4_before_next")
                # 点击"Next: Security/Background Part 5"按钮
                with page.expect_navigation(timeout=45000, wait_until="domcontentloaded"):
                    page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_function(
                    "() => document.querySelectorAll(\"input[type=radio][id*='FormView1_']\").length > 0",
                    timeout=30000
                )
                page.wait_for_timeout(500)
                print("成功进入Security/Background Part 5页面")
                _progress(59, "进入Security/Background Part 5页面...")
                # Security Part 5 所有必答项选 No（CEAC 校验：未选中会报错）
                # 已知：ChildCustody, VotingViolation, RenounceExp；另有 public school/F status 等可能遗漏
                _fill_security_no_options([
                    "rblChildCustody",
                    "rblVotingViolation",
                    "rblRenounceExp",
                ], "Security Part 5")
                # 补点可能遗漏的 No（如 public elementary school on F status 等）
                try:
                    page.evaluate("""() => {
                        document.querySelectorAll('input[type=radio][value="N"]').forEach(r => {
                            if (!r.checked && r.id && r.id.indexOf('FormView1') >= 0) r.click();
                        });
                    }""")
                    page.wait_for_timeout(200)
                except Exception:
                    pass
                capture_guide_page("security_part_5")
                save_debug_snapshot("security_part_5_before_next")
                # 点击"Next: PHOTO"按钮
                with page.expect_navigation(timeout=45000, wait_until="domcontentloaded"):
                    page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_timeout(1500)  # 等待页面稳定
                _step_log("step=Photo_Enter 进入 PHOTO 页面")
                print("成功进入PHOTO页面")
                _progress(60, "进入PHOTO页面，上传照片...")
                # 点击"Upload Photo"按钮
            # 点击上传照片按钮
                page.click("#ctl00_SiteContentPlaceHolder_btnUploadPhoto")
                page.wait_for_timeout(1000)  # 等待上传对话框出现
                
                # 设置文件选择器
                file_chooser = page.wait_for_selector('input[type="file"]')
                file_chooser.set_input_files(photo_file)  # 直接使用传入的photo_file
                
                print(f"已选择照片文件: {photo_file}")
                page.wait_for_timeout(2000)  # 等待上传完成
                
                # 点击确认上传按钮
                page.click("#ctl00_cphButtons_btnUpload")
                page.wait_for_timeout(500)
                print("点击确认上传按钮成功")

                # 点击"Next: Continue Using this Photo"按钮
                page.click("#ctl00_cphButtons_btnContinue")
                page.wait_for_timeout(1000)  # 等待页面响应
                print("成功上传照片并进入下一页")
                capture_guide_page("photo")
                # 点击"Next: REVIEW"按钮
                with page.expect_navigation(wait_until="domcontentloaded", timeout=30000):
                    page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_timeout(1000)  # 等待 REVIEW 页面稳定
                _step_log("step=Review_Enter 进入 REVIEW 页面")
                print("成功进入REVIEW页面")
                _progress(62, "进入REVIEW页面，准备下载PDF...")
                capture_guide_page("review")
                # 处理点击"REVIEW"按钮后弹出的"离开此页吗？"确认弹窗
                # 等待弹窗出现并点击"离开"按钮（按钮文本为"离开"）
                try:
                    # 等待弹窗按钮出现
                    page.wait_for_selector('button:has-text("离开")', timeout=1000)
                    # 点击"离开"按钮
                    page.click('button:has-text("离开")')
                    print("已点击弹窗中的'离开'按钮，继续流程。")
                    page.wait_for_timeout(1000)  # 等待页面响应
                except Exception as e:
                    print(f"未检测到'离开'弹窗或点击失败: {e}")

                #定义需要保存的页面URL列表
                review_pages = [
                    ("https://ceac.state.gov/GenNIV/General/review/review_reviewpersonal.aspx?node=ReviewPersonal", "DS160_Review_Personal.pdf"),
                    ("https://ceac.state.gov/GenNIV/General/review/review_reviewtravel.aspx?node=ReviewTravel", "DS160_Review_Travel.pdf"),
                    ("https://ceac.state.gov/GenNIV/General/review/review_reviewUSContact.aspx?node=ReviewUSContact", "DS160_Review_USContact.pdf"),
                    ("https://ceac.state.gov/GenNIV/General/review/review_reviewFamily.aspx?node=ReviewFamily", "DS160_Review_Family.pdf"),
                    ("https://ceac.state.gov/GenNIV/General/review/review_reviewWorkEducation.aspx?node=ReviewWorkEducation", "DS160_Review_WorkEducation.pdf"),
                    ("https://ceac.state.gov/GenNIV/General/review/review_reviewsecurity.aspx?node=ReviewSecurity", "DS160_Review_Security.pdf"),
                    ("https://ceac.state.gov/GenNIV/General/review/review_reviewlocation.aspx?node=ReviewLocation", "DS160_Review_Location.pdf")
                ]

                # 将 Excel 个人邮箱写入 recipient_email.txt，供 Node 路由发邮件时使用
                excel_personal_email = (personal_info.get('Personal Email Address') or '').strip()
                if excel_personal_email and '@' in excel_personal_email:
                    try:
                        recipient_file = os.path.join(new_folder_path, 'recipient_email.txt')
                        with open(recipient_file, 'w', encoding='utf-8') as f:
                            f.write(excel_personal_email)
                        print(f"[INFO] 已写入 Excel 个人邮箱: {excel_personal_email}")
                    except Exception as e:
                        print(f"[WARN] 写入 recipient_email.txt 失败: {e}")

                # 写入 applicant_info.json，供邮件模板展示申请人信息
                try:
                    birth_date_raw = personal_info.get('birth_date') or ''
                    birth_date_fmt = format_date(birth_date_raw) if birth_date_raw else ''
                    applicant_info = {
                        "email": excel_personal_email or (personal_info.get('Personal Email Address') or '').strip(),
                        "surname": (personal_info.get('surname') or '').strip(),
                        "birth_date": birth_date_fmt,
                        "passport_number": (personal_info.get('passport_number') or '').strip(),
                        "primary_phone": (personal_info.get('Primary Phone Number') or '').strip(),
                        "security_question": "your mother name",
                        "security_answer": "MOTHER"
                    }
                    info_file = os.path.join(new_folder_path, 'applicant_info.json')
                    with open(info_file, 'w', encoding='utf-8') as f:
                        json.dump(applicant_info, f, ensure_ascii=False, indent=2)
                except Exception as e:
                    print(f"[WARN] 写入 applicant_info.json 失败: {e}")

                # 遍历每个页面并保存PDF
                for index, (url, pdf_name) in enumerate(review_pages, 1):
                    try:
                        time.sleep(2)
                        page.goto(url)
                        time.sleep(2)  # 等待页面加载完成
                        
                        # 保存为 PDF，添加序号前缀
                        numbered_pdf_name = f"{index:02d}_{pdf_name}"
                        pdf_path = os.path.join(new_folder_path, numbered_pdf_name)
                        
                        print(f"正在保存PDF: {numbered_pdf_name}")
                        page.pdf(
                            path=pdf_path,
                            format="A4",
                            print_background=True
                        )
                        print(f"[SUCCESS] PDF 保存完成：{numbered_pdf_name}")
                        _progress(62 + (index - 1) * 5, f"已保存PDF: {numbered_pdf_name}")
                        
                        # 如果不是最后一个页面，点击Next按钮
                        if url != review_pages[-1][0]:
                            page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                            page.wait_for_timeout(1000)  # 等待页面响应
                            print(f"成功进入下一页")
                            
                    except Exception as e:
                        print(f"[ERROR] 保存PDF失败 {numbered_pdf_name}: {e}")
                        continue

                # 点击Save按钮
                _progress(94, "正在保存申请...")
                try:
                    page.click("#ctl00_SiteContentPlaceHolder_UpdateButton2")
                    page.wait_for_timeout(1000)  # 等待页面响应
                    print("已点击Save按钮")
                except Exception as e:
                    print(f"点击Save按钮失败: {e}")
                
                # 点击"Exit Application"按钮
                _progress(96, "正在退出申请...")
                try:
                    page.click("#ctl00_btnExitApplication")
                    page.wait_for_timeout(2000)  # 等待退出完成
                    print("已点击Exit Application按钮")
                except Exception as e:
                    print(f"点击Exit Application按钮失败: {e}")

                print("填写完成，程序结束")
                _get_logger().info("DS160 填表成功完成")

                # 不再由 Python 发邮件：Node 路由会统一发送（含 Excel 个人邮箱、抄送 ukvisa、新模板）
                _progress(97, "准备完成...")
                _progress(99, "PDF 已保存，邮件将由系统发送")

                _progress(100, "DS-160 填表完成")
                # Close browser
                browser.close()
                return {
                    "success": True,
                    "pdf_dir": new_folder_path,
                    "aa_code": barcode_text[:10],
                    "surname": personal_info.get("surname", "")
                }
                
            except Exception as e:
                import traceback
                error_time = int(time.time())
                error_screenshot = f"error_{error_time}.png"
                error_html = f"error_html_{error_time}.html"
                err_type = type(e).__name__
                err_msg = str(e)
                tb_str = traceback.format_exc()
                # 输出结构化错误日志，便于前端展示和排查
                _error_log(_current_step, f"{err_type}: {err_msg}", tb_str)
                _get_logger().error(f"DS160 异常 [步骤={_current_step}]: {e}", exc_info=True)
                try:
                    page.screenshot(path=error_screenshot)
                    with open(error_html, "w", encoding="utf-8") as f:
                        f.write(page.content())
                    _step_log(f"step=ERROR 截图已保存: {error_screenshot}, HTML: {error_html}")
                except Exception as save_err:
                    _step_log(f"step=ERROR 保存截图失败: {save_err}")
                print(f"Error during form filling: {str(e)}", file=sys.stderr)
                browser.close()
                return {
                    "success": False,
                    "error": str(e),
                    "pdf_dir": None,
                    "aa_code": None,
                    "surname": None
                }
        

def main():
    parser = argparse.ArgumentParser(description='DS-160 Automated Form Filling (Server Version)')
    parser.add_argument('excel_file', help='Path to Excel file with applicant data')
    parser.add_argument('photo_file', help='Path to applicant photo')
    parser.add_argument('user_email', help='User email for folder naming and notifications')
    parser.add_argument('--country_map', help='Path to country mapping file', default='country_map.xlsx')
    parser.add_argument('--api_key', help='2Captcha API key', default=DEFAULT_API_KEY)
    parser.add_argument('--capsolver_api_key', help='Capsolver API key', default=os.environ.get("CAPSOLVER_API_KEY", "") or os.environ.get("CAPSOLVER_KEY", ""))
    parser.add_argument('--debug', action='store_true', help='Enable debug mode with extra logging')
    parser.add_argument('--timing', action='store_true', help='记录各阶段耗时到 ds160_timing_*.txt，用于进度条优化')
    
    args = parser.parse_args()
    
    g = globals()
    if args.timing:
        g["_timing_enabled"] = True
    g["_timing_last"] = None
    g["_timing_records"] = []
    g["_timing_start"] = None
    
    try:
        _progress(1, "开始DS-160填表流程...")
        # Validate input files
        if not os.path.exists(args.excel_file):
            print(f"Error: Excel file not found: {args.excel_file}")
            return 1
            
        if not os.path.exists(args.photo_file):
            print(f"Error: Photo file not found: {args.photo_file}")
            return 1
        
        _progress(1, "读取Excel数据...")
        if not os.path.exists(args.country_map):
            print(f"Warning: Country mapping file not found: {args.country_map}. 请将 country_map.xlsx 放到 ds160-server-package 目录")
            country_dict = {}
            _progress(2, "未找到国家映射表")
        else:
            print(f"Loading country mapping from: {args.country_map}")
            try:
                country_dict = load_country_map(args.country_map)
                _progress(2, f"已加载国家映射表，包含 {len(country_dict)} 个国家")
            except Exception as e:
                country_dict = {}
                _progress(2, f"加载国家映射表失败: {str(e)[:50]}")
        
        # Process Excel data
        _progress(2, "处理Excel数据...")
        print(f"Processing data from: {args.excel_file}")
        personal_info_list = process_excel_data(args.excel_file, country_dict)
        
        if not personal_info_list:
            print("Error: No data found in Excel file")
            return 1
        
        chinese_name = personal_info_list[0].get('chinese_name') or personal_info_list[0].get('姓', '') or 'N/A'
        _progress(2, f"Excel数据处理完成，申请人: {chinese_name}")
        _progress(3, "开始执行自动填表...")
        
        # Initialize form filler
        filler = DS160Filler(args.api_key, args.capsolver_api_key)
        
        # Process the first applicant
        print(f"Starting DS-160 form filling for: {personal_info_list[0].get('surname')} {personal_info_list[0].get('given_name')}")
        result = filler.run(personal_info_list[0], args.photo_file, args.user_email, country_dict, args.debug)
        
        if result and result.get("success", False):
            _write_timing_summary(success=True)
            print("DS-160 form filling completed successfully!")
            return 0
        else:
            _write_timing_summary(success=False)
            print("DS-160 form filling failed.")
            if result and "error" in result:
                print(f"Error details: {result['error']}")
            return 1
            
    except Exception as e:
        import traceback as _tb
        _write_timing_summary(success=False)
        err_type = type(e).__name__
        err_msg = str(e)
        _error_log("Main", f"{err_type}: {err_msg}", _tb.format_exc())
        print(f"Error: {str(e)}", file=sys.stderr)
        _tb.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main()) 
