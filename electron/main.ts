import { app, BrowserWindow, ipcMain, dialog, shell, session } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { serialManager } from './serialManager';
import { arduinoCliService, POPULAR_BOARDS } from './arduinoCli';
import { diagnostics } from './diagnostics';
import { nativeSerial } from './nativeSerial';
import { detectSystemProfile } from './systemProfile';
import { firmwareReaderService } from './firmwareReader';


// ==========================================================
// 1. SISTEMA DE RESILIÊNCIA E CRASH LOGGING EMERGENCIAL
// ==========================================================
function logEmergencyCrash(type: string, error: any) {
  try {
    const errorStr = `==========================================================\n` +
      `[${new Date().toISOString()}] CRASH DETECTADO: ${type}\n` +
      `Mensagem: ${error?.message || error}\n` +
      `Stack:\n${error?.stack || 'N/A'}\n` +
      `Process Arch: ${process.arch}\n` +
      `OS Arch: ${os.arch()}\n` +
      `Process ExecPath: ${process.execPath}\n` +
      `App IsPackaged: ${app.isPackaged}\n` +
      `==========================================================\n\n`;

    const desktopLog = path.join(os.homedir(), 'Desktop', 'arduino_ide_crash.log');
    fs.appendFileSync(desktopLog, errorStr, 'utf-8');

    const tempLog = path.join(os.tmpdir(), 'arduino_ide_crash.log');
    fs.appendFileSync(tempLog, errorStr, 'utf-8');
  } catch (e) {
    console.error('Falha crítica ao gravar crash log:', e);
  }
}

process.on('uncaughtException', (err) => {
  logEmergencyCrash('UNCAUGHT_EXCEPTION', err);
});

process.on('unhandledRejection', (reason) => {
  logEmergencyCrash('UNHANDLED_REJECTION', reason);
});

// ==========================================================
// 2. CONTROLE DE INSTÂNCIA ÚNICA
// ==========================================================
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.exit(0);
}

// ==========================================================
// 3. RESOLUÇÃO SEGURA DE CAMINHOS
// ==========================================================
function getDirname(): string {
  if (typeof __dirname !== 'undefined' && __dirname) {
    return __dirname;
  }
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return path.dirname(process.execPath);
  }
}

const currentDir = getDirname();
let mainWindow: BrowserWindow | null = null;
let lastBuildDir: string = '';

function resolvePreloadPath(): string | undefined {
  const candidates = [
    path.join(currentDir, 'preload.js'),
    path.join(currentDir, 'preload.cjs'),
    path.join(app.getAppPath(), 'dist-electron', 'preload.js'),
    path.join(process.resourcesPath, 'app', 'dist-electron', 'preload.js')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function resolveIndexPath(): string {
  const candidates = [
    path.join(currentDir, '..', 'dist', 'index.html'),
    path.join(app.getAppPath(), 'dist', 'index.html'),
    path.join(app.getAppPath(), 'index.html'),
    path.join(process.resourcesPath, 'app', 'dist', 'index.html')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(currentDir, '..', 'dist', 'index.html');
}

function resolveAppIcon(): string | undefined {
  const candidates = [
    path.join(process.resourcesPath, 'icon.png'),
    path.join(process.resourcesPath, 'icon.ico'),
    path.join(process.resourcesPath, 'app', 'build', 'icon.png'),
    path.join(process.resourcesPath, 'app', 'build', 'icon.ico'),
    path.join(currentDir, '..', 'build', 'icon.png'),
    path.join(currentDir, '..', 'build', 'icon.ico'),
    path.join(currentDir, '..', 'public', 'icon.png'),
    path.join(app.getAppPath(), 'build', 'icon.png'),
    path.join(app.getAppPath(), 'build', 'icon.ico')
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

// ==========================================================
// 4. CRIAÇÃO DA JANELA PRINCIPAL
// ==========================================================
function createWindow() {
  try {
    const preload = resolvePreloadPath();
    const appIcon = resolveAppIcon();

    mainWindow = new BrowserWindow({
      width: 1240,
      height: 820,
      minWidth: 920,
      minHeight: 620,
      backgroundColor: '#1E1E1E',
      frame: true,
      title: 'Arduino Turbo IDE',
      icon: appIcon,
      webPreferences: {
        preload,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        spellcheck: false,
        backgroundThrottling: false
      }
    });

    mainWindow.on('restore', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('window:restored');
      }
    });

    // Fila inteligente com loteamento de IPC para evitar travamento ao receber fluxo serial pesado
    let pendingSerialLines: string[] = [];
    let serialIpcTimer: NodeJS.Timeout | null = null;

    const flushSerialIpc = () => {
      serialIpcTimer = null;
      if (pendingSerialLines.length === 0 || !mainWindow || mainWindow.isDestroyed()) {
        pendingSerialLines = [];
        return;
      }
      const toSend = pendingSerialLines;
      pendingSerialLines = [];
      mainWindow.webContents.send('serial:data', toSend.join('\n'));
    };

    nativeSerial.on('data', (text: string) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;

      pendingSerialLines.push(text);

      // Proteção contra estouro de memória no processo principal
      if (pendingSerialLines.length > 3000) {
        pendingSerialLines = pendingSerialLines.slice(-1500);
      }

      if (!serialIpcTimer) {
        serialIpcTimer = setTimeout(flushSerialIpc, 20); // ~50 FPS
      }
    });

    nativeSerial.on('status', (status: any) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('serial:status', status);
      }
    });

    const sessionRef = mainWindow.webContents.session;

    sessionRef.on('select-serial-port', (event, portList, webContents, callback) => {
      event.preventDefault();
      if (portList && portList.length > 0) {
        callback(portList[0].portId);
      } else {
        callback('');
      }
    });

    sessionRef.setPermissionCheckHandler((webContents, permission) => {
      if (permission === 'serial') return true;
      return true;
    });

    sessionRef.setDevicePermissionHandler((details) => {
      if (details.deviceType === 'serial') return true;
      return true;
    });

    if (process.env.VITE_DEV_SERVER_URL) {
      mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
      const indexPath = resolveIndexPath();
      mainWindow.loadFile(indexPath).catch((err) => {
        logEmergencyCrash('LOAD_FILE_FAILED', err);
      });
    }

    mainWindow.on('closed', () => {
      nativeSerial.disconnect(true);
      mainWindow = null;
      app.exit(0); // Garante término imediato e absoluto de todo o processo
    });
  } catch (err) {
    logEmergencyCrash('CREATE_WINDOW_FAILED', err);
  }
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch((err) => {
  logEmergencyCrash('APP_READY_FAILED', err);
});

app.on('before-quit', () => {
  nativeSerial.disconnect(true);
});

app.on('window-all-closed', () => {
  nativeSerial.disconnect(true);
  app.exit(0);
});

// ==========================================
// 5. IPC HANDLERS NATIVOS
// ==========================================

ipcMain.handle('ports:list', async () => {
  try {
    return await serialManager.listPorts();
  } catch (e: any) {
    diagnostics.logAppError(`Erro ao listar portas: ${e.message}`);
    return [];
  }
});

ipcMain.handle('boards:list', async () => {
  try {
    return await arduinoCliService.listAllBoards();
  } catch (err: any) {
    console.warn('Falha ao listar placas completas, usando populares:', err?.message);
    return POPULAR_BOARDS;
  }
});

ipcMain.handle('serial:connect', async (event, { port, baudRate }) => {
  try {
    return await nativeSerial.connect(port, Number(baudRate));
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('serial:disconnect', () => {
  nativeSerial.disconnect();
  return true;
});

ipcMain.handle('serial:send', (event, text: string) => {
  return nativeSerial.send(text);
});

ipcMain.handle('serial:status', () => {
  return nativeSerial.getStatus();
});

ipcMain.handle('cli:status', async () => {
  try {
    return await arduinoCliService.checkStatus();
  } catch (e: any) {
    diagnostics.logAppError(`Erro ao checar status do CLI: ${e.message}`);
    return { found: false, path: '', version: 'Erro', cores: [], indexes: [] };
  }
});

ipcMain.handle('cli:init', async () => {
  try {
    await arduinoCliService.initConfig();
    return await arduinoCliService.checkStatus();
  } catch (e: any) {
    diagnostics.logAppError(`Erro ao inicializar CLI: ${e.message}`);
    return { found: false, path: '', version: 'Erro', cores: [], indexes: [] };
  }
});

ipcMain.handle('cli:installCore', async (event, coreName: string) => {
  try {
    return await arduinoCliService.installCore(coreName, (output) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('log:output', { type: 'system', text: output });
      }
    });
  } catch (e: any) {
    diagnostics.logAppError(`Erro ao instalar core ${coreName}: ${e.message}`);
    return false;
  }
});

ipcMain.handle('sketch:compile', async (event, { code, fqbn, files }) => {
  try {
    let result;
    if (files && Array.isArray(files) && files.length > 0) {
      result = await arduinoCliService.compileMultiFiles(files, fqbn, (output) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('log:output', { type: 'compile', text: output });
        }
      });
    } else {
      result = await arduinoCliService.compile(code, fqbn, (output) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('log:output', { type: 'compile', text: output });
        }
      });
    }

    if (result.success) {
      lastBuildDir = result.buildDir;
    }
    return result;
  } catch (e: any) {
    diagnostics.logAppError(`Erro na compilação: ${e.message}`);
    return { success: false, buildDir: '' };
  }
});

ipcMain.handle('sketch:upload', async (event, { code, fqbn, port, files }) => {
  try {
    nativeSerial.disconnect(true);
    serialManager.setUploading(true);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('serial:pause');
    }

    let compResult;
    if (files && Array.isArray(files) && files.length > 0) {
      compResult = await arduinoCliService.compileMultiFiles(files, fqbn, (output) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('log:output', { type: 'compile', text: output });
        }
      });
    } else {
      compResult = await arduinoCliService.compile(code, fqbn, (output) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('log:output', { type: 'compile', text: output });
        }
      });
    }

    if (!compResult.success || !compResult.buildDir) {
      serialManager.setUploading(false);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('serial:resume');
      }
      return false;
    }

    lastBuildDir = compResult.buildDir;

    const success = await arduinoCliService.upload(compResult.buildDir, fqbn, port, (output) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('log:output', { type: 'upload', text: output });
      }
    });

    serialManager.setUploading(false);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('serial:resume');
    }
    return success;
  } catch (err: any) {
    serialManager.setUploading(false);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('serial:resume');
    }
    diagnostics.logAppError(`Erro durante upload: ${err.message}`);
    return false;
  }
});

// ==========================================
// 6. IPC HANDLERS: BIBLIOTECAS, EXPORTAÇÃO E DEBUG
// ==========================================

ipcMain.handle('lib:search', async (event, query: string) => {
  return await arduinoCliService.searchLibraries(query);
});

ipcMain.handle('lib:list', async () => {
  return await arduinoCliService.getInstalledLibraries();
});

ipcMain.handle('lib:install', async (event, libName: string) => {
  return await arduinoCliService.installLibrary(libName, (output) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log:output', { type: 'system', text: output });
    }
  });
});

ipcMain.handle('lib:uninstall', async (event, libName: string) => {
  return await arduinoCliService.uninstallLibrary(libName, (output) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log:output', { type: 'system', text: output });
    }
  });
});

ipcMain.handle('sketch:exportBinary', async (event, { files, fqbn }) => {
  const desktopExportDir = path.join(os.homedir(), 'Desktop', 'Arduino_Turbo_Binarios');
  const result = await arduinoCliService.exportBinary(files, fqbn, desktopExportDir, (output) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log:output', { type: 'compile', text: output });
    }
  });

  if (result.success && result.filePath) {
    shell.openPath(result.filePath).catch(() => {});
  }
  return result;
});

ipcMain.handle('debug:getInfo', async (event, fqbn: string) => {
  return await arduinoCliService.getBoardDebugInfo(fqbn);
});

ipcMain.handle('system:getProfile', () => {
  return detectSystemProfile();
});

ipcMain.handle('diagnostics:get', async () => {
  try {
    const cliStatus = await arduinoCliService.checkStatus();
    const ports = await serialManager.listPorts();
    const data = await diagnostics.collect(cliStatus, ports);
    const formattedText = diagnostics.formatReport(data);
    return { raw: data, formatted: formattedText };
  } catch (e: any) {
    return { raw: null, formatted: `Falha ao coletar diagnósticos: ${e.message}` };
  }
});

ipcMain.handle('diagnostics:exportToDesktop', async () => {
  try {
    const cliStatus = await arduinoCliService.checkStatus();
    const ports = await serialManager.listPorts();
    const data = await diagnostics.collect(cliStatus, ports);
    const formattedText = diagnostics.formatReport(data);
    const filePath = diagnostics.saveReportToDesktop(formattedText);
    return { success: true, filePath };
  } catch (e: any) {
    return { success: false, filePath: '' };
  }
});

ipcMain.handle('dialog:openFile', async () => {
  if (!mainWindow) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    filters: [
      { name: 'Código Arduino/C++', extensions: ['ino', 'cpp', 'c', 'h'] },
      { name: 'Todos os Arquivos', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (canceled || filePaths.length === 0) return null;

  const content = fs.readFileSync(filePaths[0], 'utf-8');
  return { path: filePaths[0], content, name: path.basename(filePaths[0]) };
});

ipcMain.handle('dialog:saveFile', async (event, { content, defaultPath }) => {
  if (!mainWindow) return null;
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultPath || 'sketch.ino',
    filters: [
      { name: 'Arquivo Arduino (.ino)', extensions: ['ino'] },
      { name: 'Arquivo C++ (.cpp)', extensions: ['cpp'] }
    ]
  });

  if (canceled || !filePath) return null;

  fs.writeFileSync(filePath, content, 'utf-8');
  return { path: filePath, name: path.basename(filePath) };
});

ipcMain.handle('shell:openPath', async (event, targetPath: string) => {
  if (targetPath) {
    await shell.openPath(targetPath);
  }
});

ipcMain.handle('chip:readFirmware', async (event, { port, fqbn, readSizeBytes }) => {
  return await firmwareReaderService.readFirmware({ port, fqbn, readSizeBytes });
});

ipcMain.handle('chip:exportBinary', async (event, { sourceBinaryPath, chipName }) => {
  if (!mainWindow) return { success: false };
  const ext = (chipName || '').toLowerCase().includes('avr') || (chipName || '').toLowerCase().includes('m328') ? 'hex' : 'bin';
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar Firmware de Silício',
    defaultPath: `firmware_${(chipName || 'chip').toLowerCase()}_${Date.now()}.${ext}`,
    filters: [
      { name: 'Arquivo de Firmware Binário (*.bin, *.hex)', extensions: ['bin', 'hex'] },
      { name: 'Todos os Arquivos', extensions: ['*'] }
    ]
  });

  if (canceled || !filePath) return { success: false };

  const success = firmwareReaderService.exportBinaryToDisk(sourceBinaryPath, filePath);
  if (success) {
    shell.showItemInFolder(filePath);
  }
  return { success, filePath };
});

ipcMain.handle('chip:patchPins', async (event, { sourceBinaryPath, pinMappings }) => {
  return firmwareReaderService.patchFirmwarePins({ sourceBinaryPath, pinMappings });
});

ipcMain.handle('chip:flashPatched', async (event, { port, fqbn, binaryPath }) => {
  return await firmwareReaderService.flashPatchedBinary({ port, fqbn, binaryPath });
});


