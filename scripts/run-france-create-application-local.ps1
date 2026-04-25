<#
.SYNOPSIS
  本地跑「法签生成新申请」Python CLI（与线上一致），便于调试递签城市等步骤。

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\run-france-create-application-local.ps1 -ExcelPath "D:\data\sample.xlsx"
#>
param(
  [Parameter(Mandatory = $true)]
  [string] $ExcelPath,
  [string] $OutputDir = "",
  # 默认有头，便于观察 France-Visas 弹窗与跳转；加 -Headless 可改回无头
  [switch] $Headless
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path -LiteralPath $ExcelPath)) {
  throw "Excel 不存在: $ExcelPath"
}

if (-not $OutputDir) {
  $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $OutputDir = Join-Path $repoRoot "temp\french-visa-local-smoke\$stamp"
}
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$cli = Join-Path $repoRoot "services\french-visa\create_application_cli.py"
if ($Headless) {
  $env:SELENIUM_HEADLESS = "true"
} else {
  $env:SELENIUM_HEADLESS = "false"
}
Push-Location $repoRoot
try {
  Write-Host "Excel: $ExcelPath" -ForegroundColor Cyan
  Write-Host "输出: $OutputDir" -ForegroundColor Cyan
  Write-Host "浏览器: $(if ($Headless) { '无头 (SELENIUM_HEADLESS=true)' } else { '有头 (SELENIUM_HEADLESS=false)' })" -ForegroundColor Cyan
  & python -u $cli $ExcelPath --output-dir $OutputDir
  $code = $LASTEXITCODE
  Write-Host "退出码: $code" -ForegroundColor $(if ($code -eq 0) { "Green" } else { "Yellow" })
  Write-Host "查看: $OutputDir\runner_stderr.log 与 create_result.json"
  exit $code
}
finally {
  Pop-Location
}
