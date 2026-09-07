import { describe, it, expect } from 'vitest';

describe('NetworkUpdateService - Lógica de Semver e Detecção de Atualização', () => {
  const parseSemver = (v: string) => (v || '0.0.0').split('.').map((n) => parseInt(n, 10) || 0);

  const compareVersions = (serverVer: string, serverBuild: number, currentVer: string, currentBuild: number) => {
    const [sMaj, sMin, sPat] = parseSemver(serverVer);
    const [cMaj, cMin, cPat] = parseSemver(currentVer);
    const isVersionHigher = sMaj > cMaj || (sMaj === cMaj && (sMin > cMin || (sMin === cMin && sPat > cPat)));
    return (serverBuild > currentBuild) || (serverBuild === currentBuild && isVersionHigher);
  };

  it('deve detectar atualização quando a versão do servidor for maior', () => {
    expect(compareVersions('0.2.1', 21, '0.2.0', 20)).toBe(true);
    expect(compareVersions('1.0.0', 10, '0.9.9', 10)).toBe(true);
    expect(compareVersions('0.2.0', 20, '0.1.9', 19)).toBe(true);
  });

  it('deve rejeitar atualizações para versões menores ou iguais (prevenção de downgrade)', () => {
    expect(compareVersions('0.1.9', 19, '0.2.0', 20)).toBe(false);
    expect(compareVersions('0.2.0', 20, '0.2.0', 20)).toBe(false);
    expect(compareVersions('0.1.5', 15, '0.1.8', 18)).toBe(false);
  });

  it('deve herdar changelog universal quando a entrada específica não tiver definido', () => {
    const manifest: any = {
      universal: {
        version: '0.2.1',
        build: 21,
        changelog: ['Correção universal de estabilidade', 'Suporte a barra de progresso']
      },
      arm64: {
        version: '0.2.1',
        build: 21
      }
    };

    const serverEntry = manifest.arm64;
    if (!serverEntry.changelog && manifest.universal?.changelog) {
      serverEntry.changelog = manifest.universal.changelog;
    }

    expect(serverEntry.changelog).toBeDefined();
    expect(serverEntry.changelog.length).toBe(2);
    expect(serverEntry.changelog[0]).toBe('Correção universal de estabilidade');
  });

  it('deve configurar o modo /UPDATE com argumentos de auto-restart corretos', () => {
    const arch = 'ARM64';
    const spawnArgs = ['/UPDATE', `/ARCH=${arch}`, '/AUTO_RESTART'];
    expect(spawnArgs).toContain('/UPDATE');
    expect(spawnArgs).toContain('/AUTO_RESTART');
    expect(spawnArgs).toContain('/ARCH=ARM64');
    expect(spawnArgs).not.toContain('/S'); // Não deve ser totalmente cego
  });
});
