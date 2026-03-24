# 签证助手系统 - PowerShell统一启动脚本
# 一键启动所有服务：TLS监控、材料审核、AI助手、美签填表、材料定制API等

param(
    [switch]$SkipPortCheck,
    [switch]$OpenBrowser,
    [int]$StartupDelay = 3
)

# 设置控制台编码为UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 颜色定义
$Colors = @{
    Green = "Green"
    Blue = "Blue" 
    Yellow = "Yellow"
    Red = "Red"
    Cyan = "Cyan"
    Magenta = "Magenta"
    White = "White"
}

function Write-ColorText {
    param(
        [string]$Text,
        [string]$Color = "White"
    )
    Write-Host $Text -ForegroundColor $Colors[$Color]
}

function Show-Banner {
    Write-Host ""
    Write-ColorText "╔══════════════════════════════════════════════════════════════╗" "Cyan"
    Write-ColorText "║                    签证助手系统 - 统一启动器                    ║" "Cyan"
    Write-ColorText "║                                                              ║" "Cyan"
    Write-ColorText "║  🌐 Next.js前端服务     (端口: 3001)                          ║" "Cyan"
    Write-ColorText "║  🔍 TLS监控服务        (端口: 8004)                          ║" "Cyan"
    Write-ColorText "║  🤖 AI助手服务         (端口: 8000)                          ║" "Cyan"
    Write-ColorText "║  📸 美签照片检测服务    (端口: 5001)                          ║" "Cyan"
    Write-ColorText "║  📋 DS160填表服务      (命令行工具)                           ║" "Cyan"
    Write-ColorText "║  📄 行程单生成服务     (集成服务)                             ║" "Cyan"
    Write-ColorText "║                                                              ║" "Cyan"
    Write-ColorText "║  按 Ctrl+C 停止所有服务                                       ║" "Cyan"
    Write-ColorText "╚══════════════════════════════════════════════════════════════╝" "Cyan"
    Write-Host ""
}

function Test-Port {
    param([int]$Port)
    try {
        $connection = Test-NetConnection -ComputerName "localhost" -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue
        return $connection
    } catch {
        return $false
    }
}

function Stop-PortProcess {
    param([int]$Port)
    try {
        $processes = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
        foreach ($processId in $processes) {
            $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($process) {
                Write-ColorText "🔪 杀死占用端口 $Port 的进程: PID $processId ($($process.ProcessName))" "Yellow"
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            }
        }
        Start-Sleep -Seconds 2
        return $true
    } catch {
        Write-ColorText "❌ 清理端口 $Port 时出错: $($_.Exception.Message)" "Red"
        return $false
    }
}

function Test-Dependencies {
    Write-ColorText "🔧 正在检查系统环境..." "Blue"
    
    $dependencies = @{
        "node" = "Node.js (前端服务)"
        "npm" = "NPM (包管理器)" 
        "python" = "Python (后端服务)"
    }
    
    foreach ($cmd in $dependencies.Keys) {
        try {
            $version = & $cmd --version 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-ColorText "✅ $($dependencies[$cmd]): $($version.Split("`n")[0])" "Green"
            } else {
                Write-ColorText "❌ $($dependencies[$cmd]): 未安装" "Red"
            }
        } catch {
            Write-ColorText "❌ $($dependencies[$cmd]): 未找到" "Red"
        }
    }
}

function Start-ServiceAsync {
    param(
        [string]$Name,
        [string]$Command,
        [string[]]$Arguments,
        [string]$WorkingDirectory,
        [int]$Port,
        [string]$Color = "White"
    )
    
    Write-ColorText "🚀 启动 $Name..." $Color
    
    # 检查并清理端口
    if ($Port -and !$SkipPortCheck) {
        if (Test-Port -Port $Port) {
            Write-ColorText "⚠️  端口 $Port 已被占用，正在清理..." "Yellow"
            Stop-PortProcess -Port $Port
        }
    }
    
    try {
        $processInfo = New-Object System.Diagnostics.ProcessStartInfo
        $processInfo.FileName = $Command
        $processInfo.Arguments = $Arguments -join " "
        $processInfo.WorkingDirectory = $WorkingDirectory
        $processInfo.UseShellExecute = $false
        $processInfo.CreateNoWindow = $false
        
        # 设置环境变量
        if ($Name -eq "Next.js前端服务") {
            $processInfo.EnvironmentVariables["PORT"] = "3001"
            $processInfo.EnvironmentVariables["NEXT_TELEMETRY_DISABLED"] = "1"
        }
        
        $process = [System.Diagnostics.Process]::Start($processInfo)
        
        Write-ColorText "✅ $Name 已启动 (PID: $($process.Id))" $Color
        
        # 等待服务启动
        Start-Sleep -Seconds $StartupDelay
        
        return $process
    } catch {
        Write-ColorText "❌ 启动 $Name 失败: $($_.Exception.Message)" "Red"
        return $null
    }
}

function Test-ServiceHealth {
    param([int]$Port, [string]$ServiceName)
    
    if (!$Port) { return $true }
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$Port" -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Show-ServiceStatus {
    param($Services)
    
    Write-Host ""
    Write-ColorText "📊 服务状态:" "Cyan"
    
    foreach ($service in $Services) {
        if ($service.Process -and !$service.Process.HasExited) {
            $status = "🟢 运行中"
            if ($service.Port) {
                $status += " (端口: $($service.Port))"
            }
        } else {
            $status = "🔴 已停止"
        }
        Write-Host "   $($service.Name): $status"
    }
}

# 主函数
function Main {
    # 检查是否在正确的目录
    if (!(Test-Path "package.json")) {
        Write-ColorText "❌ 请在项目根目录中运行此脚本" "Red"
        Read-Host "按任意键退出"
        exit 1
    }
    
    Show-Banner
    Test-Dependencies
    
    Write-Host ""
    Write-Host "============================================================"
    Write-ColorText "🚀 开始启动所有服务..." "Cyan"
    Write-Host "============================================================"
    
    $services = @()
    
    # 启动美签照片检测服务
    $photoService = Start-ServiceAsync -Name "美签照片检测服务" -Command "python" -Arguments @("services\photo-checker\photo_check_api.py") -WorkingDirectory $PWD -Port 5001 -Color "Yellow"
    if ($photoService) {
        $services += @{Name="美签照片检测服务"; Process=$photoService; Port=5001}
    }
    
    # 启动AI助手服务  
    $aiService = Start-ServiceAsync -Name "AI助手服务" -Command "python" -Arguments @("VISA-ASK-SYSTEM\main_api.py") -WorkingDirectory $PWD -Port 8000 -Color "Blue"
    if ($aiService) {
        $services += @{Name="AI助手服务"; Process=$aiService; Port=8000}
    }
    
    # 启动TLS监控服务
    $tlsService = Start-ServiceAsync -Name "TLS监控服务" -Command "python" -Arguments @("app\tls-monitor\main.py") -WorkingDirectory $PWD -Port 8004 -Color "Green"
    if ($tlsService) {
        $services += @{Name="TLS监控服务"; Process=$tlsService; Port=8004}
    }
    
    # 启动Next.js前端服务
    $frontendService = Start-ServiceAsync -Name "Next.js前端服务" -Command "npm" -Arguments @("run", "dev") -WorkingDirectory $PWD -Port 3001 -Color "Cyan"
    if ($frontendService) {
        $services += @{Name="Next.js前端服务"; Process=$frontendService; Port=3001}
    }
    
    Write-Host ""
    Write-Host "============================================================"
    Write-ColorText "🎉 所有服务启动完成！" "Green"
    Write-Host "============================================================"
    
    # 显示服务状态
    Show-ServiceStatus -Services $services
    
    Write-Host ""
    Write-ColorText "📋 服务访问地址:" "Cyan"
    Write-Host "   🌐 前端界面: http://localhost:3001"
    Write-Host "   🤖 AI助手API: http://localhost:8000"
    Write-Host "   🔍 TLS监控API: http://localhost:8004"
    Write-Host "   📸 照片检测API: http://localhost:5001"
    
    Write-Host ""
    Write-ColorText "💡 提示:" "Yellow"
    Write-Host "   - 所有服务已在后台运行"
    Write-Host "   - 关闭此窗口不会停止服务"
    Write-Host "   - 要停止服务，请使用任务管理器结束相关进程"
    
    # 询问是否打开浏览器
    if ($OpenBrowser -or (Read-Host "是否要打开浏览器访问前端界面？(Y/N)") -eq "Y") {
        Write-ColorText "🌐 正在打开浏览器..." "Cyan"
        Start-Process "http://localhost:3001"
    }
    
    Write-Host ""
    Write-ColorText "🎯 启动完成！您现在可以访问各个服务了。" "Green"
    Write-ColorText "按任意键退出启动器..." "Cyan"
    Read-Host
}

# 执行主函数
Main
