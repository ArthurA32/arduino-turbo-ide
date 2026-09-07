import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const versionPath = path.resolve(__dirname, '..', 'src', 'version.json');
const packageJsonPath = path.resolve(__dirname, '..', 'package.json');

/**
 * Regra do Odometro Decimal de 3 casas:
 * - 0.0.1 ate 0.0.9 -> proximo 0.1.0
 * - 0.1.0 ate 0.1.9 -> proximo 0.2.0
 * - 0.9.9 -> proximo 1.0.0
 * Sempre que a casa da direita atinge 9, zera e sobe 1 na casa anterior.
 */
export function nextOdometerVersion(currentVersion) {
  let [major, minor, patch] = currentVersion.split('.').map(Number);
  patch++;
  if (patch > 9) {
    patch = 0;
    minor++;
    if (minor > 9) {
      minor = 0;
      major++;
    }
  }
  return `${major}.${minor}.${patch}`;
}

export function bump(targetArch = 'arm64', changelogItems = null) {
  if (!fs.existsSync(versionPath)) {
    throw new Error('Arquivo src/version.json nao encontrado!');
  }

  const raw = fs.readFileSync(versionPath, 'utf-8');
  const data = JSON.parse(raw);

  const targets = targetArch === 'all' ? ['arm64', 'x64'] : [targetArch];

  for (const arch of targets) {
    if (!data[arch]) {
      throw new Error(`Arquitetura desconhecida: ${arch}`);
    }

    const prevVersion = data[arch].version;
    const nextVer = nextOdometerVersion(prevVersion);
    data[arch].version = nextVer;
    data[arch].build = (data[arch].build || 0) + 1;
    data[arch].releaseDate = new Date().toISOString().split('T')[0];

    if (changelogItems && Array.isArray(changelogItems) && changelogItems.length > 0) {
      data[arch].changelog = changelogItems;
    }

    console.log(`✔ Versao para ${arch.toUpperCase()} atualizada: ${prevVersion} -> ${nextVer} (Build ${data[arch].build})`);
  }

  fs.writeFileSync(versionPath, JSON.stringify(data, null, 2), 'utf-8');

  // Sincronizar package.json com o primeiro target
  if (fs.existsSync(packageJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    pkg.version = data[targets[0]].version;
    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2), 'utf-8');
  }

  return data;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let arch = 'arm64';
  let changelog = null;

  for (const a of args) {
    if (a.startsWith('--arch=')) {
      arch = a.split('=')[1].toLowerCase();
    } else if (a.startsWith('--changelog=')) {
      const rawCl = a.substring('--changelog='.length);
      changelog = rawCl.split('|').map(s => s.trim()).filter(Boolean);
    }
  }
  bump(arch, changelog);
}
