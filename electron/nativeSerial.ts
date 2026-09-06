import { spawn, execSync, ChildProcessWithoutNullStreams } from 'child_process';
import { EventEmitter } from 'events';
import { diagnostics } from './diagnostics';
import { processManager } from './processManager';
import { arduinoCliService } from './arduinoCli';

export class NativeSerialService extends EventEmitter {
  private activeProcess: ChildProcessWithoutNullStreams | null = null;
  private currentPort: string = '';
  private currentBaudRate: number = 115200;
  private isConnected: boolean = false;
  private lineBuffer: string = '';
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  public getStatus(): { isConnected: boolean; port: string; baudRate: number } {
    return {
      isConnected: this.isConnected,
      port: this.currentPort,
      baudRate: this.currentBaudRate
    };
  }

  private handleIncomingData(chunk: string) {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    this.lineBuffer += chunk;

    // Se o buffer contém quebras de linha (\n ou \r\n), divide em linhas completas
    if (this.lineBuffer.includes('\n')) {
      const parts = this.lineBuffer.split(/\r?\n/);
      // O último elemento é o pedaço restante incompleto (ou string vazia se terminava com \n)
      this.lineBuffer = parts.pop() || '';

      for (const line of parts) {
        if (line.length > 0) {
          this.emit('data', line);
          diagnostics.logSerial(line);
        }
      }
    }

    // Se sobrou algum texto parcial sem quebra de linha (ex: Serial.print sem ln), descarrega após 40ms
    if (this.lineBuffer.length > 0) {
      this.flushTimer = setTimeout(() => {
        if (this.lineBuffer.length > 0) {
          this.emit('data', this.lineBuffer);
          diagnostics.logSerial(this.lineBuffer);
          this.lineBuffer = '';
        }
      }, 40);
    }
  }

  public async connect(portName: string, baudRate: number): Promise<{ success: boolean; error?: string }> {
    // 1. Desconectar qualquer processo anterior e liberar travas do SO
    this.disconnect(true);

    // 2. Dar um intervalo de 150ms para o driver do Windows liberar o handle da porta COM
    await new Promise((r) => setTimeout(r, 150));

    this.currentPort = portName.toUpperCase();
    this.currentBaudRate = baudRate;
    this.lineBuffer = '';

    const cliPath = arduinoCliService.getCliPath();
    const args = ['monitor', '-p', this.currentPort, '-c', `baudrate=${this.currentBaudRate}`, '-q'];

    return new Promise((resolve) => {
      try {
        const child = spawn(cliPath, args, {
          windowsHide: true
        });

        this.activeProcess = child;
        processManager.register(child);

        let resolved = false;
        let errorMessage = '';

        child.stdout.on('data', (data: Buffer) => {
          if (this.activeProcess !== child) return;

          const text = data.toString('utf-8');
          if (!resolved) {
            resolved = true;
            this.isConnected = true;
            this.emit('status', { connected: true, port: this.currentPort, baudRate: this.currentBaudRate });
            resolve({ success: true });
          }
          this.handleIncomingData(text);
        });

        child.stderr.on('data', (data: Buffer) => {
          if (this.activeProcess !== child) return;

          const errText = data.toString('utf-8');
          errorMessage += errText;
          diagnostics.logAppError(`Erro serial (${this.currentPort}): ${errText}`);
          
          if (!resolved) {
            resolved = true;
            this.isConnected = false;
            resolve({ success: false, error: errText.trim() });
          } else {
            this.emit('data', `[ERRO SERIAL] ${errText.trim()}`);
          }
        });

        child.on('close', (code) => {
          processManager.unregister(child);
          if (this.activeProcess === child) {
            this.activeProcess = null;
            this.isConnected = false;
            this.emit('status', { connected: false, port: this.currentPort });
          }

          if (!resolved) {
            resolved = true;
            const finalError = errorMessage.trim() || `Porta COM ocupada ou fechada (código ${code}).`;
            resolve({ success: false, error: finalError });
          }
        });

        child.on('error', (err) => {
          if (this.activeProcess === child) {
            this.activeProcess = null;
            this.isConnected = false;
          }
          diagnostics.logAppError(`Falha de processo serial: ${err.message}`);
          if (!resolved) {
            resolved = true;
            resolve({ success: false, error: err.message });
          }
        });

        // Considera conectado com sucesso após 300ms se nenhum erro ocorreu
        setTimeout(() => {
          if (!resolved && this.activeProcess === child && !child.killed && !errorMessage) {
            resolved = true;
            this.isConnected = true;
            this.emit('status', { connected: true, port: this.currentPort, baudRate: this.currentBaudRate });
            resolve({ success: true });
          }
        }, 300);

      } catch (err: any) {
        this.isConnected = false;
        resolve({ success: false, error: err.message });
      }
    });
  }

  public send(text: string): boolean {
    if (!this.isConnected || !this.activeProcess || !this.activeProcess.stdin) {
      return false;
    }

    try {
      this.activeProcess.stdin.write(text);
      return true;
    } catch (e: any) {
      console.error('Falha ao enviar dados serial:', e);
      return false;
    }
  }

  public disconnect(silent: boolean = false) {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.lineBuffer = '';

    if (this.activeProcess) {
      const procToKill = this.activeProcess;
      const pid = procToKill.pid;
      this.activeProcess = null;
      processManager.unregister(procToKill);

      try {
        procToKill.kill('SIGKILL');
      } catch {}

      if (pid) {
        try {
          execSync(`taskkill /F /PID ${pid} /T`, { stdio: 'ignore' });
        } catch {}
      }
    }
    this.isConnected = false;
    if (!silent) {
      this.emit('status', { connected: false, port: this.currentPort });
    }
  }
}

export const nativeSerial = new NativeSerialService();
