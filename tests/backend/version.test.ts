import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Version Configuration - version.json e Detecção de Arquitetura', () => {
  const versionJsonPath = path.resolve(__dirname, '../../src/version.json');

  it('deve existir o arquivo src/version.json com estrutura válida para ARM64 e x64', () => {
    expect(fs.existsSync(versionJsonPath)).toBe(true);
    const raw = fs.readFileSync(versionJsonPath, 'utf-8');
    const data = JSON.parse(raw);

    expect(data.arm64).toBeDefined();
    expect(data.x64).toBeDefined();

    expect(data.arm64.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(data.arm64.build).toBeGreaterThan(0);
    expect(data.arm64.target).toContain('ARM64');

    expect(data.x64.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(data.x64.build).toBeGreaterThan(0);
    expect(data.x64.target).toContain('x64');
  });

  it('deve conter campo de changelog não vazio para ambas as arquiteturas', () => {
    const raw = fs.readFileSync(versionJsonPath, 'utf-8');
    const data = JSON.parse(raw);

    expect(Array.isArray(data.arm64.changelog)).toBe(true);
    expect(data.arm64.changelog.length).toBeGreaterThan(0);

    expect(Array.isArray(data.x64.changelog)).toBe(true);
    expect(data.x64.changelog.length).toBeGreaterThan(0);
  });

  it('deve detectar a arquitetura corretamente a partir de variáveis de ambiente do Windows', () => {
    const detectArch = (archEnv: string, wowEnv?: string) => {
      const isArm64 = (archEnv || '').toUpperCase() === 'ARM64' || (wowEnv || '').toUpperCase() === 'ARM64';
      return isArm64 ? 'arm64' : 'x64';
    };

    expect(detectArch('ARM64')).toBe('arm64');
    expect(detectArch('AMD64')).toBe('x64');
    expect(detectArch('x86', 'ARM64')).toBe('arm64');
    expect(detectArch('x86', 'AMD64')).toBe('x64');
  });
});
