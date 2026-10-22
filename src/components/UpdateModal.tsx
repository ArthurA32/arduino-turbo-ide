import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  DownloadCloud,
  ExternalLink,
  ArrowRight,
  Globe,
  RefreshCw,
  Zap,
  AlertCircle,
  CheckCircle2,
  Play
} from 'lucide-react';

interface UpdateProgress {
  percent: number;
  copiedBytes: number;
  totalBytes: number;
}

const parseChangelog = (raw: any): string[] => {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    if (raw.includes('\n')) {
      return raw.split('\n').map((s) => s.trim()).filter(Boolean);
    }
    if (raw.includes('|')) {
      return raw.split('|').map((s) => s.trim()).filter(Boolean);
    }
    return [raw.trim()];
  }
  return [
    'Atualização de estabilidade e novas ferramentas para Windows x64 e ARM64.',
    'Correções de desempenho e telemetria.'
  ];
};

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: any;
  isChecking?: boolean;
  onRecheck?: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  updateInfo,
  isChecking = false,
  onRecheck
}) => {
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isDownloaded, setIsDownloaded] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [progress, setProgress] = useState<UpdateProgress>({ percent: 0, copiedBytes: 0, totalBytes: 0 });
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsUpdating(false);
      setIsDownloaded(false);
      setIsApplying(false);
      setProgress({ percent: 0, copiedBytes: 0, totalBytes: 0 });
      setStatusMessage('');
      setErrorMessage(null);
      return;
    }

    if (window.electronAPI && typeof window.electronAPI.onUpdateProgress === 'function') {
      const unsub = window.electronAPI.onUpdateProgress((prog: UpdateProgress) => {
        setProgress(prog);
        setStatusMessage(`Baixando atualização do GitHub... ${prog.percent}%`);
      });
      return () => unsub();
    }
  }, [isOpen]);

  if (!isOpen || !updateInfo) return null;

  const serverInfo = updateInfo?.serverInfo;
  const currentInfo = updateInfo?.currentInfo;
  const networkLocation = updateInfo?.networkLocation || 'GitHub Releases (ArthurA32/arduino-turbo-ide)';
  const changelogItems = parseChangelog(serverInfo?.changelog);

  const handleStartDownload = async () => {
    setIsUpdating(true);
    setIsDownloaded(false);
    setErrorMessage(null);
    setStatusMessage('Conectando ao GitHub Releases para baixar o instalador...');

    try {
      // Se a API suportar downloadUpdate separadamente:
      if (typeof window.electronAPI.downloadUpdate === 'function') {
        const res = await window.electronAPI.downloadUpdate();
        if (!res.success) {
          setErrorMessage(res.error || 'Falha ao baixar atualização do GitHub.');
          setIsUpdating(false);
        } else {
          setIsDownloaded(true);
          setIsUpdating(false);
          setStatusMessage('Download concluído com sucesso! Pronto para instalar.');
        }
      } else {
        // Fallback para installUpdate direto
        const res = await window.electronAPI.installUpdate();
        if (!res.success) {
          setErrorMessage(res.error || 'Falha ao instalar atualização.');
          setIsUpdating(false);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro inesperado na atualização.');
      setIsUpdating(false);
    }
  };

  const handleApplyUpdate = async () => {
    setIsApplying(true);
    setStatusMessage('Iniciando o instalador da atualização... O Turbo IDE será reiniciado.');

    try {
      if (typeof window.electronAPI.applyUpdate === 'function') {
        await window.electronAPI.applyUpdate();
      } else {
        await window.electronAPI.installUpdate();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao disparar instalador.');
      setIsApplying(false);
    }
  };

  const handleOpenGitHub = () => {
    if (window.electronAPI && typeof window.electronAPI.openPath === 'function') {
      window.electronAPI.openPath('https://github.com/ArthurA32/arduino-turbo-ide/releases');
    }
  };

  const formatMB = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderChangelogItem = (rawText: string, index: number) => {
    const clean = rawText.replace(/^[-*•]\s*/, '').trim();
    const colonIndex = clean.indexOf(':');
    if (colonIndex > 0 && colonIndex <= 45) {
      const topic = clean.slice(0, colonIndex).trim();
      const detail = clean.slice(colonIndex + 1).trim();
      return (
        <li key={index} className="text-[11px] leading-relaxed text-gray-300">
          <strong className="text-cyan-300 font-semibold">{topic}:</strong> {detail}
        </li>
      );
    }

    return (
      <li key={index} className="text-[11px] leading-relaxed text-gray-300">
        {clean}
      </li>
    );
  };

  const isAvailable = Boolean(updateInfo?.available);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#1e1e1e] border border-cyan-500/30 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-modalPop">
        {/* Header com Gradiente Neon */}
        <div className="bg-gradient-to-r from-cyan-950/80 via-blue-950/60 to-[#1e1e1e] border-b border-cyan-500/20 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-lg ${
              isAvailable
                ? 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                : 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
            }`}>
              {isChecking ? (
                <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
              ) : isAvailable ? (
                <Sparkles className="w-5 h-5 animate-pulse" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {isChecking
                  ? 'Verificando Atualizações...'
                  : isAvailable
                  ? 'Nova Atualização Disponível'
                  : 'Arduino Turbo IDE Atualizado'}
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {currentInfo?.arch?.toUpperCase() || 'ARM64'}
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                {isChecking
                  ? 'Consultando GitHub Releases...'
                  : isAvailable
                  ? 'GitHub Releases Conectado'
                  : 'Você já está utilizando a versão mais recente'}
              </p>
            </div>
          </div>
          {!isUpdating && !isApplying && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 space-y-4">
          {isChecking ? (
            <div className="p-8 flex flex-col items-center justify-center space-y-3 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
              <p className="text-sm font-medium text-gray-200">Consultando o repositório oficial no GitHub...</p>
              <span className="text-xs text-gray-400">{networkLocation}</span>
            </div>
          ) : isAvailable ? (
            <>
              {/* Card de Comparação de Versão */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-black/40 border border-gray-800 rounded-lg">
                <div className="flex flex-col">
                  <span className="text-[11px] text-gray-400 font-medium">Versão Atual Instalada</span>
                  <span className="text-sm font-semibold text-gray-300">
                    v{currentInfo?.version || '0.2.8'}{' '}
                    <span className="text-[10px] text-gray-500 font-normal">#{currentInfo?.build || 28}</span>
                  </span>
                </div>
                <div className="flex flex-col border-l border-gray-800 pl-3">
                  <span className="text-[11px] text-cyan-400 font-medium flex items-center gap-1">
                    Nova Versão Oficial <ArrowRight className="w-3 h-3" />
                  </span>
                  <span className="text-sm font-bold text-cyan-300">
                    v{serverInfo?.version || '0.2.9'}{' '}
                    <span className="text-[10px] text-cyan-500/80 font-normal">#{serverInfo?.build || 29}</span>
                  </span>
                </div>
              </div>

              {/* Origem GitHub */}
              <div className="flex items-center justify-between p-2.5 bg-gray-900/60 border border-gray-800 rounded-lg text-xs">
                <div className="flex items-center gap-2 text-gray-300 truncate">
                  <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="truncate text-gray-400">
                    Origem: <strong className="text-gray-200">GitHub (ArthurA32/arduino-turbo-ide)</strong>
                  </span>
                </div>
                <button
                  onClick={handleOpenGitHub}
                  className="text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 text-[11px] shrink-0 ml-2"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ver no GitHub
                </button>
              </div>

              {/* Destaques / Changelog Dinâmico */}
              <div className="bg-black/30 border border-gray-800/80 rounded-lg p-3 space-y-2 text-xs text-gray-300">
                <div className="flex items-center justify-between font-medium text-gray-200">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>O que há de novo neste update:</span>
                  </div>
                  {serverInfo?.releaseDate && (
                    <span className="text-[10px] text-gray-400 font-mono font-normal">
                      {serverInfo.releaseDate}
                    </span>
                  )}
                </div>
                <ul className="list-disc list-outside space-y-1.5 text-gray-400 text-[11px] pl-4 max-h-44 overflow-y-auto pr-1">
                  {changelogItems.map((item, idx) => renderChangelogItem(item, idx))}
                </ul>
              </div>
            </>
          ) : (
            <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-lg space-y-3 text-center">
              <div className="flex items-center justify-center gap-2 text-emerald-400 font-medium text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>O seu aplicativo está 100% atualizado!</span>
              </div>
              <p className="text-xs text-gray-300">
                Você já está rodando a versão mais recente <strong className="text-white">v{currentInfo?.version}</strong> (Build #{currentInfo?.build}).
              </p>
              <div className="text-[11px] text-gray-400 font-mono">
                {networkLocation}
              </div>
            </div>
          )}

          {/* Barra de Progresso quando estiver baixando */}
          {isUpdating && (
            <div className="space-y-2 p-3 bg-cyan-950/20 border border-cyan-500/30 rounded-lg">
              <div className="flex items-center justify-between text-xs">
                <span className="text-cyan-300 font-medium flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  {statusMessage}
                </span>
                <span className="font-mono text-cyan-400 font-bold">
                  {progress.percent}%
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(5, progress.percent)}%` }}
                />
              </div>
              {progress.totalBytes > 0 && (
                <div className="text-[10px] text-gray-400 text-right font-mono">
                  {formatMB(progress.copiedBytes)} / {formatMB(progress.totalBytes)}
                </div>
              )}
            </div>
          )}

          {/* Alerta de Download Concluído com Sucesso */}
          {isDownloaded && !isApplying && (
            <div className="p-3 bg-emerald-950/30 border border-emerald-500/40 rounded-lg flex items-center gap-3 text-xs text-emerald-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <strong className="block font-semibold">Download concluído com sucesso!</strong>
                <span className="text-gray-300">O instalador universal está pronto na memória. Deseja atualizar agora?</span>
              </div>
            </div>
          )}

          {/* Mensagem de Aplicação em Andamento */}
          {isApplying && (
            <div className="p-3 bg-cyan-950/30 border border-cyan-500/40 rounded-lg flex items-center gap-3 text-xs text-cyan-300">
              <RefreshCw className="w-5 h-5 animate-spin text-cyan-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Mensagem de Erro */}
          {errorMessage && (
            <div className="p-3 bg-red-950/30 border border-red-500/40 rounded-lg flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-medium">Falha na atualização:</strong>
                <span className="text-gray-400">{errorMessage}</span>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com Ações */}
        <div className="bg-[#181818] border-t border-gray-800 px-6 py-3.5 flex items-center justify-end gap-3">
          {/* Se a instalação estiver sendo disparada */}
          {isApplying ? (
            <span className="text-[11px] text-cyan-400 animate-pulse font-medium">
              Iniciando instalador e reiniciando aplicação...
            </span>
          ) : isDownloaded ? (
            /* Download concluído: Perguntar se deseja instalar agora */
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                Instalar Depois
              </button>
              <button
                type="button"
                onClick={handleApplyUpdate}
                className="px-5 py-2 text-xs font-bold text-black bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all flex items-center gap-2 animate-pulse"
              >
                <Play className="w-4 h-4 fill-black" />
                Instalar e Reiniciar Agora
              </button>
            </>
          ) : !isUpdating ? (
            /* Estado normal */
            isAvailable ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                >
                  Lembrar Mais Tarde
                </button>
                <button
                  type="button"
                  onClick={handleStartDownload}
                  className="px-5 py-2 text-xs font-bold text-black bg-cyan-400 hover:bg-cyan-300 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all flex items-center gap-2"
                >
                  <DownloadCloud className="w-4 h-4" />
                  Baixar Atualização
                </button>
              </>
            ) : (
              <>
                {onRecheck && (
                  <button
                    type="button"
                    onClick={onRecheck}
                    className="px-4 py-2 text-xs font-medium text-cyan-400 hover:text-cyan-300 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Verificar Novamente
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 text-xs font-bold text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-all"
                >
                  Entendido
                </button>
              </>
            )
          ) : (
            <span className="text-[11px] text-gray-400 animate-pulse">
              Baixando dados do GitHub... Aguarde para instalar.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
