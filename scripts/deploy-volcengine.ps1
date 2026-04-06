param(
  [string]$ServerIp = "101.96.202.43",
  [string]$SshUser = "root",
  [string]$KeyPath = "d:\360Downloads\download_chrome\vistoria.pem",
  [string]$RemoteDir = "/opt/visa-assistant",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$archivePath = Join-Path $env:TEMP "visa-assistant-deploy-$timestamp.tar.gz"
$templatesArchivePath = Join-Path $env:TEMP "visa-assistant-templates-$timestamp.tar.gz"
$remoteArchive = "/tmp/visa-assistant-deploy.tar.gz"
$remoteTemplatesArchive = "/tmp/visa-assistant-templates.tar.gz"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Label,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command
  )

  Write-Host "==> $Label" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE"
  }
}

Push-Location $repoRoot
try {
  Invoke-Checked "Pack project" {
    & tar `
      --exclude=.git `
      --exclude=node_modules `
      --exclude=.next `
      --exclude=temp `
      --exclude=storage `
      --exclude=.test-dist `
      --exclude=.env.local `
      --exclude=.env.server `
      -czf $archivePath .
  }

  Invoke-Checked "Upload archive" {
    & scp `
      -o StrictHostKeyChecking=no `
      -o UserKnownHostsFile=/dev/null `
      -i $KeyPath `
      $archivePath `
      "${SshUser}@${ServerIp}:${remoteArchive}"
  }

  if (Test-Path (Join-Path $repoRoot "storage\\templates")) {
    Invoke-Checked "Pack templates" {
      & tar -czf $templatesArchivePath -C $repoRoot storage/templates
    }

    Invoke-Checked "Upload templates archive" {
      & scp `
        -o StrictHostKeyChecking=no `
        -o UserKnownHostsFile=/dev/null `
        -i $KeyPath `
        $templatesArchivePath `
        "${SshUser}@${ServerIp}:${remoteTemplatesArchive}"
    }
  }

  Invoke-Checked "Extract on server" {
    & ssh `
      -o StrictHostKeyChecking=no `
      -o UserKnownHostsFile=/dev/null `
      -i $KeyPath `
      "${SshUser}@${ServerIp}" `
      "mkdir -p ${RemoteDir} && tar -xzf ${remoteArchive} -C ${RemoteDir} && if [ -f ${remoteTemplatesArchive} ]; then tar -xzf ${remoteTemplatesArchive} -C ${RemoteDir} && rm -f ${remoteTemplatesArchive}; fi && rm -f ${remoteArchive}"
  }

  if (-not $SkipBuild) {
    Invoke-Checked "Build and restart services" {
      & ssh `
        -o StrictHostKeyChecking=no `
        -o UserKnownHostsFile=/dev/null `
        -i $KeyPath `
        "${SshUser}@${ServerIp}" `
        "bash -lc 'cd ${RemoteDir} && set -a && source .env.server && set +a && npm run build' && systemctl restart visa-web.service visa-trip-generator.service visa-explanation-letter.service visa-material-review.service visa-tls-monitor.service && systemctl is-active visa-web.service visa-trip-generator.service visa-explanation-letter.service visa-material-review.service visa-tls-monitor.service && curl -I -s http://127.0.0.1:3000/ | head -n 1"
    }
  }

  Write-Host ""
  Write-Host "Deploy finished: http://${ServerIp}" -ForegroundColor Green
} finally {
  Pop-Location
  if (Test-Path $archivePath) {
    Remove-Item $archivePath -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path $templatesArchivePath) {
    Remove-Item $templatesArchivePath -Force -ErrorAction SilentlyContinue
  }
}
