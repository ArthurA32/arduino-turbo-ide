import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import util from 'util';
import https from 'https';
import http from 'http';
import { app } from 'electron';
import { diagnostics } from './diagnostics';
import { processManager } from './processManager';
import { nativeFlasher } from './nativeFlasher';

const execPromise = util.promisify(exec);

export const TURBO_SKETCH_DIR = path.join(os.tmpdir(), 'arduino_turbo_sketch');
export const TURBO_BUILD_DIR = path.join(os.tmpdir(), 'arduino_turbo_build_output');

/**
 * Função utilitária para download de arquivos via HTTP/HTTPS com suporte a redirecionamentos (301/302/307/308)
 */
export function downloadFile(url: string, dest: string, maxRedirects: number = 5): Promise<void> {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Limite de redirecionamentos atingido ao baixar arquivo.'));
    }

    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'ArduinoTurboIDE/1.0.0 (Windows)'
      }
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          const parsed = new URL(url);
          redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
        }
        return downloadFile(redirectUrl, dest, maxRedirects - 1).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`Falha no download (HTTP ${res.statusCode})`));
      }

      const fileStream = fs.createWriteStream(dest);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    });

    req.on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

export interface BoardOption {
  name: string;
  fqbn: string;
  platform: 'esp32' | 'avr' | 'other';
  family: string;
}

export const POPULAR_BOARDS: BoardOption[] = [
  // Família ESP32 (Otimizados com Flash DIO, 3MB Flash Huge App, USB CDC e sem falha de PSRAM)
  { 
    name: 'ESP32-C5 Dev Module (Recomendado - USB CDC / 3MB Flash)', 
    fqbn: 'esp32:esp32:esp32c5:FlashMode=dio,CDCOnBoot=cdc,PSRAM=disabled,PartitionScheme=huge_app', 
    platform: 'esp32', 
    family: 'ESP32' 
  },
  { 
    name: 'ESP32-C5 Dev Module (Padrão / 3MB Flash)', 
    fqbn: 'esp32:esp32:esp32c5:FlashMode=dio,PSRAM=disabled,PartitionScheme=huge_app', 
    platform: 'esp32', 
    family: 'ESP32' 
  },
  { 
    name: 'ESP32-C6 Dev Module (USB CDC / 3MB Flash)', 
    fqbn: 'esp32:esp32:esp32c6:FlashMode=dio,CDCOnBoot=cdc,PSRAM=disabled,PartitionScheme=huge_app', 
    platform: 'esp32', 
    family: 'ESP32' 
  },
  { 
    name: 'ESP32-C3 Dev Module (USB CDC / 3MB Flash)', 
    fqbn: 'esp32:esp32:esp32c3:FlashMode=dio,CDCOnBoot=cdc,PartitionScheme=huge_app', 
    platform: 'esp32', 
    family: 'ESP32' 
  },
  { 
    name: 'ESP32-S3 Dev Module (USB CDC / 3MB Flash)', 
    fqbn: 'esp32:esp32:esp32s3:FlashMode=dio,CDCOnBoot=cdc,PartitionScheme=huge_app', 
    platform: 'esp32', 
    family: 'ESP32' 
  },
  { 
    name: 'ESP32-S2 Dev Module (USB CDC / 3MB Flash)', 
    fqbn: 'esp32:esp32:esp32s2:FlashMode=dio,CDCOnBoot=cdc,PartitionScheme=huge_app', 
    platform: 'esp32', 
    family: 'ESP32' 
  },
  { 
    name: 'ESP32-H2 Dev Module (3MB Flash)', 
    fqbn: 'esp32:esp32:esp32h2:FlashMode=dio,CDCOnBoot=cdc,PartitionScheme=huge_app', 
    platform: 'esp32', 
    family: 'ESP32' 
  },
  { 
    name: 'ESP32 Dev Module (Clássico ESP32 WROOM / 3MB Flash)', 
    fqbn: 'esp32:esp32:esp32:FlashMode=dio,PartitionScheme=huge_app', 
    platform: 'esp32', 
    family: 'ESP32' 
  },
  { 
    name: 'NodeMCU-32S (3MB Flash)', 
    fqbn: 'esp32:esp32:nodemcu-32s:PartitionScheme=huge_app', 
    platform: 'esp32', 
    family: 'ESP32' 
  },
  { 
    name: 'ESP32-CAM (3MB Flash)', 
    fqbn: 'esp32:esp32:esp32cam:PartitionScheme=huge_app', 
    platform: 'esp32', 
    family: 'ESP32' 
  },
  { 
    name: 'Arduino Nano ESP32 (3MB Flash)', 
    fqbn: 'arduino:esp32:nano_nora:PartitionScheme=huge_app', 
    platform: 'esp32', 
    family: 'ESP32' 
  },
  
  // Família Arduino AVR Oficial
  { name: 'Arduino Uno', fqbn: 'arduino:avr:uno', platform: 'avr', family: 'Arduino' },
  { name: 'Arduino Nano (ATmega328P)', fqbn: 'arduino:avr:nano:cpu=atmega328', platform: 'avr', family: 'Arduino' },
  { name: 'Arduino Nano (Old Bootloader)', fqbn: 'arduino:avr:nano:cpu=atmega328old', platform: 'avr', family: 'Arduino' },
  { name: 'Arduino Mega 2560', fqbn: 'arduino:avr:mega:cpu=atmega2560', platform: 'avr', family: 'Arduino' },
  { name: 'Arduino Pro or Pro Mini', fqbn: 'arduino:avr:pro', platform: 'avr', family: 'Arduino' },
  { name: 'Arduino Leonardo', fqbn: 'arduino:avr:leonardo', platform: 'avr', family: 'Arduino' },
  
  // Outros
  { name: 'ESP8266 Generic / NodeMCU', fqbn: 'esp8266:esp8266:generic', platform: 'other', family: 'ESP8266' },
  { name: 'Raspberry Pi Pico (RP2040)', fqbn: 'rp2040:rp2040:rpipico', platform: 'other', family: 'Raspberry Pi' }
];

export interface GitLibraryInfo {
  repoUrl: string;
  zipUrl: string;
  displayName: string;
  dependencies?: string[];
}

// Mapeamento de bibliotecas externas / GitHub que não estão no índice padrão ou precisam de download direto
export const GITHUB_LIBRARY_MAP: { [headerOrName: string]: GitLibraryInfo } = {
  'BleKeyboard.h': {
    repoUrl: 'https://github.com/T-vK/ESP32-BLE-Keyboard.git',
    zipUrl: 'https://github.com/T-vK/ESP32-BLE-Keyboard/archive/refs/heads/master.zip',
    displayName: 'ESP32-BLE-Keyboard',
    dependencies: ['NimBLE-Arduino']
  },
  'ESP32-BLE-Keyboard': {
    repoUrl: 'https://github.com/T-vK/ESP32-BLE-Keyboard.git',
    zipUrl: 'https://github.com/T-vK/ESP32-BLE-Keyboard/archive/refs/heads/master.zip',
    displayName: 'ESP32-BLE-Keyboard',
    dependencies: ['NimBLE-Arduino']
  },
  'ESP32 BLE Keyboard': {
    repoUrl: 'https://github.com/T-vK/ESP32-BLE-Keyboard.git',
    zipUrl: 'https://github.com/T-vK/ESP32-BLE-Keyboard/archive/refs/heads/master.zip',
    displayName: 'ESP32-BLE-Keyboard',
    dependencies: ['NimBLE-Arduino']
  },
  'BleMouse.h': {
    repoUrl: 'https://github.com/T-vK/ESP32-BLE-Mouse.git',
    zipUrl: 'https://github.com/T-vK/ESP32-BLE-Mouse/archive/refs/heads/master.zip',
    displayName: 'ESP32-BLE-Mouse',
    dependencies: ['NimBLE-Arduino']
  },
  'ESP32-BLE-Mouse': {
    repoUrl: 'https://github.com/T-vK/ESP32-BLE-Mouse.git',
    zipUrl: 'https://github.com/T-vK/ESP32-BLE-Mouse/archive/refs/heads/master.zip',
    displayName: 'ESP32-BLE-Mouse',
    dependencies: ['NimBLE-Arduino']
  },
  'BleGamepad.h': {
    repoUrl: 'https://github.com/lemmingDev/ESP32-BLE-Gamepad.git',
    zipUrl: 'https://github.com/lemmingDev/ESP32-BLE-Gamepad/archive/refs/heads/master.zip',
    displayName: 'ESP32-BLE-Gamepad',
    dependencies: ['NimBLE-Arduino']
  },
  'ESP32-BLE-Gamepad': {
    repoUrl: 'https://github.com/lemmingDev/ESP32-BLE-Gamepad.git',
    zipUrl: 'https://github.com/lemmingDev/ESP32-BLE-Gamepad/archive/refs/heads/master.zip',
    displayName: 'ESP32-BLE-Gamepad',
    dependencies: ['NimBLE-Arduino']
  },
  'ESPAsyncWebServer.h': {
    repoUrl: 'https://github.com/me-no-dev/ESPAsyncWebServer.git',
    zipUrl: 'https://github.com/me-no-dev/ESPAsyncWebServer/archive/refs/heads/master.zip',
    displayName: 'ESPAsyncWebServer',
    dependencies: ['AsyncTCP']
  },
  'AsyncTCP.h': {
    repoUrl: 'https://github.com/me-no-dev/AsyncTCP.git',
    zipUrl: 'https://github.com/me-no-dev/AsyncTCP/archive/refs/heads/master.zip',
    displayName: 'AsyncTCP'
  },
  'ESPAsyncTCP.h': {
    repoUrl: 'https://github.com/me-no-dev/ESPAsyncTCP.git',
    zipUrl: 'https://github.com/me-no-dev/ESPAsyncTCP/archive/refs/heads/master.zip',
    displayName: 'ESPAsyncTCP'
  }
};

// Dicionário de headers famosos para seus nomes exatos no índice oficial do Arduino
export const POPULAR_HEADER_MAP: { [header: string]: string } = {
  // BLE & Bluetooth
  'BleKeyboard.h': 'ESP32-BLE-Keyboard',
  'HijelHID_BLEKeyboard.h': 'HijelHID_BLEKeyboard',
  'NimBLEDevice.h': 'NimBLE-Arduino',
  'NimBLEHIDDevice.h': 'NimBLE-Arduino',
  'NimBLEServer.h': 'NimBLE-Arduino',
  'NimBLEClient.h': 'NimBLE-Arduino',
  'NimBLEUtils.h': 'NimBLE-Arduino',
  'BLEDevice.h': 'ESP32 BLE Arduino',
  'BluetoothSerial.h': 'ESP32',
  
  // Displays & Gráficos
  'Adafruit_GFX.h': 'Adafruit GFX Library',
  'Adafruit_SSD1306.h': 'Adafruit SSD1306',
  'Adafruit_ST7735.h': 'Adafruit ST7735 and ST7789 Library',
  'Adafruit_ST7789.h': 'Adafruit ST7735 and ST7789 Library',
  'Adafruit_ILI9341.h': 'Adafruit ILI9341',
  'Adafruit_NeoPixel.h': 'Adafruit NeoPixel',
  'TFT_eSPI.h': 'TFT_eSPI',
  'U8g2lib.h': 'U8g2',
  'LiquidCrystal_I2C.h': 'LiquidCrystal I2C',
  'LiquidCrystal.h': 'LiquidCrystal',
  'FastLED.h': 'FastLED',
  'LedControl.h': 'LedControl',
  'MD_MAX72xx.h': 'MD_MAX72XX',
  'MD_Parola.h': 'MD_Parola',

  // Sensores
  'Adafruit_Sensor.h': 'Adafruit Unified Sensor',
  'Adafruit_BME280.h': 'Adafruit BME280 Library',
  'Adafruit_BMP280.h': 'Adafruit BMP280 Library',
  'Adafruit_MPU6050.h': 'Adafruit MPU6050',
  'DHT.h': 'DHT sensor library',
  'DHT_U.h': 'DHT sensor library',
  'dht.h': 'DHTlib',
  'DallasTemperature.h': 'DallasTemperature',
  'OneWire.h': 'OneWire',
  'RTClib.h': 'RTClib',
  'MPU6050.h': 'MPU6050',
  'MPU6050_tockn.h': 'MPU6050_tockn',
  'HX711.h': 'HX711',
  'VL53L0X.h': 'VL53L0X',
  'BH1750.h': 'BH1750',
  'MAX6675.h': 'max6675',
  'TinyGPS++.h': 'TinyGPSPlus',
  'TinyGPSPlus.h': 'TinyGPSPlus',

  // Rede, Web & IoT
  'ArduinoJson.h': 'ArduinoJson',
  'PubSubClient.h': 'PubSubClient',
  'ESPAsyncWebServer.h': 'ESPAsyncWebServer',
  'AsyncTCP.h': 'AsyncTCP',
  'ESPAsyncTCP.h': 'ESPAsyncTCP',
  'WiFiManager.h': 'WiFiManager',
  'BlynkSimpleEsp32.h': 'Blynk',
  'BlynkSimpleEthernet.h': 'Blynk',
  'UniversalTelegramBot.h': 'UniversalTelegramBot',
  'NTPClient.h': 'NTPClient',
  'WebSocketsServer.h': 'WebSockets',
  'WebSocketsClient.h': 'WebSockets',

  // Motores, Servos & Atuadores
  'Servo.h': 'Servo',
  'ESP32Servo.h': 'ESP32Servo',
  'AccelStepper.h': 'AccelStepper',
  'Stepper.h': 'Stepper',

  // Conectividade RF / Comunicação
  'RF24.h': 'RF24',
  'nRF24L01.h': 'RF24',
  'LoRa.h': 'LoRa',
  'RC522.h': 'MFRC522',
  'MFRC522.h': 'MFRC522',
  'SoftwareSerial.h': 'EspSoftwareSerial',

  // Utilidades
  'Encoder.h': 'Encoder',
  'RotaryEncoder.h': 'RotaryEncoder',
  'Bounce2.h': 'Bounce2',
  'SimpleTimer.h': 'SimpleTimer',
  'TaskScheduler.h': 'TaskScheduler',
  'Keypad.h': 'Keypad'
};

export class ArduinoCliService {
  private cliPath: string = '';
  private initialized: boolean = false;
  private cachedBoards: BoardOption[] | null = null;

  constructor() {}

  public getCliPath(): string {
    if (this.cliPath) {
      return this.cliPath;
    }
    this.cliPath = this.resolveCliPath();
    return this.cliPath;
  }

  private resolveCliPath(): string {
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    try {
      if (app && app.isPackaged) {
        const packagedBin = path.join(process.resourcesPath, 'bin', 'arduino-cli.exe');
        if (fs.existsSync(packagedBin)) return packagedBin;
        const appBin = path.join(process.resourcesPath, 'app', 'bin', 'arduino-cli.exe');
        if (fs.existsSync(appBin)) return appBin;
      }

      if (app && typeof app.getAppPath === 'function') {
        const archBinPath = path.join(app.getAppPath(), 'bin', arch, 'arduino-cli.exe');
        if (fs.existsSync(archBinPath)) return archBinPath;

        const localBinPath = path.join(app.getAppPath(), 'bin', 'arduino-cli.exe');
        if (fs.existsSync(localBinPath)) return localBinPath;
      }

      const exeDirBin = path.join(path.dirname(process.execPath), 'resources', 'bin', 'arduino-cli.exe');
      if (fs.existsSync(exeDirBin)) return exeDirBin;

      const appDataBin = path.join(os.homedir(), 'AppData', 'Local', 'ArduinoTurboIDE', 'bin', 'arduino-cli.exe');
      if (fs.existsSync(appDataBin)) return appDataBin;
    } catch (e) {
      console.warn('Erro ao resolver caminho do CLI:', e);
    }

    return 'arduino-cli';
  }

  public async checkStatus(): Promise<{ found: boolean; path: string; version: string; cores: string[]; indexes: string[] }> {
    const activeCli = this.getCliPath();
    try {
      const { stdout } = await execPromise(`"${activeCli}" version --format json`);
      const versionData = JSON.parse(stdout);
      
      const cores = await this.getInstalledCores();
      
      return {
        found: true,
        path: activeCli,
        version: versionData.VersionString || stdout.trim(),
        cores,
        indexes: ['https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json']
      };
    } catch (e: any) {
      diagnostics.logAppError(`Falha ao checar status do arduino-cli (${activeCli}): ${e.message}`);
      return {
        found: false,
        path: activeCli,
        version: 'Não detectado',
        cores: [],
        indexes: []
      };
    }
  }

  public clearBoardsCache(): void {
    this.cachedBoards = null;
  }

  public async listAllBoards(): Promise<BoardOption[]> {
    if (this.cachedBoards && this.cachedBoards.length > 0) {
      return this.cachedBoards;
    }

    const activeCli = this.getCliPath();
    const resultBoards: BoardOption[] = [...POPULAR_BOARDS];
    const seenFqbns = new Set<string>();

    for (const pb of POPULAR_BOARDS) {
      const parts = pb.fqbn.toLowerCase().split(':');
      if (parts.length >= 3) {
        seenFqbns.add(`${parts[0]}:${parts[1]}:${parts[2]}`);
      } else {
        seenFqbns.add(pb.fqbn.toLowerCase());
      }
    }

    try {
      const { stdout } = await execPromise(`"${activeCli}" board listall --format json`, {
        maxBuffer: 30 * 1024 * 1024
      });
      if (stdout && stdout.trim()) {
        const data = JSON.parse(stdout.trim());
        const rawBoards: any[] = Array.isArray(data) ? data : (data && Array.isArray(data.boards) ? data.boards : []);

        for (const item of rawBoards) {
          if (!item || !item.fqbn || !item.name) continue;
          const fqbn = String(item.fqbn).trim();
          const parts = fqbn.toLowerCase().split(':');
          const fqbnKey = parts.length >= 3 ? `${parts[0]}:${parts[1]}:${parts[2]}` : fqbn.toLowerCase();

          if (seenFqbns.has(fqbnKey)) continue;

          const fqbnLower = fqbn.toLowerCase();
          let platform = 'other';
          let family = 'Outros';

          if (fqbnLower.startsWith('esp32:')) {
            platform = 'esp32';
            family = 'ESP32';
          } else if (fqbnLower.startsWith('arduino:avr') || fqbnLower.startsWith('arduino:sam') || fqbnLower.startsWith('arduino:megaavr')) {
            platform = 'avr';
            family = 'Arduino';
          } else if (fqbnLower.startsWith('esp8266:')) {
            platform = 'esp8266';
            family = 'ESP8266';
          } else if (fqbnLower.startsWith('rp2040:')) {
            platform = 'rp2040';
            family = 'Raspberry Pi';
          } else if (item.platform?.metadata?.id) {
            const platId = String(item.platform.metadata.id).toLowerCase();
            if (platId.includes('esp32')) {
              platform = 'esp32';
              family = 'ESP32';
            } else if (platId.includes('avr') || platId.includes('arduino')) {
              platform = 'avr';
              family = 'Arduino';
            }
          }

          resultBoards.push({
            name: String(item.name).trim(),
            fqbn,
            platform,
            family
          });
          seenFqbns.add(fqbnKey);
        }
      }
      this.cachedBoards = resultBoards;
      return resultBoards;
    } catch (err: any) {
      console.warn('Aviso ao listar todas as placas via CLI:', err?.message);
      return POPULAR_BOARDS;
    }
  }

  public async ensureUnsafeInstallAllowed(): Promise<void> {
    const activeCli = this.getCliPath();
    try {
      await execPromise(`"${activeCli}" config set library.enable_unsafe_install true`);
    } catch (e) {
      console.warn('Aviso ao habilitar enable_unsafe_install:', e);
    }
  }

  public async initConfig(): Promise<void> {
    const activeCli = this.getCliPath();
    try {
      const esp32IndexUrl = 'https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json';
      await execPromise(`"${activeCli}" config init --overwrite`);
      await execPromise(`"${activeCli}" config add board_manager.additional_urls "${esp32IndexUrl}"`);
      await this.ensureUnsafeInstallAllowed();
      await execPromise(`"${activeCli}" core update-index`);
      this.initialized = true;
    } catch (e: any) {
      console.error('Falha ao inicializar config do arduino-cli:', e);
      diagnostics.logAppError(`Erro ao inicializar config: ${e.message}`);
    }
  }

  public async getInstalledCores(): Promise<string[]> {
    const activeCli = this.getCliPath();
    const result: string[] = [];

    // 1. Tentar via arduino-cli core list --format json
    try {
      const { stdout } = await execPromise(`"${activeCli}" core list --format json`);
      if (stdout && stdout.trim()) {
        const data = JSON.parse(stdout.trim());
        const list = Array.isArray(data) 
          ? data 
          : (data && Array.isArray(data.platforms) ? data.platforms : []);

        for (const item of list) {
          const id = item.id || item.ID || item.platform?.id;
          const version = item.installed_version || item.InstalledVersion || item.version;
          if (id) {
            result.push(version ? `${id} (${version})` : id);
          }
        }
      }
    } catch (e) {
      console.warn('Falha ao rodar arduino-cli core list:', e);
    }

    // 2. Fallback: Inspeção direta no sistema de arquivos caso o CLI tenha retornado vazio
    if (result.length === 0) {
      try {
        const home = os.homedir();
        const possibleDirs = [
          path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'Arduino15', 'packages'),
          path.join(home, '.arduino15', 'packages'),
          path.join(home, 'Library', 'Arduino15', 'packages')
        ];

        for (const base of possibleDirs) {
          if (fs.existsSync(base)) {
            // Verificar esp32
            const esp32Hardware = path.join(base, 'esp32', 'hardware', 'esp32');
            if (fs.existsSync(esp32Hardware)) {
              const versions = fs.readdirSync(esp32Hardware).filter(v => !v.startsWith('.'));
              const ver = versions.length > 0 ? versions[versions.length - 1] : '';
              result.push(ver ? `esp32:esp32 (${ver})` : 'esp32:esp32');
            }

            // Verificar avr
            const avrHardware = path.join(base, 'arduino', 'hardware', 'avr');
            if (fs.existsSync(avrHardware)) {
              const versions = fs.readdirSync(avrHardware).filter(v => !v.startsWith('.'));
              const ver = versions.length > 0 ? versions[versions.length - 1] : '';
              result.push(ver ? `arduino:avr (${ver})` : 'arduino:avr');
            }
          }
        }
      } catch (e) {
        console.warn('Falha no fallback de inspeção de packages:', e);
      }
    }

    return Array.from(new Set(result));
  }

  public async installCore(coreName: string, onOutput: (data: string) => void): Promise<boolean> {
    const activeCli = this.getCliPath();
    return new Promise((resolve) => {
      onOutput(`[INFO] Iniciando instalação/atualização do core: ${coreName}...\n`);
      const child = spawn(activeCli, ['core', 'install', coreName]);
      processManager.register(child);

      child.stdout.on('data', (data) => {
        const text = data.toString();
        onOutput(text);
        diagnostics.logCompilation(text);
      });

      child.stderr.on('data', (data) => {
        const text = data.toString();
        onOutput(text);
        diagnostics.logCompilation(`[STDERR] ${text}`);
      });

      child.on('close', (code) => {
        processManager.unregister(child);
        if (code === 0) {
          this.clearBoardsCache();
          onOutput(`\n[SUCESSO] Core ${coreName} instalado com sucesso!\n`);
          resolve(true);
        } else {
          onOutput(`\n[ERRO] Falha ao instalar o core ${coreName} (código ${code})\n`);
          resolve(false);
        }
      });
    });
  }

  /**
   * Extrai cabeçalhos ausentes (.h / .hpp) a partir dos logs do compilador
   */
  public extractMissingHeaders(compilerOutput: string): string[] {
    const missingHeaders = new Set<string>();

    const regexes = [
      /(?:fatal error|error):\s*['"<]?([a-zA-Z0-9_+\-./\\]+\.h(?:pp)?)['">]?\s*:\s*(?:No such file or directory|Arquivo ou diret[oó]rio n[aã]o encontrado)/gi,
      /(?:fatal error|error):\s*['"<]([a-zA-Z0-9_+\-./\\]+\.h(?:pp)?)['">]\s*file not found/gi,
      /#include\s*['"<]([a-zA-Z0-9_+\-./\\]+\.h(?:pp)?)['">]\s*[\r\n]+.*(?:fatal error|error)/gi
    ];

    for (const reg of regexes) {
      let match;
      while ((match = reg.exec(compilerOutput)) !== null) {
        if (match[1]) {
          const basename = path.basename(match[1]);
          missingHeaders.add(basename);
        }
      }
    }

    return Array.from(missingHeaders);
  }

  /**
   * Localiza, baixa e instala automaticamente bibliotecas faltantes detectadas no código
   */
  public async autoResolveMissingLibraries(
    missingHeaders: string[],
    onOutput: (data: string) => void
  ): Promise<boolean> {
    let anyInstalled = false;

    for (const header of missingHeaders) {
      onOutput(`\n========================================================================\n` +
        `⚡ [AUTO-HEALER]: Biblioteca ausente detectada: '<${header}>'\n` +
        `🔍 Buscando no índice do Arduino e repositórios compatíveis...\n` +
        `========================================================================\n`);

      // 1. Checar se existe mapeamento em GITHUB_LIBRARY_MAP (para bibliotecas externas / BLE / GitHub)
      const gitInfo = GITHUB_LIBRARY_MAP[header];
      if (gitInfo) {
        onOutput(`📦 Instalando '${gitInfo.displayName}' (compatível com <${header}>)...\n`);
        const installed = await this.installLibrary(gitInfo.zipUrl || gitInfo.repoUrl, onOutput);
        if (installed) {
          onOutput(`✔ [AUTO-HEALER]: '${gitInfo.displayName}' instalada com sucesso!\n`);
          anyInstalled = true;

          // Instalar dependências associadas se houver (ex: NimBLE-Arduino)
          if (gitInfo.dependencies && gitInfo.dependencies.length > 0) {
            for (const dep of gitInfo.dependencies) {
              onOutput(`📦 [AUTO-HEALER] Instalando dependência '${dep}'...\n`);
              await this.installLibrary(dep, onOutput);
            }
          }
          continue;
        }
      }

      // 2. Checar dicionário otimizado de cabeçalhos populares
      let targetLibName = POPULAR_HEADER_MAP[header];

      // 3. Se não estiver no mapa, buscar dinamicamente via CLI
      if (!targetLibName) {
        const cleanName = header.replace(/\.h(pp)?$/i, '');
        const searchResults = await this.searchLibraries(cleanName);
        if (searchResults && searchResults.length > 0) {
          const exactMatch = searchResults.find(l => l.name.toLowerCase() === cleanName.toLowerCase());
          targetLibName = exactMatch ? exactMatch.name : searchResults[0].name;
        }
      }

      if (targetLibName) {
        onOutput(`📦 Baixando e instalando automaticamente '${targetLibName}'...\n`);
        const installed = await this.installLibrary(targetLibName, onOutput);
        if (installed) {
          onOutput(`✔ [AUTO-HEALER]: '${targetLibName}' instalada com sucesso!\n`);
          anyInstalled = true;
        } else {
          onOutput(`❌ [AUTO-HEALER]: Falha ao instalar automaticamente '${targetLibName}'.\n`);
        }
      } else {
        onOutput(`⚠️ [AUTO-HEALER]: Nenhuma biblioteca pública encontrada para '<${header}>'.\n` +
          `💡 Dica: Verifique se o nome no #include está correto ou instale manualmente pelo Gerenciador.\n`);
      }
    }

    return anyInstalled;
  }

  /**
   * Corrige automaticamente incompatibilidades conhecidas de bibliotecas legadas com o ESP32 Core 3.x
   * (ex: std::string -> String no BLEDevice::init e BLECharacteristic::setValue)
   */
  public patchLegacyLibrariesForCore3(): void {
    try {
      const home = os.homedir();
      const userProfile = process.env.USERPROFILE || home;
      const possibleDirs = [
        path.join(userProfile, 'Documents', 'Arduino', 'libraries'),
        path.join(home, 'Documents', 'Arduino', 'libraries'),
        path.join(home, 'Arduino', 'libraries')
      ];

      for (const libBase of possibleDirs) {
        if (!fs.existsSync(libBase)) continue;

        // 1. ESP32_BLE_Keyboard / ESP32-BLE-Keyboard
        const bleKbDirs = ['ESP32_BLE_Keyboard', 'ESP32-BLE-Keyboard', 'BleKeyboard'];
        for (const dirName of bleKbDirs) {
          const cppFile = path.join(libBase, dirName, 'BleKeyboard.cpp');
          if (fs.existsSync(cppFile)) {
            let content = fs.readFileSync(cppFile, 'utf-8');
            let modified = false;

            if (content.includes('BLEDevice::init(deviceName)') || /BLEDevice::init\s*\(\s*deviceName\s*\)/.test(content)) {
              content = content.replace(/BLEDevice::init\s*\(\s*deviceName\s*\)/g, 'BLEDevice::init(String(deviceName.c_str()))');
              modified = true;
            }
            if (content.includes('hid->manufacturer()->setValue(deviceManufacturer)') || /hid->manufacturer\(\)->setValue\s*\(\s*deviceManufacturer\s*\)/.test(content)) {
              content = content.replace(/hid->manufacturer\(\)->setValue\s*\(\s*deviceManufacturer\s*\)/g, 'hid->manufacturer()->setValue(String(deviceManufacturer.c_str()))');
              modified = true;
            }

            if (modified) {
              fs.writeFileSync(cppFile, content, 'utf-8');
            }
          }
        }

        // 2. ESP32_BLE_Mouse / ESP32-BLE-Mouse
        const bleMouseDirs = ['ESP32_BLE_Mouse', 'ESP32-BLE-Mouse', 'BleMouse'];
        for (const dirName of bleMouseDirs) {
          const cppFile = path.join(libBase, dirName, 'BleMouse.cpp');
          if (fs.existsSync(cppFile)) {
            let content = fs.readFileSync(cppFile, 'utf-8');
            let modified = false;

            if (content.includes('BLEDevice::init(deviceName)') || /BLEDevice::init\s*\(\s*deviceName\s*\)/.test(content)) {
              content = content.replace(/BLEDevice::init\s*\(\s*deviceName\s*\)/g, 'BLEDevice::init(String(deviceName.c_str()))');
              modified = true;
            }
            if (content.includes('hid->manufacturer()->setValue(deviceManufacturer)') || /hid->manufacturer\(\)->setValue\s*\(\s*deviceManufacturer\s*\)/.test(content)) {
              content = content.replace(/hid->manufacturer\(\)->setValue\s*\(\s*deviceManufacturer\s*\)/g, 'hid->manufacturer()->setValue(String(deviceManufacturer.c_str()))');
              modified = true;
            }

            if (modified) {
              fs.writeFileSync(cppFile, content, 'utf-8');
            }
          }
        }
      }
    } catch (e) {
      console.warn('Aviso ao executar patchLegacyLibrariesForCore3:', e);
    }
  }

  public injectPartitionScheme(fqbn: string, scheme: string): string {
    if (!fqbn || !fqbn.includes('esp32') || !scheme) return fqbn;

    if (/PartitionScheme=[^,:]+/i.test(fqbn)) {
      return fqbn.replace(/PartitionScheme=[^,:]+/i, `PartitionScheme=${scheme}`);
    }

    const colonCount = (fqbn.match(/:/g) || []).length;
    if (colonCount >= 3) {
      return `${fqbn},PartitionScheme=${scheme}`;
    } else if (colonCount === 2) {
      return `${fqbn}:PartitionScheme=${scheme}`;
    }
    return fqbn;
  }

  public async compile(
    sketchCode: string,
    fqbn: string,
    onOutput: (data: string) => void,
    attempt: number = 0
  ): Promise<{ success: boolean; buildDir: string }> {
    const activeCli = this.getCliPath();
    this.patchLegacyLibrariesForCore3();
    
    fs.mkdirSync(TURBO_SKETCH_DIR, { recursive: true });
    fs.mkdirSync(TURBO_BUILD_DIR, { recursive: true });

    // Limpar arquivos auxiliares antigos para evitar lixo de sketches anteriores
    try {
      const existing = fs.readdirSync(TURBO_SKETCH_DIR);
      for (const f of existing) {
        if (f !== 'arduino_turbo_sketch.ino') {
          fs.rmSync(path.join(TURBO_SKETCH_DIR, f), { recursive: true, force: true });
        }
      }
    } catch {}

    const inoPath = path.join(TURBO_SKETCH_DIR, 'arduino_turbo_sketch.ino');
    fs.writeFileSync(inoPath, sketchCode, 'utf-8');

    const numJobs = String(Math.max(4, os.cpus()?.length || 4));
    onOutput(`[COMPILAÇÃO TURBO] Iniciando (${numJobs} threads paralelas) para FQBN: ${fqbn}...\n`);
    diagnostics.logCompilation(`Compilando FQBN: ${fqbn} (${numJobs} threads)`);

    let fullOutput = '';

    return new Promise((resolve) => {
      const startTime = Date.now();
      const child = spawn(activeCli, [
        'compile',
        '--fqbn', fqbn,
        '--jobs', numJobs,
        '--build-path', TURBO_BUILD_DIR,
        '--warnings', 'none',
        TURBO_SKETCH_DIR
      ]);
      processManager.register(child);

      child.stdout.on('data', (data) => {
        const text = data.toString();
        fullOutput += text;
        onOutput(text);
        diagnostics.logCompilation(text);
      });

      child.stderr.on('data', (data) => {
        const text = data.toString();
        fullOutput += text;
        onOutput(text);
        diagnostics.logCompilation(`[ERRO] ${text}`);
      });

      child.on('close', async (code) => {
        processManager.unregister(child);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        const hasFatal = /error:|fatal error|exit status [1-9]/i.test(fullOutput);

        if (code === 0 && !hasFatal) {
          onOutput(`\n✔ [SUCESSO] Compilação turbo concluída em ${elapsed}s!\n`);
          diagnostics.logCompilation(`Compilação turbo bem-sucedida em ${elapsed}s`);
          resolve({ success: true, buildDir: TURBO_BUILD_DIR });
        } else {
          // Auto-Healer 1: Verificar se houve estouro de partição da memória Flash no ESP32
          const isFlashOverflow = /text section exceeds available space|exceeds available space in board|section `\.iram0\.text' will not fit|region `iram0_0_seg' overflowed/i.test(fullOutput);
          if (isFlashOverflow && fqbn.includes('esp32') && !fqbn.includes('PartitionScheme=huge_app') && attempt < 3) {
            const hugeAppFqbn = this.injectPartitionScheme(fqbn, 'huge_app');
            onOutput(`\n=================================================================\n` +
              `🚀 [AUTO-HEALER]: Detectado estouro de partição padrão da Flash (App > 1.3MB)!\n` +
              `🔧 [AUTO-HEALER]: Expandindo automaticamente para Partição 'Huge App' (3.14MB livres de Flash)...\n` +
              `🔄 [AUTO-HEALER]: Recompilando com FQBN Otimizado: ${hugeAppFqbn}...\n` +
              `=================================================================\n\n`);
            diagnostics.logCompilation(`Auto-Healer acionado: Flash Overflow expandido para huge_app`);
            const retryResult = await this.compile(sketchCode, hugeAppFqbn, onOutput, attempt + 1);
            resolve(retryResult);
            return;
          }

          // Auto-Healer 2: Verificar se há bibliotecas faltantes e instalar automaticamente
          const missingHeaders = this.extractMissingHeaders(fullOutput);
          if (missingHeaders.length > 0 && attempt < 3) {
            onOutput(`\n🔄 [AUTO-HEALER] Tentativa ${attempt + 1}/3 de resolução automática de dependências...\n`);
            const resolved = await this.autoResolveMissingLibraries(missingHeaders, onOutput);
            if (resolved) {
              onOutput(`\n🔄 [AUTO-HEALER] Recompilando o sketch após instalar as dependências...\n\n`);
              const retryResult = await this.compile(sketchCode, fqbn, onOutput, attempt + 1);
              resolve(retryResult);
              return;
            }
          }

          onOutput(`\n❌ [FALHA] Erro na compilação (Código ${code}) após ${elapsed}s.\n`);
          diagnostics.logCompilation(`Falha na compilação (código ${code})`);
          resolve({ success: false, buildDir: TURBO_BUILD_DIR });
        }
      });
    });
  }

  public async upload(
    buildDir: string,
    fqbn: string,
    port: string,
    onOutput: (data: string) => void
  ): Promise<boolean> {
    const isEsp32 = fqbn.toLowerCase().includes('esp32');
    const inputDir = fs.existsSync(buildDir) ? buildDir : TURBO_BUILD_DIR;

    // Se for placa da família ESP32, priorizar o flasher nativo ARM64
    if (isEsp32) {
      try {
        const flasherResult = await nativeFlasher.uploadEsp32(inputDir, fqbn, port, onOutput);
        if (flasherResult.success) {
          return true;
        }
        if (!flasherResult.fallbackNeeded) {
          return false;
        }
        onOutput(`\n[AVISO]: Acionando pipeline do arduino-cli como contingência...\n`);
      } catch (err: any) {
        diagnostics.logUpload(`[NativeFlasher] Exceção na gravação: ${err.message}. Alternando para arduino-cli...`);
      }
    }

    const activeCli = this.getCliPath();
    onOutput(`[GRAVAÇÃO TURBO] Enviando código em alta velocidade para ${port} (${fqbn})...\n`);
    diagnostics.logUpload(`Upload turbo iniciado na porta ${port} para ${fqbn}`);

    let fullOutput = '';

    return new Promise((resolve) => {
      const startTime = Date.now();
      const child = spawn(activeCli, [
        'upload',
        '-p', port,
        '--fqbn', fqbn,
        '--upload-property', 'upload.speed=921600',
        '--input-dir', inputDir
      ]);
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

        const hasFatalError = /A fatal error occurred|Failed uploading|Error during upload|Cannot open DFU|Permission denied|exit status [1-9]/i.test(fullOutput);

        if (code === 0 && !hasFatalError) {
          onOutput(`\n✔ [SUCESSO] Código gravado na placa com sucesso em ${elapsed}s!\n`);
          diagnostics.logUpload(`Upload bem-sucedido em ${elapsed}s`);
          resolve(true);
        } else {
          onOutput(`\n❌ [FALHA] Erro no envio para a placa (Código ${code}). Verifique a porta COM e se a placa está em modo de gravação.\n`);
          diagnostics.logUpload(`Falha no upload (código ${code})`);
          resolve(false);
        }
      });
    });
  }
  public async searchLibraries(query: string): Promise<any[]> {
    const activeCli = this.getCliPath();
    try {
      const q = query.trim() || 'esp';
      const { stdout } = await execPromise(`"${activeCli}" lib search "${q}" --format json`);
      const data = JSON.parse(stdout);
      if (data && Array.isArray(data.libraries)) {
        return data.libraries.slice(0, 40).map((lib: any) => ({
          name: lib.name,
          author: lib.author,
          maintainer: lib.maintainer,
          sentence: lib.sentence || lib.paragraph || 'Sem descrição',
          website: lib.website,
          category: lib.category || 'Geral',
          latestVersion: lib.latest?.version || '1.0.0',
          types: lib.types || []
        }));
      }
      return [];
    } catch (e: any) {
      diagnostics.logAppError(`Erro ao buscar bibliotecas (${query}): ${e.message}`);
      return [];
    }
  }

  public async getInstalledLibraries(): Promise<any[]> {
    const activeCli = this.getCliPath();
    try {
      const { stdout } = await execPromise(`"${activeCli}" lib list --format json`);
      const data = JSON.parse(stdout);
      if (data && Array.isArray(data.installed_libraries)) {
        return data.installed_libraries.map((item: any) => ({
          name: item.library?.name || item.name,
          version: item.library?.version || item.version || 'Instalada',
          author: item.library?.author || item.author,
          sentence: item.library?.sentence || item.sentence || '',
          location: item.library?.location || item.location,
          isLegacy: false
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  public async installLibrary(libTarget: string, onOutput: (data: string) => void): Promise<boolean> {
    await this.ensureUnsafeInstallAllowed();

    // 1. Caso seja uma URL Git ou arquivo Zip direto
    const isUrl = /^https?:\/\//i.test(libTarget) || libTarget.endsWith('.git');
    const isZip = /\.zip($|\?)/i.test(libTarget);

    if (isUrl) {
      if (isZip || libTarget.includes('/archive/')) {
        // Baixar zip e instalar via --zip-path
        return this.installZipLibraryFromUrl(libTarget, onOutput);
      }

      // Tentar via --git-url
      onOutput(`[INFO] Instalando repositório Git: ${libTarget}...\n`);
      const gitResult = await this.runCliCommand(['lib', 'install', '--git-url', libTarget], onOutput);
      if (gitResult) {
        onOutput(`\n✔ [SUCESSO] Repositório Git instalado com sucesso!\n`);
        return true;
      }

      // Se falhar via git-url (ex: sem git instalado), tentar fallback baixando o ZIP do GitHub
      if (libTarget.includes('github.com')) {
        const repoClean = libTarget.replace(/\.git$/i, '').replace(/\/$/, '');
        const zipMasterUrl = `${repoClean}/archive/refs/heads/master.zip`;
        const zipMainUrl = `${repoClean}/archive/refs/heads/main.zip`;

        onOutput(`[INFO] Tentando download direto do pacote ZIP do GitHub...\n`);
        const zipMasterSuccess = await this.installZipLibraryFromUrl(zipMasterUrl, onOutput);
        if (zipMasterSuccess) return true;

        const zipMainSuccess = await this.installZipLibraryFromUrl(zipMainUrl, onOutput);
        if (zipMainSuccess) return true;
      }

      return false;
    }

    // 2. Verificar se o nome informado possui mapeamento Git dedicado
    const gitInfo = GITHUB_LIBRARY_MAP[libTarget] || GITHUB_LIBRARY_MAP[`${libTarget}.h`];
    if (gitInfo) {
      onOutput(`[INFO] Biblioteca '${libTarget}' localizada no repositório GitHub (${gitInfo.displayName})...\n`);
      if (gitInfo.zipUrl) {
        const zipSuccess = await this.installZipLibraryFromUrl(gitInfo.zipUrl, onOutput);
        if (zipSuccess) {
          if (gitInfo.dependencies && gitInfo.dependencies.length > 0) {
            for (const dep of gitInfo.dependencies) {
              await this.installLibrary(dep, onOutput);
            }
          }
          return true;
        }
      }
      if (gitInfo.repoUrl) {
        const gitSuccess = await this.installLibrary(gitInfo.repoUrl, onOutput);
        if (gitSuccess) {
          if (gitInfo.dependencies && gitInfo.dependencies.length > 0) {
            for (const dep of gitInfo.dependencies) {
              await this.installLibrary(dep, onOutput);
            }
          }
          return true;
        }
      }
    }

    // 3. Tentar instalação padrão via nome no índice oficial do Arduino
    onOutput(`[INFO] Baixando e instalando biblioteca: ${libTarget}...\n`);
    const standardSuccess = await this.runCliCommand(['lib', 'install', libTarget], onOutput);
    if (standardSuccess) {
      onOutput(`\n✔ [SUCESSO] Biblioteca '${libTarget}' instalada e pronta para uso!\n`);
      return true;
    }

    // 4. Se falhou pelo nome exato, tentar busca no índice por palavras-chave similares
    onOutput(`🔍 Tentando busca dinâmica no índice de bibliotecas para '${libTarget}'...\n`);
    const cleanSearch = libTarget.replace(/[-_]/g, ' ').trim();
    const searchResults = await this.searchLibraries(cleanSearch);
    if (searchResults && searchResults.length > 0) {
      const candidate = searchResults[0].name;
      if (candidate.toLowerCase() !== libTarget.toLowerCase()) {
        onOutput(`📦 Tentando instalar candidata compatível encontrada: '${candidate}'...\n`);
        const candidateSuccess = await this.runCliCommand(['lib', 'install', candidate], onOutput);
        if (candidateSuccess) {
          onOutput(`\n✔ [SUCESSO] Biblioteca candidata '${candidate}' instalada com sucesso!\n`);
          return true;
        }
      }
    }

    onOutput(`\n❌ [ERRO] Falha ao instalar biblioteca '${libTarget}'.\n`);
    return false;
  }

  private async installZipLibraryFromUrl(
    zipUrl: string,
    onOutput: (data: string) => void
  ): Promise<boolean> {
    const tempZip = path.join(os.tmpdir(), `arduino_lib_${Date.now()}_${Math.floor(Math.random() * 1000)}.zip`);

    try {
      onOutput(`📥 Baixando pacote ZIP: ${zipUrl}...\n`);
      await downloadFile(zipUrl, tempZip);
      
      onOutput(`📦 Instalando pacote ZIP na IDE...\n`);
      const success = await this.runCliCommand(['lib', 'install', '--zip-path', tempZip], onOutput);
      if (success) {
        this.patchLegacyLibrariesForCore3();
        onOutput(`\n✔ [SUCESSO] Pacote ZIP instalado com sucesso!\n`);
      }
      return success;
    } catch (e: any) {
      onOutput(`[AVISO] Falha ao baixar/instalar via ZIP: ${e.message}\n`);
      return false;
    } finally {
      try {
        if (fs.existsSync(tempZip)) {
          fs.rmSync(tempZip, { force: true });
        }
      } catch {}
    }
  }

  private runCliCommand(args: string[], onOutput: (data: string) => void): Promise<boolean> {
    const activeCli = this.getCliPath();
    return new Promise((resolve) => {
      const child = spawn(activeCli, args);
      processManager.register(child);

      child.stdout.on('data', (data) => {
        const text = data.toString();
        onOutput(text);
        diagnostics.logCompilation(text);
      });

      child.stderr.on('data', (data) => {
        const text = data.toString();
        onOutput(text);
        diagnostics.logCompilation(`[STDERR] ${text}`);
      });

      child.on('close', (code) => {
        processManager.unregister(child);
        resolve(code === 0);
      });
    });
  }

  public async uninstallLibrary(libName: string, onOutput: (data: string) => void): Promise<boolean> {
    const activeCli = this.getCliPath();
    return new Promise((resolve) => {
      onOutput(`[INFO] Desinstalando biblioteca: ${libName}...\n`);
      const child = spawn(activeCli, ['lib', 'uninstall', libName]);
      processManager.register(child);

      child.stdout.on('data', (data) => onOutput(data.toString()));
      child.stderr.on('data', (data) => onOutput(data.toString()));

      child.on('close', (code) => {
        processManager.unregister(child);
        if (code === 0) {
          onOutput(`\n✔ [SUCESSO] Biblioteca '${libName}' desinstalada.\n`);
          resolve(true);
        } else {
          onOutput(`\n❌ [ERRO] Falha ao desinstalar '${libName}' (código ${code})\n`);
          resolve(false);
        }
      });
    });
  }

  public async compileMultiFiles(
    files: { name: string; content: string }[],
    fqbn: string,
    onOutput: (data: string) => void,
    attempt: number = 0
  ): Promise<{ success: boolean; buildDir: string }> {
    const activeCli = this.getCliPath();
    this.patchLegacyLibrariesForCore3();

    fs.mkdirSync(TURBO_SKETCH_DIR, { recursive: true });
    fs.mkdirSync(TURBO_BUILD_DIR, { recursive: true });

    // Sincronizar arquivos: remover arquivos que não estão mais na lista de abas
    try {
      const activeFileNames = new Set(files.map(f => f.name.endsWith('.ino') ? 'arduino_turbo_sketch.ino' : f.name));
      const existing = fs.readdirSync(TURBO_SKETCH_DIR);
      for (const f of existing) {
        if (!activeFileNames.has(f)) {
          fs.rmSync(path.join(TURBO_SKETCH_DIR, f), { recursive: true, force: true });
        }
      }
    } catch {}

    // Identificar arquivo principal (.ino) ou salvar todos
    const mainIno = files.find(f => f.name.endsWith('.ino')) || files[0];
    const mainInoPath = path.join(TURBO_SKETCH_DIR, 'arduino_turbo_sketch.ino');
    fs.writeFileSync(mainInoPath, mainIno ? mainIno.content : '', 'utf-8');

    // Salvar arquivos adicionais (.h, .cpp, .c, etc.)
    for (const file of files) {
      if (file !== mainIno) {
        const filePath = path.join(TURBO_SKETCH_DIR, file.name);
        fs.writeFileSync(filePath, file.content, 'utf-8');
      }
    }

    const numJobs = String(Math.max(4, os.cpus()?.length || 4));
    onOutput(`[COMPILAÇÃO TURBO MULTI-ABAS] ${files.length} arquivo(s) (${numJobs} threads paralelas) para FQBN: ${fqbn}...\n`);
    for (const f of files) {
      onOutput(`  📁 Incluído: ${f.name}\n`);
    }

    let fullOutput = '';

    return new Promise((resolve) => {
      const startTime = Date.now();
      const child = spawn(activeCli, [
        'compile',
        '--fqbn', fqbn,
        '--jobs', numJobs,
        '--build-path', TURBO_BUILD_DIR,
        '--warnings', 'none',
        TURBO_SKETCH_DIR
      ]);
      processManager.register(child);

      child.stdout.on('data', (data) => {
        const text = data.toString();
        fullOutput += text;
        onOutput(text);
        diagnostics.logCompilation(text);
      });

      child.stderr.on('data', (data) => {
        const text = data.toString();
        fullOutput += text;
        onOutput(text);
        diagnostics.logCompilation(`[ERRO] ${text}`);
      });

      child.on('close', async (code) => {
        processManager.unregister(child);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        const hasFatal = /error:|fatal error|exit status [1-9]/i.test(fullOutput);

        if (code === 0 && !hasFatal) {
          onOutput(`\n✔ [SUCESSO] Compilação multi-abas turbo concluída em ${elapsed}s!\n`);
          diagnostics.logCompilation(`Compilação multi-abas turbo bem-sucedida em ${elapsed}s`);
          resolve({ success: true, buildDir: TURBO_BUILD_DIR });
        } else {
          // Auto-Healer 1: Verificar se houve estouro de partição da memória Flash no ESP32
          const isFlashOverflow = /text section exceeds available space|exceeds available space in board|section `\.iram0\.text' will not fit|region `iram0_0_seg' overflowed/i.test(fullOutput);
          if (isFlashOverflow && fqbn.includes('esp32') && !fqbn.includes('PartitionScheme=huge_app') && attempt < 3) {
            const hugeAppFqbn = this.injectPartitionScheme(fqbn, 'huge_app');
            onOutput(`\n=================================================================\n` +
              `🚀 [AUTO-HEALER]: Detectado estouro de partição padrão da Flash (App > 1.3MB)!\n` +
              `🔧 [AUTO-HEALER]: Expandindo automaticamente para Partição 'Huge App' (3.14MB livres de Flash)...\n` +
              `🔄 [AUTO-HEALER]: Recompilando com FQBN Otimizado: ${hugeAppFqbn}...\n` +
              `=================================================================\n\n`);
            diagnostics.logCompilation(`Auto-Healer acionado: Flash Overflow expandido para huge_app`);
            const retryResult = await this.compileMultiFiles(files, hugeAppFqbn, onOutput, attempt + 1);
            resolve(retryResult);
            return;
          }

          // Auto-Healer 2: Verificar se há bibliotecas faltantes e instalar automaticamente
          const missingHeaders = this.extractMissingHeaders(fullOutput);
          if (missingHeaders.length > 0 && attempt < 3) {
            onOutput(`\n🔄 [AUTO-HEALER] Tentativa ${attempt + 1}/3 de resolução automática de dependências...\n`);
            const resolved = await this.autoResolveMissingLibraries(missingHeaders, onOutput);
            if (resolved) {
              onOutput(`\n🔄 [AUTO-HEALER] Recompilando o projeto multi-abas após instalar as dependências...\n\n`);
              const retryResult = await this.compileMultiFiles(files, fqbn, onOutput, attempt + 1);
              resolve(retryResult);
              return;
            }
          }

          onOutput(`\n❌ [FALHA] Erro na compilação (Código ${code}) após ${elapsed}s.\n`);
          diagnostics.logCompilation(`Falha na compilação multi-abas (código ${code})`);
          resolve({ success: false, buildDir: TURBO_BUILD_DIR });
        }
      });
    });
  }

  public async exportBinary(
    files: { name: string; content: string }[],
    fqbn: string,
    targetOutputDir: string,
    onOutput: (data: string) => void
  ): Promise<{ success: boolean; filePath: string }> {
    const activeCli = this.getCliPath();
    const tempDir = path.join(os.tmpdir(), 'arduino_turbo_export_' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });

    const sketchName = path.basename(tempDir);
    const mainIno = files.find(f => f.name.endsWith('.ino')) || files[0];
    fs.writeFileSync(path.join(tempDir, `${sketchName}.ino`), mainIno ? mainIno.content : '', 'utf-8');

    for (const file of files) {
      if (file !== mainIno) {
        fs.writeFileSync(path.join(tempDir, file.name), file.content, 'utf-8');
      }
    }

    fs.mkdirSync(targetOutputDir, { recursive: true });

    onOutput(`[EXPORTAÇÃO] Compilando e gerando binário final em ${targetOutputDir}...\n`);

    return new Promise((resolve) => {
      const child = spawn(activeCli, [
        'compile',
        '--fqbn', fqbn,
        '--output-dir', targetOutputDir,
        tempDir
      ]);
      processManager.register(child);

      child.stdout.on('data', (data) => onOutput(data.toString()));
      child.stderr.on('data', (data) => onOutput(data.toString()));

      child.on('close', (code) => {
        processManager.unregister(child);
        if (code === 0) {
          onOutput(`\n✔ [SUCESSO] Binário compilado exportado com sucesso para:\n📁 ${targetOutputDir}\n`);
          resolve({ success: true, filePath: targetOutputDir });
        } else {
          onOutput(`\n❌ [FALHA] Erro ao exportar binário (Código ${code}).\n`);
          resolve({ success: false, filePath: '' });
        }
      });
    });
  }

  public async getBoardDebugInfo(fqbn: string): Promise<any> {
    const activeCli = this.getCliPath();
    try {
      const { stdout } = await execPromise(`"${activeCli}" board details -b ${fqbn} --format json`);
      const data = JSON.parse(stdout);
      return {
        name: data.name || fqbn,
        fqbn: data.fqbn || fqbn,
        debuggingSupported: data.debugging_supported || false,
        programmers: data.programmers || [],
        configOptions: data.config_options || []
      };
    } catch (e: any) {
      return {
        name: fqbn,
        fqbn,
        debuggingSupported: fqbn.includes('esp32') || fqbn.includes('samd') || fqbn.includes('rp2040'),
        programmers: [],
        configOptions: []
      };
    }
  }
}

export const arduinoCliService = new ArduinoCliService();
