# Script de Compilação Cruzada (Cross-Compilation) e Entrega na Área de Trabalho
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$DesktopDir = [System.IO.Path]::Combine($env:USERPROFILE, "Desktop")
$ReleaseDir = Join-Path $ProjectRoot "release"
$TargetOutputDir = Join-Path $DesktopDir "Arduino_Turbo_IDE_Windows_ARM64"
$TargetZip = Join-Path $DesktopDir "Arduino_Turbo_IDE_ARM64.zip"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  COMPILAÇÃO NATIVA ARDUINO TURBO IDE (WINDOWS ARM64)    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Verificar / Baixar arduino-cli ARM64
$CliExe = Join-Path $ProjectRoot "bin\arduino-cli.exe"
if (-not (Test-Path $CliExe)) {
    Write-Host "[1/4] Baixando motor arduino-cli nativo para Windows ARM64..." -ForegroundColor Yellow
    & powershell -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "download-arm64-cli.ps1") -Arch "ARM64"
} else {
    Write-Host "[1/4] arduino-cli.exe nativo já presente no binário do projeto." -ForegroundColor Green
}

# 2. Compilar Frontend e Electron
Write-Host "[2/4] Compilando interface (Vite + React + Monaco Editor)..." -ForegroundColor Yellow
Set-Location $ProjectRoot
npm run build

# 3. Empacotar para win32-arm64
Write-Host "[3/4] Empacotando aplicação nativa para Windows ARM64..." -ForegroundColor Yellow
npx electron-builder --arm64 --win --dir

# 4. Copiar para a Área de Trabalho
Write-Host "[4/4] Copiando arquivos finais para a Área de Trabalho..." -ForegroundColor Yellow

$PackagedFolder = Join-Path $ReleaseDir "win-arm64-unpacked"

if (Test-Path $PackagedFolder) {
    if (Test-Path $TargetOutputDir) {
        Remove-Item -Path $TargetOutputDir -Recurse -Force
    }
    
    # Copiar a pasta descompactada para o Desktop
    Copy-Item -Path $PackagedFolder -Destination $TargetOutputDir -Recurse -Force

    # Copiar também o arduino-cli para dentro da pasta do app
    $DestBin = Join-Path $TargetOutputDir "resources\bin"
    if (-not (Test-Path $DestBin)) {
        New-Item -ItemType Directory -Path $DestBin -Force | Out-Null
    }
    Copy-Item -Path (Join-Path $ProjectRoot "bin\*") -Destination $DestBin -Recurse -Force -ErrorAction SilentlyContinue

    # Criar arquivo compactado .ZIP na Área de Trabalho para fácil transporte
    if (Test-Path $TargetZip) {
        Remove-Item -Path $TargetZip -Force
    }
    Write-Host "Compactando pacote ZIP na Área de Trabalho..." -ForegroundColor Yellow
    Compress-Archive -Path "$TargetOutputDir\*" -DestinationPath $TargetZip -Force

    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  ✔ SUCESSO! APLICATIVO ARM64 ENTREGUE NA ÁREA DE TRABALHO" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "Pasta executável: $TargetOutputDir" -ForegroundColor White
    Write-Host "Arquivo Compactado: $TargetZip" -ForegroundColor White
    Write-Host "Executável principal: $(Join-Path $TargetOutputDir 'Arduino Turbo IDE (ARM64).exe')" -ForegroundColor Cyan
} else {
    Write-Error "A pasta de saída do electron-builder não foi encontrada em $PackagedFolder"
}
