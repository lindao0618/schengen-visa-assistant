@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: 设置颜色代码
set "GREEN=[92m"
set "BLUE=[94m"
set "YELLOW=[93m"
set "RED=[91m"
set "CYAN=[96m"
set "PURPLE=[95m"
set "RESET=[0m"

:: 打印启动横幅
echo.
echo %CYAN%╔══════════════════════════════════════════════════════════════╗%RESET%
echo %CYAN%║                    签证助手系统 - 统一启动器                    ║%RESET%
echo %CYAN%║                                                              ║%RESET%
echo %CYAN%║  🌐 Next.js前端服务     (端口: 3001)                          ║%RESET%
echo %CYAN%║  🔍 TLS监控服务        (端口: 8004)                          ║%RESET%
echo %CYAN%║  🤖 AI助手服务         (端口: 8000)                          ║%RESET%
echo %CYAN%║  📸 美签照片检测服务    (端口: 5001)                          ║%RESET%
echo %CYAN%║  📋 DS160填表服务      (命令行工具)                           ║%RESET%
echo %CYAN%║  📄 行程单生成服务     (集成服务)                             ║%RESET%
echo %CYAN%║                                                              ║%RESET%
echo %CYAN%║  按 Ctrl+C 停止所有服务                                       ║%RESET%
echo %CYAN%╚══════════════════════════════════════════════════════════════╝%RESET%
echo.

:: 检查是否在正确的目录
if not exist "package.json" (
    echo %RED%❌ 请在项目根目录中运行此脚本%RESET%
    pause
    exit /b 1
)

:: 检查依赖
echo %BLUE%🔧 正在检查系统环境...%RESET%

:: 检查Node.js
node --version >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo %GREEN%✅ Node.js: !NODE_VERSION!%RESET%
) else (
    echo %RED%❌ Node.js: 未安装%RESET%
)

:: 检查NPM
npm --version >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo %GREEN%✅ NPM: !NPM_VERSION!%RESET%
) else (
    echo %RED%❌ NPM: 未安装%RESET%
)

:: 检查Python
python --version >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
    echo %GREEN%✅ Python: !PYTHON_VERSION!%RESET%
) else (
    echo %RED%❌ Python: 未安装%RESET%
)

echo.
echo ============================================================
echo %CYAN%🚀 开始启动所有服务...%RESET%
echo ============================================================

:: 清理可能占用的端口
echo %YELLOW%🔧 清理端口占用...%RESET%
for %%p in (3001 8004 8000 5001) do (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%%p') do (
        echo %YELLOW%🔪 杀死占用端口 %%p 的进程: PID %%a%RESET%
        taskkill /f /pid %%a >nul 2>&1
    )
)

:: 等待端口清理完成
timeout /t 2 /nobreak >nul

:: 启动美签照片检测服务 (端口: 5001)
echo.
echo %YELLOW%🚀 启动美签照片检测服务...%RESET%
start "美签照片检测服务" cmd /c "cd /d %~dp0services\photo-checker && python photo_check_api.py"
timeout /t 3 /nobreak >nul

:: 启动AI助手服务 (端口: 8000)
echo %BLUE%🚀 启动AI助手服务...%RESET%
start "AI助手服务" cmd /c "cd /d %~dp0VISA-ASK-SYSTEM && python main_api.py"
timeout /t 8 /nobreak >nul

:: 启动TLS监控服务 (端口: 8004)
echo %GREEN%🚀 启动TLS监控服务...%RESET%
start "TLS监控服务" cmd /c "cd /d %~dp0app\tls-monitor && python main.py"
timeout /t 5 /nobreak >nul

:: 启动Next.js前端服务 (端口: 3001)
echo %CYAN%🚀 启动Next.js前端服务...%RESET%
set PORT=3001
set NEXT_TELEMETRY_DISABLED=1
start "Next.js前端服务" cmd /c "npm run dev"
timeout /t 5 /nobreak >nul

echo.
echo ============================================================
echo %GREEN%🎉 所有服务启动完成！%RESET%
echo ============================================================

:: 显示服务访问地址
echo.
echo %CYAN%📋 服务访问地址:%RESET%
echo    🌐 前端界面: http://localhost:3001
echo    🤖 AI助手API: http://localhost:8000
echo    🔍 TLS监控API: http://localhost:8004
echo    📸 照片检测API: http://localhost:5001

echo.
echo %CYAN%📊 服务状态检查:%RESET%

:: 等待服务完全启动
timeout /t 10 /nobreak >nul

:: 检查服务端口状态
for %%p in (3001:前端服务 8000:AI助手 8004:TLS监控 5001:照片检测) do (
    for /f "tokens=1,2 delims=:" %%a in ("%%p") do (
        netstat -an | findstr :%%a >nul 2>&1
        if !errorlevel! equ 0 (
            echo    %GREEN%🟢 %%b (端口: %%a) - 运行中%RESET%
        ) else (
            echo    %RED%🔴 %%b (端口: %%a) - 未启动%RESET%
        )
    )
)

echo.
echo %YELLOW%💡 提示:%RESET%
echo    - 所有服务已在后台运行
echo    - 关闭此窗口不会停止服务
echo    - 要停止服务，请关闭对应的服务窗口
echo    - 或使用任务管理器结束相关进程

echo.
echo %GREEN%🎯 启动完成！您现在可以访问各个服务了。%RESET%
echo.

:: 询问是否打开浏览器
set /p OPEN_BROWSER="是否要打开浏览器访问前端界面？(Y/N): "
if /i "!OPEN_BROWSER!"=="Y" (
    echo %CYAN%🌐 正在打开浏览器...%RESET%
    start http://localhost:3001
)

echo.
echo %CYAN%按任意键退出启动器...%RESET%
pause >nul
