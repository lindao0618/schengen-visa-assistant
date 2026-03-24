# 材料审核系统 - 安装使用指南

## 🎯 系统概述

这是一个基于 **PaddleOCR + PP-StructureV3** 的智能签证材料审核系统，能够自动分析行程单、酒店预订单、银行流水等文档，提供结构化的数据提取和智能验证建议。

## 📁 文件结构

```
app/material_review/
├── main.py                 # 主服务文件 (FastAPI)
├── document_processor.py   # 文档处理器（分析逻辑）
├── requirements.txt        # 依赖列表
├── start_service.py        # 启动脚本
├── test_service.py         # 测试脚本
├── demo.html              # 演示界面
├── README.md              # 详细说明
├── SETUP_GUIDE.md         # 本文件
└── test_documents/        # 测试文档（运行测试后生成）
```

## 🚀 快速开始

### 方法一：使用启动脚本（推荐）

```bash
# 进入材料审核目录
cd app/material_review

# 运行启动脚本（会自动检查并安装依赖）
python start_service.py
```

### 方法二：手动安装

```bash
# 1. 安装基础依赖
pip install fastapi uvicorn python-multipart

# 2. 安装 PaddleOCR（可选，建议使用镜像源）
pip install paddlepaddle -i https://mirror.baidu.com/pypi/simple
pip install "paddleocr[structure]" -i https://mirror.baidu.com/pypi/simple

# 3. 安装其他依赖
pip install -r requirements.txt

# 4. 启动服务
python main.py
```

## 🌐 访问服务

启动成功后，可以通过以下方式访问：

- **API 服务**: http://localhost:8003
- **API 文档**: http://localhost:8003/docs
- **演示界面**: 直接打开 `demo.html` 文件

## 🧪 运行测试

```bash
# 运行完整测试套件
python test_service.py
```

测试将自动：
1. 检查服务健康状态
2. 创建测试文档
3. 测试文件上传分析
4. 测试 Base64 分析
5. 输出测试结果报告

## 📊 支持的分析类型

### 1. 行程单分析 (`itinerary`)
- **提取信息**: 日期、目的地、住宿、交通、活动
- **验证项目**: 日期一致性、行程合理性、住宿匹配、时长适当
- **输出建议**: 日期补充、目的地明确、住宿证明等

### 2. 酒店预订单分析 (`hotel_booking`)
- **提取信息**: 酒店名称、入住退房日期、客人姓名、预订号、金额
- **验证项目**: 预订确认状态、日期有效性、姓名匹配、金额合理
- **输出建议**: 确认状态、可取消预订等

### 3. 银行流水分析 (`bank_statement`)
- **提取信息**: 账户信息、流水期间、交易记录、余额
- **验证项目**: 余额充足性、收入规律性、期间适当性
- **输出建议**: 余额增加、期间延长、交易说明等

## 🔧 API 使用示例

### 文件上传分析

```bash
curl -X POST "http://localhost:8003/upload-document" \
  -F "file=@your_document.pdf" \
  -F "analysis_type=itinerary"
```

### Base64 分析

```bash
curl -X POST "http://localhost:8003/analyze-base64" \
  -H "Content-Type: application/json" \
  -d '{
    "file_base64": "base64_encoded_content",
    "file_type": "pdf",
    "analysis_type": "hotel_booking"
  }'
```

## 📋 响应格式

```json
{
  "analysis_result": {
    "success": true,
    "document_type": "itinerary",
    "extracted_data": {
      "dates": ["2024-12-25", "2025-01-05"],
      "destinations": ["巴黎", "里昂"],
      "accommodations": [...],
      "transportation": [...],
      "activities": [...]
    },
    "verification_results": {
      "date_consistency": true,
      "reasonable_itinerary": true,
      "accommodation_matches": true,
      "duration_appropriate": true
    },
    "recommendations": [
      "建议补充具体的交通安排证明",
      "行程安排合理，建议保持"
    ],
    "confidence_score": 0.85
  },
  "visual_markup_base64": null
}
```

## ⚙️ 配置选项

### PaddleOCR 配置
可在 `main.py` 中调整 OCR 参数：

```python
self.ocr_engine = PaddleOCR(
    use_angle_cls=True,  # 启用角度校正
    lang='ch',           # 语言支持（ch=中英文）
    show_log=False       # 关闭详细日志
)
```

### 验证规则自定义
在 `document_processor.py` 中修改验证逻辑：

```python
def validate_itinerary(extracted_data: Dict[str, Any]) -> Dict[str, Any]:
    # 自定义验证规则
    if len(destinations) > 10:
        validation_results["issues"].append("目的地过多，可能影响签证通过率")
    return validation_results
```

## 🔍 故障排除

### 常见问题

1. **PaddleOCR 安装失败**
   ```bash
   # 使用清华源
   pip install paddlepaddle -i https://pypi.tuna.tsinghua.edu.cn/simple
   pip install paddleocr -i https://pypi.tuna.tsinghua.edu.cn/simple
   ```

2. **服务启动失败**
   - 检查端口 8003 是否被占用
   - 确保 Python 版本 >= 3.7
   - 检查依赖安装情况

3. **OCR 识别效果差**
   - 确保文档清晰度足够
   - 尝试调整 PaddleOCR 参数
   - 考虑预处理图像（增强对比度、去噪等）

4. **内存占用过高**
   - 减少并发请求数量
   - 及时清理临时文件
   - 考虑使用轻量级模型

### 备用模式运行

如果 PaddleOCR 安装失败，系统会以备用模式运行：
- 不支持 OCR 功能
- 返回模拟分析结果
- 仍可测试 API 接口和前端界面

## 📈 性能优化建议

1. **模型缓存**: OCR 模型在启动时加载，避免重复初始化
2. **异步处理**: 利用 FastAPI 异步特性处理并发请求
3. **文件缓存**: 对相同文档的重复分析使用缓存
4. **GPU 加速**: 在支持的环境中启用 GPU 加速

## 🔄 扩展开发

### 添加新文档类型

1. 在 `DocumentAnalyzer` 类中添加新方法
2. 在 `document_processor.py` 中创建对应处理器
3. 更新 API 路由支持新类型

### 集成到现有系统

可以通过以下方式集成：
- REST API 调用
- Python 模块导入
- Docker 容器部署
- 微服务架构

## 📞 技术支持

如遇到问题，请检查：
1. 系统日志输出
2. API 文档 (http://localhost:8003/docs)
3. 测试结果 (运行 `test_service.py`)

---

**注意**: 首次运行时，PaddleOCR 会自动下载模型文件，可能需要较长时间和网络连接。