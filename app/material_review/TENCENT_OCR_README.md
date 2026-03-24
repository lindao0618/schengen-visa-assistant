# 腾讯云OCR材料审核系统

本系统使用腾讯云OCR API替代本地PaddleOCR，提供更准确的文档识别和分析功能。

## 🚀 快速开始

### 1. 安装依赖

```bash
cd app/material_review
pip install -r tencent_requirements.txt
```

### 2. 获取腾讯云API密钥

1. 访问 [腾讯云控制台](https://console.cloud.tencent.com/cam/capi)
2. 创建或获取您的 `SecretId` 和 `SecretKey`
3. 确保您的账户有OCR服务的使用权限

### 3. 设置环境变量

#### 方法一：使用设置脚本（推荐）
```bash
python setup_tencent_env.py
```

#### 方法二：手动设置
**Windows:**
```bash
set TENCENTCLOUD_SECRET_ID=您的SecretId
set TENCENTCLOUD_SECRET_KEY=您的SecretKey
```

**Linux/Mac:**
```bash
export TENCENTCLOUD_SECRET_ID=您的SecretId
export TENCENTCLOUD_SECRET_KEY=您的SecretKey
```

### 4. 测试配置

```bash
python test_tencent_ocr.py
```

### 5. 启动服务

#### 使用启动脚本（推荐）
```bash
python start_tencent_service.py
```

#### 手动启动
```bash
python tencent_ocr_main.py
```

## 📋 功能特性

### ✅ 腾讯云OCR集成
- 高精度文档识别
- 支持PDF和图片格式
- 自动置信度评估
- 云端处理，无需本地模型

### ✅ 文档分析
- 智能文本提取
- 结构化数据解析
- 多种文档类型支持
- AI辅助分析

### ✅ 结果导出
- 自动生成Word文档
- 包含完整OCR结果
- 支持在线下载
- 格式化文本输出

### ✅ Web界面
- 友好的文件上传界面
- 实时分析进度显示
- 详细的分析结果展示
- 一键下载功能

## 🔧 API接口

### 上传文档分析
```
POST /upload-document
Content-Type: multipart/form-data

Parameters:
- file: 文档文件 (PDF/JPG/PNG)
- document_type: 文档类型 (itinerary/hotel/bank_statement/等)
```

### 下载OCR结果
```
GET /download-ocr-result/{filename}
```

### 健康检查
```
GET /health
```

## 📊 支持的文档格式

| 格式 | 扩展名 | 说明 |
|------|--------|------|
| PDF文档 | .pdf | 支持多页PDF |
| 图片 | .jpg, .jpeg, .png | 常见图片格式 |

## 🔧 配置说明

### 环境变量

| 变量名 | 必需 | 说明 |
|--------|------|------|
| TENCENTCLOUD_SECRET_ID | ✅ | 腾讯云API SecretId |
| TENCENTCLOUD_SECRET_KEY | ✅ | 腾讯云API SecretKey |

### 服务配置

- **端口**: 8003
- **CORS**: 支持localhost:3000和localhost:3004
- **文件大小限制**: 由FastAPI默认设置决定
- **超时**: 由腾讯云API限制决定

## 🚨 故障排除

### 常见问题

#### 1. ImportError: 腾讯云SDK导入失败
```bash
pip install tencentcloud-sdk-python
```

#### 2. 认证失败
- 检查SecretId和SecretKey是否正确
- 确认环境变量已正确设置
- 验证腾讯云账户权限

#### 3. OCR识别失败
- 检查文件格式是否支持
- 确认文件没有损坏
- 验证网络连接

#### 4. 服务启动失败
- 检查端口8003是否被占用
- 确认所有依赖已安装
- 查看错误日志

### 日志查看

服务运行时会输出详细日志，包括：
- OCR API调用状态
- 文件处理进度
- 错误信息详情

### 调试模式

如需调试，可以修改日志级别：
```python
logging.basicConfig(level=logging.DEBUG)
```

## 📈 性能优化

### 1. 文件预处理
- 确保图片清晰度
- 适当调整图片大小
- 使用高质量PDF

### 2. API调用优化
- 合理设置超时时间
- 使用批量处理
- 缓存常用结果

## 🔒 安全建议

1. **保护API密钥**
   - 不要在代码中硬编码密钥
   - 使用环境变量存储
   - 定期轮换密钥

2. **网络安全**
   - 使用HTTPS传输
   - 限制访问来源
   - 设置适当的CORS策略

3. **文件安全**
   - 验证文件类型
   - 限制文件大小
   - 及时清理临时文件

## 📞 技术支持

- 腾讯云OCR官方文档: https://cloud.tencent.com/document/product/866
- FastAPI官方文档: https://fastapi.tiangolo.com/
- 项目Issues: 请在项目仓库提交问题

## 🔄 版本更新

### v1.0.0
- 初始版本
- 腾讯云OCR集成
- 基础文档分析功能
- Web界面支持

## 📄 许可证

本项目遵循相应的开源许可证。使用腾讯云服务需遵循腾讯云服务条款。