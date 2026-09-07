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
  private inFlightScan: Promise<DetectedPort[]> | null = null;

  constructor() {
    super();
  }

  public setUploading(uploading: boolean) {
    this.isUploading = uploading;
    this.emit('uploadStateChange', uploading);
  }

  public async listPorts(): Promise<DetectedPort[]> {
    // Se já houver um scan em andamento, aguardar a promessa existente (deduplicação de requisições simultâneas)
    if (this.inFlightScan) {
      return this.inFlightScan;
    }

    this.inFlightScan = this.executeScan().finally(() => {
      this.inFlightScan = null;
    });

    return this.inFlightScan;
  }

  private async executeScan(): Promise<DetectedPort[]> {
    const portsMap = new Map<string, DetectedPort>();

    // 1. Consulta Imediata no Registro do Windows (15 a 25ms)
    // Obtém todas as portas registradas pelo kernel no mapa de hardware
    try {
      const { stdout: regOut } = await execPromise('reg query "HKLM\\HARDWARE\\DEVICEMAP\\SERIALCOMM"', {
        timeout: 1500
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
      // Registro pode estar vazio se nenhuma porta estiver plugada
    }

    // 2. Consulta WQL de Alto Desempenho no CIM/WMI do Windows (~300ms)
    // Filtra diretamente no motor C++ do WMI (sem trazer milhares de dispositivos PnP para memória)
    // e captura 100% dos dispositivos que possuem (COM\d+) no Nome, independente do PNPClass
    try {
      const psCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance -Query 'SELECT Name, Description, Manufacturer, DeviceID FROM Win32_PnPEntity WHERE Name LIKE ''%(COM%)''' | Select-Object Name, Description, Manufacturer, DeviceID | ConvertTo-Json -Compress"`;
      const { stdout: psOut } = await execPromise(psCommand, { timeout: 6000 });

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
      // Se o WMI falhar, os dados capturados pelo registro do Windows são mantidos
    }

    const result = Array.from(portsMap.values());

    // 3. Ordenação Inteligente por Prioridade de Microcontroladores
    // Garante que placas USB (ESP32, Arduino, CH340, CP2102) sempre apareçam no topo
    // antes de portas Bluetooth virtuais ou COM1 da placa-mãe
    const getPriority = (p: DetectedPort) => {
      const bg = (p.boardGuess || '').toLowerCase();
      const fn = (p.friendlyName || '').toLowerCase();
      if (bg.includes('arduino') || bg.includes('esp32') || bg.includes('ch340') || bg.includes('cp210') || bg.includes('ftdi')) return 1;
      if (fn.includes('usb') || (p.vendorId && p.vendorId !== '0000')) return 2;
      if (fn.includes('bluetooth') || fn.includes('bth')) return 4;
      if (p.port === 'COM1' && fn.includes('communications port')) return 5;
      return 3;
    };

    result.sort((a, b) => getPriority(a) - getPriority(b) || a.port.localeCompare(b.port, undefined, { numeric: true }));

    return result;
  }

  private guessBoardType(name: string, desc: string, manuf: string, vid?: string, pid?: string): string {
    const combined = `${name} ${desc} ${manuf}`.toLowerCase();

    // Identificação por VID/PID conhecidos
    if (vid === '1A86' && pid === '7523') return 'Arduino / ESP32 (Chip CH340)';
    if (vid === '1A86') return 'Arduino / ESP32 (Chip CH340/CH341)';
    if (vid === '10C4' && pid === 'EA60') return 'ESP32 / ESP8266 (Chip CP2102)';
    if (vid === '10C4') return 'ESP32 / NodeMCU (Silicon Labs)';
    if (vid === '303A') return 'ESP32 USB Nativo (Espressif)';
    if (vid === '2341' || vid === '2A03') return 'Arduino Oficial (Uno/Mega/Nano)';
    if (vid === '0403' && pid === '6001') return 'Arduino / FTDI FT232R';
    if (vid === '0403') return 'Dispositivo FTDI USB';
    if (vid === '067B') return 'Prolific USB-to-Serial';

    if (combined.includes('esp32')) return 'ESP32';
    if (combined.includes('ch340') || combined.includes('ch341')) return 'Arduino / ESP32 (CH340)';
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
