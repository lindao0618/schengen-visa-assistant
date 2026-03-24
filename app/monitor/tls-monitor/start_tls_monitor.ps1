# TLS法签监控系统启动脚本 (PowerShell)
# 设置控制台编码
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    TLS法签监控系统启动脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查Python环境
Write-Host "正在检查Python环境..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Python环境检查通过: $pythonVersion" -ForegroundColor Green
    } else {
        throw "Python命令执行失败"
    }
} catch {
    Write-Host "❌ 错误: 未找到Python环境" -ForegroundColor Red
    Write-Host "请确保已安装Python并添加到PATH环境变量" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}

Write-Host ""

# 检查依赖包
Write-Host "正在检查依赖包..." -ForegroundColor Yellow
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

try {
    pip install -r requirements.txt 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ 依赖包安装完成" -ForegroundColor Green
    } else {
        Write-Host "⚠️ 警告: 依赖包安装可能不完整，但继续尝试启动" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ 警告: 依赖包安装失败，但继续尝试启动" -ForegroundColor Yellow
}

Write-Host ""

# 启动系统
Write-Host "正在启动TLS监控系统..." -ForegroundColor Yellow
Write-Host ""
Write-Host "服务信息:" -ForegroundColor Cyan
Write-Host "  - 监控主程序: 运行中" -ForegroundColor White
Write-Host "  - API服务器: http://localhost:8004" -ForegroundColor White
Write-Host "  - 监控状态: http://localhost:8004/status" -ForegroundColor White
Write-Host "  - 健康检查: http://localhost:8004/health" -ForegroundColor White
Write-Host ""
Write-Host "按 Ctrl+C 停止所有服务" -ForegroundColor Yellow
Write-Host ""

try {
    # 启动Python脚本
    python start.py
} catch {
    Write-Host "❌ 启动失败: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    Write-Host ""
    Write-Host "TLS监控系统已停止" -ForegroundColor Yellow
    Read-Host "按回车键退出"
}


























