import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { SerialPlotter } from '../../src/components/SerialPlotter';
import { SerialTerminal } from '../../src/components/SerialTerminal';

describe('Segurança de Portas Nulas/Indefinidas em Componentes Seriais', () => {
  it('SerialPlotter deve renderizar sem exceção mesmo se ports for indefinido ou vazio', () => {
    expect(() => {
      render(
        <SerialPlotter
          selectedPort=""
          setSelectedPort={() => {}}
          ports={undefined as any}
          isUploading={false}
          isActiveTab={true}
        />
      );
    }).not.toThrow();
  });

  it('SerialTerminal deve renderizar sem exceção mesmo se ports for nulo', () => {
    expect(() => {
      render(
        <SerialTerminal
          selectedPort=""
          setSelectedPort={() => {}}
          ports={null as any}
          isUploading={false}
          isActiveTab={true}
        />
      );
    }).not.toThrow();
  });
});
