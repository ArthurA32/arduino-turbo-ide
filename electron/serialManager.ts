import { exec } from 'child_process';
import util from 'util';
import { EventEmitter } from 'events';

const execPromise = util.promisify(exec);

export interface DetectedPort {
  port: string;
  friendlyName: string;
  description: string;
  manufacturer: string;
  vendorId?: string;
  productId?: string;
  boardGuess?: string;
}

export class SerialManager extends EventEmitter {
  private isUploading: boolean = false;

  constructor() {
    super();
  }

  private cachedPorts: DetectedPort[] = [];
  private lastPortScanTime: number = 0;

  public setUploading(uploading: boolean) {
    this.isUploading = uploading;
    this.emit('uploadStateChange', uploading);
  }

  public async listPorts(): Promise<DetectedPort[]> {
    const now = Date.now();
    // Cache de 2.5 segundos para evitar múltiplos spawns simultâneos do PowerShell
    if (this.cachedPorts.length > 0 && (now - this.lastPortScanTime) < 2500) {
      return this.cachedPorts;
    }

    const portsMap = new Map<string, DetectedPort>();

    // 1. Sondagem Ultrarrápida no Registro do Windows (15 a 25ms)
    try {
      const { stdout: regOut } = await execPromise('reg query "HKLM\\HARDWARE\\DEVICEMAP\\SERIALCOMM"', {
        timeout: 1000
      });
      if (regOut) {
        const lines = regOut.split('\n');
        for (const line of lines) {
          const match = line.match(/REG_SZ\s+(COM\d+)/i);
          if (match) {
            const portName = match[1].toUpperCase();
            portsMap.set(portName, {
              port: portName,
              friendlyName: `Porta Serial (${portName})`,
              description: line.trim().split(/\s+/)[0] || 'Dispositivo Serial',
              manufacturer: 'Microsoft / Fabricante Padrão',
              boardGuess: 'Porta Serial'
            });
          }
        }
      }
    } catch {
      // Registro pode estar vazio se nenhuma porta existir
    }

    // 2. Enriquecimento com Detalhes PNP e VID/PID filtrando EXCLUSIVAMENTE por 'Ports' (~200ms)
    try {
      const psCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_PnPEntity -Filter 'PNPClass = ''Ports''' | Select-Object Name, Description, Manufacturer, DeviceID | ConvertTo-Json -Compress"`;
      const { stdout: psOut } = await execPromise(psCommand, { timeout: 2500 });
      
      if (psOut && psOut.trim()) {
        let parsed: any;
        try {
          parsed = JSON.parse(psOut.trim());
        } catch {}

        if (parsed) {
          const rawList = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of rawList) {
            if (!item || !item.Name) continue;
            const comMatch = item.Name.match(/\((COM\d+)\)/i);
            if (!comMatch) continue;

            const portName = comMatch[1].toUpperCase();
            const friendlyName = item.Name || portName;
            const description = item.Description || '';
            const manufacturer = item.Manufacturer || '';
            const deviceId = item.DeviceID || '';

            const vidMatch = deviceId.match(/VID_([0-9A-Fa-f]{4})/);
            const pidMatch = deviceId.match(/PID_([0-9A-Fa-f]{4})/);
            const vid = vidMatch ? vidMatch[1].toUpperCase() : undefined;
            const pid = pidMatch ? pidMatch[1].toUpperCase() : undefined;

            const boardGuess = this.guessBoardType(friendlyName, description, manufacturer, vid, pid);

            portsMap.set(portName, {
              port: portName,
              friendlyName,
              description,
              manufacturer,
              vendorId: vid,
              productId: pid,
              boardGuess
            });
          }
        }
      }
    } catch (e: any) {
      // Se o PowerShell falhar ou atingir timeout, os dados obtidos pelo registro são preservados
    }

    const result = Array.from(portsMap.values());
    this.cachedPorts = result;
    this.lastPortScanTime = Date.now();
    return result;
  }

  private guessBoardType(name: string, desc: string, manuf: string, vid?: string, pid?: string): string {
    const combined = `${name} ${desc} ${manuf}`.toLowerCase();

    // Identificação por VID/PID conhecidos
    if (vid === '1A86' && pid === '7523') return 'Arduino / ESP32 (Chip CH340)';
    if (vid === '10C4' && pid === 'EA60') return 'ESP32 / ESP8266 (Chip CP2102)';
    if (vid === '303A') return 'ESP32 Nativo USB (Espressif)';
    if (vid === '2341' || vid === '2A03') return 'Arduino Oficial (Uno/Mega/Nano)';
    if (vid === '0403' && pid === '6001') return 'Arduino / FTDI FT232R';

    if (combined.includes('esp32')) return 'ESP32';
    if (combined.includes('ch340')) return 'Arduino / ESP32 (CH340)';
    if (combined.includes('cp210')) return 'ESP32 / NodeMCU (CP210x)';
    if (combined.includes('ftdi')) return 'Arduino FTDI';
    if (combined.includes('arduino uno')) return 'Arduino Uno';
    if (combined.includes('arduino nano')) return 'Arduino Nano';
    if (combined.includes('arduino mega')) return 'Arduino Mega';
    if (combined.includes('usb-serial')) return 'Dispositivo Serial USB';

    return 'Dispositivo Serial';
  }
}

export const serialManager = new SerialManager();
