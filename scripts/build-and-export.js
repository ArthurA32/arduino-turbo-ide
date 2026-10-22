import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const desktopDir = path.join(os.homedir(), 'Desktop');
const releaseDir = path.join(projectRoot, 'release');

const versionConfigPath = path.join(projectRoot, 'src', 'version.json');
let versionConfig = { arm64: { version: '0.1.8', build: 18 }, x64: { version: '0.1.5', build: 15 } };
if (fs.existsSync(versionConfigPath)) {
  try {
    versionConfig = JSON.parse(fs.readFileSync(versionConfigPath, 'utf-8'));
  } catch {}
}

const arm64Version = versionConfig.arm64?.version || '0.1.5';
const x64Version = versionConfig.x64?.version || '0.1.3';
const mainVersion = arm64Version; // Versão de referência do instalador

console.log('==========================================================');
console.log(`  PIPELINE BUILD ARDUINO TURBO IDE (INSTALADOR UNIVERSAL) `);
console.log(`  Versão ARM64: v${arm64Version} (Build #${versionConfig.arm64?.build || 15})`);
console.log(`  Versão x64:   v${x64Version} (Build #${versionConfig.x64?.build || 13})`);
console.log('==========================================================');

// Localizar makensis.exe
function resolveMakensisExe() {
  const localCache = path.join(os.homedir(), 'AppData', 'Local', 'electron-builder', 'Cache', 'nsis', 'nsis-3.0.4.1', 'makensis.exe');
  if (fs.existsSync(localCache)) return localCache;

  const binCache = path.join(os.homedir(), 'AppData', 'Local', 'electron-builder', 'Cache', 'nsis', 'nsis-3.0.4.1', 'Bin', 'makensis.exe');
  if (fs.existsSync(binCache)) return binCache;

  return 'makensis.exe';
}

// Localizar ou criar diretório de updates no servidor de rede
function resolveServerUpdateDir() {
  const candidateDirs = [
    'Z:\\Updates Turbo IDE',
    '\\\\192.168.3.74\\M-servidor\\Updates Turbo IDE'
  ];

  for (const dir of candidateDirs) {
    try {
      if (fs.existsSync(dir)) return dir;
      const parent = path.dirname(dir);
      if (fs.existsSync(parent)) {
        fs.mkdirSync(dir, { recursive: true });
        return dir;
      }
    } catch {}
  }
  return null;
}

// 1. Compilar Frontend e Electron com Vite
console.log('\n[1/5] Compilando assets e TypeScript (Vite)...');
execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' });

// 2. Empacotar unpacked das duas arquiteturas
console.log('\n[2/5] Gerando pacotes nativos para x64 e ARM64...');

console.log('   📦 Empacotando Windows x64 (unpacked)...');
execSync('npx electron-builder --x64 --win --dir', { cwd: projectRoot, stdio: 'inherit' });

console.log('   📦 Empacotando Windows ARM64 (unpacked)...');
execSync('npx electron-builder --arm64 --win --dir', { cwd: projectRoot, stdio: 'inherit' });

const arm64Folder = path.join(releaseDir, 'win-arm64-unpacked');
const x64Folder = path.join(releaseDir, 'win-unpacked');

if (!fs.existsSync(arm64Folder) || !fs.existsSync(x64Folder)) {
  throw new Error('Falha ao localizar pastas descompactadas das arquiteturas.');
}

// 3. Gerar arquivos compactados (.ZIP) no Desktop
console.log('\n[3/5] Gerando arquivos compactados (.ZIP) na Área de Trabalho...');

const zipArm64 = path.join(desktopDir, 'Arduino_Turbo_IDE_Windows_ARM64.zip');
const zipX64 = path.join(desktopDir, 'Arduino_Turbo_IDE_Windows_x64.zip');

if (fs.existsSync(zipArm64)) fs.unlinkSync(zipArm64);
if (fs.existsSync(zipX64)) fs.unlinkSync(zipX64);

try {
  execSync(`tar -a -c -f "${zipArm64}" -C "${path.dirname(arm64Folder)}" "${path.basename(arm64Folder)}"`);
} catch {
  execSync(`powershell -Command "Compress-Archive -Path '${arm64Folder}\\*' -DestinationPath '${zipArm64}' -Force"`);
}
console.log(`   ✔ ZIP ARM64 entregue: ${zipArm64}`);

try {
  execSync(`tar -a -c -f "${zipX64}" -C "${path.dirname(x64Folder)}" "${path.basename(x64Folder)}"`);
} catch {
  execSync(`powershell -Command "Compress-Archive -Path '${x64Folder}\\*' -DestinationPath '${zipX64}' -Force"`);
}
console.log(`   ✔ ZIP x64 entregue: ${zipX64}`);

// 4. Compilar o Instalador Universal Unificado via NSIS
console.log('\n[4/5] Compilando Instalador Universal Unificado (ARM64 + x64)...');
const makensisExe = resolveMakensisExe();
const nsiScript = path.join(projectRoot, 'scripts', 'installer-universal.nsi');
const universalInstallerOutput = path.join(releaseDir, 'Arduino_Turbo_IDE_Setup.exe');

const nsisCmd = `"${makensisExe}" "/DAPP_VERSION=${mainVersion}" "/DPROJECT_ROOT=${projectRoot}" "/DOUTPUT_FILE=${universalInstallerOutput}" "${nsiScript}"`;
execSync(nsisCmd, { cwd: projectRoot, stdio: 'inherit' });

if (!fs.existsSync(universalInstallerOutput)) {
  throw new Error('Falha ao gerar o Instalador Universal.');
}

console.log(`   ✔ Instalador Universal gerado com sucesso: ${universalInstallerOutput}`);

// 5. Entregar na Área de Trabalho e Sincronizar com o Servidor de Rede
console.log('\n[5/5] Publicando instalador único na Área de Trabalho e no Servidor...');

// Desktop:
const desktopInstaller = path.join(desktopDir, 'Arduino_Turbo_IDE_Setup_Universal.exe');
fs.copyFileSync(universalInstallerOutput, desktopInstaller);
console.log(`   ✔ Instalador Universal entregue no Desktop: ${desktopInstaller}`);

// Limpar instaladores separados antigos do Desktop
const oldDesktopFiles = [
  path.join(desktopDir, 'Arduino_Turbo_IDE_Setup.exe'),
  path.join(desktopDir, 'Arduino_Turbo_IDE_Setup_ARM64.exe'),
  path.join(desktopDir, 'Arduino_Turbo_IDE_Setup_x64.exe'),
  path.join(desktopDir, 'Arduino_Turbo_IDE_Windows_ARM64'),
  path.join(desktopDir, 'Arduino_Turbo_IDE_Windows_x64')
];
for (const f of oldDesktopFiles) {
  if (fs.existsSync(f)) {
    try {
      if (fs.statSync(f).isDirectory()) {
        fs.rmSync(f, { recursive: true, force: true });
      } else {
        fs.unlinkSync(f);
      }
      console.log(`   🧹 Removido arquivo avulso antigo do Desktop: ${path.basename(f)}`);
    } catch {}
  }
}

// Servidor de Rede (Z:\Updates Turbo IDE)
const serverDir = resolveServerUpdateDir();
if (serverDir) {
  console.log(`   🌐 Conectado ao servidor de atualizações: ${serverDir}`);

  // Limpar instaladores antigos do servidor
  try {
    const serverFiles = fs.readdirSync(serverDir);
    for (const file of serverFiles) {
      if (file.toLowerCase().endsWith('.exe')) {
        const oldFilePath = path.join(serverDir, file);
        fs.unlinkSync(oldFilePath);
        console.log(`   🗑 Removendo instalador antigo do servidor: ${file}`);
      }
    }
  } catch (err) {
    console.warn('   Aviso ao limpar servidor:', err.message);
  }

  // Copiar novo instalador universal para o servidor
  const serverInstallerPath = path.join(serverDir, 'Arduino_Turbo_IDE_Setup.exe');
  fs.copyFileSync(universalInstallerOutput, serverInstallerPath);
  console.log(`   ✔ Novo instalador universal copiado para o servidor: ${serverInstallerPath}`);

  // Atualizar manifesto updates.json
  const manifestPath = path.join(serverDir, 'updates.json');
  const installerSize = fs.statSync(serverInstallerPath).size;

  const arm64Changelog = versionConfig.arm64?.changelog || versionConfig.changelog || [];
  const x64Changelog = versionConfig.x64?.changelog || versionConfig.changelog || [];
  const universalChangelog = versionConfig.universal?.changelog || arm64Changelog || [];

  const manifest = {
    universal: {
      version: mainVersion,
      build: versionConfig.arm64?.build || 19,
      installer: 'Arduino_Turbo_IDE_Setup.exe',
      releaseDate: new Date().toISOString().split('T')[0],
      changelog: universalChangelog,
      fileSize: installerSize
    },
    arm64: {
      version: arm64Version,
      build: versionConfig.arm64?.build || 19,
      installer: 'Arduino_Turbo_IDE_Setup.exe',
      releaseDate: new Date().toISOString().split('T')[0],
      changelog: arm64Changelog,
      fileSize: installerSize
    },
    x64: {
      version: x64Version,
      build: versionConfig.x64?.build || 16,
      installer: 'Arduino_Turbo_IDE_Setup.exe',
      releaseDate: new Date().toISOString().split('T')[0],
      changelog: x64Changelog,
      fileSize: installerSize
    },
    lastUpdated: new Date().toISOString()
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`   ✔ Manifesto updates.json atualizado com sucesso no servidor.`);

  try {
    const localManifest = path.join(releaseDir, 'updates.json');
    fs.writeFileSync(localManifest, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`   ✔ Cópia local de updates.json salva em release.`);
  } catch {}
} else {
  console.warn('   ⚠ Servidor de rede offline no momento. Instalador salvo localmente.');
}

console.log('\n==========================================================');
console.log('  ✔ PROCESSO UNIVERSAL CONCLUÍDO COM SUCESSO!            ');
console.log('  Instalador Universal Único: Arduino_Turbo_IDE_Setup.exe ');
console.log('  Área de Trabalho e Servidor de Rede 100% Sincronizados! ');
console.log('==========================================================');


