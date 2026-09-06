import React, { useState, useEffect } from 'react';
import { Bug, Copy, Download, Check, RefreshCw, X, ShieldAlert, Cpu, HardDrive, Usb } from 'lucide-react';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [reportData, setReportData] = useState<any>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [savedPath, setSavedPath] = useState<string | null>(null);

  const fetchDiagnostics = async () => {
    setLoading(true);
    setSavedPath(null);
    try {
      const data = await window.electronAPI.getDiagnostics();
      setReportData(data);
    } catch (err) {
      console.error('Erro ao buscar diagnósticos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDiagnostics();
    }
  }, [isOpen]);

  const handleCopy = () => {
    if (!reportData?.formatted) return;
    navigator.clipboard.writeText(reportData.formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveToDesktop = async () => {
    try {
      const result = await window.electronAPI.exportDiagnosticsToDesktop();
      if (result.success) {
        setSavedPath(result.filePath);
      }
    } catch (e) {
      console.error('Falha ao salvar relatório na Área de Trabalho:', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-[#1E1E1E] border border-[#3E3E42] rounded-lg shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden text-sm">
        {/* Cabeçalho do Modal */}
        <div className="bg-[#121217] px-5 py-3.5 border-b border-[#2A2A38] flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-rose-400">
            <ShieldAlert className="w-5 h-5" />
            <div>
              <h2 className="font-bold text-white text-base leading-tight">
                Relatório de Diagnóstico & Sistema
              </h2>
              <span className="text-[11px] text-gray-400 font-mono">
                {reportData?.raw?.systemProfile?.osName ? `${reportData.raw.systemProfile.osName} (${reportData.raw.systemProfile.tagLabel})` : 'Coletando dados...'}
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

        {/* Resumo Rápido de Cards */}
        <div className="p-4 bg-[#14141A] border-b border-[#2A2A38] grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-[#181822] p-3 rounded-xl border border-[#2B2B38] flex items-start gap-3">
            <Cpu className="w-5 h-5 text-[#00B4B9] shrink-0 mt-0.5" />
            <div>
              <div className="text-[11px] text-gray-400 font-medium">Sistema / Arquitetura</div>
              <div className="font-semibold text-white text-xs">
                {reportData?.raw?.systemProfile?.tagLabel || reportData?.raw?.osInfo?.arch || 'Verificando...'}
              </div>
              <div className="text-[10px] text-[#00B4B9] font-mono mt-0.5">
                {reportData?.raw?.systemProfile?.deviceName || 'Nativo'}
              </div>
            </div>
          </div>

          <div className="bg-[#181822] p-3 rounded-xl border border-[#2B2B38] flex items-start gap-3">
            <HardDrive className="w-5 h-5 text-[#E47128] shrink-0 mt-0.5" />
            <div>
              <div className="text-[11px] text-gray-400 font-medium">Motor Arduino-CLI</div>
              <div className="font-semibold text-white text-xs">
                {reportData?.raw?.cliInfo?.cliFound ? 'Detectado (Ativo)' : 'Não encontrado'}
              </div>
              <div className="text-[10px] text-gray-300 font-mono truncate max-w-[180px] mt-0.5">
                {reportData?.raw?.cliInfo?.cliVersion ? `v${reportData.raw.cliInfo.cliVersion}` : 'Desconhecida'}
              </div>
            </div>
          </div>

          <div className="bg-[#181822] p-3 rounded-xl border border-[#2B2B38] flex items-start gap-3">
            <Usb className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-[11px] text-gray-400 font-medium">Portas Serial / COM</div>
              <div className="font-semibold text-white text-xs">
                {reportData?.raw?.serialInfo?.detectedPorts?.length || 0} detectadas
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5 font-mono">
                {reportData?.raw?.serialInfo?.detectedPorts?.[0]?.port || 'Nenhuma conectada'}
              </div>
            </div>
          </div>
        </div>

        {/* Visualizador de Log Formatado */}
        <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-gray-300 bg-[#181818] select-text">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
              <RefreshCw className="w-6 h-6 animate-spin text-[#00B4B9]" />
              <span>Coletando informações do sistema e logs de erro...</span>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap leading-relaxed">
              {reportData?.formatted || 'Nenhum dado coletado.'}
            </pre>
          )}
        </div>

        {/* Notificação de Arquivo Salvo */}
        {savedPath && (
          <div className="bg-green-950/80 border-t border-green-700/80 px-4 py-2 text-xs text-green-300 flex items-center justify-between">
            <span>✔ Relatório salvo com sucesso em: <strong className="font-mono">{savedPath}</strong></span>
            <button
              onClick={() => window.electronAPI.openPath(savedPath)}
              className="underline text-white hover:text-green-200 ml-2"
            >
              Abrir Arquivo
            </button>
          </div>
        )}

        {/* Barra de Ações Inferior */}
        <div className="bg-[#252526] px-4 py-3 border-t border-[#3E3E42] flex items-center justify-between">
          <button
            onClick={fetchDiagnostics}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#333] hover:bg-[#3E3E42] text-gray-300 text-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar Dados</span>
          </button>

          <div className="flex items-center gap-3">
            {/* Botão Copiar */}
            <button
              onClick={handleCopy}
              disabled={loading || !reportData}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#3E3E42] hover:bg-[#4E4E52] text-white text-xs font-medium transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copiado para a Área de Transferência!' : 'Copiar Texto'}</span>
            </button>

            {/* Botão Salvar na Área de Trabalho */}
            <button
              onClick={handleSaveToDesktop}
              disabled={loading || !reportData}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#00979C] hover:bg-[#00B4B9] text-white text-xs font-semibold shadow-md transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Salvar na Área de Trabalho (.txt)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
