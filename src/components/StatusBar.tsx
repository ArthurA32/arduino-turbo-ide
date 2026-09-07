import React from 'react';
import { Cpu, Usb, CheckCircle2, AlertCircle, Loader2, HardDrive, Database, Layers } from 'lucide-react';

interface StatusBarProps {
  isCompiling: boolean;
  isUploading: boolean;
  selectedBoard: any;
  selectedPort: string;
  flashUsage?: string;
  ramUsage?: string;
  statusMessage?: string;
  uploadProgress?: number | null;
  uploadStatusText?: string;
  partitionSchemeLabel?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  isCompiling,
  isUploading,
  selectedBoard,
  selectedPort,
  flashUsage,
  ramUsage,
  statusMessage,
  uploadProgress,
  uploadStatusText,
  partitionSchemeLabel
}) => {
  return (
    <footer className="h-6 bg-[#16161D] border-t border-[#2B2B36] flex items-center justify-between px-3 text-[11px] text-gray-400 select-none z-30 font-sans">
      {/* Lado Esquerdo: Placa e Porta Selecionadas */}
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
      </div>

      {/* Centro: Barra de Progresso e Indexação */}
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
          <div className="flex items-center gap-2 text-[#E47128]">
            <Loader2 className="w-3 h-3 animate-spin shrink-0 text-[#FF8C38]" />
            <span className="font-medium truncate max-w-[220px]">
              {uploadStatusText || 'Gravando na memória Flash...'}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-28 h-2 bg-[#2B2B36] rounded-full overflow-hidden border border-[#3A2820] shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-[#E47128] via-[#FF8C38] to-[#00E5FF] rounded-full transition-all duration-150 ease-out shadow-sm"
                  style={{ width: `${Math.max(uploadProgress ?? 5, 5)}%` }}
                />
              </div>
              <span className="font-mono text-[10px] font-bold text-[#FF8C38] min-w-[32px] text-right">
                {uploadProgress !== null && uploadProgress !== undefined ? `${uploadProgress}%` : '...'}
              </span>
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
