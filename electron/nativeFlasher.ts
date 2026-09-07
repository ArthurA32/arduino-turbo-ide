import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { app } from 'electron';
import { diagnostics } from './diagnostics';
import { processManager } from './processManager';
import { nativeSerial } from './nativeSerial';

export interface NativeFlasherInfo {
  available: boolean;
  isNativeArm64: boolean;
  pythonPath: string | null;
  esptoolMode: 'embedded_arm64' | 'system_arm64' | 'system_python' | 'emulated_fallback' | 'unavailable';
  details: string;
}

export class NativeFlasherService {
  private cachedPythonPath: string | null = null;
  private cachedFallbackEsptool: string | null = null;
  private isArm64Runtime: boolean = false;

  constructor() {
    this.isArm64Runtime = process.arch === 'arm64' || (process.env.PROCESSOR_ARCHITECTURE || '').toUpperCase() === 'ARM64';
  }

  /**
   * Resolve o caminho do Python ARM64 embutido ou do sistema
   */
  public resolvePythonPath(): string | null {
    if (this.cachedPythonPath && fs.existsSync(this.cachedPythonPath)) {
      return this.cachedPythonPath;
    }

    const candidatePaths: string[] = [];

    try {
      // 1. Caminho empacotado em resources (ARM64 embedded)
      if (app && app.isPackaged) {
        candidatePaths.push(
          path.join(process.resourcesPath, 'bin', 'arm64', 'python', 'python.exe'),
          path.join(process.resourcesPath, 'bin', 'python', 'python.exe'),
          path.join(process.resourcesPath, 'app', 'bin', 'arm64', 'python', 'python.exe')
        );
      }

      // 2. Caminho em tempo de desenvolvimento
      if (app && typeof app.getAppPath === 'function') {
        const appPath = app.getAppPath();
        candidatePaths.push(
          path.join(appPath, 'bin', 'arm64', 'python', 'python.exe'),
          path.join(appPath, 'bin', 'python', 'python.exe')
        );
      }

      // 3. Relativo ao executável
      const exeDir = path.dirname(process.execPath);
      candidatePaths.push(
        path.join(exeDir, 'resources', 'bin', 'arm64', 'python', 'python.exe'),
        path.join(exeDir, 'bin', 'arm64', 'python', 'python.exe')
      );

      // 4. Se estiver em ambiente ARM64, checar se há Python oficial instalado no sistema
      const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
      candidatePaths.push(
        path.join(localAppData, 'Programs', 'Python', 'Python312', 'python.exe'),
        path.join(localAppData, 'Programs', 'Python', 'Python311', 'python.exe'),
        path.join(localAppData, 'Programs', 'Python', 'Python310', 'python.exe')
      );
    } catch (e) {
      console.warn('Erro ao listar caminhos candidatos do Python:', e);
    }

    for (const p of candidatePaths) {
      if (p && fs.existsSync(p)) {
        this.cachedPythonPath = p;
        diagnostics.logSystem(`[NativeFlasher] Python localizado em: ${p}`);
        return p;
      }
    }

    return null;
  }

  /**
   * Localiza o executável esptool.exe tradicional (fallback)
   */
  public resolveFallbackEsptool(): string {
    if (this.cachedFallbackEsptool && fs.existsSync(this.cachedFallbackEsptool)) {
      return this.cachedFallbackEsptool;
    }

    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const toolsDir = path.join(localAppData, 'Arduino15', 'packages', 'esp32', 'tools', 'esptool_py');

    if (fs.existsSync(toolsDir)) {
      try {
        const versions = fs.readdirSync(toolsDir);
        for (const ver of versions.reverse()) {
          const exePath = path.join(toolsDir, ver, 'esptool.exe');
          if (fs.existsSync(exePath)) {
            this.cachedFallbackEsptool = exePath;
            return exePath;
          }
        }
      } catch {}
    }

    return 'esptool';
  }

  /**
   * Retorna informações de diagnóstico sobre o modo do gravador
   */
  public getInfo(): NativeFlasherInfo {
    const pythonPath = this.resolvePythonPath();
    const isArm64 = this.isArm64Runtime;

    if (pythonPath) {
      const isEmbedded = pythonPath.includes('bin') && pythonPath.includes('arm64');
      return {
        available: true,
        isNativeArm64: isArm64 || isEmbedded,
        pythonPath,
        esptoolMode: isEmbedded ? 'embedded_arm64' : (isArm64 ? 'system_arm64' : 'system_python'),
        details: isEmbedded
          ? 'Python 3.12 ARM64 Embarcado Nativo (Snapdragon)'
          : (isArm64 ? 'Python ARM64 do Sistema' : 'Python Nativo do Sistema')
      };
    }

    const fallback = this.resolveFallbackEsptool();
    return {
      available: fs.existsSync(fallback),
      isNativeArm64: false,
      pythonPath: null,
      esptoolMode: fs.existsSync(fallback) ? 'emulated_fallback' : 'unavailable',
      details: 'Modo de compatibilidade (esptool.exe padrão)'
    };
  }

  /**
   * Extrai o identificador do chip a partir do FQBN
   */
  public parseChipFromFqbn(fqbn: string): string {
    const parts = fqbn.split(':');
    if (parts.length >= 3) {
      const boardId = parts[2].toLowerCase();
      if (boardId.includes('c5')) return 'esp32c5';
      if (boardId.includes('c6')) return 'esp32c6';
      if (boardId.includes('c3')) return 'esp32c3';
      if (boardId.includes('s3') || boardId.includes('nora')) return 'esp32s3';
      if (boardId.includes('s2')) return 'esp32s2';
      if (boardId.includes('h2')) return 'esp32h2';
      if (boardId.includes('p4')) return 'esp32p4';
      if (boardId.includes('esp32')) return 'esp32';
    }
    return 'auto';
  }

  /**
   * Executa a gravação flash do ESP32 de forma 100% nativa em ARM64
   */
  public async uploadEsp32(
    buildDir: string,
    fqbn: string,
    port: string,
    onOutput: (data: string) => void
  ): Promise<{ success: boolean; fallbackNeeded?: boolean }> {
    // 1. Liberar porta COM antes de iniciar handshake
    nativeSerial.disconnect(true);
    await new Promise((r) => setTimeout(r, 200));

    // 2. Verificar presença de flash_args gerado pelo compilador
    const flashArgsPath = path.join(buildDir, 'flash_args');
    if (!fs.existsSync(flashArgsPath)) {
      diagnostics.logUpload('[NativeFlasher] Arquivo flash_args não encontrado no diretório de compilação. Recorrendo ao arduino-cli...');
      return { success: false, fallbackNeeded: true };
    }

    const flashArgsRaw = fs.readFileSync(flashArgsPath, 'utf-8');
    const rawTokens = flashArgsRaw.trim().split(/\s+/).filter(Boolean);

    // Ajustar tokens relativos para caminhos absolutos no diretório de build
    const flashArgs: string[] = rawTokens.map((token) => {
      if (token.endsWith('.bin') && !path.isAbsolute(token)) {
        const candidate = path.join(buildDir, token);
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
      return token;
    });

    const chip = this.parseChipFromFqbn(fqbn);
    const pythonPath = this.resolvePythonPath();

    let executable: string;
    let spawnArgs: string[];
    let isNative = false;

    if (pythonPath) {
      executable = pythonPath;
      spawnArgs = [
        '-m', 'esptool',
        '--chip', chip,
        '--port', port,
        '--baud', '921600',
        '--before', 'default-reset',
        '--after', 'hard-reset',
        'write-flash',
        '-z',
        ...flashArgs
      ];
      isNative = true;
      onOutput(`[GRAVAÇÃO TURBO ARM64 NATIVA] Conectando diretamente aos núcleos Snapdragon via Python ARM64...\n`);
      onOutput(`⚡ Porta: ${port} | Velocidade: 921.600 baud | Chip: ${chip.toUpperCase()}\n\n`);
    } else {
      executable = this.resolveFallbackEsptool();
      spawnArgs = [
        '--chip', chip,
        '--port', port,
        '--baud', '921600',
        '--before', 'default-reset',
        '--after', 'hard-reset',
        'write_flash',
        '-z',
        ...flashArgs
      ];
      onOutput(`[GRAVAÇÃO TURBO] Iniciando gravação na porta ${port} (${chip.toUpperCase()})...\n\n`);
    }

    diagnostics.logUpload(`[NativeFlasher] Executando comando: ${executable} ${spawnArgs.join(' ')}`);

    return new Promise((resolve) => {
      const startTime = Date.now();
      let fullOutput = '';

      const child = spawn(executable, spawnArgs, {
        cwd: buildDir,
        windowsHide: true
      });

      processManager.register(child);

      child.stdout.on('data', (data) => {
        const text = data.toString();
        fullOutput += text;
        onOutput(text);
        diagnostics.logUpload(text);
      });

      child.stderr.on('data', (data) => {
        const text = data.toString();
        fullOutput += text;
        onOutput(text);
        diagnostics.logUpload(`[ERRO/INFO] ${text}`);
      });

      child.on('close', (code) => {
        processManager.unregister(child);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

        const chipMismatch = fullOutput.match(/This chip is (ESP32-[A-Za-z0-9]+|ESP32[A-Za-z0-9]*), not/i);
        if (chipMismatch) {
          const detectedChip = chipMismatch[1].toUpperCase();
          onOutput(`\n=================================================================\n` +
            `💡 [DIAGNÓSTICO AUTOMÁTICO]: O gravador detectou que sua placa física é um '${detectedChip}'!\n` +
            `👉 Solução: No topo do aplicativo, altere o seletor de Placa para '${detectedChip} Dev Module' e clique em 'Carregar' novamente.\n` +
            `=================================================================\n`);
        }

        const hasFatalError = /A fatal error occurred|Failed uploading|Error during upload|Permission denied|exit status [1-9]/i.test(fullOutput);

        if (code === 0 && !hasFatalError) {
          const modeTag = isNative ? ' [ARM64 Nativo Snapdragon]' : '';
          onOutput(`\n✔ [SUCESSO] Código gravado na Flash com sucesso em ${elapsed}s!${modeTag}\n`);
          diagnostics.logUpload(`Upload bem-sucedido em ${elapsed}s via NativeFlasher`);
          resolve({ success: true });
        } else {
          // Se for erro de comando/módulo ausente no Python, permitir fallback ao arduino-cli
          const isModuleMissing = /No module named esptool/i.test(fullOutput);
          if (isModuleMissing) {
            diagnostics.logUpload(`[NativeFlasher] Módulo esptool indisponível no Python selecionado. Acionando fallback...`);
            resolve({ success: false, fallbackNeeded: true });
          } else {
            onOutput(`\n❌ [FALHA] Erro no envio para a placa (Código ${code}). Verifique se a porta COM5 está livre e se o ESP32 está em modo de boot.\n`);
            diagnostics.logUpload(`Falha no upload via NativeFlasher (código ${code})`);
            resolve({ success: false, fallbackNeeded: false });
          }
        }
      });

      child.on('error', (err) => {
        processManager.unregister(child);
        diagnostics.logUpload(`[NativeFlasher] Erro ao disparar processo: ${err.message}`);
        resolve({ success: false, fallbackNeeded: true });
      });
    });
  }

  /**
   * Lê a memória Flash do chip para descompilação e análise de portas
   */
  public async readFlash(
    port: string,
    readSizeBytes: number,
    dumpBinPath: string,
    onLog?: (msg: string) => void
  ): Promise<boolean> {
    nativeSerial.disconnect(true);
    await new Promise((r) => setTimeout(r, 200));

    const pythonPath = this.resolvePythonPath();
    const sizeHex = `0x${readSizeBytes.toString(16)}`;

    let executable: string;
    let spawnArgs: string[];

    if (pythonPath) {
      executable = pythonPath;
      spawnArgs = ['-m', 'esptool', '--port', port, '--baud', '921600', 'read_flash', '0', sizeHex, dumpBinPath];
      if (onLog) onLog(`[NativeFlasher ARM64] Lendo ${readSizeBytes} bytes da memória Flash via Python ARM64 Nativo...`);
    } else {
      executable = this.resolveFallbackEsptool();
      spawnArgs = ['--port', port, '--baud', '921600', 'read_flash', '0', sizeHex, dumpBinPath];
      if (onLog) onLog(`[Flasher] Lendo ${readSizeBytes} bytes da memória Flash via esptool...`);
    }

    diagnostics.logSystem(`[NativeFlasher] read_flash comando: ${executable} ${spawnArgs.join(' ')}`);

    return new Promise((resolve, reject) => {
      const child = spawn(executable, spawnArgs, { windowsHide: true });
      processManager.register(child);
      let stderr = '';

      child.stdout.on('data', (d) => {
        const text = d.toString().trim();
        diagnostics.logSystem(`[esptool read] ${text}`);
        if (onLog) onLog(text);
      });

      child.stderr.on('data', (d) => {
        stderr += d.toString();
        diagnostics.logSystem(`[esptool stderr] ${d.toString().trim()}`);
      });

      child.on('close', (code) => {
        processManager.unregister(child);
        if (code === 0 && fs.existsSync(dumpBinPath) && fs.statSync(dumpBinPath).size > 0) {
          resolve(true);
        } else {
          reject(new Error(`Falha na leitura da Flash via esptool (código ${code}): ${stderr}`));
        }
      });

      child.on('error', (err) => {
        processManager.unregister(child);
        reject(err);
      });
    });
  }

  /**
   * Grava um binário com patch de pinos/portas diretamente na Flash
   */
  public async writeFlashPatch(
    port: string,
    patchedBinPath: string,
    onLog?: (msg: string) => void
  ): Promise<boolean> {
    nativeSerial.disconnect(true);
    await new Promise((r) => setTimeout(r, 200));

    const pythonPath = this.resolvePythonPath();
    let executable: string;
    let spawnArgs: string[];

    if (pythonPath) {
      executable = pythonPath;
      spawnArgs = ['-m', 'esptool', '--port', port, '--baud', '921600', 'write-flash', '-z', '0x0', patchedBinPath];
      if (onLog) onLog(`[NativeFlasher ARM64] Gravando patch na Flash via Python ARM64 Nativo...`);
    } else {
      executable = this.resolveFallbackEsptool();
      spawnArgs = ['--port', port, '--baud', '921600', 'write_flash', '-z', '0x0', patchedBinPath];
      if (onLog) onLog(`[Flasher] Gravando patch na Flash via esptool...`);
    }

    diagnostics.logSystem(`[NativeFlasher] write_flash patch: ${executable} ${spawnArgs.join(' ')}`);

    return new Promise((resolve, reject) => {
      const child = spawn(executable, spawnArgs, { windowsHide: true });
      processManager.register(child);
      let stderr = '';

      child.stdout.on('data', (d) => {
        const text = d.toString().trim();
        diagnostics.logSystem(`[esptool write] ${text}`);
        if (onLog) onLog(text);
      });

      child.stderr.on('data', (d) => {
        stderr += d.toString();
        diagnostics.logSystem(`[esptool write stderr] ${d.toString().trim()}`);
      });

      child.on('close', (code) => {
        processManager.unregister(child);
        if (code === 0) {
          resolve(true);
        } else {
          reject(new Error(`Falha ao gravar patch via esptool (código ${code}): ${stderr}`));
        }
      });

      child.on('error', (err) => {
        processManager.unregister(child);
        reject(err);
      });
    });
  }
}

export const nativeFlasher = new NativeFlasherService();
