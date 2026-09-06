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

  public setUploading(uploading: boolean) {
    this.isUploading = uploading;
    this.emit('uploadStateChange', uploading);
  }

  public async listPorts(): Promise<DetectedPort[]> {
    const ports: DetectedPort[] = [];

    try {
      // Usar comando nativo do PowerShell para listar todas as portas COM com detalhes PNP
      const psCommand = `powershell -NoProfile -Command "Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -match '\\(COM\\d+\\)' } | Select-Object Name, Description, Manufacturer, DeviceID | ConvertTo-Json -Compress"`;
      
      const { stdout } = await execPromise(psCommand);
      if (!stdout || stdout.trim() === '') {
        return [];
      }

      let parsed: any;
      try {
        parsed = JSON.parse(stdout.trim());
      } catch (e) {
        return [];
      }

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

        // Extrair VID e PID se disponíveis
        const vidMatch = deviceId.match(/VID_([0-9A-Fa-f]{4})/);
        const pidMatch = deviceId.match(/PID_([0-9A-Fa-f]{4})/);
        const vid = vidMatch ? vidMatch[1].toUpperCase() : undefined;
        const pid = pidMatch ? pidMatch[1].toUpperCase() : undefined;

        // Adivinhar o modelo de placa / chip
        const boardGuess = this.guessBoardType(friendlyName, description, manufacturer, vid, pid);

        ports.push({
          port: portName,
          friendlyName,
          description,
          manufacturer,
          vendorId: vid,
          productId: pid,
          boardGuess
        });
      }
    } catch (error) {
      console.error('Erro ao listar portas COM:', error);
    }

    return ports;
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
