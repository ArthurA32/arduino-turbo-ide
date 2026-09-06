import os from 'os';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { detectSystemProfile, SystemProfile } from './systemProfile';

export interface DiagnosticData {
  timestamp: string;
  systemProfile: SystemProfile;
  osInfo: {
    platform: string;
    release: string;
    type: string;
    arch: string;
    processArch: string;
    isArmNative: boolean;
    cpus: string;
    totalMemGB: string;
    freeMemGB: string;
  };
  cliInfo: {
    cliFound: boolean;
    cliPath: string;
    cliVersion: string;
    installedCores: string[];
    boardIndexUrls: string[];
  };
  serialInfo: {
    detectedPorts: any[];
  };
  recentLogs: {
    compilation: string[];
    upload: string[];
    serial: string[];
    appErrors: string[];
  };
}

class DiagnosticsCollector {
  private compilationLogs: string[] = [];
  private uploadLogs: string[] = [];
  private serialLogs: string[] = [];
  private appErrors: string[] = [];

  public logCompilation(msg: string) {
    this.compilationLogs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    if (this.compilationLogs.length > 500) this.compilationLogs.shift();
  }

  public logUpload(msg: string) {
    this.uploadLogs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    if (this.uploadLogs.length > 500) this.uploadLogs.shift();
  }

  public logSerial(msg: string) {
    this.serialLogs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    if (this.serialLogs.length > 500) this.serialLogs.shift();
  }

  public logAppError(msg: string) {
    this.appErrors.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    if (this.appErrors.length > 500) this.appErrors.shift();
  }

  public logSystem(msg: string) {
    console.log(`[SYSTEM] ${msg}`);
    this.appErrors.push(`[${new Date().toLocaleTimeString()}] [SYSTEM] ${msg}`);
    if (this.appErrors.length > 500) this.appErrors.shift();
  }


  public clearLogs() {
    this.compilationLogs = [];
    this.uploadLogs = [];
    this.serialLogs = [];
    this.appErrors = [];
  }

  public async collect(cliStatus: any, detectedPorts: any[]): Promise<DiagnosticData> {
    const profile = detectSystemProfile();

    return {
      timestamp: new Date().toISOString(),
      systemProfile: profile,
      osInfo: {
        platform: profile.osName,
        release: profile.release,
        type: os.type(),
        arch: profile.arch,
        processArch: profile.processArch,
        isArmNative: profile.isArmNative,
        cpus: profile.cpuModel,
        totalMemGB: profile.totalMemGB,
        freeMemGB: profile.freeMemGB
      },
      cliInfo: {
        cliFound: cliStatus.found || false,
        cliPath: cliStatus.path || 'Não encontrado',
        cliVersion: cliStatus.version || 'Desconhecida',
        installedCores: cliStatus.cores || [],
        boardIndexUrls: cliStatus.indexes || []
      },
      serialInfo: {
        detectedPorts: detectedPorts || []
      },
      recentLogs: {
        compilation: this.compilationLogs.slice(-100),
        upload: this.uploadLogs.slice(-100),
        serial: this.serialLogs.slice(-100),
        appErrors: this.appErrors.slice(-100)
      }
    };
  }

  public formatReport(data: DiagnosticData): string {
    const tag = data.systemProfile?.tagLabel || data.osInfo.platform;
    return `===============================================================
RELATÓRIO DE DIAGNÓSTICO - ARDUINO TURBO IDE [${tag.toUpperCase()}]
Gerado em: ${new Date(data.timestamp).toLocaleString('pt-BR')}
===============================================================

[1. SISTEMA OPERACIONAL E DISPOSITIVO DETECTADO]
- Sistema Operacional: ${data.systemProfile?.osName || data.osInfo.platform}
- Categoria do Dispositivo: ${data.systemProfile?.deviceName || 'Desconhecido'}
- Arquitetura do Sistema: ${data.osInfo.arch}
- Arquitetura do Processo IDE: ${data.osInfo.processArch}
- Execução Nativa: ${data.osInfo.isArmNative ? 'Nativo (ARM64)' : 'Nativo (x64 / PC)'}
- Processador / CPU: ${data.osInfo.cpus}
- Memória RAM: ${data.osInfo.freeMemGB} livres de ${data.osInfo.totalMemGB}

[2. DICAS RECOMENDADAS PARA ESTE SISTEMA (${tag})]
${data.systemProfile?.tips?.map((t, idx) => `  ${idx + 1}. [${t.title}] ${t.description}`).join('\n\n') || '  (Nenhuma dica específica)'}

[3. MOTOR ARDUINO-CLI / TOOLCHAIN]
- Arduino CLI detectado: ${data.cliInfo.cliFound ? 'SIM' : 'NÃO'}
- Caminho do Executável: ${data.cliInfo.cliPath}
- Versão do Motor: ${data.cliInfo.cliVersion}
- Cores de Placas Instalados:
${data.cliInfo.installedCores.length > 0 ? data.cliInfo.installedCores.map(c => '  • ' + c).join('\n') : '  (Nenhum core instalado ainda)'}

[4. PORTAS COM / HARDWARE DETECTADO]
${data.serialInfo.detectedPorts.length > 0 ? JSON.stringify(data.serialInfo.detectedPorts, null, 2) : 'Nenhuma porta serial conectada no momento.'}

[5. LOGS RECENTES DE ERROS DO APP]
${data.recentLogs.appErrors.length > 0 ? data.recentLogs.appErrors.join('\n') : '(Sem erros registrados)'}

[6. ÚLTIMO LOG DE COMPILAÇÃO]
${data.recentLogs.compilation.length > 0 ? data.recentLogs.compilation.join('\n') : '(Nenhuma compilação recente)'}

[7. ÚLTIMO LOG DE UPLOAD / FLASHING]
${data.recentLogs.upload.length > 0 ? data.recentLogs.upload.join('\n') : '(Nenhum upload recente)'}

===============================================================
FIM DO RELATÓRIO
===============================================================`;
  }

  public saveReportToDesktop(reportText: string): string {
    const desktopDir = path.join(os.homedir(), 'Desktop');
    const profile = detectSystemProfile();
    const cleanTag = profile.tagLabel.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const filename = `relatorio_arduino_${cleanTag}_${Date.now()}.txt`;
    const targetPath = path.join(desktopDir, filename);

    fs.writeFileSync(targetPath, reportText, 'utf-8');
    return targetPath;
  }
}

export const diagnostics = new DiagnosticsCollector();

