import { describe, it, expect, vi } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TopBar } from '../../src/components/TopBar';
import { UpdateModal } from '../../src/components/UpdateModal';

// Mock completo de fluxo interativo
const InteractiveAppFlow: React.FC = () => {
  const [selectedBoard, setSelectedBoard] = useState<any>({
    name: 'ESP32-C5 Dev Module',
    fqbn: 'esp32:esp32:esp32c5',
    family: 'ESP32'
  });
  const [selectedPort, setSelectedPort] = useState<string>('COM2');
  const [partitionScheme, setPartitionScheme] = useState<string>('huge_app');
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);
  const [actionLog, setActionLog] = useState<string[]>([]);

  const mockBoards = [
    { name: 'ESP32-C5 Dev Module', fqbn: 'esp32:esp32:esp32c5', family: 'ESP32' },
    { name: 'Arduino Uno', fqbn: 'arduino:avr:uno', family: 'Arduino AVR' }
  ];

  const mockPorts = [
    { port: 'COM2', friendlyName: 'USB-SERIAL CH340 (COM2)', boardGuess: 'Arduino Uno' },
    { port: 'COM5', friendlyName: 'Silicon Labs CP210x (COM5)', boardGuess: 'ESP32' }
  ];

  const mockUpdateInfo = {
    available: true,
    serverInfo: {
      version: '0.2.1',
      build: 21,
      releaseDate: '2026-09-07',
      changelog: [
        'TopBar: Correção no overflow dos seletores de placas e portas',
        'AutoUpdater: Barra de progresso nativa no modo /UPDATE'
      ]
    },
    currentInfo: {
      version: '0.2.0',
      build: 20,
      arch: 'arm64'
    },
    networkLocation: 'Z:\\Updates Turbo IDE'
  };

  return (
    <div className="flex flex-col h-screen w-screen">
      <TopBar
        onCompile={() => setActionLog(prev => [...prev, 'compile'])}
        onUpload={() => setActionLog(prev => [...prev, 'upload'])}
        isCompiling={false}
        isUploading={false}
        onExportBinary={() => setActionLog(prev => [...prev, 'export'])}
        isExportingBinary={false}
        onReadChipFirmware={() => setActionLog(prev => [...prev, 'read_chip'])}
        selectedBoard={selectedBoard}
        setSelectedBoard={setSelectedBoard}
        boards={mockBoards}
        selectedPort={selectedPort}
        setSelectedPort={setSelectedPort}
        ports={mockPorts}
        onRefreshPorts={() => setActionLog(prev => [...prev, 'refresh_ports'])}
        isRefreshingPorts={false}
        onOpenLibraryModal={() => setActionLog(prev => [...prev, 'open_libs'])}
        onOpenDebugModal={() => setActionLog(prev => [...prev, 'open_debug'])}
        onOpenReportModal={() => setActionLog(prev => [...prev, 'open_report'])}
        onOpenCoreModal={() => setActionLog(prev => [...prev, 'open_cores'])}
        onOpenFile={() => setActionLog(prev => [...prev, 'open_file'])}
        onSaveFile={() => setActionLog(prev => [...prev, 'save_file'])}
        fileName="sketch.ino"
        partitionScheme={partitionScheme}
        onPartitionSchemeChange={setPartitionScheme}
        versionInfo={{
          version: '0.2.0',
          build: 20,
          arch: 'arm64',
          targetName: 'Windows ARM64 Nativo',
          fullString: 'v0.2.0 [ARM64]'
        }}
        updateInfo={mockUpdateInfo}
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
      />

      <div data-testid="action-log">
        {actionLog.join(',')}
      </div>

      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        updateInfo={mockUpdateInfo}
      />
    </div>
  );
};

describe('E2E / Testes de Interface — Fluxos Reais do Usuário', () => {
  it('Cenário 1: Deve inicializar a TopBar exibindo logotipo, versão ARM64 e botão de Update disponível', () => {
    render(<InteractiveAppFlow />);

    expect(screen.getByText('TURBO IDE')).toBeDefined();
    expect(screen.getByText('v0.2.0')).toBeDefined();
    expect(screen.getByText('Update v0.2.1')).toBeDefined();
  });

  it('Cenário 2: Deve permitir alternar a placa e atualizar o esquema de partição condicional', async () => {
    render(<InteractiveAppFlow />);

    // Inicialmente com ESP32: o seletor Huge App deve estar presente
    expect(screen.getByText('Huge App (3MB)')).toBeDefined();

    // Abrir seletor de placas
    const boardBtn = screen.getByText('ESP32-C5 Dev Module');
    fireEvent.click(boardBtn);

    // Clicar em Arduino Uno
    const unoOption = screen.getByText('Arduino Uno');
    fireEvent.click(unoOption);

    // Agora o nome da placa selecionada é Arduino Uno
    await waitFor(() => {
      expect(screen.queryByText('Huge App (3MB)')).toBeNull(); // Não é ESP32, esconde partição
    });
  });

  it('Cenário 3: Deve permitir trocar a porta COM ativa pelo seletor', async () => {
    render(<InteractiveAppFlow />);

    const portBtn = screen.getByText('COM2');
    fireEvent.click(portBtn);

    const com5Option = screen.getByText('COM5');
    fireEvent.click(com5Option);

    await waitFor(() => {
      expect(screen.getByText('COM5')).toBeDefined();
    });
  });

  it('Cenário 4: Deve abrir o modal de atualização ao clicar no botão de Update e exibir notas de versão', async () => {
    render(<InteractiveAppFlow />);

    const updateBtn = screen.getByText('Update v0.2.1');
    fireEvent.click(updateBtn);

    // O modal abre
    await waitFor(() => {
      expect(screen.getByText(/Atualização Silenciosa Disponível/i)).toBeDefined();
      expect(screen.getByText(/O que há de novo neste update/i)).toBeDefined();
      expect(screen.getByText(/TopBar:/i)).toBeDefined();
      expect(screen.getByText(/Atualizar Agora/i)).toBeDefined();
    });
  });

  it('Cenário 5: Deve acionar ações dos botões principais de compilação, gravação e leitura de chip', () => {
    render(<InteractiveAppFlow />);

    // Clicar em Verificar
    const compileBtn = screen.getByText('Verificar');
    fireEvent.click(compileBtn);

    // Clicar em Carregar
    const uploadBtn = screen.getByText('Carregar');
    fireEvent.click(uploadBtn);

    // Clicar em Ler Chip
    const readChipBtn = screen.getByText('Ler Chip');
    fireEvent.click(readChipBtn);

    const log = screen.getByTestId('action-log').textContent;
    expect(log).toContain('compile');
    expect(log).toContain('upload');
    expect(log).toContain('read_chip');
  });
});
