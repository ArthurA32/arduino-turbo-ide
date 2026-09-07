import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { app } from 'electron';
import { getAppVersionInfo } from './version';
import { diagnostics } from './diagnostics';

export interface UpdateReleaseEntry {
  version: string;
  build: number;
  installer: string;
  releaseDate: string;
  changelog?: string;
  fileSize?: number;
}

export interface UpdateManifest {
  arm64?: UpdateReleaseEntry;
  x64?: UpdateReleaseEntry;
  lastUpdated?: string;
}

export interface CheckUpdateResult {
  available: boolean;
  serverInfo?: UpdateReleaseEntry;
  currentInfo: ReturnType<typeof getAppVersionInfo>;
  installerFullPath?: string;
  networkLocation?: string;
  error?: string;
}

export class NetworkUpdateService {
  private candidateServerDirs: string[] = [
    'Z:\\Updates Turbo IDE',
    '\\\\192.168.3.74\\M-servidor\\Updates Turbo IDE'
  ];

  /**
   * Localiza a pasta de updates acessível na rede local
   */
  public resolveUpdateDirectory(): string | null {
    for (const dir of this.candidateServerDirs) {
      try {
        if (fs.existsSync(dir)) {
          return dir;
        }
      } catch (err) {
        // Ignora falhas de timeout em caminhos offline
      }
    }
    return null;
  }

  /**
   * Verifica se há atualizações disponíveis no servidor de rede
   */
  public async checkForUpdates(): Promise<CheckUpdateResult> {
    const currentInfo = getAppVersionInfo();
    const updateDir = this.resolveUpdateDirectory();

    if (!updateDir) {
      return {
        available: false,
        currentInfo,
        error: 'Servidor local não encontrado (Z:\\Updates Turbo IDE inacessível).'
      };
    }

    const manifestPath = path.join(updateDir, 'updates.json');
    if (!fs.existsSync(manifestPath)) {
      return {
        available: false,
        currentInfo,
        error: 'Arquivo updates.json não encontrado na pasta do servidor.'
      };
    }

    try {
      const raw = fs.readFileSync(manifestPath, 'utf-8');
      const manifest: UpdateManifest = JSON.parse(raw);
      const archKey = currentInfo.arch; // 'arm64' ou 'x64'
      const serverEntry = manifest[archKey];

      if (!serverEntry) {
        return {
          available: false,
          currentInfo,
          error: `Nenhum release encontrado para ${archKey} no servidor.`
        };
      }

      const installerPath = path.join(updateDir, serverEntry.installer);
      const isNewer = (serverEntry.build > currentInfo.build) || (serverEntry.version !== currentInfo.version);

      if (isNewer && fs.existsSync(installerPath)) {
        diagnostics.logSystem(`[AutoUpdater] Nova atualização detectada: v${serverEntry.version} (Build #${serverEntry.build})`);
        return {
          available: true,
          serverInfo: serverEntry,
          currentInfo,
          installerFullPath: installerPath,
          networkLocation: updateDir
        };
      }

      return {
        available: false,
        serverInfo: serverEntry,
        currentInfo,
        networkLocation: updateDir
      };
    } catch (err: any) {
      diagnostics.logSystem(`[AutoUpdater] Erro ao processar updates.json: ${err.message}`);
      return {
        available: false,
        currentInfo,
        error: `Erro ao ler manifesto: ${err.message}`
      };
    }
  }

  /**
   * Baixa o instalador do servidor e executa a atualização automática
   */
  public async installUpdate(
    onProgress?: (progress: { percent: number; copiedBytes: number; totalBytes: number }) => void
  ): Promise<{ success: boolean; error?: string }> {
    const check = await this.checkForUpdates();
    if (!check.available || !check.installerFullPath) {
      return { success: false, error: check.error || 'Nenhuma atualização disponível para instalar.' };
    }

    const sourceInstaller = check.installerFullPath;
    const tempDir = os.tmpdir();
    const destInstaller = path.join(tempDir, `Arduino_Turbo_IDE_Update_${check.serverInfo?.version || 'new'}.exe`);

    try {
      diagnostics.logSystem(`[AutoUpdater] Copiando instalador de ${sourceInstaller} para ${destInstaller}...`);

      const totalSize = fs.statSync(sourceInstaller).size;
      let copied = 0;

      await new Promise<void>((resolve, reject) => {
        const readStream = fs.createReadStream(sourceInstaller);
        const writeStream = fs.createWriteStream(destInstaller);

        readStream.on('data', (chunk) => {
          copied += chunk.length;
          if (onProgress && totalSize > 0) {
            onProgress({
              percent: Math.min(100, Math.round((copied / totalSize) * 100)),
              copiedBytes: copied,
              totalBytes: totalSize
            });
          }
        });

        readStream.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('finish', () => resolve());

        readStream.pipe(writeStream);
      });

      diagnostics.logSystem(`[AutoUpdater] Cópia concluída com sucesso (${totalSize} bytes). Disparando instalador...`);

      // Disparar instalador em processo desvinculado (detached)
      const child = spawn(destInstaller, [], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();

      // Fechar a aplicação em 1 segundo para permitir que o instalador substitua os arquivos
      setTimeout(() => {
        if (app) app.quit();
      }, 1000);

      return { success: true };
    } catch (err: any) {
      diagnostics.logSystem(`[AutoUpdater] Falha ao instalar atualização: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}

export const networkUpdateService = new NetworkUpdateService();
