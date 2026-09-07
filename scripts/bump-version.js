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

export function bump(targetArch = 'arm64') {
  if (!fs.existsSync(versionPath)) {
    throw new Error('Arquivo src/version.json nao encontrado!');
  }

  const raw = fs.readFileSync(versionPath, 'utf-8');
  const data = JSON.parse(raw);

  if (!data[targetArch]) {
    throw new Error(`Arquitetura desconhecida: ${targetArch}`);
  }

  const prevVersion = data[targetArch].version;
  const nextVer = nextOdometerVersion(prevVersion);
  data[targetArch].version = nextVer;
  data[targetArch].build = (data[targetArch].build || 0) + 1;
  data[targetArch].releaseDate = new Date().toISOString().split('T')[0];

  fs.writeFileSync(versionPath, JSON.stringify(data, null, 2), 'utf-8');

  // Sincronizar package.json
  if (fs.existsSync(packageJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    pkg.version = nextVer;
    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2), 'utf-8');
  }

  console.log(`✔ Versao para ${targetArch.toUpperCase()} atualizada: ${prevVersion} -> ${nextVer} (Build ${data[targetArch].build})`);
  return { prevVersion, nextVer, build: data[targetArch].build };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let arch = 'arm64';
  for (const a of args) {
    if (a.startsWith('--arch=')) {
      arch = a.split('=')[1].toLowerCase();
    }
  }
  bump(arch);
}
