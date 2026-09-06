import React from 'react';
import { Cpu, Usb, CheckCircle2, AlertCircle, Loader2, HardDrive, Database } from 'lucide-react';

interface StatusBarProps {
  isCompiling: boolean;
  isUploading: boolean;
  selectedBoard: any;
  selectedPort: string;
  flashUsage?: string;
  ramUsage?: string;
  statusMessage?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  isCompiling,
  isUploading,
  selectedBoard,
  selectedPort,
  flashUsage,
  ramUsage,
  statusMessage
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
