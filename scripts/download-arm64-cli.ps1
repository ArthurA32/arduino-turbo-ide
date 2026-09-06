# Script para baixar e configurar o motor arduino-cli
param(
    [string]$Arch = "64bit"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$BinDir = Join-Path $ProjectRoot "bin"

if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Configurando motor arduino-cli para o projeto..." -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$ApiUrl = "https://api.github.com/repos/arduino/arduino-cli/releases/latest"
$Headers = @{ "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }

try {
    $Release = Invoke-RestMethod -Uri $ApiUrl -Headers $Headers
    $Version = $Release.tag_name
    Write-Host "Versao detectada: $Version" -ForegroundColor Green

    # Procurar Windows_64bit.zip
    $Asset = $Release.assets | Where-Object { $_.name -like "*Windows_64bit.zip" } | Select-Object -First 1

    if (-not $Asset) {
        $DownloadUrl = "https://github.com/arduino/arduino-cli/releases/download/v1.5.1/arduino-cli_1.5.1_Windows_64bit.zip"
    } else {
        $DownloadUrl = $Asset.browser_download_url
    }

    $ZipPath = Join-Path $BinDir "arduino-cli.zip"
    Write-Host "Baixando: $DownloadUrl ..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath

    Write-Host "Extraindo arduino-cli.exe para $BinDir ..." -ForegroundColor Yellow
    Expand-Archive -Path $ZipPath -DestinationPath $BinDir -Force
    if (Test-Path $ZipPath) {
        Remove-Item $ZipPath -Force
    }

    $CliExe = Join-Path $BinDir "arduino-cli.exe"
    Write-Host "✔ arduino-cli configurado com sucesso em: $CliExe" -ForegroundColor Green
} catch {
    Write-Host "Erro durante download do arduino-cli: $($_.Exception.Message)" -ForegroundColor Red
    throw $_
}
