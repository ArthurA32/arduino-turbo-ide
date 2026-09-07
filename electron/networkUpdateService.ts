import fs from 'fs';
import path from 'path';
import os from 'os';
import net from 'net';
import { spawn } from 'child_process';
import { app } from 'electron';
import { getAppVersionInfo } from './version';
import { diagnostics } from './diagnostics';

export interface UpdateReleaseEntry {
  version: string;
  build: number;
  installer: string;
  releaseDate: string;
  changelog?: string | string[];
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

/**
 * Testa se um host (IP ou hostname) está acessível na rede via TCP (ex: porta SMB 445)
 * com timeout ultracurto para jamais travar o thread do Node/Electron.
 */
function isHostReachable(host: string, port = 445, timeoutMs = 500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let finished = false;

    const finish = (val: boolean) => {
      if (!finished) {
        finished = true;
        socket.destroy();
        resolve(val);
      }
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));

    try {
      socket.connect(port, host);
    } catch {
      finish(false);
    }
  });
}

/**
 * Verifica se um caminho está acessível de forma 100% assíncrona
 * e com timeout protetivo para evitar bloqueio em caminhos UNC ou unidades desconectadas.
 */
function checkPathAccessible(dirPath: string, timeoutMs = 600): Promise<boolean> {
  return new Promise((resolve) => {
    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        resolve(false);
      }
    }, timeoutMs);

    fs.promises.stat(dirPath)
      .then((stat) => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          resolve(true);
        }
      })
      .catch(() => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          resolve(false);
        }
      });
  });
}

export class NetworkUpdateService {
  private candidateServerDirs: string[] = [
    'Z:\\Updates Turbo IDE',
    '\\\\192.168.3.74\\M-servidor\\Updates Turbo IDE'
  ];

  /**
   * Localiza a pasta de updates acessível na rede local de forma 100% assíncrona e não-bloqueante
   */
  public async resolveUpdateDirectory(): Promise<string | null> {
    // 1. Suporte a diretório local customizado via variável de ambiente (para testes locais)
    const customDir = process.env.TURBO_UPDATE_DIR;
    if (customDir) {
      const customExists = await checkPathAccessible(customDir, 600);
      if (customExists) return customDir;
    }

    // 2. Verificação ultrarrápida do servidor SMB local (192.168.3.74:445)
    // Se não estiver na rede local (ex: computador do primo ou café), aborta imediatamente em 400ms
    // sem invocar chamadas de filesystem em Z: ou UNC, eliminando qualquer risco de travamento "(Not Responding)" no Windows.
    const smbHost = '192.168.3.74';
    const isLocalServerOnline = await isHostReachable(smbHost, 445, 400);
    if (!isLocalServerOnline) {
      diagnostics.logSystem(`[AutoUpdater] Servidor local (${smbHost}) inacessível (computador externo ou offline). Verificação cancelada com segurança.`);
      return null;
    }

    for (const dir of this.candidateServerDirs) {
      try {
        const exists = await checkPathAccessible(dir, 600);
        if (exists) {
          return dir;
        }
      } catch (err) {
        // Ignora falhas de acesso
      }
    }
    return null;
  }

  /**
   * Verifica se há atualizações disponíveis no servidor de rede
   */
  public async checkForUpdates(): Promise<CheckUpdateResult> {
    const currentInfo = getAppVersionInfo();
    const updateDir = await this.resolveUpdateDirectory();

    if (!updateDir) {
      return {
        available: false,
        currentInfo,
        error: 'Servidor local não encontrado ou offline.'
      };
    }

    const manifestPath = path.join(updateDir, 'updates.json');
    const manifestExists = await checkPathAccessible(manifestPath, 600);
    if (!manifestExists) {
      return {
        available: false,
        currentInfo,
        error: 'Arquivo updates.json não encontrado na pasta do servidor.'
      };
    }

    try {
      const raw = (await fs.promises.readFile(manifestPath, 'utf-8')).replace(/^\uFEFF/, '');
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

      // Herdar changelog universal se a entrada específica não tiver definido
      if (!serverEntry.changelog && (manifest as any).universal?.changelog) {
        serverEntry.changelog = (manifest as any).universal.changelog;
      }

      const installerPath = path.join(updateDir, serverEntry.installer);

      // Comparação estrita para evitar falsos positivos de atualização ou downgrade indesejado
      const parseSemver = (v: string) => (v || '0.0.0').split('.').map((n) => parseInt(n, 10) || 0);
      const [sMaj, sMin, sPat] = parseSemver(serverEntry.version);
      const [cMaj, cMin, cPat] = parseSemver(currentInfo.version);
      const isVersionHigher = sMaj > cMaj || (sMaj === cMaj && (sMin > cMin || (sMin === cMin && sPat > cPat)));
      const isNewer = (serverEntry.build > currentInfo.build) || (serverEntry.build === currentInfo.build && isVersionHigher);

      const installerExists = isNewer ? await checkPathAccessible(installerPath, 800) : false;

      if (isNewer && installerExists) {
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

    const currentInfo = check.currentInfo;
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

      diagnostics.logSystem(`[AutoUpdater] Cópia concluída com sucesso (${totalSize} bytes). Disparando instalador silencioso...`);

      // Disparar instalador em modo de atualização com barra de progresso visual (/UPDATE) e reinício automático
      const archArg = `/ARCH=${(currentInfo?.arch || 'x64').toUpperCase()}`;
      const child = spawn(destInstaller, ['/UPDATE', archArg, '/AUTO_RESTART'], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();

      // Fechar a aplicação em 1200ms para que a janela de progresso do instalador já apareça na tela
      setTimeout(() => {
        if (app) app.quit();
      }, 1200);

      return { success: true };
    } catch (err: any) {
      diagnostics.logSystem(`[AutoUpdater] Falha ao instalar atualização: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}

export const networkUpdateService = new NetworkUpdateService();
