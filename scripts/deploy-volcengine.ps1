param(
  [string]$ServerIp = "101.96.202.43",
  [string]$SshUser = "root",
  [string]$KeyPath = "d:\360Downloads\download_chrome\vistoria.pem",
  [string]$RemoteDir = "/opt/visa-assistant",
  [switch]$SkipBuild,
  [switch]$FullDeploy,
  [int]$ScpRetries = 4
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$archivePath = Join-Path $env:TEMP "visa-assistant-deploy-$timestamp.tar.gz"
$templatesArchivePath = Join-Path $env:TEMP "visa-assistant-templates-$timestamp.tar.gz"
$deleteManifestPath = Join-Path $env:TEMP "visa-assistant-delete-$timestamp.txt"
$remoteArchive = "/tmp/visa-assistant-deploy.tar.gz"
$remoteTemplatesArchive = "/tmp/visa-assistant-templates.tar.gz"
$remoteDeleteManifest = "/tmp/visa-assistant-delete.txt"

function Test-DeployPathExcluded {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RelativePath
  )

  $normalized = ($RelativePath -replace "\\", "/").TrimStart("./")
  if (-not $normalized) { return $true }
  return
    $normalized -like ".git/*" -or
    $normalized -eq ".git" -or
    $normalized -like "node_modules/*" -or
    $normalized -eq "node_modules" -or
    $normalized -like ".next/*" -or
    $normalized -eq ".next" -or
    $normalized -like ".next-build/*" -or
    $normalized -eq ".next-build" -or
    $normalized -like "temp/*" -or
    $normalized -eq "temp" -or
    $normalized -like "storage/*" -or
    $normalized -eq "storage" -or
    $normalized -like "storage/templates/*" -or
    $normalized -eq "storage/templates" -or
    $normalized -like ".test-dist/*" -or
    $normalized -eq ".test-dist" -or
    $normalized -like "artifacts/*" -or
    $normalized -eq "artifacts" -or
    $normalized -like "debug-dumps/*" -or
    $normalized -eq "debug-dumps" -or
    $normalized -eq ".env.local" -or
    $normalized -eq ".env.server" -or
    $normalized -like "*.log"
}

function Get-ChangedDeployPaths {
  $statusLines = & git -c core.quotepath=false status --porcelain=1 --untracked-files=all
  if ($LASTEXITCODE -ne 0) {
    throw "git status failed with exit code $LASTEXITCODE"
  }

  $uploadSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  $deleteSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

  foreach ($rawLine in $statusLines) {
    $line = [string]$rawLine
    if ([string]::IsNullOrWhiteSpace($line) -or $line.Length -lt 4) { continue }

    $status = $line.Substring(0, 2)
    $pathPart = $line.Substring(3).Trim()
    if (-not $pathPart) { continue }

    $oldPath = $null
    $newPath = $pathPart
    if ($pathPart -like "* -> *") {
      $parts = $pathPart -split " -> ", 2
      $oldPath = $parts[0].Trim()
      $newPath = $parts[1].Trim()
    }

    if ($oldPath -and -not (Test-DeployPathExcluded $oldPath)) {
      [void]$deleteSet.Add($oldPath)
    }

    if ($status.Contains("D")) {
      if (-not (Test-DeployPathExcluded $newPath)) {
        [void]$deleteSet.Add($newPath)
      }
      continue
    }

    if (Test-DeployPathExcluded $newPath) { continue }
    if (Test-Path (Join-Path $repoRoot $newPath) -PathType Leaf) {
      [void]$uploadSet.Add($newPath)
    }
  }

  return @{
    Upload = @($uploadSet)
    Delete = @($deleteSet)
  }
}

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

function Invoke-CheckedScp {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Label,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command
  )

  for ($attempt = 1; $attempt -le $ScpRetries; $attempt++) {
    Write-Host "==> $Label (attempt $attempt/$ScpRetries)" -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -eq 0) {
      return
    }
    if ($attempt -lt $ScpRetries) {
      Write-Host "    scp failed (exit $LASTEXITCODE), retrying in 8s..." -ForegroundColor Yellow
      Start-Sleep -Seconds 8
    }
  }
  throw "$Label failed with exit code $LASTEXITCODE after $ScpRetries attempts"
}

Push-Location $repoRoot
try {
  $changedDeploy = $null
  $uploadPaths = @()
  $deletePaths = @()

  if ($FullDeploy) {
    Invoke-Checked "Pack project" {
      & tar `
        --exclude=.git `
        --exclude=node_modules `
        --exclude=.next `
        --exclude=.next-build `
        --exclude=temp `
        --exclude=storage `
        --exclude=.test-dist `
        --exclude=artifacts `
        --exclude=debug-dumps `
        --exclude=*.log `
        --exclude=.env.local `
        --exclude=.env.server `
        -czf $archivePath .
    }
  } else {
    $changedDeploy = Get-ChangedDeployPaths
    $uploadPaths = @($changedDeploy.Upload | Where-Object { $_ })
    $deletePaths = @($changedDeploy.Delete | Where-Object { $_ })
    if ($uploadPaths.Count -eq 0 -and $deletePaths.Count -eq 0) {
      Write-Host "==> No deployable file changes detected" -ForegroundColor Yellow
      return
    }

    if ($uploadPaths.Count -gt 0) {
      Invoke-Checked "Pack changed files" {
        & tar -czf $archivePath @uploadPaths
      }
    } else {
      Invoke-Checked "Pack empty archive" {
        & tar -czf $archivePath --files-from NUL
      }
    }

    if ($deletePaths.Count -gt 0) {
      Set-Content -Path $deleteManifestPath -Value ($deletePaths -join "`n") -Encoding UTF8
    }
  }

  Invoke-CheckedScp "Upload archive" {
    & scp `
      -C `
      -o StrictHostKeyChecking=no `
      -o UserKnownHostsFile=/dev/null `
      -o ServerAliveInterval=30 `
      -o ServerAliveCountMax=10 `
      -i $KeyPath `
      $archivePath `
      "${SshUser}@${ServerIp}:${remoteArchive}"
  }

  if ((-not $FullDeploy) -and (Test-Path $deleteManifestPath)) {
    Invoke-CheckedScp "Upload delete manifest" {
      & scp `
        -C `
        -o StrictHostKeyChecking=no `
        -o UserKnownHostsFile=/dev/null `
        -o ServerAliveInterval=30 `
        -o ServerAliveCountMax=10 `
        -i $KeyPath `
        $deleteManifestPath `
        "${SshUser}@${ServerIp}:${remoteDeleteManifest}"
    }
  }

  if (Test-Path (Join-Path $repoRoot "storage\\templates")) {
    Invoke-Checked "Pack templates" {
      & tar -czf $templatesArchivePath -C $repoRoot storage/templates
    }

    Invoke-CheckedScp "Upload templates archive" {
      & scp `
        -C `
        -o StrictHostKeyChecking=no `
        -o UserKnownHostsFile=/dev/null `
        -o ServerAliveInterval=30 `
        -o ServerAliveCountMax=10 `
        -i $KeyPath `
        $templatesArchivePath `
        "${SshUser}@${ServerIp}:${remoteTemplatesArchive}"
    }
  }

  Invoke-Checked "Extract on server" {
    & ssh `
      -o StrictHostKeyChecking=no `
      -o UserKnownHostsFile=/dev/null `
      -o ServerAliveInterval=30 `
      -o ServerAliveCountMax=10 `
      -i $KeyPath `
      "${SshUser}@${ServerIp}" `
      "mkdir -p ${RemoteDir} && rm -f ${remoteDeleteManifest} && tar -xzf ${remoteArchive} -C ${RemoteDir} && if [ -f ${remoteTemplatesArchive} ]; then tar -xzf ${remoteTemplatesArchive} -C ${RemoteDir} && rm -f ${remoteTemplatesArchive}; fi && rm -f ${remoteArchive}"
  }

  if (-not $SkipBuild) {
    Invoke-Checked "Build and restart services" {
      & ssh `
        -o StrictHostKeyChecking=no `
        -o UserKnownHostsFile=/dev/null `
        -o ServerAliveInterval=30 `
        -o ServerAliveCountMax=10 `
        -i $KeyPath `
        "${SshUser}@${ServerIp}" `
        "bash -lc 'cd ${RemoteDir} && set -a && source .env.server && set +a && npx prisma generate && npx prisma migrate deploy && npm run build' && systemctl restart visa-web.service visa-trip-generator.service visa-explanation-letter.service visa-material-review.service visa-tls-monitor.service && systemctl is-active visa-web.service visa-trip-generator.service visa-explanation-letter.service visa-material-review.service visa-tls-monitor.service && curl -I -s http://127.0.0.1:3000/ | head -n 1"
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
  if (Test-Path $deleteManifestPath) {
    Remove-Item $deleteManifestPath -Force -ErrorAction SilentlyContinue
  }
}
