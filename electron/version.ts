import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { app } from 'electron';

export interface AppVersionInfo {
  version: string;
  build: number;
  arch: 'arm64' | 'x64';
  targetName: string;
  releaseDate: string;
  fullString: string;
}

function getSafeDirname(): string {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
}

export function getAppVersionInfo(): AppVersionInfo {
  const isArm64 = process.arch === 'arm64' || (process.env.PROCESSOR_ARCHITECTURE || '').toUpperCase() === 'ARM64';
  const archKey: 'arm64' | 'x64' = isArm64 ? 'arm64' : 'x64';

  try {
    let rawData: any = null;
    const safeDir = getSafeDirname();
    const appPath = app && typeof app.getAppPath === 'function' ? app.getAppPath() : '';
    const resPath = process.resourcesPath || '';

    const candidates = [
      path.join(safeDir, '..', 'src', 'version.json'),
      path.join(safeDir, 'version.json'),
      path.join(resPath, 'version.json'),
      path.join(resPath, 'app', 'src', 'version.json'),
      path.join(resPath, 'app', 'version.json'),
      path.join(appPath, 'src', 'version.json'),
      path.join(appPath, 'version.json')
    ];

    for (const c of candidates) {
      if (c && fs.existsSync(c)) {
        try {
          rawData = JSON.parse(fs.readFileSync(c, 'utf-8'));
          break;
        } catch {}
      }
    }

    const arm64Ver = rawData?.arm64?.version || '0.1.5';
    const arm64Build = rawData?.arm64?.build || 15;
    const x64Ver = rawData?.x64?.version || '0.1.3';
    const x64Build = rawData?.x64?.build || 13;

    const version = isArm64 ? arm64Ver : x64Ver;
    const build = isArm64 ? arm64Build : x64Build;
    const targetName = isArm64 ? 'Windows ARM64 Nativo' : 'Windows x64';
    const releaseDate = isArm64 ? (rawData?.arm64?.releaseDate || '2026-09-07') : (rawData?.x64?.releaseDate || '2026-09-07');
    const fullString = `v${version} [${isArm64 ? 'ARM64' : 'x64'}]`;

    return {
      version,
      build,
      arch: archKey,
      targetName,
      releaseDate,
      fullString
    };
  } catch {
    // Fallback defensivo que nunca lança exceção
    return {
      version: isArm64 ? '0.1.5' : '0.1.3',
      build: isArm64 ? 15 : 13,
      arch: archKey,
      targetName: isArm64 ? 'Windows ARM64 Nativo' : 'Windows x64',
      releaseDate: '2026-09-07',
      fullString: `v${isArm64 ? '0.1.5' : '0.1.3'} [${isArm64 ? 'ARM64' : 'x64'}]`
    };
  }
}

