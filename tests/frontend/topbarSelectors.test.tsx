import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TopBar } from '../../src/components/TopBar';

describe('TopBar - Seletores de Placas, Portas COM e Partição Flash', () => {
  const mockBoards = [
    { name: 'ESP32-C5 Dev Module', fqbn: 'esp32:esp32:esp32c5', family: 'ESP32' },
    { name: 'Arduino Uno', fqbn: 'arduino:avr:uno', family: 'Arduino AVR' }
  ];

  const mockPorts = [
    { port: 'COM2', friendlyName: 'USB-SERIAL CH340 (COM2)', boardGuess: 'Arduino Uno' }
  ];

  it('deve conter as classes overflow-visible e z-40 no header para não cortar menus suspensos', () => {
    const { container } = render(
      <TopBar
        onCompile={() => {}}
        onUpload={() => {}}
        isCompiling={false}
        isUploading={false}
        onExportBinary={() => {}}
        isExportingBinary={false}
        onReadChipFirmware={() => {}}
        selectedBoard={mockBoards[0]}
        setSelectedBoard={() => {}}
        boards={mockBoards}
        selectedPort="COM2"
        setSelectedPort={() => {}}
        ports={mockPorts}
        onRefreshPorts={() => {}}
        isRefreshingPorts={false}
        onOpenLibraryModal={() => {}}
        onOpenDebugModal={() => {}}
        onOpenReportModal={() => {}}
        onOpenCoreModal={() => {}}
        onOpenFile={() => {}}
        onSaveFile={() => {}}
        fileName="sketch.ino"
        partitionScheme="huge_app"
      />
    );

    const header = container.querySelector('header');
    expect(header).toBeDefined();
    expect(header?.className).toContain('overflow-visible');
    expect(header?.className).toContain('z-40');
    expect(header?.className).not.toContain('overflow-hidden');
  });

  it('deve abrir o menu de seleção de placas ao clicar no botão de placa', () => {
    render(
      <TopBar
        onCompile={() => {}}
        onUpload={() => {}}
        isCompiling={false}
        isUploading={false}
        onExportBinary={() => {}}
        isExportingBinary={false}
        onReadChipFirmware={() => {}}
        selectedBoard={mockBoards[0]}
        setSelectedBoard={() => {}}
        boards={mockBoards}
        selectedPort="COM2"
        setSelectedPort={() => {}}
        ports={mockPorts}
        onRefreshPorts={() => {}}
        isRefreshingPorts={false}
        onOpenLibraryModal={() => {}}
        onOpenDebugModal={() => {}}
        onOpenReportModal={() => {}}
        onOpenCoreModal={() => {}}
        onOpenFile={() => {}}
        onSaveFile={() => {}}
        fileName="sketch.ino"
      />
    );

    // Encontrar o botão da placa e clicar
    const boardBtn = screen.getByText('ESP32-C5 Dev Module');
    fireEvent.click(boardBtn);

    // O input de busca dentro do dropdown deve estar visível
    const searchInput = screen.getByPlaceholderText(/Buscar placa/i);
    expect(searchInput).toBeDefined();
  });

  it('deve abrir o seletor de portas COM ao clicar', () => {
    render(
      <TopBar
        onCompile={() => {}}
        onUpload={() => {}}
        isCompiling={false}
        isUploading={false}
        onExportBinary={() => {}}
        isExportingBinary={false}
        onReadChipFirmware={() => {}}
        selectedBoard={mockBoards[0]}
        setSelectedBoard={() => {}}
        boards={mockBoards}
        selectedPort="COM2"
        setSelectedPort={() => {}}
        ports={mockPorts}
        onRefreshPorts={() => {}}
        isRefreshingPorts={false}
        onOpenLibraryModal={() => {}}
        onOpenDebugModal={() => {}}
        onOpenReportModal={() => {}}
        onOpenCoreModal={() => {}}
        onOpenFile={() => {}}
        onSaveFile={() => {}}
        fileName="sketch.ino"
      />
    );

    const portBtn = screen.getByText('COM2');
    fireEvent.click(portBtn);

    // O cabeçalho 'Portas Detectadas' deve estar presente no dropdown aberto
    expect(screen.getByText('Portas Detectadas')).toBeDefined();
  });

  it('deve abrir o seletor de partição Huge App quando a placa for ESP32', () => {
    render(
      <TopBar
        onCompile={() => {}}
        onUpload={() => {}}
        isCompiling={false}
        isUploading={false}
        onExportBinary={() => {}}
        isExportingBinary={false}
        onReadChipFirmware={() => {}}
        selectedBoard={mockBoards[0]} // ESP32
        setSelectedBoard={() => {}}
        boards={mockBoards}
        selectedPort="COM2"
        setSelectedPort={() => {}}
        ports={mockPorts}
        onRefreshPorts={() => {}}
        isRefreshingPorts={false}
        onOpenLibraryModal={() => {}}
        onOpenDebugModal={() => {}}
        onOpenReportModal={() => {}}
        onOpenCoreModal={() => {}}
        onOpenFile={() => {}}
        onSaveFile={() => {}}
        fileName="sketch.ino"
        partitionScheme="huge_app"
      />
    );

    const partBtn = screen.getByText('Huge App (3MB)');
    fireEvent.click(partBtn);

    expect(screen.getByText('Esquema de Partição Flash')).toBeDefined();
  });
});
