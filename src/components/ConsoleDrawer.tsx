import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal, Code, ChevronUp, ChevronDown, Trash2, ArrowDownCircle, Maximize2, Minimize2, Activity } from 'lucide-react';
import { SerialTerminal } from './SerialTerminal';
import { SerialPlotter } from './SerialPlotter';

interface ConsoleDrawerProps {
  logs: { type: string; text: string }[];
  onClearLogs: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  activeTab: 'console' | 'serial' | 'plotter';
  setActiveTab: (tab: 'console' | 'serial' | 'plotter') => void;
  selectedPort: string;
  setSelectedPort?: (port: string) => void;
  ports?: any[];
  isUploading: boolean;
}

export const ConsoleDrawer: React.FC<ConsoleDrawerProps> = ({
  logs,
  onClearLogs,
  isOpen,
  onToggleOpen,
  activeTab,
  setActiveTab,
  selectedPort,
  setSelectedPort,
  ports,
  isUploading
}) => {
  const [drawerHeight, setDrawerHeight] = useState<number>(280);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const consoleContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && consoleContainerRef.current && activeTab === 'console') {
      consoleContainerRef.current.scrollTop = consoleContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll, activeTab]);

  // Manipulador de redimensionamento por arraste do mouse
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const newHeight = window.innerHeight - e.clientY;
    const minHeight = 110;
    const maxHeight = Math.floor(window.innerHeight * 0.85);

    if (newHeight >= minHeight && newHeight <= maxHeight) {
      setDrawerHeight(newHeight);
      setIsMaximized(false);
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const toggleMaximize = () => {
    if (isMaximized) {
      setDrawerHeight(280);
      setIsMaximized(false);
    } else {
      setDrawerHeight(Math.floor(window.innerHeight * 0.75));
      setIsMaximized(true);
    }
  };

  const currentHeight = isOpen 
    ? (isMaximized ? Math.floor(window.innerHeight * 0.75) : drawerHeight) 
    : 32;

  return (
    <div 
      style={{ height: `${currentHeight}px` }} 
      className={`border-t border-[#2B2B36] bg-[#0F0F13] flex flex-col relative select-none z-20 ${
        isDragging ? '' : 'transition-[height] duration-150'
      }`}
    >
      {/* Barra divisória de redimensionamento (Splitter) */}
      {isOpen && (
        <div
          onMouseDown={handleMouseDown}
          title="Arraste para aumentar ou diminuir a altura do painel"
          className="h-1.5 w-full bg-[#1C1C24] hover:bg-[#00979C] active:bg-[#00B4B9] cursor-row-resize absolute top-0 left-0 transition-colors z-30 flex items-center justify-center group"
        >
          <div className="w-8 h-0.5 bg-gray-500 rounded-full group-hover:bg-white" />
        </div>
      )}

      {/* Barra de Abas do Console */}
      <div className="h-8 bg-[#16161D] border-b border-[#2B2B36] flex items-center justify-between px-3 pt-1">
        <div className="flex items-center gap-1">
          {/* Aba Console de Compilação */}
          <button
            onClick={() => {
              setActiveTab('console');
              if (!isOpen) onToggleOpen();
            }}
            className={`flex items-center gap-1.5 px-3 h-7 text-xs font-medium rounded-t border-b-2 transition-colors ${
              activeTab === 'console' && isOpen
                ? 'border-[#00979C] text-white bg-[#0F0F13]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Code className="w-3.5 h-3.5 text-[#00B4B9]" />
            <span>Saída de Compilação & Gravação</span>
          </button>

          {/* Aba Monitor Serial */}
          <button
            onClick={() => {
              setActiveTab('serial');
              if (!isOpen) onToggleOpen();
            }}
            className={`flex items-center gap-1.5 px-3 h-7 text-xs font-medium rounded-t border-b-2 transition-colors ${
              activeTab === 'serial' && isOpen
                ? 'border-[#00979C] text-white bg-[#0F0F13]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-[#E47128]" />
            <span>Monitor Serial</span>
          </button>

          {/* Aba Plotter Serial Gráfico */}
          <button
            onClick={() => {
              setActiveTab('plotter');
              if (!isOpen) onToggleOpen();
            }}
            className={`flex items-center gap-1.5 px-3 h-7 text-xs font-medium rounded-t border-b-2 transition-colors ${
              activeTab === 'plotter' && isOpen
                ? 'border-[#00979C] text-white bg-[#0F0F13]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-[#66BB6A]" />
            <span>Plotter Gráfico</span>
          </button>
        </div>

        {/* Controles do Console */}
        <div className="flex items-center gap-1">
          {activeTab === 'console' && isOpen && (
            <>
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`p-1 rounded text-xs border transition-colors ${
                  autoScroll ? 'bg-[#00979C]/20 border-[#00979C] text-[#00B4B9]' : 'border-transparent text-gray-400 hover:bg-[#202028]'
                }`}
                title="Autoscroll"
              >
                <ArrowDownCircle className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={onClearLogs}
                className="p-1 text-gray-400 hover:text-red-400 hover:bg-[#202028] rounded transition-colors"
                title="Limpar Console"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {isOpen && (
            <button
              onClick={toggleMaximize}
              className="p-1 text-gray-400 hover:text-white hover:bg-[#202028] rounded transition-colors ml-1"
              title={isMaximized ? "Restaurar Altura" : "Maximizar Painel"}
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            onClick={onToggleOpen}
            className="p-1 text-gray-400 hover:text-white hover:bg-[#202028] rounded transition-colors ml-0.5"
            title={isOpen ? 'Recolher Painel' : 'Expandir Painel'}
          >
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Conteúdo das Abas (Todas preservadas em memória sem desmontar) */}
      {isOpen && (
        <div className="flex-1 overflow-hidden bg-[#0F0F13] relative">
          {/* Aba 1: Saída de Compilação & Gravação */}
          <div className={`h-full w-full ${activeTab === 'console' ? 'flex flex-col' : 'hidden'}`}>
            <div 
              ref={consoleContainerRef}
              className="h-full p-3 overflow-y-auto font-mono text-xs select-text space-y-0.5"
            >
              {logs.length === 0 ? (
                <div className="text-gray-500 italic">
                  Pronto. Clique em "Verificar" para compilar ou "Carregar" para gravar na placa.
                </div>
              ) : (
                logs.map((log, idx) => {
                  const isError = log.text.includes('[ERRO]') || log.text.includes('❌') || log.type === 'error' || log.text.includes('fatal error');
                  const isSuccess = log.text.includes('[SUCESSO]') || log.text.includes('✔');
                  const isHeader = log.text.startsWith('[COMPILAÇÃO]') || log.text.startsWith('[GRAVAÇÃO]');
                  const isNotice = log.text.includes('DIAGNÓSTICO AUTOMÁTICO');

                  return (
                    <div 
                      key={idx} 
                      className={`leading-tight whitespace-pre-wrap break-all ${
                        isNotice
                          ? 'text-yellow-300 font-semibold bg-yellow-950/20 p-2 rounded border border-yellow-800/40 my-1'
                          : isError 
                            ? 'text-red-400 font-semibold' 
                            : isSuccess 
                              ? 'text-green-400 font-semibold' 
                              : isHeader 
                                ? 'text-[#00B4B9] font-bold' 
                                : 'text-gray-300'
                      }`}
                    >
                      {log.text}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Aba 2: Monitor Serial (Mantém logs e conexão 100% preservados) */}
          <div className={`h-full w-full ${activeTab === 'serial' ? 'flex flex-col' : 'hidden'}`}>
            <SerialTerminal 
              selectedPort={selectedPort} 
              setSelectedPort={setSelectedPort}
              ports={ports}
              isUploading={isUploading} 
              isActiveTab={activeTab === 'serial'}
            />
          </div>

          {/* Aba 3: Plotter Gráfico Serial */}
          <div className={`h-full w-full ${activeTab === 'plotter' ? 'flex flex-col' : 'hidden'}`}>
            <SerialPlotter 
              selectedPort={selectedPort}
              setSelectedPort={setSelectedPort}
              ports={ports}
              isUploading={isUploading}
              isActiveTab={activeTab === 'plotter'}
            />
          </div>
        </div>
      )}
    </div>
  );
};
