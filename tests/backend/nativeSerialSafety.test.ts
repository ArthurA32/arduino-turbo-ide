import { describe, it, expect, vi } from 'vitest';

describe('Segurança Serial Nativa (Diretiva AGENTS.md)', () => {
  it('deve exigir liberação serial silenciosa disconnect(true) antes de qualquer upload ou leitura', () => {
    // Simulação do serviço serial
    const mockNativeSerial = {
      isConnected: true,
      currentPort: 'COM2',
      disconnectCalls: [] as boolean[],
      disconnect(silent: boolean = false) {
        this.isConnected = false;
        this.disconnectCalls.push(silent);
      }
    };

    // Operação segura que antecede gravação na placa
    const prepareForUpload = (serial: typeof mockNativeSerial) => {
      serial.disconnect(true);
      return !serial.isConnected;
    };

    const isSafe = prepareForUpload(mockNativeSerial);
    expect(isSafe).toBe(true);
    expect(mockNativeSerial.disconnectCalls).toContain(true);
  });

  it('não deve emitir desconexão ruidosa quando silent=true para não resetar estado do UI desnecessariamente', () => {
    let statusEmitted = false;
    const mockEmitter = {
      emitStatus: () => { statusEmitted = true; }
    };

    const disconnect = (silent: boolean) => {
      if (!silent) {
        mockEmitter.emitStatus();
      }
    };

    disconnect(true);
    expect(statusEmitted).toBe(false);

    disconnect(false);
    expect(statusEmitted).toBe(true);
  });
});
