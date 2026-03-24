@echo off
chcp 65001 >nul
echo.
echo ========================================
echo    TLS法签监控系统启动脚本
echo ========================================
echo.

echo 正在检查Python环境...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到Python环境
    echo 请确保已安装Python并添加到PATH环境变量
    pause
    exit /b 1
)

echo ✅ Python环境检查通过
echo.

echo 正在检查依赖包...
cd /d "%~dp0"
pip install -r requirements.txt >nul 2>&1
if errorlevel 1 (
    echo ⚠️ 警告: 依赖包安装可能不完整，但继续尝试启动
    echo.
)

echo 正在启动TLS监控系统...
echo.
echo 服务信息:
echo   - 监控主程序: 运行中
echo   - API服务器: http://localhost:8004
echo   - 监控状态: http://localhost:8004/status
echo   - 健康检查: http://localhost:8004/health
echo.
echo 按 Ctrl+C 停止所有服务
echo.

python start.py

echo.
echo TLS监控系统已停止
pause


























