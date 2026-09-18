@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   COMPILANDO SUPERDIAL HUB - EXECUTAVEL STANDALONE (7 MODOS)
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Verificando e instalando dependencias...
python -m pip install -r requirements.txt

echo.
echo [2/3] Executando PyInstaller (--noconsole --onefile)...
pyinstaller --noconsole --onefile ^
    --name "SuperDialHub" ^
    --icon "assets/icon.ico" ^
    --add-data "assets;assets" ^
    --collect-all customtkinter ^
    --collect-all pycaw ^
    --collect-all bleak ^
    --hidden-import "comtypes" ^
    --hidden-import "pystray" ^
    --hidden-import "PIL" ^
    --hidden-import "pynput" ^
    --hidden-import "winrt" ^
    main.py

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo   [SUCESSO] Compilacao concluida com exito!
    echo   Executavel standalone: dist\SuperDialHub.exe
    echo ========================================================
    
    echo [3/3] Atualizando executavel na raiz e na Area de Trabalho...
    copy /y "dist\SuperDialHub.exe" "..\" >nul
    copy /y "dist\SuperDialHub.exe" "C:\Users\Administrator\Desktop\" >nul
    echo [OK] Executavel atualizado na Area de Trabalho com sucesso!
) else (
    echo.
    echo [ERRO] Falha na compilacao do PyInstaller.
)
