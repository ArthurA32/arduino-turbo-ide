# Arduino Turbo IDE 🚀

**Arduino Turbo IDE** é um ambiente de desenvolvimento avançado, ultra-otimizado e de alta performance projetado para desenvolvimento de sistemas embarcados em **Arduino AVR** e microcontroladores da família **ESP32** (Classic WROOM, C3, C5, C6, S2, S3).

Desenvolvido para entregar velocidade extrema de compilação, telemetria em tempo real e engenharia reversa nativa em silício, operando nativamente em **Windows x64** e **Windows ARM64 (Snapdragon X Elite / Plus)**.

---

## 📌 Diretiva Obrigatória de Versionamento e Segurança de Código (Git Local)

> ⚠️ **DIRETIVA MANDATÓRIA DO PROJETO - VERSIONAMENTO AUTOMÁTICO**:
> 
> A partir de agora, **toda vez que uma nova funcionalidade, correção ou atualização for desenvolvida e validada como 100% funcional e sem erros (e sem que nenhum erro seja reportado)**:
> 
> 1. **Commit Obrigatório no Git Local**: Deve ser realizado um commit no repositório Git local com mensagem descritiva detalhando as melhorias implementadas.
> 2. **Criação de Tags de Versão (Checkpoints)**: Sempre que uma entrega significativa for concluída, criar uma tag (`vX.X.X`) para permitir rollback instantâneo.
> 3. **Segurança de Código**: O objetivo é garantir que o desenvolvedor possa retroceder (`git checkout` / `git reset`), comparar históricos e avançar com segurança absoluta, sem necessidade de apagar arquivos manualmente ou descompilar programas prontos para recuperar versões anteriores.
> 4. **Isolamento de Arquivos Desnecessários (`.gitignore`)**: O versionamento preserva estritamente o código-fonte, scripts, configs e assets essenciais, excluindo `node_modules`, pastas temporárias de compilação (`arduino_turbo_build_*`), `dist`, `dist-electron` e `release`.

---

## 🌟 Funcionalidades Principais

### 1. 🔬 Leitor de Silício, Descompilador & Remapeador de Portas GPIO (ESP32 & AVR)
- **Leitura Nativa de Flash**: Dump direto da memória física do chip via `esptool.exe` (ESP32) ou `avrdude.exe` (AVR) pela porta serial (COM).
- **Descompilação para Código C / Assembly**: Reconstrução estruturada de instruções da CPU, blocos de rotinas e strings ASCII presentes na Flash.
- **Identificação e Remapeamento Dinâmico de Portas GPIO**:
  - Detecta pinos físicos e portas configuradas dentro do firmware rodando no microcontrolador (ex: pinos de módulos, relés, displays ou sensores).
  - Permite alterar as portas setadas no código diretamente no binário e regravar no silício sem necessitar do código-fonte original.
- **Exportação de Firmware**: Salvamento de imagens brutas `.bin` e `.hex` diretamente para a Área de Trabalho.

### 2. ⚡ Engine de Compilação Turbo (ARM64 & x64)
- **Cache de Compilação Persistente (`--build-path`)**: Compilação de sketches subsequentes reduzida de 60-150s para apenas **0.8s a 2s**.
- **Multi-Threading Nativo (`--jobs N`)**: Distribui tarefas entre todos os núcleos de CPU disponíveis.
- **Gravação em Alta Velocidade**: Upload via USB CDC a 921.600 baud.
- **Binário Nativo ARM64**: Integra o binário AArch64 PE `0xAA64` do `arduino-cli.exe` no Windows ARM64.

### 3. 🛡️ Auto-Healer & Auto-Patcher de Bibliotecas (Core 3.x)
- Download automático de bibliotecas faltantes via repositórios Git/ZIP (`BleKeyboard`, `BleMouse`, `ESPAsyncWebServer`, `AsyncTCP`, `NimBLE-Arduino`).
- Patcher dinâmico de compatibilidade: Converte automaticamente assinaturas legadas `std::string` para `String` no ESP32 Core 3.x.

### 4. 📈 Osciloscópio Digital & Plotter Gráfico (60 FPS)
- Renderização ultra-rápida via HTML5 Canvas 2D.
- Auto-Scale inteligente e Crosshair HUD com valores exatos por canal.
- Presets rápidos para sinais digitais (0/1) e conversores ADC (10-bit / 12-bit).

---

## 🛠️ Tecnologias Utilizadas
- **Framework Desktop**: Electron 35 + Node.js
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Editor de Código**: Monaco Editor (VS Code core) com IntelliSense nativo C++/Arduino
- **Toolchains de Embarcados**: Arduino CLI, avrdude, esptool, avr-objdump, xtensa-esp32-elf-objdump, riscv32-esp-elf-objdump
