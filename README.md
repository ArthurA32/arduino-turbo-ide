# Arduino Turbo IDE 🚀

[![Release](https://img.shields.io/badge/Release-v0.3.0-00B4D8?style=for-the-badge&logo=github)](https://github.com/ArthurA32/arduino-turbo-ide/releases)
[![Platform](https://img.shields.io/badge/Windows-x64_%7C_ARM64-0078D4?style=for-the-badge&logo=windows)](https://github.com/ArthurA32/arduino-turbo-ide/releases)
[![License](https://img.shields.io/badge/License-MIT-success?style=for-the-badge)](LICENSE)

**Arduino Turbo IDE** é um ambiente de desenvolvimento avançado, ultra-otimizado e de alta performance projetado para desenvolvimento de sistemas embarcados em **Arduino AVR** e microcontroladores da família **ESP32** (Classic WROOM, C3, C5, C6, S2, S3).

Desenvolvido para entregar velocidade extrema de compilação, telemetria em tempo real e engenharia reversa nativa em silício, operando nativamente nas arquiteturas **Windows x64** e **Windows ARM64**.

---

## 📥 Download & Instalação

Baixe a versão mais recente diretamente na aba de lançamentos oficiais:

👉 **[Baixar Instalador Universal (v0.3.0)](https://github.com/ArthurA32/arduino-turbo-ide/releases/latest)**

* **Instalador Universal Inteligente (`Arduino_Turbo_IDE_Setup_Universal.exe`):**  
  Um único instalador que detecta automaticamente a arquitetura da sua máquina e instala a versão ideal:
  * Em sistemas **x64** $\rightarrow$ Instala a versão nativa de 64-bit.
  * Em sistemas **ARM64** $\rightarrow$ Instala a versão nativa ARM64 com máxima performance e autonomia, sem camadas de emulação.

---

## ⚡ Primeiro Uso: Guia Rápido de Inicialização

> [!IMPORTANT]
> **Passo obrigatório na primeira execução do aplicativo:**

Ao abrir o **Arduino Turbo IDE** pela primeira vez, siga este passo simples para configurar os compiladores:

1. **Localize o ícone da Nuvem:** No topo da tela, clique no ícone da **nuvem com a setinha para baixo** (Gerenciador de Cores / Plataformas).
2. **Instale os Cores Essenciais:**
   * Instale o **Arduino AVR Core** (para placas Arduino Uno, Mega, Nano, etc.).
   * Instale o **Espressif ESP32 Core** (para módulos e placas da linha ESP32).
3. **Aguarde a finalização:** O download e a descompactação demoram um pouco na primeira vez porque baixam os compiladores de silício completos.
4. **Pronto!** Essa etapa só precisa ser feita **uma única vez**. Assim que o download dos dois cores for concluído, o aplicativo já estará 100% pronto e totalmente funcional para criar, compilar e gravar seus projetos!

---

## 🌟 Funcionalidades Principais

### 1. 🔬 Leitor de Silício, Descompilador & Remapeador de Portas GPIO (ESP32 & AVR)
- **Leitura Nativa de Flash**: Dump direto da memória física do chip via `esptool.exe` (ESP32) ou `avrdude.exe` (AVR) pela porta serial (COM).
- **Descompilação para Código C / Assembly**: Reconstrução estruturada de instruções da CPU, blocos de rotinas e strings ASCII presentes na Flash.
- **Identificação e Remapeamento Dinâmico de Portas GPIO**:
  - Detecta pinos físicos e portas configuradas dentro do firmware rodando no microcontrolador (ex: pinos de módulos, relés, displays ou sensores).
  - Permite alterar as portas setadas no código diretamente no binário e regravar no silício sem necessitar do código-fonte original.
- **Exportação de Firmware**: Salvamento de imagens brutas `.bin` e `.hex` diretamente no computador.

### 2. ⚡ Engine de Compilação Turbo (ARM64 & x64)
- **Cache de Compilação Persistente (`--build-path`)**: Compilação de sketches subsequentes reduzida de 60-150s para apenas **0.8s a 2s**.
- **Multi-Threading Nativo (`--jobs N`)**: Distribui tarefas de build entre todos os núcleos de CPU disponíveis.
- **Gravação em Alta Velocidade**: Upload via USB CDC a 921.600 baud.
- **Binário Nativo ARM64**: Integra o binário AArch64 PE `0xAA64` do `arduino-cli.exe` para arquitetura Windows ARM64.

### 3. 🛡️ Auto-Healer & Auto-Patcher de Bibliotecas (Core 3.x)
- Download e injeção automática de bibliotecas faltantes via repositórios Git/ZIP (`BleKeyboard`, `BleMouse`, `ESPAsyncWebServer`, `AsyncTCP`, `NimBLE-Arduino`).
- Patcher dinâmico de compatibilidade: Converte automaticamente assinaturas legadas `std::string` para `String` no ESP32 Core 3.x.

### 4. 📈 Osciloscópio Digital & Plotter Gráfico (60 FPS)
- Renderização ultra-rápida via HTML5 Canvas 2D.
- Auto-Scale inteligente e Crosshair HUD com valores exatos por canal.
- Presets rápidos para sinais digitais (0/1) e conversores ADC (10-bit / 12-bit).

---

## 📜 Histórico e Linha do Tempo (Changelog Oficial)

O desenvolvimento deste software segue a **Regra do Odômetro Decimal de 3 casas**:

### 🔹 [v0.2.9] - 2026-10-22 *(Versão Atual)*
- **Identidade no Gerenciador de Tarefas:** Correção da chave PE `FileDescription` e registro do processo para exibir estritamente `Arduino Turbo IDE` no Gerenciador de Tarefas do Windows.
- **Unificação do Instalador Universal:** O pipeline foca e entrega o instalador universal inteligente unificado.
- **Auditoria de Metadados:** Alinhamento de cabeçalhos PE para x64 e ARM64.

### 🔹 [v0.2.5 - v0.2.8] - 2026-09-07
- **Detecção Instantânea de Portas COM via WQL:** Redução de latência de varredura serial de 2.500ms para 290ms.
- **Auto-Detecção de Placas:** Identificação imediata de microcontroladores USB plugados (Arduino / ESP32).
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
