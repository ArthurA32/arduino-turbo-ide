; ==============================================================================
; ARDUINO TURBO IDE - INSTALADOR UNIVERSAL UNIFICADO (ARM64 + X64)
; ==============================================================================

Unicode True
RequestExecutionLevel user
SetCompressor /SOLID lzma

!define PRODUCT_NAME "Arduino Turbo IDE"
!define PRODUCT_PUBLISHER "Antigravity"
!define PRODUCT_WEB_SITE "https://github.com/arduino-arm-turbo-ide"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\ArduinoTurboIDE"

!ifndef APP_VERSION
  !define APP_VERSION "0.1.5"
!endif

!ifndef PROJECT_ROOT
  !define PROJECT_ROOT ".."
!endif

!ifndef OUTPUT_FILE
  !define OUTPUT_FILE "..\release\Arduino_Turbo_IDE_Setup.exe"
!endif

Name "${PRODUCT_NAME}"
OutFile "${OUTPUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\Arduino Turbo IDE"
ShowInstDetails show
ShowUnInstDetails show

; Icones
!define MUI_ICON "${PROJECT_ROOT}\build\icon.ico"
!define MUI_UNICON "${PROJECT_ROOT}\build\icon.ico"

; Modern UI 2
!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "x64.nsh"

; Variaveis
Var Dialog
Var Hwnd_RadioARM64
Var Hwnd_Radiox64
Var Hwnd_DescARM64
Var Hwnd_Descx64
Var Hwnd_InfoBox
Var SelectedArch
Var DetectedArch
Var AutoRestart
Var IsUpdating

; Configuracoes da interface
!define MUI_ABORTWARNING
!define MUI_CUSTOMFUNCTION_GUIINIT CustomGUIInit

; 1. Pagina de Boas-Vindas
!define MUI_PAGE_CUSTOMFUNCTION_PRE WelcomePre
!define MUI_WELCOMEPAGE_TITLE "Bem-vindo ao Instalador Universal do ${PRODUCT_NAME}"
!define MUI_WELCOMEPAGE_TEXT "Este instalador universal unifica os pacotes nativos para Windows ARM64 e Windows x64 em um unico executavel.\r\n\r\nNa proxima etapa, voce podera selecionar ou confirmar a versao otimizada para o seu computador.\r\n\r\nClique em Avancar para continuar."
!insertmacro MUI_PAGE_WELCOME

; 2. Pagina Personalizada de Escolha de Arquitetura
Page custom ArchSelectionPage ArchSelectionPageLeave

; 3. Pagina de Diretorio de Instalacao
!define MUI_PAGE_CUSTOMFUNCTION_PRE DirectoryPre
!insertmacro MUI_PAGE_DIRECTORY

; 4. Pagina de Instalacao de Arquivos
!define MUI_PAGE_CUSTOMFUNCTION_PRE InstFilesPre
!insertmacro MUI_PAGE_INSTFILES

; 5. Pagina de Conclusao
!define MUI_PAGE_CUSTOMFUNCTION_PRE FinishPre
!define MUI_FINISHPAGE_RUN "$INSTDIR\Arduino Turbo IDE.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Iniciar o ${PRODUCT_NAME} agora"
!insertmacro MUI_PAGE_FINISH

; Paginas do Desinstalador
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Idioma
!insertmacro MUI_LANGUAGE "PortugueseBR"

; ==============================================================================
; FUNCOES DO WIZARD
; ==============================================================================

Function .onInit
  ; Detectar arquitetura nativa da maquina
  ReadEnvStr $0 "PROCESSOR_ARCHITECTURE"
  ReadEnvStr $1 "PROCESSOR_ARCHITEW6432"

  ${If} $0 == "ARM64"
    StrCpy $DetectedArch "ARM64"
  ${ElseIf} $1 == "ARM64"
    StrCpy $DetectedArch "ARM64"
  ${Else}
    StrCpy $DetectedArch "x64"
  ${EndIf}

  ; Inicializar com a detectada
  StrCpy $SelectedArch $DetectedArch

  ; Checar se foi passado parametro /ARCH=ARM64 ou /ARCH=x64 na linha de comando
  ${GetParameters} $R0
  ${GetOptions} $R0 "/ARCH=" $R1
  ${If} $R1 != ""
    ${If} $R1 == "ARM64"
    ${OrIf} $R1 == "arm64"
      StrCpy $SelectedArch "ARM64"
    ${ElseIf} $R1 == "x64"
    ${OrIf} $R1 == "X64"
      StrCpy $SelectedArch "x64"
    ${EndIf}
  ${EndIf}

  ; Checar se foi passado parametro /AUTO_RESTART na linha de comando
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/AUTO_RESTART" $R1
  ${IfNot} ${Errors}
    StrCpy $AutoRestart "1"
  ${EndIf}

  ; Checar se foi passado parametro /UPDATE na linha de comando
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/UPDATE" $R1
  ${IfNot} ${Errors}
    StrCpy $IsUpdating "1"
    StrCpy $AutoRestart "1"
  ${EndIf}
FunctionEnd

Function WelcomePre
  ${If} $IsUpdating == "1"
    Abort
  ${EndIf}
FunctionEnd

Function CustomGUIInit
  ${If} $IsUpdating == "1"
    SendMessage $HWNDPARENT 0x000C 0 "STR:Atualizando ${PRODUCT_NAME}"
  ${EndIf}
FunctionEnd

Function DirectoryPre
  ${If} $IsUpdating == "1"
    Abort
  ${EndIf}
FunctionEnd

Function InstFilesPre
  ${If} $IsUpdating == "1"
    SendMessage $HWNDPARENT 0x000C 0 "STR:Atualizando ${PRODUCT_NAME}"
    !insertmacro MUI_HEADER_TEXT "Atualizando ${PRODUCT_NAME}" "Aguarde enquanto os arquivos do sistema estão sendo atualizados..."
    SetAutoClose true
  ${EndIf}
FunctionEnd

Function FinishPre
  ${If} $IsUpdating == "1"
    Abort
  ${EndIf}
FunctionEnd

Function ArchSelectionPage
  ${If} $IsUpdating == "1"
    Abort
  ${EndIf}

  !insertmacro MUI_HEADER_TEXT "Escolha da Arquitetura do Sistema" "Selecione a versao nativa do Arduino Turbo IDE que deseja instalar."

  nsDialogs::Create 1018
  Pop $Dialog
  ${If} $Dialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 16u "Identificamos o seu sistema. Escolha a versao otimizada para o seu hardware:"
  Pop $0

  ; Opcao ARM64
  ${NSD_CreateRadioButton} 10u 20u 90% 12u "Windows ARM64 Nativo (Qualcomm Snapdragon / Processadores ARM 64-bit)"
  Pop $Hwnd_RadioARM64

  ${NSD_CreateLabel} 22u 34u 85% 24u "Otimizado para Snapdragon X Elite / 7c / 8cx. Inclui binario AArch64 PE nativo e Python 3.12 ARM64 integrado para gravacao ultrarrapida sem emulacao."
  Pop $Hwnd_DescARM64

  ; Opcao x64
  ${NSD_CreateRadioButton} 10u 64u 90% 12u "Windows x64 (Intel Core / AMD Ryzen de 64 bits)"
  Pop $Hwnd_Radiox64

  ${NSD_CreateLabel} 22u 78u 85% 24u "Compativel com a arquitetura padrao x86_64 para todos os desktops e notebooks Intel e AMD convencionais."
  Pop $Hwnd_Descx64

  ; Caixa informativa de deteccao
  ${NSD_CreateLabel} 10u 110u 90% 16u "Hardware Detectado: Processador com arquitetura $DetectedArch (Pre-selecionado)"
  Pop $Hwnd_InfoBox

  ; Pre-marcar a opcao correta
  ${If} $SelectedArch == "ARM64"
    ${NSD_Check} $Hwnd_RadioARM64
  ${Else}
    ${NSD_Check} $Hwnd_Radiox64
  ${EndIf}

  nsDialogs::Show
FunctionEnd

Function ArchSelectionPageLeave
  ${NSD_GetState} $Hwnd_RadioARM64 $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $SelectedArch "ARM64"
  ${Else}
    StrCpy $SelectedArch "x64"
  ${EndIf}
FunctionEnd

; ==============================================================================
; SECAO DE INSTALACAO
; ==============================================================================

Section "Instalar" SEC01
  ; 1. Fechar qualquer instancia em execucao para prevenir lock de arquivos (sem /T para nao encerrar o proprio instalador)
  DetailPrint "Fechando eventuais instancias ativas do aplicativo..."
  ExecWait 'taskkill /F /IM "Arduino Turbo IDE.exe"'
  Sleep 1000

  SetOutPath "$INSTDIR"

  ; 2. Extrair arquivos conforme a arquitetura selecionada
  ${If} $IsUpdating == "1"
    DetailPrint "Atualizando arquivos do ${PRODUCT_NAME} ($SelectedArch)..."
  ${EndIf}

  ${If} $SelectedArch == "ARM64"
    ${If} $IsUpdating != "1"
      DetailPrint "Instalando pacote nativo Windows ARM64..."
    ${EndIf}
    File /r "${PROJECT_ROOT}\release\win-arm64-unpacked\*.*"
  ${Else}
    ${If} $IsUpdating != "1"
      DetailPrint "Instalando pacote nativo Windows x64..."
    ${EndIf}
    File /r "${PROJECT_ROOT}\release\win-unpacked\*.*"
  ${EndIf}

  ; Garantir ícones oficiais na pasta resources
  SetOutPath "$INSTDIR\resources"
  File "${PROJECT_ROOT}\build\icon.ico"
  File "${PROJECT_ROOT}\build\icon.png"
  SetOutPath "$INSTDIR"

  ; 3. Criar desinstalador
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; 4. Atalhos no Menu Iniciar e Area de Trabalho
  DetailPrint "Criando atalhos..."
  CreateDirectory "$SMPROGRAMS\Arduino Turbo IDE"
  CreateShortCut "$SMPROGRAMS\Arduino Turbo IDE\Arduino Turbo IDE.lnk" "$INSTDIR\Arduino Turbo IDE.exe" "" "$INSTDIR\resources\icon.ico" 0
  CreateShortCut "$SMPROGRAMS\Arduino Turbo IDE\Desinstalar.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\Uninstall.exe" 0
  CreateShortCut "$DESKTOP\Arduino Turbo IDE.lnk" "$INSTDIR\Arduino Turbo IDE.exe" "" "$INSTDIR\resources\icon.ico" 0

  ; 5. Registrar no Windows (Painel de Controle / Configuracoes)
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${PRODUCT_NAME} ($SelectedArch)"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\resources\icon.ico"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr HKCU "${UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1

  ; 6. Se solicitado auto-restart ou se for instalacao silenciosa (/S), reabrir o aplicativo
  ${If} $AutoRestart == "1"
    DetailPrint "Reiniciando aplicacao atualizada..."
    Sleep 1000
    Exec '"$INSTDIR\Arduino Turbo IDE.exe"'
  ${Else}
    IfSilent do_silent_restart skip_silent_restart
    do_silent_restart:
      DetailPrint "Reiniciando aplicacao atualizada silenciosamente..."
      Sleep 1000
      Exec '"$INSTDIR\Arduino Turbo IDE.exe"'
    skip_silent_restart:
  ${EndIf}
SectionEnd

; ==============================================================================
; SECAO DE DESINSTALACAO
; ==============================================================================

Section "Uninstall"
  DetailPrint "Fechando eventuais instancias ativas..."
  ExecWait 'taskkill /F /IM "Arduino Turbo IDE.exe" /T'
  Sleep 500

  DetailPrint "Removendo atalhos..."
  Delete "$DESKTOP\Arduino Turbo IDE.lnk"
  Delete "$SMPROGRAMS\Arduino Turbo IDE\Arduino Turbo IDE.lnk"
  Delete "$SMPROGRAMS\Arduino Turbo IDE\Desinstalar.lnk"
  RMDir "$SMPROGRAMS\Arduino Turbo IDE"

  DetailPrint "Removendo entradas de registro..."
  DeleteRegKey HKCU "${UNINST_KEY}"

  DetailPrint "Removendo arquivos instalados..."
  RMDir /r "$INSTDIR"
SectionEnd
