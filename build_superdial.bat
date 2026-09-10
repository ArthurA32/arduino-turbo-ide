@echo off
echo ========================================================
echo   Iniciando build do SuperDial Hub a partir da raiz...
echo ========================================================
cd /d "%~dp0superdial_hub"
call build.bat

if exist "dist\SuperDialHub.exe" (
    copy /y "dist\SuperDialHub.exe" "%~dp0SuperDialHub.exe"
    echo.
    echo [OK] Copiado executavel SuperDialHub.exe para a raiz do projeto!
)
