import os from 'os';
import fs from 'fs';

export interface SystemTip {
  title: string;
  description: string;
  category: 'driver' | 'performance' | 'port' | 'system';
}

export interface SystemProfile {
  platform: string;
  osName: string;
  release: string;
  arch: string;
  processArch: string;
  cpuModel: string;
  totalMemGB: string;
  freeMemGB: string;
  deviceCategory: 'windows_x64' | 'windows_arm64' | 'windows_x86' | 'linux_raspberry' | 'linux_arm' | 'linux_x64' | 'macos_arm64' | 'macos_x64';
  tagLabel: string;
  deviceName: string;
  isArmNative: boolean;
  tips: SystemTip[];
}

export function detectSystemProfile(): SystemProfile {
  const platform = os.platform(); // 'win32', 'linux', 'darwin'
  const release = os.release();
  const arch = os.arch();
  const processArch = process.arch;
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? `${cpus[0].model} (${cpus.length} cores)` : 'Processador Desconhecido';
  const totalMemGB = (os.totalmem() / (1024 ** 3)).toFixed(2) + ' GB';
  const freeMemGB = (os.freemem() / (1024 ** 3)).toFixed(2) + ' GB';

  let osName = 'Sistema Operacional';
  let deviceCategory: SystemProfile['deviceCategory'] = 'windows_x64';
  let tagLabel = 'Windows x64';
  let deviceName = 'Computador Desktop / Notebook';
  let isRaspberry = false;
  let isArmNative = processArch === 'arm64' || process.env.PROCESSOR_ARCHITECTURE === 'ARM64';

  // 1. Identificar Linux / Raspberry Pi
  if (platform === 'linux') {
    let linuxDistro = 'Linux';
    try {
      if (fs.existsSync('/etc/os-release')) {
        const content = fs.readFileSync('/etc/os-release', 'utf-8');
        const match = content.match(/PRETTY_NAME="([^"]+)"/);
        if (match) linuxDistro = match[1];
      }
    } catch {}

    // Checar se é Raspberry Pi
    try {
      if (fs.existsSync('/proc/device-tree/model')) {
        const modelContent = fs.readFileSync('/proc/device-tree/model', 'utf-8');
        if (modelContent.toLowerCase().includes('raspberry pi')) {
          isRaspberry = true;
          deviceName = modelContent.replace(/\0/g, '').trim();
        }
      }
    } catch {}

    if (!isRaspberry && (cpuModel.toLowerCase().includes('bcm283') || cpuModel.toLowerCase().includes('bcm271'))) {
      isRaspberry = true;
      deviceName = 'Raspberry Pi Single Board Computer';
    }

    if (isRaspberry) {
      deviceCategory = 'linux_raspberry';
      osName = linuxDistro.includes('Raspbian') ? linuxDistro : `Raspberry Pi OS (${linuxDistro})`;
      tagLabel = `Raspberry Pi (${processArch})`;
    } else if (processArch === 'arm64' || processArch === 'arm') {
      deviceCategory = 'linux_arm';
      osName = `${linuxDistro} (ARM)`;
      tagLabel = `Linux ARM (${processArch})`;
      deviceName = 'Dispositivo Linux ARM / SBC';
    } else {
      deviceCategory = 'linux_x64';
      osName = `${linuxDistro} (x64)`;
      tagLabel = 'Linux x64';
      deviceName = 'Computador Linux x64';
    }
  } 
  // 2. Identificar macOS
  else if (platform === 'darwin') {
    const isAppleSilicon = processArch === 'arm64';
    deviceCategory = isAppleSilicon ? 'macos_arm64' : 'macos_x64';
    osName = isAppleSilicon ? 'macOS (Apple Silicon)' : 'macOS (Intel)';
    tagLabel = isAppleSilicon ? 'macOS ARM64' : 'macOS x64';
    deviceName = isAppleSilicon ? 'Mac (Apple Silicon M-Series)' : 'Mac (Intel Core)';
  } 
  // 3. Identificar Windows (11, 10, ARM64, x64, x86)
  else if (platform === 'win32') {
    const buildNumber = parseInt(release.split('.')[2] || '0', 10);
    const isWin11 = buildNumber >= 22000;
    const isWin10 = buildNumber >= 10240 && buildNumber < 22000;
    const baseWinName = isWin11 ? 'Windows 11' : isWin10 ? 'Windows 10' : 'Windows';

    const isArmWindows = processArch === 'arm64' || process.env.PROCESSOR_ARCHITECTURE === 'ARM64' || cpuModel.toLowerCase().includes('snapdragon') || cpuModel.toLowerCase().includes('qualcomm');

    if (isArmWindows) {
      deviceCategory = 'windows_arm64';
      osName = `${baseWinName} ARM64`;
      tagLabel = `${baseWinName} ARM64`;
      deviceName = cpuModel.toLowerCase().includes('snapdragon') 
        ? 'Notebook Snapdragon ARM64 (Galaxy Book Go / Surface Pro X)' 
        : 'Dispositivo Windows ARM64';
      isArmNative = true;
    } else if (processArch === 'x64' || arch === 'x64') {
      deviceCategory = 'windows_x64';
      osName = `${baseWinName} Pro/Home (64-bit)`;
      tagLabel = `${baseWinName} x64`;
      deviceName = 'Computador Desktop / Notebook (x64)';
    } else {
      deviceCategory = 'windows_x86';
      osName = `${baseWinName} (32-bit)`;
      tagLabel = `${baseWinName} 32-bit`;
      deviceName = 'Computador x86 (32 bits)';
    }
  }

  // 4. Gerar Dicas Contextuais Especializadas para o Sistema Detectado
  const tips: SystemTip[] = [];

  switch (deviceCategory) {
    case 'windows_x64':
      tips.push({
        title: `Drivers USB Serial no ${tagLabel}:`,
        description: 'Placas com conversores CH340, CP2102 ou FT232R utilizam drivers de 64 bits padrão do Windows. Se a placa não for reconhecida após plugar, certifique-se de instalar o pacote CH341SER.EXE oficial de 64 bits.',
        category: 'driver'
      });
      tips.push({
        title: 'Gerenciamento de Portas COM:',
        description: 'Se a placa receber uma porta alta (ex: COM32), você pode remapear para COM1-COM8 no Gerenciador de Dispositivos > Portas (COM e LPT) > Propriedades > Configurações de Porta > Avançado.',
        category: 'port'
      });
      tips.push({
        title: 'Desempenho de Compilação Multi-Core:',
        description: `O motor de compilação C++ utiliza todos os núcleos do seu ${cpus.length > 0 ? cpus[0].model : 'processador x64'} em paralelo, entregando tempo de build quase instantâneo.`,
        category: 'performance'
      });
      break;

    case 'windows_arm64':
      tips.push({
        title: `Drivers Nativos no ${tagLabel} (Snapdragon / WoA):`,
        description: 'No Windows 11 ARM64, utilize drivers USB Serial nativos ARM64 (como o WCH CH340 ARM64 e Silicon Labs CP210x Universal) para evitar sobrecarga de emulação e garantir gravação fluida.',
        category: 'driver'
      });
      tips.push({
        title: 'Eficiência e Baixo Consumo de Bateria:',
        description: 'O Arduino Turbo IDE roda em modo ARM64 100% nativo, mantendo o dispositivo frio e economizando até 70% de bateria mesmo durante uploads e compilações frequentes.',
        category: 'performance'
      });
      tips.push({
        title: 'Conexão USB CDC em ESP32 (S3/C3/C5):',
        description: 'Caso a placa com USB CDC nativo desconecte ao reiniciar o microcontrolador, verifique se a opção "Economia de Energia USB" no Gerenciador de Dispositivos está desmarcada para a porta.',
        category: 'system'
      });
      break;

    case 'linux_raspberry':
      tips.push({
        title: `Permissões de Porta Serial no ${tagLabel}:`,
        description: 'No Raspberry Pi OS, seu usuário precisa pertencer ao grupo dialout para acessar portas seriais sem root. Execute no terminal: `sudo usermod -a -G dialout $USER` e reinicie a sessão.',
        category: 'system'
      });
      tips.push({
        title: 'Conflito com Daemon BRLTTY no Linux:',
        description: 'Se sua placa com CH340/CP2102 desconectar 2 segundos após plugar na porta USB, remova o serviço braille com: `sudo apt remove brltty`.',
        category: 'driver'
      });
      tips.push({
        title: 'Pinos UART GPIO Nativos (Pinos 14 e 15):',
        description: 'Além da conexão via cabo USB (/dev/ttyUSB0 ou /dev/ttyACM0), você pode comunicar diretamente pelos pinos GPIO 14 (TX) e GPIO 15 (RX) ativando a Serial no comando `sudo raspi-config`.',
        category: 'port'
      });
      break;

    case 'linux_arm':
    case 'linux_x64':
      tips.push({
        title: `Permissões de Comunicação Serial (${tagLabel}):`,
        description: 'Em distribuições Linux (Ubuntu/Debian/Fedora/Arch), adicione seu usuário aos grupos de hardware: `sudo usermod -a -G dialout,tty $USER` e efetue logout/login.',
        category: 'system'
      });
      tips.push({
        title: 'Regras udev para Gravadores e ESP32:',
        description: 'Para gravar placas via modo DFU/Bootloader sem permissão de superusuário, configure as regras udev em `/etc/udev/rules.d/99-arduino.rules`.',
        category: 'driver'
      });
      tips.push({
        title: 'Identificação de Portas /dev/ttyUSB e /dev/ttyACM:',
        description: 'Conversores seriais externos aparecem como `/dev/ttyUSB0`, enquanto chips com USB nativo (Leonardo, ESP32-S3) utilizam `/dev/ttyACM0`.',
        category: 'port'
      });
      break;

    case 'macos_arm64':
    case 'macos_x64':
      tips.push({
        title: `Identificação de Portas no ${tagLabel}:`,
        description: 'No macOS, as placas seriais são listadas no padrão `/dev/cu.usbserial-*` ou `/dev/cu.usbmodem*`. Selecione sempre a entrada iniciada por `cu.` em vez de `tty.` para evitar bloqueio de linha.',
        category: 'port'
      });
      tips.push({
        title: 'Permissões de Acessórios USB:',
        description: 'Em versões recentes do macOS, confirme a permissão de conexão na caixa de diálogo "Permitir que este acessório se conecte" ao plugar o cabo USB da placa.',
        category: 'system'
      });
      break;

    case 'windows_x86':
      tips.push({
        title: `Configuração em Sistemas ${tagLabel}:`,
        description: 'Em sistemas Windows de 32 bits, utilize toolchains de compilação compatíveis com arquitetura x86 e evite alocações de memória RAM acima de 2 GB no compilador.',
        category: 'driver'
      });
      break;
  }

  return {
    platform,
    osName,
    release,
    arch,
    processArch,
    cpuModel,
    totalMemGB,
    freeMemGB,
    deviceCategory,
    tagLabel,
    deviceName,
    isArmNative,
    tips
  };
}
