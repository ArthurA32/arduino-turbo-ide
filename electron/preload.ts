import { contextBridge, ipcRenderer } from 'electron';

export interface IElectronAPI {
  listPorts: () => Promise<any[]>;
  listBoards: () => Promise<any[]>;
  getCliStatus: () => Promise<any>;
  initCli: () => Promise<any>;
  installCore: (coreName: string) => Promise<boolean>;
  compileSketch: (code: string, fqbn: string, files?: { name: string; content: string }[]) => Promise<{ success: boolean; buildDir: string }>;
  uploadSketch: (code: string, fqbn: string, port: string, files?: { name: string; content: string }[]) => Promise<boolean>;
  getDiagnostics: () => Promise<{ raw: any; formatted: string }>;
  exportDiagnosticsToDesktop: () => Promise<{ success: boolean; filePath: string }>;
  openFile: () => Promise<{ path: string; content: string; name: string } | null>;
  saveFile: (content: string, defaultPath?: string) => Promise<{ path: string; name: string } | null>;
  openPath: (targetPath: string) => Promise<void>;
  
  // Bibliotecas
  searchLibraries: (query: string) => Promise<any[]>;
  listInstalledLibraries: () => Promise<any[]>;
  installLibrary: (libName: string) => Promise<boolean>;
  uninstallLibrary: (libName: string) => Promise<boolean>;

  // Exportação e Debug
  exportBinary: (files: { name: string; content: string }[], fqbn: string) => Promise<{ success: boolean; filePath: string }>;
  getDebugInfo: (fqbn: string) => Promise<any>;
  getSystemProfile: () => Promise<any>;
  readChipFirmware: (options: { port: string; fqbn: string; readSizeBytes?: number }) => Promise<any>;
  exportChipFirmware: (options: { sourceBinaryPath: string; chipName: string }) => Promise<{ success: boolean; filePath?: string }>;
  patchChipPins: (options: { sourceBinaryPath: string; pinMappings: Array<{ originalPin: number; newPin: number }> }) => Promise<{ success: boolean; patchedPath?: string; changesCount: number; error?: string }>;
  flashChipPatched: (options: { port: string; fqbn: string; binaryPath: string }) => Promise<{ success: boolean; message: string }>;



  // Comunicação Serial Nativa
  connectSerial: (port: string, baudRate: number) => Promise<{ success: boolean; error?: string }>;
  disconnectSerial: () => Promise<void>;
  sendSerialData: (text: string) => Promise<boolean>;
  getSerialStatus: () => Promise<{ isConnected: boolean; port: string; baudRate: number }>;

  // Eventos em tempo real
  onLogOutput: (callback: (data: { type: string; text: string }) => void) => () => void;
  onSerialData: (callback: (text: string) => void) => () => void;
  onSerialStatus: (callback: (status: { connected: boolean; port: string; baudRate?: number; error?: string }) => void) => () => void;
  onSerialPause: (callback: () => void) => () => void;
  onSerialResume: (callback: () => void) => () => void;
  onWindowRestored: (callback: () => void) => () => void;
  getAppVersion: () => Promise<{ version: string; build: number; arch: string; targetName: string; releaseDate: string; fullString: string }>;

  // Atualização Automática via GitHub Releases
  checkForUpdates: () => Promise<any>;
  downloadUpdate: () => Promise<{ success: boolean; installerPath?: string; error?: string }>;
  applyUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => Promise<{ success: boolean; error?: string }>;
  onUpdateProgress: (callback: (progress: { percent: number; copiedBytes: number; totalBytes: number }) => void) => () => void;
  onUpdateAvailable: (callback: (info: any) => void) => () => void;
}

const api: IElectronAPI = {
  getAppVersion: () => ipcRenderer.invoke('app:version-info'),
  listPorts: () => ipcRenderer.invoke('ports:list'),
  listBoards: () => ipcRenderer.invoke('boards:list'),
  getCliStatus: () => ipcRenderer.invoke('cli:status'),
  initCli: () => ipcRenderer.invoke('cli:init'),
  installCore: (coreName: string) => ipcRenderer.invoke('cli:installCore', coreName),
  compileSketch: (code: string, fqbn: string, files?: { name: string; content: string }[]) => 
    ipcRenderer.invoke('sketch:compile', { code, fqbn, files }),
  uploadSketch: (code: string, fqbn: string, port: string, files?: { name: string; content: string }[]) => 
    ipcRenderer.invoke('sketch:upload', { code, fqbn, port, files }),
  getDiagnostics: () => ipcRenderer.invoke('diagnostics:get'),
  exportDiagnosticsToDesktop: () => ipcRenderer.invoke('diagnostics:exportToDesktop'),
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (content: string, defaultPath?: string) => ipcRenderer.invoke('dialog:saveFile', { content, defaultPath }),
  openPath: (targetPath: string) => ipcRenderer.invoke('shell:openPath', targetPath),
  
  // Bibliotecas
  searchLibraries: (query: string) => ipcRenderer.invoke('lib:search', query),
  listInstalledLibraries: () => ipcRenderer.invoke('lib:list'),
  installLibrary: (libName: string) => ipcRenderer.invoke('lib:install', libName),
  uninstallLibrary: (libName: string) => ipcRenderer.invoke('lib:uninstall', libName),

  // Exportação e Debug
  exportBinary: (files, fqbn) => ipcRenderer.invoke('sketch:exportBinary', { files, fqbn }),
  getDebugInfo: (fqbn) => ipcRenderer.invoke('debug:getInfo', fqbn),
  getSystemProfile: () => ipcRenderer.invoke('system:getProfile'),
  readChipFirmware: (options) => ipcRenderer.invoke('chip:readFirmware', options),
  exportChipFirmware: (options) => ipcRenderer.invoke('chip:exportBinary', options),
  patchChipPins: (options) => ipcRenderer.invoke('chip:patchPins', options),
  flashChipPatched: (options) => ipcRenderer.invoke('chip:flashPatched', options),



  // Serial Nativo
  connectSerial: (port: string, baudRate: number) => ipcRenderer.invoke('serial:connect', { port, baudRate }),
  disconnectSerial: () => ipcRenderer.invoke('serial:disconnect'),
  sendSerialData: (text: string) => ipcRenderer.invoke('serial:send', text),
  getSerialStatus: () => ipcRenderer.invoke('serial:status'),

  onLogOutput: (callback) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('log:output', handler);
    return () => ipcRenderer.removeListener('log:output', handler);
  },
  onSerialData: (callback) => {
    const handler = (_event: any, text: string) => callback(text);
    ipcRenderer.on('serial:data', handler);
    return () => ipcRenderer.removeListener('serial:data', handler);
  },
  onSerialStatus: (callback) => {
    const handler = (_event: any, status: any) => callback(status);
    ipcRenderer.on('serial:status', handler);
    return () => ipcRenderer.removeListener('serial:status', handler);
  },
  onSerialPause: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('serial:pause', handler);
    return () => ipcRenderer.removeListener('serial:pause', handler);
  },
  onSerialResume: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('serial:resume', handler);
    return () => ipcRenderer.removeListener('serial:resume', handler);
  },
  onWindowRestored: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('window:restored', handler);
    return () => ipcRenderer.removeListener('window:restored', handler);
  },

  // Auto-Update via GitHub
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  applyUpdate: () => ipcRenderer.invoke('update:apply'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateProgress: (callback) => {
    const handler = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('update:progress', handler);
    return () => ipcRenderer.removeListener('update:progress', handler);
  },
  onUpdateAvailable: (callback) => {
    const handler = (_event: any, info: any) => callback(info);
    ipcRenderer.on('update:available', handler);
    return () => ipcRenderer.removeListener('update:available', handler);
  }
};

contextBridge.exposeInMainWorld('electronAPI', api);
