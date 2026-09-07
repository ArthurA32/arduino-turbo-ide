import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { UpdateModal } from '../../src/components/UpdateModal';

describe('UpdateModal - Changelog Dinâmico e Formatação', () => {
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

  it('deve renderizar as notas de versão dinâmicas fornecidas pelo servidor', () => {
    render(
      <UpdateModal
        isOpen={true}
        onClose={() => {}}
        updateInfo={mockUpdateInfo}
      />
    );

    // O título da seção
    expect(screen.getByText(/O que há de novo neste update/i)).toBeDefined();

    // Os itens dinâmicos do changelog
    expect(screen.getByText(/Correção no overflow dos seletores de placas e portas/i)).toBeDefined();
    expect(screen.getByText(/Barra de progresso nativa no modo \/UPDATE/i)).toBeDefined();

    // Os tópicos destacados em negrito/ciano
    expect(screen.getByText('TopBar:')).toBeDefined();
    expect(screen.getByText('AutoUpdater:')).toBeDefined();
  });

  it('deve exibir a data de lançamento da atualização', () => {
    render(
      <UpdateModal
        isOpen={true}
        onClose={() => {}}
        updateInfo={mockUpdateInfo}
      />
    );

    expect(screen.getByText('2026-09-07')).toBeDefined();
  });

  it('não deve renderizar quando isOpen for false', () => {
    const { container } = render(
      <UpdateModal
        isOpen={false}
        onClose={() => {}}
        updateInfo={mockUpdateInfo}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
