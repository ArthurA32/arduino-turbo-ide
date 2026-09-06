import React, { useState, useEffect } from 'react';
import { DownloadCloud, Check, X, RefreshCw, Cpu, Usb, Info, ShieldCheck, Laptop } from 'lucide-react';

interface CoreInstallerModalProps {
  isOpen: boolean;
  onClose: () => void;
  installedCores: string[];
  onRefreshStatus: () => void;
}

export const CoreInstallerModal: React.FC<CoreInstallerModalProps> = ({
  isOpen,
  onClose,
  installedCores,
  onRefreshStatus
}) => {
  const [installingCore, setInstallingCore] = useState<string | null>(null);
  const [installLog, setInstallLog] = useState<string[]>([]);
  const [systemProfile, setSystemProfile] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      onRefreshStatus();
      window.electronAPI.getSystemProfile().then((profile) => {
        setSystemProfile(profile);
      }).catch((e) => console.error('Erro ao obter perfil do sistema:', e));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInstall = async (coreName: string) => {
    setInstallingCore(coreName);
    setInstallLog([`[INÍCIO] Instalando pacote ${coreName}... Aguarde o download.`]);

    try {
      // Primeiro inicializa os repositórios caso necessário
      await window.electronAPI.initCli();
      
      const success = await window.electronAPI.installCore(coreName);
      if (success) {
        setInstallLog((prev) => [...prev, `✔ Core ${coreName} instalado com sucesso!`]);
        await onRefreshStatus();
      } else {
        setInstallLog((prev) => [...prev, `❌ Falha ao instalar o core ${coreName}. Verifique sua conexão à internet.`]);
      }
    } catch (err: any) {
      setInstallLog((prev) => [...prev, `❌ Erro: ${err.message}`]);
    } finally {
      setInstallingCore(null);
    }
  };

  const esp32Entry = installedCores.find(c => c.toLowerCase().includes('esp32'));
  const isEsp32Installed = Boolean(esp32Entry);
  const esp32Version = esp32Entry ? esp32Entry.match(/\(([^)]+)\)/)?.[1] || '' : '';

  const avrEntry = installedCores.find(c => c.toLowerCase().includes('avr'));
  const isAvrInstalled = Boolean(avrEntry);
  const avrVersion = avrEntry ? avrEntry.match(/\(([^)]+)\)/)?.[1] || '' : '';

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#16161D] border border-[#2E2E40] rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden text-sm text-gray-200">
        
        {/* Cabeçalho */}
        <div className="bg-[#121217] px-5 py-3.5 border-b border-[#2A2A38] flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-[#00B4B9]">
            <DownloadCloud className="w-5 h-5" />
            <div>
              <h2 className="font-bold text-white text-base leading-tight">
                Gerenciador de Cores e Toolchain
              </h2>
              <span className="text-[11px] text-gray-400 font-mono">
                {systemProfile ? `Plataforma: ${systemProfile.osName} (${systemProfile.tagLabel})` : 'Detectando arquitetura...'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#202028] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          
          {/* Badge do Hardware Detectado */}
          {systemProfile && (
            <div className="bg-[#121218] border border-[#2A2A38] rounded-lg p-3 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Laptop className="w-4 h-4 text-[#00B4B9] shrink-0" />
                <div>
                  <span className="font-semibold text-white block">{systemProfile.deviceName}</span>
                  <span className="text-gray-400 text-[11px]">{systemProfile.cpuModel} • {systemProfile.totalMemGB} RAM</span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#00979C]/20 border border-[#00979C]/40 text-[#00B4B9] text-[10px] font-mono uppercase font-bold shrink-0">
                {systemProfile.tagLabel}
              </span>
            </div>
          )}

          {/* Cards de Pacotes de Cores */}
          <div className="space-y-3">
            {/* Card ESP32 */}
            <div className="bg-[#181822] border border-[#2B2B38] rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-[#38384C] transition-all">
              <div className="flex items-start gap-3">
                <Cpu className="w-6 h-6 text-[#E47128] mt-1 shrink-0" />
                <div>
                  <div className="font-semibold text-white text-sm flex items-center gap-2">
                    <span>Espressif ESP32 Core</span>
                    {isEsp32Installed && (
                      <span className="bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 text-[10px] px-2 py-0.5 rounded font-mono font-medium flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                        <span>Instalado {esp32Version ? `(v${esp32Version})` : ''}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Suporte completo para ESP32, ESP32-S2, ESP32-S3, ESP32-C3, ESP32-C5 e NodeMCU.
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleInstall('esp32:esp32')}
                disabled={installingCore !== null}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                  isEsp32Installed
                    ? 'bg-[#222230] hover:bg-[#2C2C3C] text-gray-300 hover:text-white border border-[#3A3A4E]'
                    : 'bg-[#00979C] hover:bg-[#00B4B9] active:scale-95 text-white shadow-md'
                }`}
              >
                {installingCore === 'esp32:esp32' ? (
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Baixando...
                  </span>
                ) : isEsp32Installed ? (
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 text-gray-400" />
                    <span>Reinstalar / Atualizar</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <DownloadCloud className="w-3.5 h-3.5" />
                    <span>Instalar ESP32</span>
                  </span>
                )}
              </button>
            </div>

            {/* Card Arduino AVR */}
            <div className="bg-[#181822] border border-[#2B2B38] rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-[#38384C] transition-all">
              <div className="flex items-start gap-3">
                <Cpu className="w-6 h-6 text-[#00B4B9] mt-1 shrink-0" />
                <div>
                  <div className="font-semibold text-white text-sm flex items-center gap-2">
                    <span>Arduino AVR Core</span>
                    {isAvrInstalled && (
                      <span className="bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 text-[10px] px-2 py-0.5 rounded font-mono font-medium flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                        <span>Instalado {avrVersion ? `(v${avrVersion})` : ''}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Suporte oficial para Arduino Uno, Nano, Mega 2560, Leonardo e Pro Mini.
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleInstall('arduino:avr')}
                disabled={installingCore !== null}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                  isAvrInstalled
                    ? 'bg-[#222230] hover:bg-[#2C2C3C] text-gray-300 hover:text-white border border-[#3A3A4E]'
                    : 'bg-[#00979C] hover:bg-[#00B4B9] active:scale-95 text-white shadow-md'
                }`}
              >
                {installingCore === 'arduino:avr' ? (
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Baixando...
                  </span>
                ) : isAvrInstalled ? (
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 text-gray-400" />
                    <span>Reinstalar / Atualizar</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <DownloadCloud className="w-3.5 h-3.5" />
                    <span>Instalar Arduino AVR</span>
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Dicas Especializadas para o Sistema Detectado */}
          {systemProfile && systemProfile.tips && systemProfile.tips.length > 0 && (
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                Dicas de Configuração para {systemProfile.tagLabel}:
              </span>
              <div className="space-y-2">
                {systemProfile.tips.map((tip: any, idx: number) => (
                  <div key={idx} className="bg-[#121218] border border-[#282838] rounded-lg p-3 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-yellow-400 font-semibold">
                      <Usb className="w-3.5 h-3.5" />
                      <span>{tip.title}</span>
                    </div>
                    <p className="text-gray-300 text-[11.5px] leading-relaxed">
                      {tip.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Log de Instalação */}
          {installLog.length > 0 && (
            <div className="bg-[#0E0E14] border border-[#282838] rounded-lg p-3 max-h-32 overflow-y-auto font-mono text-[11px] text-gray-300 space-y-1 select-text">
              {installLog.map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="bg-[#121217] px-5 py-3 border-t border-[#2A2A38] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#252532] hover:bg-[#323242] text-white text-xs font-semibold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

