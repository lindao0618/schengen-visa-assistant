from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import JSONResponse
from datetime import datetime, timedelta
from prompt_builder import build_prompt
from deepseek_api import call_deepseek
from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Mm, Inches, Pt
from docx2pdf import convert
import shutil
import os
import re
import base64
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

@app.get("/health")
def health():
    """健康检查：用于确认行程单服务是否已启动"""
    return {"status": "ok", "service": "trip_generator"}

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def create_word_from_template(rows, template_path: str, output_docx: str):
    """Create Word document using the template file - preserving all original formatting"""

    doc = Document(template_path)
    table = doc.tables[0]
    
    print(f"Template table has {len(table.rows)} rows")
    print(f"Data to insert: {len(rows)} rows")
    print(f"Data content: {rows}")

    # 保留前2行（标题行和表头），清除后面的数据行
    while len(table.rows) > 2:
        table._element.remove(table.rows[-1]._element)
    
    print(f"After clearing, table has {len(table.rows)} rows")

    # 为每个数据行创建新行，保持模板格式
    for i, row_data in enumerate(rows):
        print(f"Processing row {i}: {row_data}")
        
        # 添加新行
        new_row = table.add_row()
        cells = new_row.cells
        
        # 复制模板中第3行的格式（第一个数据行）
        if i == 0 and len(table.rows) > 3:
            template_row = table.rows[2]  # 第3行是第一个数据行
            for j, cell in enumerate(cells):
                # 复制单元格格式
                cell._element.get_or_add_tcPr().append(template_row.cells[j]._element.get_or_add_tcPr())

        for j, content in enumerate(row_data):
            cell = cells[j]
            
            # 获取第一个段落
            para = cell.paragraphs[0]
            
            # 清除所有runs但保留段落格式
            for run in para.runs:
                run.clear()
            
            # 添加新内容，完全继承模板格式
            run = para.add_run(content)
            print(f"  Cell {j}: '{content}' -> '{run.text}'")

    print(f"Final table has {len(table.rows)} rows")
    doc.save(output_docx)
    print(f"Document saved to {output_docx}")

def create_pdf_from_template(rows, template_path: str, output_pdf: str):
    """Create PDF using the template file"""
    import os
    from docx2pdf import convert
    
    # 先生成Word文件
    output_docx = output_pdf.replace('.pdf', '.docx')
    create_word_from_template(rows, template_path, output_docx)
    
    # 然后转换为PDF
    convert(output_docx, output_pdf)
    
    # 删除临时Word文件
    os.remove(output_docx)

class ItineraryRequest(BaseModel):
    country: str
    departure_city: str
    arrival_city: str
    start_date: str  # yyyy-mm-dd
    end_date: str    # yyyy-mm-dd
    hotel_name: str
    hotel_address: str
    hotel_phone: str

class ItineraryResponse(BaseModel):
    pdf_base64: str
    analysis: str

def parse_attractions(response):
    """Parse AI response to extract dates and attractions"""
    # Split response by lines and remove empty lines
    lines = [line.strip() for line in response.split('\n') if line.strip()]
    
    daily_attractions = {}
    for line in lines:
        # Look for lines containing date and attractions (format: "YYYY.MM.DD: Attraction1, Attraction2")
        if ':' in line:
            date_str, attractions = line.split(':', 1)
            date_str = date_str.strip()
            attractions = attractions.strip()
            
            # Convert YYYY.MM.DD format to DD/MM/YYYY format
            if len(date_str) == 10 and date_str[4] == '.' and date_str[7] == '.':
                year = date_str[0:4]
                month = date_str[5:7]
                day = date_str[8:10]
                date_str = f"{day}/{month}/{year}"
            
            # Special handling for Palace of Versailles
            if "Palace of Versailles" in attractions or "Château de Versailles" in attractions:
                print(f"\n🏰 Found Palace of Versailles {date_str} - Setting as only attraction for the day")
                daily_attractions[date_str] = "Palace of Versailles"
            else:
                # Process comma-separated attractions
                attractions_list = [attr.strip() for attr in attractions.split(',')]
                daily_attractions[date_str] = ', '.join(attractions_list)
    
    return daily_attractions

def analyze_itinerary(rows):
    """Analyze the itinerary using Deepseek"""
    # Convert rows to readable format for analysis
    itinerary_text = "Generated Itinerary:\n\n"
    for row in rows:
        day, date, transport, spots, hotel = row
        itinerary_text += f"Day {day} ({date}):\n"
        itinerary_text += f"City: {transport}\n"
        if spots:
            itinerary_text += f"Attractions: {spots}\n"
        if hotel:
            itinerary_text += f"Hotel Information:\n{hotel}\n"
        itinerary_text += "-------------------\n"

    prompt = f"""Please analyze this travel itinerary based on French visa center (TLScontact/VFS Global) official requirements and visa officer practices. Consider:

1. Official Visa Requirements:
   - Are all dates listed consecutively?
   - Are all cities and transportation methods clearly indicated?
   - Are attractions properly planned for each day?（if there is only one attraction, it should be Palace of Versailles,this is suitable for visa officer）
   - Does it align with hotel bookings (check-in/check-out)?

2. Daily Schedule Credibility:
   - Are there 2-3 attractions per day (minimum requirement)?（if there is only one attraction, it should be Palace of Versailles,this is suitable for visa officer）
   - Is the first day marked with check-in and last day with check-out?
   - Are attractions logically varied between days (not repetitive)?
   - Is the number of attractions reasonable (not exceeding 4 per day)?
   - Do hotel locations match the cities visited?

3. Schedule Practicality:
   - Is the route between attractions efficient?
   - Is there enough time between attractions?
   - Are attractions logically grouped by location?
   - Are there any scheduling conflicts or impractical arrangements?

4. Overall Credibility:
   - Does the itinerary appear authentic and well-planned?
   - Are there emotional touchpoints (e.g., evening walks, relaxation time)?
   - Is there enough variety in activities?
   - Is the format clear and easy for visa officers to review?

Itinerary to analyze:
{itinerary_text}

请简要分析该行程是否符合签证基本要求和标准。"""

    response = call_deepseek(prompt, lang="zh")
    return response

@app.post("/generate-itinerary", response_model=ItineraryResponse)
def generate_itinerary(req: ItineraryRequest):
    try:
        # Date processing
        start_date = datetime.strptime(req.start_date, "%Y-%m-%d")
        end_date = datetime.strptime(req.end_date, "%Y-%m-%d")
        days = (end_date - start_date).days + 1

        print("\n=== Generated Daily Attractions ===")
        print(f"Destination: from {req.departure_city} to {req.arrival_city}")
        print(f"Duration: {days} days ({req.start_date} to {req.end_date})")
        print("=====================================\n")

        # Generate one prompt for the entire itinerary
        prompt = build_prompt(
            city=req.arrival_city,
            start=start_date.strftime("%Y.%m.%d"),
            end=end_date.strftime("%Y.%m.%d"),
            hotel={
                "名称": req.hotel_name,
                "地址": req.hotel_address,
                "电话": req.hotel_phone
            },
            lang="zh"
        )
        
        response = call_deepseek(prompt, lang="zh")
        print("\nDeepseek response:")
        print(response)
        
        daily_attractions = parse_attractions(response)
        daily_spots = {}
        
        # Process attractions for all days except first and last
        for i in range(1, days - 1):
            current_date = start_date + timedelta(days=i)
            display_date_str = current_date.strftime("%d/%m/%Y")
            
            if daily_attractions:
                attractions = daily_attractions.get(display_date_str, "")
                if attractions:
                    print(f"\nDay {i} ({display_date_str}):")
                    print(f"Attractions: {attractions}")
                    print("----------------------------------------")
                    daily_spots[display_date_str] = attractions

        rows = []
        for i in range(days):
            current_date = start_date + timedelta(days=i)
            date_str = current_date.strftime("%d/%m/%Y")
            
            # Handle transportation and attractions based on day type
            if i == 0:  # First day (arrival)
                transport = f"{req.departure_city} ➔ {req.arrival_city}"
                spots = "Arrival Day - Hotel Check-in"
                hotel_info = f"Hotel: {req.hotel_name}\nAddress: {req.hotel_address}\nPhone: {req.hotel_phone}"
            elif i == days - 1:  # Last day (departure)
                transport = f"{req.arrival_city} ➔ {req.departure_city}"
                spots = "Departure Day - Hotel Check-out"
                hotel_info = ""
            else:  # Regular sightseeing day
                transport = f"{req.arrival_city}"  # Just use arrival city name for middle days
                spots = daily_spots.get(date_str, "")  # Empty string if no attractions found
                hotel_info = f"Hotel: {req.hotel_name}\nAddress: {req.hotel_address}\nPhone: {req.hotel_phone}"

            rows.append([str(i + 1), date_str, transport, spots, hotel_info])

        # Create output directory
        os.makedirs("output", exist_ok=True)
        
        # Generate unique filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_docx = f"output/itinerary_{timestamp}.docx"
        output_pdf = f"output/itinerary_{timestamp}.pdf"

        # Get itinerary analysis
        logger.info("Analyzing itinerary")
        analysis = analyze_itinerary(rows)
        
        # Create Word document first
        logger.info("Creating Word document from template")
        create_word_from_template(rows, "template.docx", output_docx)
        logger.info(f"Word document saved as: {output_docx}")

        # Convert Word to PDF (requires Microsoft Word on Windows)
        try:
            from docx2pdf import convert
            logger.info("Converting Word to PDF...")
            convert(output_docx, output_pdf)
            logger.info(f"PDF saved as: {output_pdf}")
        except Exception as pdf_err:
            logger.warning(f"docx2pdf failed ({pdf_err}), trying LibreOffice...")
            # Fallback: LibreOffice headless (if installed)
            try:
                import subprocess
                abs_docx = os.path.abspath(output_docx)
                out_dir = os.path.dirname(abs_docx)
                for prog in ["soffice", "libreoffice"]:
                    try:
                        r = subprocess.run(
                            [prog, "--headless", "--convert-to", "pdf", "--outdir", out_dir, abs_docx],
                            capture_output=True, timeout=60, cwd=os.getcwd()
                        )
                        if os.path.exists(output_pdf):
                            logger.info("PDF created via LibreOffice")
                            break
                    except (FileNotFoundError, subprocess.TimeoutExpired):
                        continue
            except Exception as e:
                logger.warning(f"LibreOffice fallback failed: {e}")
            if not os.path.exists(output_pdf):
                raise RuntimeError(
                    "PDF 生成失败。请安装 Microsoft Word 或 LibreOffice 以支持 Word 转 PDF。"
                ) from pdf_err

        logger.info("Reading generated file")
        with open(output_pdf, "rb") as pdf_file:
            pdf_content = pdf_file.read()
            logger.info(f"File size: {len(pdf_content)} bytes")
            pdf_base64 = base64.b64encode(pdf_content).decode()
            logger.info(f"Base64 string length: {len(pdf_base64)}")

        # Return both PDF and analysis
        response_data = {
            "pdf_base64": pdf_base64,
            "analysis": analysis
        }
        
        logger.info("Sending response")
        return JSONResponse(content=response_data)
        
    except Exception as e:
        logger.error(f"Error in generate_itinerary: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

if __name__ == "__main__":
    import uvicorn
    try:
        print("Starting trip generator service on port 8002...")
        uvicorn.run(app, host="0.0.0.0", port=8002, log_level="info")
    except KeyboardInterrupt:
        print("Service stopped by user")
    except Exception as e:
        print(f"Service error: {e}")
        # Keep the service running even if there's an error
        import time
        while True:
            time.sleep(1)
