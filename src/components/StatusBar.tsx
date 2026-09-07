import React from 'react';
import { Cpu, Usb, CheckCircle2, AlertCircle, Loader2, HardDrive, Database, Layers, Activity } from 'lucide-react';

interface StatusBarProps {
  isCompiling: boolean;
  isUploading: boolean;
  selectedBoard: any;
  selectedPort: string;
  flashUsage?: string;
  ramUsage?: string;
  statusMessage?: string;
  partitionSchemeLabel?: string;
  activeProcessStep?: number;
  totalProcessSteps?: number;
  processName?: string;
  processPercentage?: number;
  onOpenProcessesDrawer?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  isCompiling,
  isUploading,
  selectedBoard,
  selectedPort,
  flashUsage,
  ramUsage,
  statusMessage,
  partitionSchemeLabel,
  activeProcessStep,
  totalProcessSteps,
  processName,
  processPercentage,
  onOpenProcessesDrawer
}) => {
  return (
    <footer className="h-6 bg-[#16161D] border-t border-[#2B2B36] flex items-center justify-between px-3 text-[11px] text-gray-400 select-none z-30 font-sans">
      {/* Lado Esquerdo: Placa, Porta e Processos Ativos */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-gray-300">
          <Cpu className="w-3 h-3 text-[#00B4B9]" />
          <span className="font-medium truncate max-w-[180px]">
            {selectedBoard ? selectedBoard.name : 'Nenhuma Placa'}
          </span>
        </div>

        <div className="flex items-center gap-1 text-gray-300">
          <Usb className={`w-3 h-3 ${selectedPort ? 'text-green-400' : 'text-gray-500'}`} />
          <span>{selectedPort ? selectedPort : 'Sem Porta'}</span>
        </div>

        {/* Indicador de Processos em Tempo Real (ao lado da porta selecionada) */}
        <button
          onClick={onOpenProcessesDrawer}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono transition-all border ${
            isUploading || isCompiling
              ? 'bg-[#121E2C] border-cyan-500/50 text-cyan-300 hover:bg-[#162638] shadow-sm cursor-pointer'
              : 'bg-[#161622] border-[#2B2B38] text-gray-400 hover:text-gray-300 hover:border-gray-600 cursor-pointer'
          }`}
          title={
            isCompiling || isUploading
              ? `Processo ${activeProcessStep || 1}/${totalProcessSteps || 4}: ${processName || 'Em andamento'} (~${processPercentage || 0}%) - Clique para abrir detalhes`
              : '0 processos pesados ativos - Clique para ver o painel de processos'
          }
        >
          <Activity className={`w-3 h-3 ${isUploading || isCompiling ? 'text-[#00E5FF] animate-pulse' : 'text-gray-500'}`} />
          {isCompiling || isUploading ? (
            <div className="flex items-center gap-1">
              <span className="font-semibold text-white">
                Proc {activeProcessStep || 1}/{totalProcessSteps || 4}:
              </span>
              <span className="text-cyan-200 truncate max-w-[130px] md:max-w-[170px]">
                {processName || (isCompiling ? 'Compilando' : 'Processando')}
              </span>
              <span className="ml-1 px-1 py-0.2 rounded bg-cyan-950/80 border border-cyan-600/40 text-cyan-300 font-bold">
                ~{processPercentage || 0}%
              </span>
            </div>
          ) : (
            <span>0 processos ativos</span>
          )}
        </button>
      </div>

      {/* Centro: Barra de Progresso e Indexação (Restaurada ao estado anterior) */}
      <div className="flex items-center gap-2">
        {isCompiling ? (
          <div className="flex items-center gap-1.5 text-[#00B4B9]">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Compilando sketch & indexando dependências C++...</span>
            <div className="w-16 h-1.5 bg-[#2B2B36] rounded-full overflow-hidden ml-1">
              <div className="h-full bg-[#00B4B9] animate-pulse w-3/4 rounded-full" />
            </div>
          </div>
        ) : isUploading ? (
          <div className="flex items-center gap-1.5 text-[#E47128]">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Gravando na memória Flash...</span>
            <div className="w-16 h-1.5 bg-[#2B2B36] rounded-full overflow-hidden ml-1">
              <div className="h-full bg-[#E47128] animate-pulse w-full rounded-full" />
            </div>
          </div>
        ) : statusMessage ? (
          <div className="flex items-center gap-1 text-gray-300">
            <span>{statusMessage}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-gray-500">
            <CheckCircle2 className="w-3 h-3 text-green-500" />
            <span>Pronto (Indexador C++ Ativo)</span>
          </div>
        )}
      </div>

      {/* Lado Direito: Uso de Memória Flash e RAM */}
      <div className="flex items-center gap-3">
        {partitionSchemeLabel && (
          <div 
            className="flex items-center gap-1 text-amber-300 font-mono text-[10px] bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/40"
            title="Esquema de Partição da Memória Flash (ESP32)"
          >
            <Layers className="w-3 h-3 text-amber-400" />
            <span>{partitionSchemeLabel}</span>
          </div>
        )}

        {flashUsage && (
          <div className="flex items-center gap-1 text-gray-300 font-mono" title="Uso da Memória Flash do Microcontrolador">
            <HardDrive className="w-3 h-3 text-[#00B4B9]" />
            <span>Flash: {flashUsage}</span>
          </div>
        )}

        {ramUsage && (
          <div className="flex items-center gap-1 text-gray-300 font-mono" title="Uso da Memória RAM Dinâmica">
            <Database className="w-3 h-3 text-purple-400" />
            <span>RAM: {ramUsage}</span>
          </div>
        )}

        <div className="text-[10px] text-gray-500 font-mono border-l border-[#2B2B36] pl-2">
          UTF-8
        </div>
      </div>
    </footer>
  );
};
