# Arduino Turbo IDE 🚀

[![Release](https://img.shields.io/badge/Release-v0.3.1-00B4D8?style=for-the-badge&logo=github)](https://github.com/ArthurA32/arduino-turbo-ide/releases)
[![Platform](https://img.shields.io/badge/Windows-x64_%7C_ARM64-0078D4?style=for-the-badge&logo=windows)](https://github.com/ArthurA32/arduino-turbo-ide/releases)
[![License](https://img.shields.io/badge/License-MIT-success?style=for-the-badge)](LICENSE)

**Arduino Turbo IDE** é um ambiente de desenvolvimento avançado, ultra-otimizado e de alta performance projetado para desenvolvimento de sistemas embarcados em microcontroladores de múltiplas arquiteturas (**AVR**, **ESP32**, **ESP8266**, **Raspberry Pi RP2040**, **STM32** e muito mais).

Desenvolvido para entregar velocidade extrema de compilação, telemetria em tempo real e engenharia reversa nativa em silício, operando nativamente nas arquiteturas **Windows x64** e **Windows ARM64**.

---

## 📥 Download & Instalação

Baixe a versão oficial mais recente:

👉 **[Baixar Instalador Universal (v0.3.1 Oficial)](https://github.com/ArthurA32/arduino-turbo-ide/releases/latest)**

* **Instalador Universal Inteligente (`Arduino_Turbo_IDE_Setup_Universal.exe`):**  
  Um único instalador que detecta automaticamente a arquitetura da sua máquina e instala a versão ideal:
  * Em sistemas **x64** $\rightarrow$ Instala a versão nativa de 64-bit.
  * Em sistemas **ARM64** $\rightarrow$ Instala a versão nativa ARM64 com máxima performance e autonomia, sem camadas de emulação.
  * **Instalação 100% Silenciosa:** Processo de atualização em segundo plano sem abertura de janelas de terminal.

---

## 🔌 Plataformas & Microcontroladores Suportados

Graças à integração com o ecossistema e engine de toolchains do Arduino CLI, o Turbo IDE oferece suporte universal a uma vasta gama de placas de desenvolvimento:

* 🟢 **Família Arduino Oficial & AVR:**  
  Arduino Uno (R3 e R4 Minima / WiFi), Nano, Mega 2560, Leonardo, Pro Mini, Micro, Duemilanove, Nano Every, etc.

* 🔵 **Família Espressif (ESP32 & ESP8266):**  
  ESP32 Classic (WROOM / WROVER), ESP32-S2, ESP32-S3, ESP32-C3, ESP32-C5, ESP32-C6, NodeMCU v2/v3, D1 Mini ESP8266, etc.

* 🟣 **Família Raspberry Pi Silicon:**  
  Raspberry Pi Pico, Raspberry Pi Pico W, e módulos de desenvolvimento baseados no microcontrolador dual-core **RP2040**.

* 🟡 **Família ARM Cortex, STM32 & Outros:**  
  STM32F103 (BluePill / BlackPill), SAMD21 (Arduino Zero / MKR Series), Teensy (4.0 / 4.1), etc.

> 💡 **Extensibilidade Universal:** Qualquer pacote ou URL de placas adicionais da comunidade pode ser gerenciado diretamente dentro do aplicativo!

---

## ⚡ Primeiro Uso: Guia Rápido de Inicialização

> [!IMPORTANT]
> **Passo recomendado na primeira execução do aplicativo:**

Ao abrir o **Arduino Turbo IDE** pela primeira vez, siga este passo simples para configurar os compiladores das suas placas:

1. **Localize o ícone da Nuvem:** No topo da tela, clique no ícone da **nuvem com a setinha para baixo** (Gerenciador de Cores / Plataformas).
2. **Instale os Cores Desejados:**
   * Instale o **Arduino AVR Core** (para placas clássicas Arduino).
   * Instale o **Espressif ESP32 Core** (para módulos da linha ESP32).
   * *(Opcional)* Instale os pacotes de **Raspberry Pi Pico** ou **STM32** conforme sua necessidade.
3. **Aguarde a finalização:** O download é feito apenas uma única vez na máquina.
4. **Pronto!** O Turbo IDE estará 100% preparado para criar, compilar e gravar qualquer projeto com velocidade máxima.

---

## 🌟 Funcionalidades Principais

### 1. 🔄 Auto-Updater Global via GitHub Releases
- **Verificação Automática:** O aplicativo consulta o repositório público do GitHub e notifica novas versões instantaneamente para qualquer usuário no mundo (sem necessidade de VPN).
- **Download em Tempo Real:** Barra de progresso visual exibindo porcentagem de 0% a 100% e tamanho transferido em MBs.
- **Atualização com 1 Clique:** Botão para aplicar o update e reiniciar o aplicativo de forma suave e rápida.

### 2. 🔬 Leitor de Silício, Descompilador & Remapeador de Portas GPIO (ESP32 & AVR)
- **Leitura Nativa de Flash**: Dump direto da memória física do chip via `esptool.exe` (ESP32) ou `avrdude.exe` (AVR) pela porta serial (COM).
- **Descompilação para Código C / Assembly**: Reconstrução estruturada de instruções da CPU, blocos de rotinas e strings ASCII presentes na Flash.
- **Identificação e Remapeamento Dinâmico de Portas GPIO**:
  - Detecta pinos físicos e portas configuradas dentro do firmware rodando no microcontrolador.
  - Permite alterar as portas setadas no código diretamente no binário e regravar no silício sem necessitar do código-fonte original.
- **Exportação de Firmware**: Salvamento de imagens brutas `.bin` e `.hex` diretamente no computador.

### 3. ⚡ Engine de Compilação Turbo (ARM64 & x64)
- **Cache de Compilação Persistente (`--build-path`)**: Compilação de sketches subsequentes reduzida de 60-150s para apenas **0.8s a 2s**.
- **Multi-Threading Nativo (`--jobs N`)**: Distribui tarefas de build entre todos os núcleos de CPU disponíveis.
- **Gravação em Alta Velocidade**: Upload via USB CDC a 921.600 baud.
- **Binário Nativo ARM64**: Integra o binário AArch64 PE `0xAA64` do `arduino-cli.exe` para arquitetura Windows ARM64.

### 4. 🛡️ Auto-Healer & Auto-Patcher de Bibliotecas (Core 3.x)
- Download e injeção automática de bibliotecas faltantes via repositórios Git/ZIP (`BleKeyboard`, `BleMouse`, `ESPAsyncWebServer`, `AsyncTCP`, `NimBLE-Arduino`).
- Patcher dinâmico de compatibilidade: Converte automaticamente assinaturas legadas `std::string` para `String` no ESP32 Core 3.x.

### 5. 📈 Osciloscópio Digital & Plotter Gráfico (60 FPS)
- Renderização ultra-rápida via HTML5 Canvas 2D.
- Auto-Scale inteligente e Crosshair HUD com valores exatos por canal.
- Presets rápidos para sinais digitais (0/1) e conversores ADC (10-bit / 12-bit).

---

## 📜 Histórico e Linha do Tempo (Changelog Oficial)

O desenvolvimento deste software segue a **Regra do Odômetro Decimal de 3 casas**:

### 🔹 [v0.3.1] - 2026-10-22 *(Lançamento Oficial Vigente)*
- **Auto-Updater Global via GitHub:** Busca automática de novas releases públicas diretamente da API do GitHub com barra de progresso e fluxo de confirmação.
- **Instalador Silencioso:** Eliminação de janelas pretas de terminal do CMD durante atualizações e instalações (`nsExec::Exec`).
- **Unificação de Arquiteturas:** Alinhamento estrito e sincronizado das versões `x64` e `ARM64` no mesmo número de versão e build.
- **Identidade PE no Windows:** Descritor do executável configurado rigorosamente como `Arduino Turbo IDE` no Gerenciador de Tarefas.

### 🔹 [v0.2.5 - v0.2.8] - 2026-09-07
- **Detecção Instantânea de Portas COM via WQL:** Redução de latência de varredura serial de 2.500ms para 290ms.
- **Auto-Detecção de Placas:** Identificação imediata de microcontroladores USB plugados.
- **Crash Logging Resiliente:** Monitoramento de exceções e relatórios emergenciais na raiz do app.

### 🔹 [v0.2.0 - v0.2.4]
- **Arquitetura Universal NSIS:** Criação do script de setup com detecção de hardware em tempo de execução via APIs nativas do Windows.
- **Refatoração do Monitor Serial:** Unificação de consoles e eliminação de controles redundantes.

### 🔹 [v0.1.0 - v0.1.8]
- **Toolchain Nativo ARM64:** Compilação do ecossistema `arduino-cli` e runtime embedded de Python 3.12 para AArch64 nativo.
- **Multi-Target Inicial:** Primeiros builds paralelos para arquiteturas x64 e ARM64.

---

## 🛠️ Tecnologias Utilizadas

- **Shell Desktop**: Electron 35 + Node.js
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Editor de Código**: Monaco Editor (núcleo do VS Code) com IntelliSense nativo C++/Arduino
- **Toolchains de Embarcados**: Arduino CLI, avrdude, esptool, avr-objdump, xtensa-esp32-elf-objdump, riscv32-esp-elf-objdump

---

## 🤝 Contribuições e Relato de Bugs (Issues)

Encontrou algum problema, travamento ou tem sugestão de novas placas?
* Abra uma [Issue no GitHub](https://github.com/ArthurA32/arduino-turbo-ide/issues).
* Toda notificação é analisada, replicada e corrigida nos ciclos de atualização contínua!
