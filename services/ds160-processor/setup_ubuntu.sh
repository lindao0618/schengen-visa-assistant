#!/bin/bash
# DS160 Automation Setup Script for Ubuntu Server
# 此脚本安装DS160自动填表程序所需的所有依赖

# 显示执行过程中的命令
set -x

echo "DS160自动填表程序服务器版本安装脚本"
echo "=================================="

# 更新系统包
echo "正在更新系统包..."
sudo apt-get update

# 安装python3和pip（如果尚未安装）
echo "正在安装Python和依赖..."
sudo apt-get install -y python3 python3-pip

# 安装poppler-utils，这是pdf2image依赖的库
echo "正在安装poppler-utils..."
sudo apt-get install -y poppler-utils

# 安装playwright所需的系统依赖
echo "正在安装系统依赖..."
sudo apt-get install -y libx11-xcb1 libxcb-dri3-0 libxcomposite1 libxcursor1 \
libxdamage1 libxi6 libxtst6 libnss3 libcups2 libxss1 libxrandr2 \
libasound2 libatk1.0-0 libatk-bridge2.0-0 libpangocairo-1.0-0 \
libgtk-3-0 libgbm1 libxshmfence1

# 使用pip安装Python依赖
echo "正在安装Python包..."
pip3 install -r requirements.txt

# 安装playwright浏览器
echo "正在安装Playwright浏览器..."
python3 -m playwright install chromium

# 创建输出目录
echo "正在创建输出目录..."
mkdir -p excel_files
mkdir -p photos
mkdir -p output
mkdir -p logs

# 设置执行权限
echo "正在设置执行权限..."
chmod +x test_ds160_server.sh
chmod +x run_ds160.sh

# 成功安装完成
echo ""
echo "安装完成！"
echo ""
echo "使用以下命令运行DS160自动填表程序："
echo "python3 ds160_server.py <excel文件> <照片文件>"
echo ""
echo "示例："
echo "python3 ds160_server.py excel_files/ds160_data.xlsx photos/applicant.jpg"
echo ""
echo "或者使用测试脚本："
echo "./test_ds160_server.sh <excel文件> <照片文件>"
echo ""
echo "如果没有提供参数，测试脚本将尝试在excel_files/和photos/目录中寻找默认文件。"

echo "环境设置完成！"
echo "使用方法："
echo "python3 ds160_server.py <excel文件路径> <照片文件路径>"
echo "例如："
echo "python3 ds160_server.py ./excel_files/test-ds160.xlsx ./photos/test-ds160.jpg" 