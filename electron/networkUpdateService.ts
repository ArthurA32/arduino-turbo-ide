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
  downloadUrl?: string;
  releaseDate: string;
  changelog?: string | string[];
  fileSize?: number;
}

export interface CheckUpdateResult {
  available: boolean;
  serverInfo?: UpdateReleaseEntry;
  currentInfo: ReturnType<typeof getAppVersionInfo>;
  installerFullPath?: string;
  downloadUrl?: string;
  networkLocation?: string;
  error?: string;
}

export interface UpdateProgress {
  percent: number;
  copiedBytes: number;
  totalBytes: number;
}

const GITHUB_REPO = 'ArthurA32/arduino-turbo-ide';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export class GitHubUpdateService {
  private downloadedInstallerPath: string | null = null;
  private cachedCheckResult: CheckUpdateResult | null = null;

  /**
   * Converte versão "0.2.9" em números para comparação
   */
  private parseSemver(v: string): [number, number, number] {
    const clean = (v || '0.0.0').replace(/^v/i, '').trim();
    const parts = clean.split('.').map((n) => parseInt(n, 10) || 0);
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  }

  /**
   * Compara duas versões segundo a regra do odômetro
   */
  private isNewerVersion(remoteVer: string, localVer: string): boolean {
    const [rMaj, rMin, rPat] = this.parseSemver(remoteVer);
    const [lMaj, lMin, lPat] = this.parseSemver(localVer);

    if (rMaj > lMaj) return true;
    if (rMaj === lMaj && rMin > lMin) return true;
    if (rMaj === lMaj && rMin === lMin && rPat > lPat) return true;
    return false;
  }

  /**
   * Verifica se há atualizações disponíveis diretamente no GitHub Releases
   */
  public async checkForUpdates(): Promise<CheckUpdateResult> {
    const currentInfo = getAppVersionInfo();

    try {
      diagnostics.logSystem(`[AutoUpdater] Verificando atualizações no GitHub: ${GITHUB_REPO}...`);

      const res = await fetch(GITHUB_API_URL, {
        headers: {
          'User-Agent': 'Arduino-Turbo-IDE',
          'Accept': 'application/vnd.github+json'
        }
      });

      if (!res.ok) {
        if (res.status === 404) {
          return {
            available: false,
            currentInfo,
            networkLocation: 'GitHub Releases',
            error: 'Nenhuma release publicada encontrada no repositório.'
          };
        }
        throw new Error(`Resposta do GitHub HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json() as any;
      const remoteTag = String(data.tag_name || '').trim();
      const remoteVersion = remoteTag.replace(/^v/i, '');

      // Localizar o executável do instalador universal nos assets da release
      const assets = Array.isArray(data.assets) ? data.assets : [];
      const exeAsset = assets.find((a: any) =>
        String(a.name).toLowerCase().includes('universal') && String(a.name).toLowerCase().endsWith('.exe')
      ) || assets.find((a: any) => String(a.name).toLowerCase().endsWith('.exe'));

      if (!exeAsset) {
        diagnostics.logSystem(`[AutoUpdater] Release ${remoteTag} encontrada, mas sem instalador .exe anexado.`);
        return {
          available: false,
          currentInfo,
          networkLocation: 'GitHub Releases',
          error: 'Nenhum instalador executável (.exe) anexado nesta versão.'
        };
      }

      const isNewer = this.isNewerVersion(remoteVersion, currentInfo.version);

      const serverInfo: UpdateReleaseEntry = {
        version: remoteVersion,
        build: (currentInfo.build || 0) + (isNewer ? 1 : 0),
        installer: exeAsset.name,
        downloadUrl: exeAsset.browser_download_url,
        fileSize: exeAsset.size,
        releaseDate: (data.published_at || '').split('T')[0] || new Date().toISOString().split('T')[0],
        changelog: data.body || 'Atualização de estabilidade e novas ferramentas.'
      };

      this.cachedCheckResult = {
        available: isNewer,
        serverInfo,
        currentInfo,
        downloadUrl: exeAsset.browser_download_url,
        networkLocation: `GitHub Releases (${GITHUB_REPO})`
      };

      if (isNewer) {
        diagnostics.logSystem(`[AutoUpdater] Nova versão detectada no GitHub: v${remoteVersion} (Atual instalada: v${currentInfo.version})`);
      } else {
        diagnostics.logSystem(`[AutoUpdater] Aplicativo já está na versão mais recente (v${currentInfo.version}).`);
      }

      return this.cachedCheckResult;
    } catch (err: any) {
      diagnostics.logSystem(`[AutoUpdater] Falha ao verificar no GitHub: ${err?.message}`);
      return {
        available: false,
        currentInfo,
        networkLocation: 'GitHub Releases',
        error: `Não foi possível consultar o GitHub: ${err?.message || 'Sem conexão com a internet'}`
      };
    }
  }

  /**
   * Baixa o instalador a partir do link direto do GitHub Releases com progresso em tempo real
   */
  public async downloadUpdate(
    onProgress?: (progress: UpdateProgress) => void
  ): Promise<{ success: boolean; installerPath?: string; error?: string }> {
    const check = this.cachedCheckResult || (await this.checkForUpdates());
    const downloadUrl = check.downloadUrl || check.serverInfo?.downloadUrl;

    if (!downloadUrl) {
      return { success: false, error: check.error || 'URL de download da atualização não encontrada.' };
    }

    const tempDir = os.tmpdir();
    const destInstaller = path.join(tempDir, `Arduino_Turbo_IDE_Update_${check.serverInfo?.version || 'new'}.exe`);

    try {
      diagnostics.logSystem(`[AutoUpdater] Iniciando download do instalador via GitHub: ${downloadUrl}`);

      const res = await fetch(downloadUrl, {
        headers: { 'User-Agent': 'Arduino-Turbo-IDE' }
      });

      if (!res.ok || !res.body) {
        throw new Error(`Falha ao baixar arquivo do GitHub: HTTP ${res.status}`);
      }

      const totalBytes = Number(res.headers.get('content-length')) || check.serverInfo?.fileSize || 0;
      let copiedBytes = 0;

      const fileStream = fs.createWriteStream(destInstaller);
      const reader = res.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        fileStream.write(Buffer.from(value));
        copiedBytes += value.length;

        if (onProgress && totalBytes > 0) {
          const percent = Math.min(100, Math.round((copiedBytes / totalBytes) * 100));
          onProgress({ percent, copiedBytes, totalBytes });
        }
      }

      await new Promise<void>((resolve, reject) => {
        fileStream.end(() => resolve());
        fileStream.on('error', reject);
      });

      diagnostics.logSystem(`[AutoUpdater] Download concluído com sucesso (${copiedBytes} bytes) em ${destInstaller}.`);
      this.downloadedInstallerPath = destInstaller;

      return { success: true, installerPath: destInstaller };
    } catch (err: any) {
      diagnostics.logSystem(`[AutoUpdater] Erro durante o download: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Dispara o instalador baixado e fecha o aplicativo automaticamente
   */
  public async applyUpdate(): Promise<{ success: boolean; error?: string }> {
    const installerPath = this.downloadedInstallerPath;

    if (!installerPath || !fs.existsSync(installerPath)) {
      return { success: false, error: 'Arquivo do instalador não localizado para instalação.' };
    }

    try {
      const currentInfo = getAppVersionInfo();
      const archArg = `/ARCH=${(currentInfo?.arch || 'x64').toUpperCase()}`;

      diagnostics.logSystem(`[AutoUpdater] Disparando instalador: ${installerPath} ${archArg} /UPDATE /AUTO_RESTART`);

      const child = spawn(installerPath, ['/UPDATE', archArg, '/AUTO_RESTART'], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();

      // Fechar a aplicação em 800ms para liberar os arquivos e abrir o instalador
      setTimeout(() => {
        if (app) app.quit();
      }, 800);

      return { success: true };
    } catch (err: any) {
      diagnostics.logSystem(`[AutoUpdater] Erro ao disparar instalador: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Método legado unificado: baixa o instalador e aplica imediatamente
   */
  public async installUpdate(
    onProgress?: (progress: UpdateProgress) => void
  ): Promise<{ success: boolean; error?: string }> {
    const dlResult = await this.downloadUpdate(onProgress);
    if (!dlResult.success) {
      return { success: false, error: dlResult.error };
    }
    return await this.applyUpdate();
  }
}

export const networkUpdateService = new GitHubUpdateService();
export const gitHubUpdateService = networkUpdateService;
