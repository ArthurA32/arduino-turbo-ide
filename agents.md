# Diretrizes para Agentes de IA & Engenharia de Software (agents.md)

Este documento estabelece as diretrizes estritas de comportamento, fluxo de trabalho e boas práticas que devem ser rigorosamente seguidas por qualquer **Agente de IA** atuando no desenvolvimento e manutenção do projeto **Arduino Turbo IDE**.

---

## 🔒 1. DIRETIVA MANDATÓRIA: Versionamento Local no Git a Cada Atualização Estável

> ### 🛑 REGRA DE OURO PARA AGENTES:
> Sempre que uma tarefa, alteração, refatoração ou atualização for concluída, e após ser validada como **100% correta, estável e livre de erros (com compilação bem-sucedida e aprovação do usuário sem relatos de falhas)**:
> 
> 1. **Executar Versionamento Imediato no Git Local**:
>    ```bash
>    git add .
>    git commit -m "tipo(escopo): descrição clara e detalhada das melhorias"
>    ```
> 2. **Objetivo de Segurança**: Criar pontos de restauração (checkpoints) confiáveis para que o desenvolvedor possa navegar pelo histórico (`git checkout`, `git revert`, `git reset`) sem correr o menor risco de perder código, corromper o ambiente ou precisar descompilar código previamente gerado.
> 3. **Nunca Pular o Commit**: Se a entrega foi finalizada com sucesso, o commit local deve ser efetuado antes de encerrar o ciclo daquela solicitação.

---

## ⚡ 2. Arquitetura Dual-Target (Windows x64 e Windows ARM64)
- O projeto oferece suporte de primeira classe a processadores Intel/AMD (x64) e Qualcomm Snapdragon (ARM64).
- Ao realizar alterações no pipeline de empacotamento ou nos scripts de automação (`scripts/build-and-export.js`), certifique-se de que os binários corretos de cada arquitetura (`bin/x64/arduino-cli.exe` e `bin/arm64/arduino-cli.exe`) sejam preservados e distribuídos adequadamente.
- Não introduza dependências nativas incompatíveis com a arquitetura ARM64 do Windows.

---

## 🔬 3. Módulo de Engenharia Reversa e Leitura de Silício (Firmware Decompiler)
- **Foco Primário de Reconfiguração de Portas**: A principal finalidade do descompilador de silício para o usuário é a **detecção, inspeção e alteração direta de portas/pinos GPIO** atribuídos no código que está rodando dentro do microcontrolador (ESP32 / AVR).
- **Mapeador de GPIO**: Sempre que a memória Flash de um chip for lida, o analisador deve:
  1. Identificar números de portas de hardware (ex: pinos digitais, pinos PWM, barramentos I2C/SPI) setados no firmware.
  2. Permitir que o usuário reatribua essas portas visualmente de forma simples.
  3. Gerar o código C anotado com `#define`s claros para as portas alteradas ou aplicar o patch de reatribuição diretamente no binário dumpado.

---

## 🛡️ 4. Regras de Código e Resiliência
- **TypeScript Strict**: Nunca introduzir erros de tipagem. Todo ciclo de desenvolvimento deve ser validado com `npx tsc --noEmit`.
- **Prevenção de Locks de Porta Serial**: Antes de qualquer operação de upload (`esptool`, `avrdude`, `arduino-cli upload`) ou leitura de Flash de silício, a conexão do monitor serial nativo deve ser liberada com `nativeSerial.disconnect(true)` para evitar colisões no driver do Windows.
- **Logging Seguro**: Não utilizar métodos inexistentes no coletor de diagnósticos; manter tratamento defensivo com `try/catch`.
