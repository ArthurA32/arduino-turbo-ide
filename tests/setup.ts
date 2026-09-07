// Global test setup for DOM and window.electronAPI mocks
if (typeof window !== 'undefined') {
  (window as any).electronAPI = {
    getAppVersion: async () => ({
      version: '0.2.1',
      build: 21,
      arch: 'arm64',
      targetName: 'Windows ARM64 Nativo',
      releaseDate: '2026-09-07',
      fullString: 'v0.2.1 [ARM64]'
    }),
    listPorts: async () => [
      { port: 'COM2', friendlyName: 'USB-SERIAL CH340 (COM2)', boardGuess: 'Arduino Uno' },
      { port: 'COM5', friendlyName: 'Silicon Labs CP210x (COM5)', boardGuess: 'ESP32' }
    ],
    listBoards: async () => [
      { name: 'ESP32-C5 Dev Module', fqbn: 'esp32:esp32:esp32c5', family: 'ESP32' },
      { name: 'Arduino Uno', fqbn: 'arduino:avr:uno', family: 'Arduino AVR' }
    ],
    checkForUpdates: async () => ({
      available: true,
      serverInfo: {
        version: '0.2.1',
        build: 21,
        releaseDate: '2026-09-07',
        changelog: [
          'Seletores TopBar: Correção no corte de overflow dos menus suspensos de Placas, Portas COM e Esquema de Partição Flash (Huge App).',
          'Progresso de Atualização: Janela nativa com barra de progresso em tempo real durante a instalação da nova versão.'
        ]
      },
      currentInfo: {
        version: '0.2.0',
        build: 20,
        arch: 'arm64'
      },
      networkLocation: 'Z:\\Updates Turbo IDE'
    }),
    installUpdate: async () => ({ success: true }),
    onUpdateProgress: (cb: any) => () => {},
    onUpdateAvailable: (cb: any) => () => {},
    onLogOutput: (cb: any) => () => {},
    onSerialData: (cb: any) => () => {},
    onSerialStatus: (cb: any) => () => {},
    onSerialPause: (cb: any) => () => {},
    onSerialResume: (cb: any) => () => {},
    onWindowRestored: (cb: any) => () => {},
    getSerialStatus: async () => ({ isConnected: false, port: '', baudRate: 115200 }),
    connectSerial: async (port: string, baud: number) => ({ success: true }),
    disconnectSerial: async () => {},
    sendSerialData: async () => true,
    openPath: async () => {}
  };

  // Mock HTMLCanvasElement.prototype.getContext
  if (typeof HTMLCanvasElement !== 'undefined') {
    HTMLCanvasElement.prototype.getContext = () => ({
      fillRect: () => {},
      clearRect: () => {},
      getImageData: (x: number, y: number, w: number, h: number) => ({ data: new Array(w * h * 4) }),
      putImageData: () => {},
      createImageData: () => [],
      setTransform: () => {},
      drawImage: () => {},
      save: () => {},
      fillText: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      fill: () => {},
      translate: () => {},
      scale: () => {},
      rotate: () => {},
      arc: () => {},
      strokeRect: () => {},
      measureText: () => ({ width: 0 }),
      transform: () => {},
      rect: () => {},
      clip: () => {}
    } as any);
  }

  // Mock ResizeObserver
  if (typeof (window as any).ResizeObserver === 'undefined') {
    (window as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
}
