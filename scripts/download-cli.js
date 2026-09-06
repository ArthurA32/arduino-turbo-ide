import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const binDir = path.join(projectRoot, 'bin');

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

console.log('==========================================================');
console.log('Obtendo motor arduino-cli oficial...');
console.log('==========================================================');

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    function get(u) {
      https.get(u, { headers: { 'User-Agent': 'NodeJS' } }, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          return get(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Falha HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            resolve();
          });
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
    }

    get(url);
  });
}

async function main() {
  try {
    const apiUrl = 'https://api.github.com/repos/arduino/arduino-cli/releases/latest';
    const resp = await fetch(apiUrl, { headers: { 'User-Agent': 'NodeJS' } });
    const data = await resp.json();
    console.log(`Versao detectada: ${data.tag_name}`);

    const asset = data.assets.find((a) => a.name.includes('Windows_64bit.zip'));
    if (!asset) {
      throw new Error('Asset Windows_64bit.zip nao encontrado.');
    }

    const downloadUrl = asset.browser_download_url;
    const zipPath = path.join(binDir, 'arduino-cli.zip');

    console.log(`Baixando de: ${downloadUrl}`);
    await downloadFile(downloadUrl, zipPath);

    console.log(`Extraindo para ${binDir}...`);
    // Usar tar -xf que vem nativo no Windows 10/11
    try {
      execSync(`tar -xf "${zipPath}" -C "${binDir}"`);
    } catch {
      execSync(`powershell -Command "Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${binDir}' -Force"`);
    }

    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    console.log(`✔ arduino-cli configurado com sucesso em: ${path.join(binDir, 'arduino-cli.exe')}`);
  } catch (err) {
    console.error('Erro ao configurar arduino-cli:', err);
    process.exit(1);
  }
}

main();
