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
let targetArchArg = 'all';

for (const arg of args) {
  if (arg.startsWith('--arch=')) {
    targetArchArg = arg.split('=')[1].toLowerCase();
  }
}

const buildX64 = targetArchArg === 'x64' || targetArchArg === 'all';
const buildArm64 = targetArchArg === 'arm64' || targetArchArg === 'all';

console.log('==========================================================');
console.log(`  PIPELINE DUAL-BUILD ARDUINO TURBO IDE                   `);
console.log(`  Alvos selecionados: ${buildX64 && buildArm64 ? 'x64 + ARM64 (Dual Target)' : buildX64 ? 'Apenas x64' : 'Apenas ARM64'}`);
console.log('==========================================================');

// 1. Compilação do Frontend e Electron com Vite
console.log('\n[1/3] Compilando assets e TypeScript (Vite)...');
execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' });

// Função para empacotar e exportar por arquitetura
function packageAndExport(arch, label, folderName, zipName) {
  console.log(`\n----------------------------------------------------------`);
  console.log(`[2/3] Empacotando aplicação nativa para ${label} (${arch})...`);
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
      console.log(`   🎨 Injetando ícone nativo oficial no executável via rcedit...`);
      execSync(`"${rceditExe}" "${targetExe}" --set-icon "${appIconIco}" --set-version-string "FileDescription" "Arduino Turbo IDE" --set-version-string "ProductName" "Arduino Turbo IDE"`, { stdio: 'inherit' });
      console.log(`   ✔ Ícone e metadados injetados com sucesso no executável.`);
    } catch (e) {
      console.warn('   Aviso ao rodar rcedit no executável:', e.message);
    }
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
