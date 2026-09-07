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
let versionConfig = { arm64: { version: '0.1.3', build: 13 }, x64: { version: '0.1.1', build: 11 } };
if (fs.existsSync(versionConfigPath)) {
  try {
    versionConfig = JSON.parse(fs.readFileSync(versionConfigPath, 'utf-8'));
  } catch {}
}

console.log('==========================================================');
console.log(`  PIPELINE BUILD ARDUINO TURBO IDE                        `);
console.log(`  Alvos selecionados: ${buildX64 && buildArm64 ? 'x64 + ARM64 (Dual Target)' : buildX64 ? 'Apenas x64' : 'Apenas ARM64'}`);
if (buildArm64) console.log(`  Versão ARM64: v${versionConfig.arm64?.version || '0.1.3'} (Build #${versionConfig.arm64?.build || 13})`);
if (buildX64) console.log(`  Versão x64:   v${versionConfig.x64?.version || '0.1.1'} (Build #${versionConfig.x64?.build || 11})`);
console.log('==========================================================');

// 1. Compilação do Frontend e Electron com Vite
console.log('\n[1/3] Compilando assets e TypeScript (Vite)...');
execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' });

// Função para empacotar e exportar por arquitetura
function packageAndExport(arch, label, folderName, zipName) {
  const archVersion = versionConfig[arch]?.version || '0.1.3';
  const archBuild = versionConfig[arch]?.build || 13;

  console.log(`\n----------------------------------------------------------`);
  console.log(`[2/3] Empacotando aplicação nativa para ${label} (${arch}) v${archVersion}...`);
  console.log(`----------------------------------------------------------`);

  execSync(`npx electron-builder --${arch} --win --dir`, { cwd: projectRoot, stdio: 'inherit' });

  const candidateFolders = [
    path.join(releaseDir, `win-${arch}-unpacked`),
    path.join(releaseDir, arch === 'x64' ? 'win-unpacked' : `win-${arch}-unpacked`)
  ];

  let packagedFolder = candidateFolders.find(f => fs.existsSync(f));

  if (!packagedFolder) {
    throw new Error(`Pasta de saída do electron-builder não encontrada. Verificados: ${candidateFolders.join(', ')}`);
  }

  const targetOutputDir = path.join(desktopDir, folderName);
  const targetZip = path.join(desktopDir, zipName);

  console.log(`\n[3/3] Exportando versão ${label} para a Área de Trabalho...`);

  // Tentar remover pasta anterior de forma segura com retries se necessário
  if (fs.existsSync(targetOutputDir)) {
    try {
      fs.rmSync(targetOutputDir, { recursive: true, force: true });
    } catch (rmErr) {
      console.warn(`Aviso: Tentando fechar processos pendentes para substituir a pasta...`);
      try {
        execSync('taskkill /F /IM "Arduino Turbo IDE.exe" /T', { stdio: 'ignore' });
      } catch {}
      // Esperar 500ms
      const start = Date.now();
      while (Date.now() - start < 500) {}
      fs.rmSync(targetOutputDir, { recursive: true, force: true });
    }
  }

  // Copiar pasta descompactada
  fs.cpSync(packagedFolder, targetOutputDir, { recursive: true });

  // Injetar ícone e propriedades nativas no executável via rcedit
  const rceditExe = path.join(projectRoot, 'bin', 'tools', 'rcedit.exe');
  const appIconIco = path.join(projectRoot, 'build', 'icon.ico');
  const appIconPng = path.join(projectRoot, 'build', 'icon.png');
  const targetExe = path.join(targetOutputDir, 'Arduino Turbo IDE.exe');

  if (fs.existsSync(appIconIco)) {
    fs.copyFileSync(appIconIco, path.join(targetOutputDir, 'resources', 'icon.ico'));
  }
  if (fs.existsSync(appIconPng)) {
    fs.copyFileSync(appIconPng, path.join(targetOutputDir, 'resources', 'icon.png'));
  }

  if (fs.existsSync(rceditExe) && fs.existsSync(appIconIco) && fs.existsSync(targetExe)) {
    try {
      console.log(`   🎨 Injetando ícone nativo oficial e versão v${archVersion} (${arch.toUpperCase()}) no executável via rcedit...`);
      execSync(`"${rceditExe}" "${targetExe}" --set-icon "${appIconIco}" --set-file-version "${archVersion}" --set-product-version "${archVersion}" --set-version-string "FileVersion" "${archVersion}" --set-version-string "ProductVersion" "${archVersion} (${arch.toUpperCase()})" --set-version-string "FileDescription" "Arduino Turbo IDE (${arch.toUpperCase()})" --set-version-string "ProductName" "Arduino Turbo IDE"`, { stdio: 'inherit' });
      console.log(`   ✔ Ícone e metadados de versão v${archVersion} injetados com sucesso no executável.`);
    } catch (e) {
      console.warn('   Aviso ao rodar rcedit no executável:', e.message);
    }
  }

  // Copiar version.json para pasta resources do aplicativo
  try {
    const resDir = path.join(targetOutputDir, 'resources');
    fs.mkdirSync(resDir, { recursive: true });
    fs.copyFileSync(versionConfigPath, path.join(resDir, 'version.json'));
    const appSrcDir = path.join(targetOutputDir, 'resources', 'app', 'src');
    fs.mkdirSync(appSrcDir, { recursive: true });
    fs.copyFileSync(versionConfigPath, path.join(appSrcDir, 'version.json'));
  } catch (err) {
    console.warn('   Aviso ao copiar version.json para resources:', err.message);
  }

  // Copiar binários nativos dedicados do arduino-cli de acordo com a arquitetura
  const destBin = path.join(targetOutputDir, 'resources', 'bin');
  fs.mkdirSync(destBin, { recursive: true });
  
  const archSpecificCli = path.join(projectRoot, 'bin', arch, 'arduino-cli.exe');
  const genericCli = path.join(projectRoot, 'bin', 'arduino-cli.exe');
  const sourceCli = fs.existsSync(archSpecificCli) ? archSpecificCli : genericCli;

  if (fs.existsSync(sourceCli)) {
    fs.copyFileSync(sourceCli, path.join(destBin, 'arduino-cli.exe'));
    
    // Também garantir dentro de resources/app/bin se existir
    const appBin = path.join(targetOutputDir, 'resources', 'app', 'bin');
    fs.mkdirSync(appBin, { recursive: true });
    fs.copyFileSync(sourceCli, path.join(appBin, 'arduino-cli.exe'));
    console.log(`   ✔ Binário nativo ${arch.toUpperCase()} do arduino-cli integrado com sucesso.`);
  }

  // Se for ARM64, copiar o runtime Python ARM64 nativo para aceleração do flasher
  if (arch === 'arm64') {
    const pythonSrc = path.join(projectRoot, 'bin', 'arm64', 'python');
    if (fs.existsSync(pythonSrc)) {
      const destPython = path.join(destBin, 'arm64', 'python');
      fs.mkdirSync(destPython, { recursive: true });
      fs.cpSync(pythonSrc, destPython, { recursive: true });
      console.log(`   ✔ Runtime Python ARM64 nativo integrado com sucesso para aceleração do flasher.`);
    }
  }

  // Gerar arquivo ZIP na Área de Trabalho
  if (fs.existsSync(targetZip)) {
    fs.unlinkSync(targetZip);
  }
  console.log(`Criando arquivo compactado (.ZIP): ${targetZip}`);
  try {
    execSync(`tar -a -c -f "${targetZip}" -C "${desktopDir}" "${folderName}"`);
  } catch {
    execSync(`powershell -Command "Compress-Archive -Path '${targetOutputDir}\\*' -DestinationPath '${targetZip}' -Force"`);
  }

  console.log(`✔ [${label}] Entregue com sucesso na Área de Trabalho:`);
  console.log(`   📁 Pasta: ${targetOutputDir}`);
  console.log(`   📦 ZIP: ${targetZip}`);
  console.log(`   🚀 Executável: ${path.join(targetOutputDir, 'Arduino Turbo IDE.exe')}`);
}

// Executar builds solicitados
try {
  if (buildX64) {
    packageAndExport('x64', 'Windows x64', 'Arduino_Turbo_IDE_Windows_x64', 'Arduino_Turbo_IDE_Windows_x64.zip');
  }

  if (buildArm64) {
    packageAndExport('arm64', 'Windows ARM64', 'Arduino_Turbo_IDE_Windows_ARM64', 'Arduino_Turbo_IDE_Windows_ARM64.zip');
  }

  console.log('\n==========================================================');
  console.log('  ✔ PROCESSO DUAL-BUILD CONCLUÍDO COM SUCESSO!           ');
  console.log('==========================================================');
} catch (err) {
  console.error('\n❌ Erro durante o processo de compilação:', err);
  process.exit(1);
}
