param(
    [ValidateSet("x64", "arm64", "all")]
    [string]$Arquitetura = $(if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "x64" }),
    [switch]$SkipBuild
)

$ErrorActionPreference = "Continue"
$falhouAlgumaEtapa = $false

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  QUALITY GATE & PIPELINE DE TESTES TURBO IDE ($Arquitetura) " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Validacao de Tipagem TypeScript Estrita
Write-Host "`n[1/5] Verificacao de Tipagem Estrita TypeScript (tsc)..." -ForegroundColor Yellow
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERRO] Falha na validacao de tipos TypeScript!" -ForegroundColor Red
    $falhouAlgumaEtapa = $true
} else {
    Write-Host "  [OK] TypeScript 100% livre de erros!" -ForegroundColor Green
}

# 2. Camada 1: Testes de Backend (Electron / Node.js)
Write-Host "`n[2/5] Executando Camada 1: Testes de Backend (Node / Electron)..." -ForegroundColor Yellow
npm run test:backend
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERRO] Falha encontrada na Camada de Backend." -ForegroundColor Red
    $falhouAlgumaEtapa = $true
} else {
    Write-Host "  [OK] Camada de Backend aprovada." -ForegroundColor Green
}

# 3. Camada 2: Testes de Frontend (React / TypeScript)
Write-Host "`n[3/5] Executando Camada 2: Testes de Frontend (React / Monaco)..." -ForegroundColor Yellow
npm run test:frontend
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERRO] Falha encontrada na Camada de Frontend." -ForegroundColor Red
    $falhouAlgumaEtapa = $true
} else {
    Write-Host "  [OK] Camada de Frontend aprovada." -ForegroundColor Green
}

# 4. Camada 3: Testes de Interface & E2E (Fluxos de Usuario Real)
Write-Host "`n[4/5] Executando Camada 3: Testes de Interface (E2E / Fluxos)..." -ForegroundColor Yellow
npm run test:e2e
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERRO] Falha encontrada nos Testes de Interface." -ForegroundColor Red
    $falhouAlgumaEtapa = $true
} else {
    Write-Host "  [OK] Testes de Interface aprovados." -ForegroundColor Green
}

# 5. Consolidacao do Relatorio Unificado Machine-Readable
Write-Host "`n[5/5] Consolidando resultados no relatorio unificado..." -ForegroundColor Yellow
node .\scripts\consolidar-relatorio.js
$statusRelatorio = if ($LASTEXITCODE -eq 0) { "PASSOU" } else { "FALHOU" }

Write-Host "`n==========================================================" -ForegroundColor Cyan
if ($statusRelatorio -eq "PASSOU" -and -not $falhouAlgumaEtapa) {
    Write-Host "  STATUS FINAL QUALITY GATE: PASSOU (100% APROVADO)" -ForegroundColor Green
    Write-Host "  Relatorio completo: .\reports\RELATORIO_TESTES.md" -ForegroundColor Gray
    Write-Host "==========================================================" -ForegroundColor Cyan

    if (-not $SkipBuild) {
        Write-Host "`nQuality Gate Aprovado! Prosseguindo com Build e Publicacao..." -ForegroundColor Green
        node .\scripts\build-and-export.js
        exit $LASTEXITCODE
    } else {
        Write-Host "`n[INFO] Build ignorado (-SkipBuild solicitado)." -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "  STATUS FINAL QUALITY GATE: FALHOU (BLOQUEADO)" -ForegroundColor Red
    Write-Host "  Publicacao no servidor e Area de Trabalho BLOQUEADA." -ForegroundColor Red
    Write-Host "  Relatorio gerado para correcao: .\reports\RELATORIO_TESTES.md" -ForegroundColor Red
    Write-Host "==========================================================" -ForegroundColor Cyan
    exit 1
}
