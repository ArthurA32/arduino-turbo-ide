param(
    [int]$MaxIteracoes = 5,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  LOOP DE VERIFICACAO E AUTOCORRECAO DO QUALITY GATE      " -ForegroundColor Cyan
Write-Host "  Limite maximo de tentativas: $MaxIteracoes               " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

for ($i = 1; $i -le $MaxIteracoes; $i++) {
    Write-Host "`n>>> Iniciando Tentativa $i de $MaxIteracoes..." -ForegroundColor Yellow

    if ($SkipBuild) {
        powershell -ExecutionPolicy Bypass -File .\pipeline-testes.ps1 -SkipBuild
    } else {
        powershell -ExecutionPolicy Bypass -File .\pipeline-testes.ps1
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n[OK] SUCESSO na tentativa $i! O Quality Gate passou com 100% de aprovacao." -ForegroundColor Green
        exit 0
    }

    Write-Host "`n[AVISO] Falhas detectadas na tentativa $i." -ForegroundColor DarkYellow
    if (Test-Path ".\reports\RELATORIO_TESTES.md") {
        Write-Host "Conteudo do Relatorio de Erros consolidado:" -ForegroundColor Cyan
        Get-Content ".\reports\RELATORIO_TESTES.md"
    }

    if ($i -lt $MaxIteracoes) {
        Write-Host "`n[LOOP] Entregando relatorio ao agente de IA para aplicacao de correcoes..." -ForegroundColor Magenta
        Write-Host "Aguardando correcoes antes de iniciar proxima iteracao..." -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }
}

Write-Host "`n[FALHA] Limite de $MaxIteracoes tentativas atingido sem sucesso total. Revisao manual necessaria." -ForegroundColor Red
exit 1
