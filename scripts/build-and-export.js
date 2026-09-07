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

// Fechar instâncias em execução para liberar o lock de arquivos no Windows
try {
  execSync('taskkill /F /IM "Arduino Turbo IDE.exe" /T', { stdio: 'ignore' });
} catch {}

const args = process.argv.slice(2);
let targetArchArg = 'arm64';

for (const arg of args) {
  if (arg.startsWith('--arch=')) {
    targetArchArg = arg.split('=')[1].toLowerCase();
  }
}

const buildX64 = targetArchArg === 'x64' || targetArchArg === 'all';
const buildArm64 = targetArchArg === 'arm64' || targetArchArg === 'all';

const versionConfigPath = path.join(projectRoot, 'src', 'version.json');
let versionConfig = { arm64: { version: '0.1.5', build: 15 }, x64: { version: '0.1.3', build: 13 } };
if (fs.existsSync(versionConfigPath)) {
  try {
    versionConfig = JSON.parse(fs.readFileSync(versionConfigPath, 'utf-8'));
  } catch {}
}

console.log('==========================================================');
console.log(`  PIPELINE BUILD ARDUINO TURBO IDE (INSTALLER + ZIP + UPDATES)`);
console.log(`  Alvos selecionados: ${buildX64 && buildArm64 ? 'x64 + ARM64 (Dual Target)' : buildX64 ? 'Apenas x64' : 'Apenas ARM64'}`);
if (buildArm64) console.log(`  Versão ARM64: v${versionConfig.arm64?.version || '0.1.5'} (Build #${versionConfig.arm64?.build || 15})`);
if (buildX64) console.log(`  Versão x64:   v${versionConfig.x64?.version || '0.1.3'} (Build #${versionConfig.x64?.build || 13})`);
console.log('==========================================================');

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

// 1. Compilação do Frontend e Electron com Vite
console.log('\n[1/4] Compilando assets e TypeScript (Vite)...');
execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' });

// Função para empacotar, gerar instalador NSIS e sincronizar servidor
function packageAndExport(arch, label, folderName, zipName) {
  const archVersion = versionConfig[arch]?.version || '0.1.5';
  const archBuild = versionConfig[arch]?.build || 15;
  const archLabel = arch === 'arm64' ? 'ARM64' : 'x64';

  console.log(`\n----------------------------------------------------------`);
  console.log(`[2/4] Gerando instalador NSIS e binário para ${label} (${arch}) v${archVersion}...`);
  console.log(`----------------------------------------------------------`);

  // Sincronizar package.json version antes de empacotar
  const pkgPath = path.join(projectRoot, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    pkg.version = archVersion;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  } catch {}

  // Executar electron-builder (produz o unpacked e o instalador NSIS)
  execSync(`npx electron-builder --${arch} --win`, { cwd: projectRoot, stdio: 'inherit' });

  // Localizar pasta descompactada
  const candidateFolders = [
    path.join(releaseDir, `win-${arch}-unpacked`),
    path.join(releaseDir, arch === 'x64' ? 'win-unpacked' : `win-${arch}-unpacked`)
  ];
  let packagedFolder = candidateFolders.find(f => fs.existsSync(f));
  if (!packagedFolder) {
    throw new Error(`Pasta de saída do electron-builder não encontrada: ${candidateFolders.join(', ')}`);
  }

  // Localizar instalador NSIS gerado pelo electron-builder
  const candidateInstallers = [
    path.join(releaseDir, `Arduino_Turbo_IDE_Setup_${arch}.exe`),
    path.join(releaseDir, `Arduino Turbo IDE Setup ${archVersion}.exe`),
    path.join(releaseDir, `Arduino_Turbo_IDE_Setup_${archVersion}.exe`)
  ];
  let sourceInstaller = candidateInstallers.find(f => fs.existsSync(f));

  if (!sourceInstaller) {
    // Busca qualquer .exe de instalador na pasta release
    const allExes = fs.readdirSync(releaseDir).filter(f => f.endsWith('.exe') && f.includes('Setup'));
    if (allExes.length > 0) {
      sourceInstaller = path.join(releaseDir, allExes[0]);
    } else {
      throw new Error(`Instalador NSIS não encontrado em ${releaseDir}`);
    }
  }

  console.log(`   ✔ Instalador gerado: ${sourceInstaller}`);

  console.log(`\n[3/4] Exportando instalador (.exe) e arquivo .zip para a Área de Trabalho...`);

  // 1. Limpar pastas descompactadas soltas na Área de Trabalho (conforme regra estrita do usuário)
  const looseDesktopFolder = path.join(desktopDir, folderName);
  if (fs.existsSync(looseDesktopFolder)) {
    console.log(`   🧹 Removendo pasta descompactada solta da Área de Trabalho: ${folderName}`);
    try {
      fs.rmSync(looseDesktopFolder, { recursive: true, force: true });
    } catch {}
  }

  // 2. Copiar instalador para a Área de Trabalho
  const desktopInstallerName = `Arduino_Turbo_IDE_Setup_${archLabel}.exe`;
  const desktopInstallerPath = path.join(desktopDir, desktopInstallerName);
  fs.copyFileSync(sourceInstaller, desktopInstallerPath);
  console.log(`   ✔ Instalador (.exe) entregue no Desktop: ${desktopInstallerPath}`);

  // 3. Gerar arquivo compactado (.zip) da aplicação na Área de Trabalho
  const targetZip = path.join(desktopDir, zipName);
  if (fs.existsSync(targetZip)) {
    fs.unlinkSync(targetZip);
  }
  console.log(`   📦 Gerando arquivo compactado (.ZIP): ${targetZip}`);
  try {
    execSync(`tar -a -c -f "${targetZip}" -C "${path.dirname(packagedFolder)}" "${path.basename(packagedFolder)}"`);
  } catch {
    execSync(`powershell -Command "Compress-Archive -Path '${packagedFolder}\\*' -DestinationPath '${targetZip}' -Force"`);
  }
  console.log(`   ✔ Arquivo ZIP entregue no Desktop: ${targetZip}`);

  // 4. Sincronizar servidor de atualizações na rede local (Z:\Updates Turbo IDE)
  console.log(`\n[4/4] Sincronizando servidor de rede para atualizações automáticas...`);
  const serverDir = resolveServerUpdateDir();

  if (serverDir) {
    console.log(`   🌐 Conectado ao servidor de atualizações: ${serverDir}`);

    // Limpar instaladores antigos desta arquitetura no servidor
    try {
      const serverFiles = fs.readdirSync(serverDir);
      for (const file of serverFiles) {
        if (file.toLowerCase().endsWith('.exe') && file.toLowerCase().includes(archLabel.toLowerCase())) {
          const oldFilePath = path.join(serverDir, file);
          console.log(`   🗑 Removendo versão antiga do servidor: ${file}`);
          fs.unlinkSync(oldFilePath);
        }
      }
    } catch (err) {
      console.warn('   Aviso ao limpar versões antigas no servidor:', err.message);
    }

    // Copiar o novo instalador para a pasta de updates do servidor
    const serverInstallerPath = path.join(serverDir, desktopInstallerName);
    fs.copyFileSync(sourceInstaller, serverInstallerPath);
    console.log(`   ✔ Novo instalador copiado para o servidor: ${serverInstallerPath}`);

    // Atualizar manifesto updates.json no servidor
    const manifestPath = path.join(serverDir, 'updates.json');
    let manifest = {};
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      } catch {}
    }

    manifest[arch] = {
      version: archVersion,
      build: archBuild,
      installer: desktopInstallerName,
      releaseDate: new Date().toISOString().split('T')[0],
      changelog: `Build v${archVersion} (#${archBuild}) com instalador nativo automático e suporte a updates via rede local.`,
      fileSize: fs.statSync(serverInstallerPath).size
    };
    manifest.lastUpdated = new Date().toISOString();

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`   ✔ Manifesto updates.json atualizado no servidor com sucesso.`);
  } else {
    console.warn('   ⚠ Servidor local offline ou inacessível no momento. O instalador ficou salvo localmente.');
  }

  console.log(`\n✔ [${label}] Processo finalizado com sucesso!`);
}

// Executar builds solicitados
try {
  if (buildX64) {
    packageAndExport('x64', 'Windows x64', 'Arduino_Turbo_IDE_Windows_x64', 'Arduino_Turbo_IDE_Windows_x64.zip');
  }

  if (buildArm64) {
    packageAndExport('arm64', 'Windows ARM64', 'Arduino_Turbo_IDE_Windows_ARM64', 'Arduino_Turbo_IDE_Windows_ARM64.zip');
  }

  // Garantir que nenhuma pasta descompactada fique solta no Desktop
  const looseDirs = [
    path.join(desktopDir, 'Arduino_Turbo_IDE_Windows_ARM64'),
    path.join(desktopDir, 'Arduino_Turbo_IDE_Windows_x64')
  ];
  for (const d of looseDirs) {
    if (fs.existsSync(d)) {
      try { fs.rmSync(d, { recursive: true, force: true }); } catch {}
    }
  }

  console.log('\n==========================================================');
  console.log('  ✔ PROCESSO CONCLUÍDO COM SUCESSO!                      ');
  console.log('  Instaladores (.exe) e arquivos (.zip) na Área de Trabalho.');
  console.log('  Servidor de rede atualizado com o último release.');
  console.log('==========================================================');
} catch (err) {
  console.error('\n❌ Erro durante o processo de compilação:', err);
  process.exit(1);
}

