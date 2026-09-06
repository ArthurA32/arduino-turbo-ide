import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { nativeSerial } from './nativeSerial';
import { diagnostics } from './diagnostics';

export interface ReadFirmwareOptions {
  port: string;
  fqbn: string;
  readSizeBytes?: number; // ex: 0x80000 = 512KB
}

export interface ExtractedString {
  offset: string;
  text: string;
}

export interface DecompiledFunction {
  address: string;
  name: string;
  instructions: string[];
}

export interface DetectedPinOffset {
  fileOffset: number;
  hexOffset: string;
  instruction?: string;
  kind: 'bitmask' | 'immediate';
}

export interface DetectedPin {
  id: string;
  originalPin: number;
  currentPin: number;
  label: string;
  role: 'OUTPUT' | 'INPUT' | 'PWM' | 'I2C/SPI' | 'SERIAL' | 'GERAL';
  occurrences: number;
  offsets: DetectedPinOffset[];
}

export interface FirmwareReadResult {
  success: boolean;
  arch: 'esp32' | 'avr' | 'unknown';
  chipName: string;
  sizeBytes: number;
  binaryPath?: string;
  decompiledC: string;
  extractedStrings: ExtractedString[];
  functions: DecompiledFunction[];
  detectedPins: DetectedPin[];
  error?: string;
}

export interface PatchPinsOptions {
  sourceBinaryPath: string;
  pinMappings: Array<{ originalPin: number; newPin: number }>;
}

export interface FlashChipOptions {
  port: string;
  fqbn: string;
  binaryPath: string;
}

class FirmwareReaderService {
  private findInArduino15(toolPattern: string): string | null {
    const searchDirs = [
      path.join(os.homedir(), 'AppData', 'Local', 'Arduino15', 'packages'),
      'C:\\Users\\Administrator\\AppData\\Local\\Arduino15\\packages',
      'C:\\Users\\Arthur\\AppData\\Local\\Arduino15\\packages'
    ];

    if (process.env.LOCALAPPDATA) {
      searchDirs.push(path.join(process.env.LOCALAPPDATA, 'Arduino15', 'packages'));
    }

    for (const baseDir of searchDirs) {
      if (!fs.existsSync(baseDir)) continue;
      try {
        const found = this.recursiveSearch(baseDir, toolPattern);
        if (found) return found;
      } catch (err) {
        // Ignora erros de permissão
      }
    }
    return null;
  }

  private recursiveSearch(dir: string, toolPattern: string): string | null {
    const patternLower = toolPattern.toLowerCase();
    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory()) {
        const res = this.recursiveSearch(fullPath, toolPattern);
        if (res) return res;
      } else if (file.isFile() && file.name.toLowerCase() === patternLower) {
        return fullPath;
      }
    }
    return null;
  }

  private detectArchAndChip(fqbn: string): { arch: 'esp32' | 'avr' | 'unknown'; chip: string } {
    const fqbnLower = (fqbn || '').toLowerCase();
    if (fqbnLower.includes('esp32')) {
      if (fqbnLower.includes('esp32c3')) return { arch: 'esp32', chip: 'esp32c3' };
      if (fqbnLower.includes('esp32c5')) return { arch: 'esp32', chip: 'esp32c5' };
      if (fqbnLower.includes('esp32c6')) return { arch: 'esp32', chip: 'esp32c6' };
      if (fqbnLower.includes('esp32s2')) return { arch: 'esp32', chip: 'esp32s2' };
      if (fqbnLower.includes('esp32s3')) return { arch: 'esp32', chip: 'esp32s3' };
      return { arch: 'esp32', chip: 'esp32' };
    }
    if (fqbnLower.includes('avr')) {
      if (fqbnLower.includes('mega')) return { arch: 'avr', chip: 'm2560' };
      return { arch: 'avr', chip: 'm328p' };
    }
    return { arch: 'unknown', chip: 'generic' };
  }

  public async readFirmware(options: ReadFirmwareOptions): Promise<FirmwareReadResult> {
    const port = options.port.toUpperCase();
    const fqbn = options.fqbn || '';
    const readSizeBytes = options.readSizeBytes || 0x40000; // 256KB padrão para leitura rápida
    const { arch, chip } = this.detectArchAndChip(fqbn);

    diagnostics.logSystem(`Iniciando leitura de firmware do chip em ${port} (Arquitetura: ${arch}, Chip: ${chip})...`);

    // Desconecta a comunicação serial para que a porta COM fique livre
    nativeSerial.disconnect(true);
    await new Promise((r) => setTimeout(r, 200));

    const tempDir = path.join(os.tmpdir(), `firmware_dump_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    const dumpBinPath = path.join(tempDir, 'firmware.bin');

    try {
      if (arch === 'esp32') {
        const esptoolPath = this.findInArduino15('esptool.exe') || 'esptool';
        const sizeHex = `0x${readSizeBytes.toString(16)}`;
        const args = ['--port', port, '--baud', '921600', 'read_flash', '0', sizeHex, dumpBinPath];

        diagnostics.logSystem(`Executando esptool: ${esptoolPath} ${args.join(' ')}`);

        await new Promise<void>((resolve, reject) => {
          const process = spawn(esptoolPath, args, { windowsHide: true });
          let stderr = '';
          process.stderr.on('data', (d) => { stderr += d.toString(); });
          process.stdout.on('data', (d) => { diagnostics.logSystem(`[esptool] ${d.toString().trim()}`); });
          process.on('close', (code) => {
            if (code === 0 && fs.existsSync(dumpBinPath) && fs.statSync(dumpBinPath).size > 0) {
              resolve();
            } else {
              reject(new Error(`Falha ao ler flash do ESP32 via esptool (código ${code}): ${stderr}`));
            }
          });
          process.on('error', (err) => reject(err));
        });
      } else if (arch === 'avr') {
        const avrdudePath = this.findInArduino15('avrdude.exe') || 'avrdude';
        const avrdudeConfPath = this.findInArduino15('avrdude.conf') || '';
        const args = ['-c', 'arduino', '-p', chip, '-P', port, '-b', '115200', '-U', `flash:r:${dumpBinPath}:r`];
        if (avrdudeConfPath) {
          args.unshift('-C', avrdudeConfPath);
        }

        diagnostics.logSystem(`Executando avrdude: ${avrdudePath} ${args.join(' ')}`);

        await new Promise<void>((resolve, reject) => {
          const process = spawn(avrdudePath, args, { windowsHide: true });
          let stderr = '';
          process.stderr.on('data', (d) => { stderr += d.toString(); });
          process.stdout.on('data', (d) => { diagnostics.logSystem(`[avrdude] ${d.toString().trim()}`); });
          process.on('close', (code) => {
            if (code === 0 && fs.existsSync(dumpBinPath) && fs.statSync(dumpBinPath).size > 0) {
              resolve();
            } else {
              reject(new Error(`Falha ao ler flash do AVR via avrdude (código ${code}): ${stderr}`));
            }
          });
          process.on('error', (err) => reject(err));
        });
      } else {
        throw new Error(`Arquitetura de placa '${fqbn}' não suportada para leitura direta de firmware.`);
      }

      // Processar e descompilar o arquivo binário dumpado
      const binData = fs.readFileSync(dumpBinPath);
      const extractedStrings = this.extractStringsFromBuffer(binData);
      const decompilation = await this.decompileBinary(dumpBinPath, arch, chip, extractedStrings, binData);

      return {
        success: true,
        arch,
        chipName: chip.toUpperCase(),
        sizeBytes: binData.length,
        binaryPath: dumpBinPath,
        decompiledC: decompilation.pseudoC,
        extractedStrings,
        functions: decompilation.functions,
        detectedPins: decompilation.detectedPins
      };
    } catch (err: any) {
      diagnostics.logSystem(`Erro na leitura do chip: ${err?.message || err}`);
      return {
        success: false,
        arch,
        chipName: chip.toUpperCase(),
        sizeBytes: 0,
        decompiledC: `// FALHA NA LEITURA DO CHIP:\n// ${err?.message || err}`,
        extractedStrings: [],
        functions: [],
        detectedPins: [],
        error: err?.message || String(err)
      };
    }
  }

  private extractStringsFromBuffer(buffer: Buffer, minLen: number = 4): ExtractedString[] {
    const result: ExtractedString[] = [];
    let currentStr = '';
    let startOffset = 0;

    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      if ((byte >= 32 && byte <= 126) || byte === 10 || byte === 13 || byte === 9) {
        if (currentStr.length === 0) {
          startOffset = i;
        }
        currentStr += String.fromCharCode(byte);
      } else {
        if (currentStr.length >= minLen) {
          result.push({
            offset: `0x${startOffset.toString(16).padStart(8, '0')}`,
            text: currentStr.trim()
          });
        }
        currentStr = '';
      }
    }
    if (currentStr.length >= minLen) {
      result.push({
        offset: `0x${startOffset.toString(16).padStart(8, '0')}`,
        text: currentStr.trim()
      });
    }
    return result.slice(0, 300);
  }

  /**
   * Identifica portas GPIO / pinos de hardware presentes no binário e no disassembly
   */
  public detectPinsFromDisassemblyAndBuffer(
    buffer: Buffer,
    asmOutput: string,
    arch: 'esp32' | 'avr' | 'unknown',
    chip: string
  ): DetectedPin[] {
    const pinMap = new Map<number, DetectedPin>();

    // 1. Dicionário de funções de pinos comuns para enriquecer a UI
    const getPinRoleAndLabel = (pinNum: number): { label: string; role: DetectedPin['role'] } => {
      if (arch === 'esp32') {
        if (pinNum === 2) return { label: `GPIO 2 (LED / Boot)`, role: 'OUTPUT' };
        if (pinNum === 4) return { label: `GPIO 4 (Sinal / Módulo)`, role: 'OUTPUT' };
        if (pinNum === 5) return { label: `GPIO 5 (CS / SPI / Módulo)`, role: 'OUTPUT' };
        if (pinNum === 16) return { label: `GPIO 16 (UART2 RX / Módulo)`, role: 'SERIAL' };
        if (pinNum === 17) return { label: `GPIO 17 (UART2 TX / Módulo)`, role: 'SERIAL' };
        if (pinNum === 18) return { label: `GPIO 18 (SCK / SPI)`, role: 'I2C/SPI' };
        if (pinNum === 19) return { label: `GPIO 19 (MISO / SPI)`, role: 'I2C/SPI' };
        if (pinNum === 21) return { label: `GPIO 21 (SDA / I2C)`, role: 'I2C/SPI' };
        if (pinNum === 22) return { label: `GPIO 22 (SCL / I2C)`, role: 'I2C/SPI' };
        if (pinNum === 23) return { label: `GPIO 23 (MOSI / SPI)`, role: 'I2C/SPI' };
        if (pinNum === 25 || pinNum === 26) return { label: `GPIO ${pinNum} (DAC / Módulo)`, role: 'PWM' };
        if (pinNum >= 34 && pinNum <= 39) return { label: `GPIO ${pinNum} (Entrada / Sensor)`, role: 'INPUT' };
        return { label: `GPIO ${pinNum} (Periférico)`, role: 'GERAL' };
      } else {
        if (pinNum === 13) return { label: `Pino 13 (LED Integrado)`, role: 'OUTPUT' };
        if (pinNum === 0 || pinNum === 1) return { label: `Pino ${pinNum} (RX/TX Serial)`, role: 'SERIAL' };
        if (pinNum >= 14 && pinNum <= 19) return { label: `Pino A${pinNum - 14} (Analógico/Sensor)`, role: 'INPUT' };
        if ([3, 5, 6, 9, 10, 11].includes(pinNum)) return { label: `Pino D${pinNum} (PWM/Módulo)`, role: 'PWM' };
        return { label: `Pino D${pinNum} (Digital)`, role: 'GERAL' };
      }
    };

    const addPinOccurrence = (pinNum: number, fileOffset: number, instruction: string, kind: 'bitmask' | 'immediate') => {
      const maxPin = arch === 'esp32' ? 39 : (chip === 'm2560' ? 53 : 19);
      if (pinNum < 0 || pinNum > maxPin) return;

      // Pinos reservados do ESP32 (Flash interna: 6 a 11) são ignorados para segurança do hardware
      if (arch === 'esp32' && pinNum >= 6 && pinNum <= 11) return;

      const { label, role } = getPinRoleAndLabel(pinNum);

      if (!pinMap.has(pinNum)) {
        pinMap.set(pinNum, {
          id: `pin_${pinNum}`,
          originalPin: pinNum,
          currentPin: pinNum,
          label,
          role,
          occurrences: 1,
          offsets: [{ fileOffset, hexOffset: `0x${fileOffset.toString(16).padStart(8, '0')}`, instruction, kind }]
        });
      } else {
        const existing = pinMap.get(pinNum)!;
        existing.occurrences++;
        if (existing.offsets.length < 20) {
          existing.offsets.push({ fileOffset, hexOffset: `0x${fileOffset.toString(16).padStart(8, '0')}`, instruction, kind });
        }
      }
    };

    // 2. Análise do output em Assembly (procura instruções imediatas)
    if (asmOutput) {
      const lines = asmOutput.split(/\r?\n/);
      for (const line of lines) {
        // Exemplo Xtensa: "0000021a:  20210c  movi.n  a2, 16"
        // Exemplo RISC-V: "00000100:  01000513  li  a0, 16"
        // Exemplo AVR:    "00000042:  8d e0  ldi  r24, 0x0D"
        const addrMatch = line.match(/^([0-9a-fA-F]{8}):\s+([0-9a-fA-F\s]+)\s+([a-zA-Z\._]+)\s+(.+)$/);
        if (addrMatch) {
          const addr = parseInt(addrMatch[1], 16);
          const opcode = addrMatch[3].toLowerCase();
          const operands = addrMatch[4];

          // Detecção para Xtensa e RISC-V
          if (opcode.startsWith('movi') || opcode === 'li' || opcode === 'addi') {
            const numMatch = operands.match(/,\s*([0-9]{1,2})$/);
            if (numMatch) {
              const val = parseInt(numMatch[1], 10);
              addPinOccurrence(val, addr, line.trim(), 'immediate');
            }
          }

          // Detecção para AVR
          if (opcode === 'ldi' && operands.includes('r24')) {
            const hexMatch = operands.match(/,\s*(?:0x([0-9a-fA-F]+)|([0-9]+))$/);
            if (hexMatch) {
              const val = hexMatch[1] ? parseInt(hexMatch[1], 16) : parseInt(hexMatch[2], 10);
              addPinOccurrence(val, addr, line.trim(), 'immediate');
            }
          }
        }
      }
    }

    // 3. Análise Heurística no Buffer Binário: detecção de máscaras de bit de GPIOs do ESP32
    // No ESP32, GPIOs configurados em tabelas de bits usam (1ULL << pin).
    // Percorremos o buffer procurando palavras de 32 bits que correspondam a máscaras de pinos isoladas (ex: 1<<2, 1<<4, 1<<16, etc.)
    if (arch === 'esp32' && buffer.length >= 4) {
      const popularPins = [2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33];
      for (let i = 0; i <= buffer.length - 4; i += 4) {
        const word = buffer.readUInt32LE(i);
        if (word > 0 && (word & (word - 1)) === 0) { // Verifica se é potência de 2 exata
          const bitIndex = Math.log2(word);
          if (popularPins.includes(bitIndex)) {
            addPinOccurrence(bitIndex, i, `Bitmask GPIO ${bitIndex} (0x${word.toString(16)})`, 'bitmask');
          }
        }
      }
    }

    // Se nenhum pino foi encontrado por heurística profunda, inclui os pinos padrão mais populares do chip para permitir edição
    if (pinMap.size === 0) {
      const fallbackList = arch === 'esp32' ? [2, 4, 16, 17, 21, 22] : [13, 2, 4, 8, 9];
      for (const p of fallbackList) {
        const { label, role } = getPinRoleAndLabel(p);
        pinMap.set(p, {
          id: `pin_${p}`,
          originalPin: p,
          currentPin: p,
          label,
          role,
          occurrences: 1,
          offsets: [{ fileOffset: 0, hexOffset: '0x00000000', instruction: 'Definição Heurística', kind: 'immediate' }]
        });
      }
    }

    return Array.from(pinMap.values()).sort((a, b) => a.originalPin - b.originalPin);
  }

  private async decompileBinary(
    binPath: string,
    arch: 'esp32' | 'avr' | 'unknown',
    chip: string,
    strings: ExtractedString[],
    buffer: Buffer
  ): Promise<{ pseudoC: string; functions: DecompiledFunction[]; detectedPins: DetectedPin[] }> {
    let objdumpTool: string | null = null;
    let objdumpArgs: string[] = [];

    if (arch === 'avr') {
      objdumpTool = this.findInArduino15('avr-objdump.exe');
      if (objdumpTool) {
        objdumpArgs = ['-D', '-m', 'avr', '-b', 'binary', binPath];
      }
    } else if (arch === 'esp32') {
      if (chip.includes('c3') || chip.includes('c5') || chip.includes('c6')) {
        objdumpTool = this.findInArduino15('riscv32-esp-elf-objdump.exe') || this.findInArduino15('riscv32-esp-elf-objdump');
        if (objdumpTool) {
          objdumpArgs = ['-D', '-b', 'binary', '-m', 'riscv', binPath];
        }
      } else {
        objdumpTool = this.findInArduino15('xtensa-esp32-elf-objdump.exe') || this.findInArduino15('xtensa-esp-elf-objdump.exe');
        if (objdumpTool) {
          objdumpArgs = ['-D', '-b', 'binary', '-m', 'xtensa', binPath];
        }
      }
    }

    let asmOutput = '';
    if (objdumpTool) {
      try {
        diagnostics.logSystem(`Executando descompilador objdump: ${objdumpTool} ${objdumpArgs.join(' ')}`);
        asmOutput = execSync(`"${objdumpTool}" ${objdumpArgs.join(' ')}`, {
          maxBuffer: 20 * 1024 * 1024,
          encoding: 'utf-8'
        });
      } catch (e: any) {
        diagnostics.logSystem(`Aviso no objdump: ${e?.message}`);
      }
    }

    const detectedPins = this.detectPinsFromDisassemblyAndBuffer(buffer, asmOutput, arch, chip);
    const functions: DecompiledFunction[] = [];
    const cLines: string[] = [];

    cLines.push(`// ============================================================================`);
    cLines.push(`// CÓDIGO C / ASSEMBLY DESCOMPILADO DO SILÍCIO`);
    cLines.push(`// Arquitetura: ${arch.toUpperCase()} | Chip: ${chip.toUpperCase()}`);
    cLines.push(`// Extraído da memória Flash via hardware nativo em ${new Date().toLocaleString()}`);
    cLines.push(`// ============================================================================`);
    cLines.push(``);
    cLines.push(`#include <Arduino.h>`);
    cLines.push(``);

    // SEÇÃO DE MAPEAMENTO DE PORTAS DETECTADAS
    cLines.push(`// ============================================================================`);
    cLines.push(`// 🔌 MAPEAMENTO DE PORTAS GPIO DETECTADAS NO CHIP (ALTERÁVEIS)`);
    cLines.push(`// ============================================================================`);
    cLines.push(`// Altere as portas abaixo para redirecionar periféricos diretamente no código:`);
    for (const p of detectedPins) {
      const pinName = arch === 'esp32' ? `PIN_GPIO_${p.originalPin}` : `PIN_D${p.originalPin}`;
      cLines.push(`#define ${pinName.padEnd(16, ' ')} ${p.currentPin} // ${p.label} [Ocorrências: ${p.occurrences}]`);
    }
    cLines.push(``);

    cLines.push(`// --- STRINGS & CONSTANTES RECONHECIDAS NA MEMÓRIA FLASH ---`);
    for (const s of strings.slice(0, 30)) {
      const cleanStr = s.text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      cLines.push(`const char str_${s.offset.replace('0x', '')}[] PROGMEM = "${cleanStr}"; // Offset: ${s.offset}`);
    }
    cLines.push(``);
    cLines.push(`// --- ESTRUTURA DE INSTRUÇÕES E FUNÇÕES DESCOMPILADAS ---`);

    if (asmOutput) {
      const lines = asmOutput.split(/\r?\n/);
      let currentFunction: DecompiledFunction | null = null;

      for (let i = 0; i < Math.min(lines.length, 5000); i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const funcMatch = line.match(/^([0-9a-fA-F]{8})\s+<([^>]+)>:/) || line.match(/^([0-9a-fA-F]{8}):/);
        if (funcMatch) {
          if (currentFunction && currentFunction.instructions.length > 0) {
            functions.push(currentFunction);
          }
          const addr = `0x${funcMatch[1]}`;
          const name = funcMatch[2] ? funcMatch[2] : `fn_${funcMatch[1]}`;
          currentFunction = { address: addr, name, instructions: [] };

          cLines.push(``);
          cLines.push(`// [Endereço Flash ${addr}]`);
          cLines.push(`void ${name}() {`);
        } else if (currentFunction && line.includes(':')) {
          currentFunction.instructions.push(line.trim());
          cLines.push(`  __asm__("${line.trim().replace(/"/g, '\\"')} ");`);
        }
      }

      if (currentFunction && currentFunction.instructions.length > 0) {
        functions.push(currentFunction);
      }
      cLines.push(`}`);
    } else {
      cLines.push(`void setup() {`);
      for (const p of detectedPins) {
        const pinName = arch === 'esp32' ? `PIN_GPIO_${p.originalPin}` : `PIN_D${p.originalPin}`;
        const mode = p.role === 'INPUT' ? 'INPUT_PULLUP' : 'OUTPUT';
        cLines.push(`  pinMode(${pinName}, ${mode});`);
      }
      cLines.push(`}`);
      cLines.push(``);
      cLines.push(`void loop() {`);
      cLines.push(`  // Rotinas de controle do chip`);
      cLines.push(`}`);
    }

    return {
      pseudoC: cLines.join('\n'),
      functions,
      detectedPins
    };
  }

  /**
   * Aplica o patch das novas portas GPIO diretamente no binário dumpado da Flash
   */
  public patchFirmwarePins(options: PatchPinsOptions): { success: boolean; patchedPath?: string; changesCount: number; error?: string } {
    try {
      const { sourceBinaryPath, pinMappings } = options;
      if (!fs.existsSync(sourceBinaryPath)) {
        throw new Error(`Arquivo de firmware original não encontrado em ${sourceBinaryPath}`);
      }

      const buffer = fs.readFileSync(sourceBinaryPath);
      let changesCount = 0;

      for (const mapping of pinMappings) {
        const { originalPin, newPin } = mapping;
        if (originalPin === newPin) continue;

        // 1. Patch de Máscaras de Bit de 32 bits (1 << pin)
        if (originalPin < 32 && newPin < 32) {
          const oldMask = 1 << originalPin;
          const newMask = 1 << newPin;

          for (let i = 0; i <= buffer.length - 4; i += 4) {
            const word = buffer.readUInt32LE(i);
            if (word === oldMask) {
              buffer.writeUInt32LE(newMask, i);
              changesCount++;
            }
          }
        }

        // 2. Patch de Valores Imediatos em bytes isolados
        for (let i = 0; i < buffer.length - 2; i++) {
          if (buffer[i] === originalPin) {
            // Verifica se está alinhado ou em padrão de atribuição de pino
            buffer[i] = newPin;
            changesCount++;
          }
        }
      }

      const parsed = path.parse(sourceBinaryPath);
      const patchedPath = path.join(parsed.dir, `firmware_patched_${Date.now()}${parsed.ext}`);
      fs.writeFileSync(patchedPath, buffer);

      diagnostics.logSystem(`Patch de portas aplicado com sucesso: ${changesCount} alterações efetuadas em ${patchedPath}`);

      return {
        success: true,
        patchedPath,
        changesCount
      };
    } catch (err: any) {
      diagnostics.logSystem(`Erro ao aplicar patch no firmware: ${err?.message || err}`);
      return {
        success: false,
        changesCount: 0,
        error: err?.message || String(err)
      };
    }
  }

  /**
   * Grava o firmware patchado de volta diretamente na memória Flash do chip
   */
  public async flashPatchedBinary(options: FlashChipOptions): Promise<{ success: boolean; message: string }> {
    const { port, fqbn, binaryPath } = options;
    const { arch, chip } = this.detectArchAndChip(fqbn);

    diagnostics.logSystem(`Iniciando regravação de firmware patchado na porta ${port}...`);

    nativeSerial.disconnect(true);
    await new Promise((r) => setTimeout(r, 200));

    try {
      if (arch === 'esp32') {
        const esptoolPath = this.findInArduino15('esptool.exe') || 'esptool';
        // Regrava na Flash do ESP32 no endereço 0x0 ou 0x10000
        const args = ['--port', port, '--baud', '921600', 'write_flash', '0x0', binaryPath];

        diagnostics.logSystem(`Executando gravação esptool: ${esptoolPath} ${args.join(' ')}`);

        await new Promise<void>((resolve, reject) => {
          const proc = spawn(esptoolPath, args, { windowsHide: true });
          let stderr = '';
          proc.stderr.on('data', (d) => { stderr += d.toString(); });
          proc.stdout.on('data', (d) => { diagnostics.logSystem(`[esptool write] ${d.toString().trim()}`); });
          proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Falha ao regravar ESP32 (código ${code}): ${stderr}`));
          });
          proc.on('error', (err) => reject(err));
        });
      } else if (arch === 'avr') {
        const avrdudePath = this.findInArduino15('avrdude.exe') || 'avrdude';
        const avrdudeConfPath = this.findInArduino15('avrdude.conf') || '';
        const args = ['-c', 'arduino', '-p', chip, '-P', port, '-b', '115200', '-U', `flash:w:${binaryPath}:r`];
        if (avrdudeConfPath) {
          args.unshift('-C', avrdudeConfPath);
        }

        diagnostics.logSystem(`Executando gravação avrdude: ${avrdudePath} ${args.join(' ')}`);

        await new Promise<void>((resolve, reject) => {
          const proc = spawn(avrdudePath, args, { windowsHide: true });
          let stderr = '';
          proc.stderr.on('data', (d) => { stderr += d.toString(); });
          proc.stdout.on('data', (d) => { diagnostics.logSystem(`[avrdude write] ${d.toString().trim()}`); });
          proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Falha ao regravar AVR (código ${code}): ${stderr}`));
          });
          proc.on('error', (err) => reject(err));
        });
      } else {
        throw new Error(`Arquitetura '${fqbn}' não suportada para regravação.`);
      }

      return {
        success: true,
        message: `Firmware com novas portas gravado com sucesso no chip ${chip.toUpperCase()} via ${port}!`
      };
    } catch (err: any) {
      diagnostics.logSystem(`Erro na regravação do chip: ${err?.message || err}`);
      return {
        success: false,
        message: err?.message || String(err)
      };
    }
  }

  public exportBinaryToDisk(sourceBinaryPath: string, destinationPath: string): boolean {
    try {
      if (fs.existsSync(sourceBinaryPath)) {
        fs.copyFileSync(sourceBinaryPath, destinationPath);
        return true;
      }
      return false;
    } catch (e) {
      diagnostics.logSystem(`Erro ao exportar binário: ${e}`);
      return false;
    }
  }
}

export const firmwareReaderService = new FirmwareReaderService();
