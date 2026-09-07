import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export interface AppVersionInfo {
  version: string;
  build: number;
  arch: 'arm64' | 'x64';
  targetName: string;
  releaseDate: string;
  fullString: string;
}

export function getAppVersionInfo(): AppVersionInfo {
  const isArm64 = process.arch === 'arm64' || (process.env.PROCESSOR_ARCHITECTURE || '').toUpperCase() === 'ARM64';
  const archKey: 'arm64' | 'x64' = isArm64 ? 'arm64' : 'x64';

  let rawData: any = null;
  const candidates = [
    path.join(__dirname, '..', 'src', 'version.json'),
    path.join(__dirname, 'version.json'),
    path.join(process.resourcesPath, 'version.json'),
    path.join(process.resourcesPath, 'app', 'src', 'version.json'),
    path.join(app ? app.getAppPath() : '', 'src', 'version.json')
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      try {
        rawData = JSON.parse(fs.readFileSync(c, 'utf-8'));
        break;
      } catch {}
    }
  }

  const arm64Ver = rawData?.arm64?.version || '0.1.3';
  const arm64Build = rawData?.arm64?.build || 13;
  const x64Ver = rawData?.x64?.version || '0.1.1';
  const x64Build = rawData?.x64?.build || 11;

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
}
