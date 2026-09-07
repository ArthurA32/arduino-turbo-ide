const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

module.exports = async function(context) {
  const projectRoot = context.packager.projectDir;
  const appOutDir = context.appOutDir;
  const isArm = context.arch === 3 || context.arch === 'arm64' || String(context.arch).toLowerCase().includes('arm');
  const archName = isArm ? 'arm64' : 'x64';

  console.log(`\n[afterPack] Injetando recursos nativos para ${archName.toUpperCase()} em ${appOutDir}...`);

  // 1. Injetar version.json
  const versionConfigPath = path.join(projectRoot, 'src', 'version.json');
  if (fs.existsSync(versionConfigPath)) {
    const resDir = path.join(appOutDir, 'resources');
    fs.mkdirSync(resDir, { recursive: true });
    fs.copyFileSync(versionConfigPath, path.join(resDir, 'version.json'));
    const appSrcDir = path.join(appOutDir, 'resources', 'app', 'src');
    fs.mkdirSync(appSrcDir, { recursive: true });
    fs.copyFileSync(versionConfigPath, path.join(appSrcDir, 'version.json'));
  }

  // 2. Injetar arduino-cli nativo da arquitetura em resources/bin
  const resBin = path.join(appOutDir, 'resources', 'bin');
  fs.mkdirSync(resBin, { recursive: true });

  const archCli = path.join(projectRoot, 'bin', archName, 'arduino-cli.exe');
  const genericCli = path.join(projectRoot, 'bin', 'arduino-cli.exe');
  const srcCli = fs.existsSync(archCli) ? archCli : genericCli;
  if (fs.existsSync(srcCli)) {
    fs.copyFileSync(srcCli, path.join(resBin, 'arduino-cli.exe'));
    console.log(`[afterPack] ✔ arduino-cli.exe nativo (${archName}) copiado para resources/bin`);
  }

  // 3. Se ARM64, injetar runtime Python ARM64 nativo
  if (archName === 'arm64') {
    const pythonSrc = path.join(projectRoot, 'bin', 'arm64', 'python');
    if (fs.existsSync(pythonSrc)) {
      const destPython = path.join(resBin, 'arm64', 'python');
      fs.mkdirSync(destPython, { recursive: true });
      fs.cpSync(pythonSrc, destPython, { recursive: true });
      console.log(`[afterPack] ✔ Runtime Python ARM64 nativo injetado em resources/bin/arm64/python`);
    }
  }

  // 4. Copiar icon.ico e icon.png para pasta resources
  const appIconIco = path.join(projectRoot, 'build', 'icon.ico');
  const appIconPng = path.join(projectRoot, 'build', 'icon.png');
  const resDir = path.join(appOutDir, 'resources');
  fs.mkdirSync(resDir, { recursive: true });

  if (fs.existsSync(appIconIco)) {
    fs.copyFileSync(appIconIco, path.join(resDir, 'icon.ico'));
  }
  if (fs.existsSync(appIconPng)) {
    fs.copyFileSync(appIconPng, path.join(resDir, 'icon.png'));
  }

  // 5. Injetar ícone no executável via rcedit se disponível
  const rceditExe = path.join(projectRoot, 'bin', 'tools', 'rcedit.exe');
  const targetExe = path.join(appOutDir, 'Arduino Turbo IDE.exe');

  if (fs.existsSync(rceditExe) && fs.existsSync(appIconIco) && fs.existsSync(targetExe)) {
    try {
      execSync(`"${rceditExe}" "${targetExe}" --set-icon "${appIconIco}"`, { stdio: 'ignore' });
      console.log(`[afterPack] ✔ Ícone oficial verificado no executável.`);
    } catch (e) {
      console.warn('[afterPack] Aviso rcedit:', e.message);
    }
  }
};
