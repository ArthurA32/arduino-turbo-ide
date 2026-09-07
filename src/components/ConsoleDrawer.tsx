import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal, Code, ChevronUp, ChevronDown, Trash2, ArrowDownCircle, Maximize2, Minimize2, Activity, Cpu, CheckCircle2, Clock, Layers, Zap } from 'lucide-react';
import { SerialTerminal } from './SerialTerminal';
import { SerialPlotter } from './SerialPlotter';

interface ConsoleDrawerProps {
  logs: { type: string; text: string }[];
  onClearLogs: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  activeTab: 'console' | 'serial' | 'plotter' | 'processos';
  setActiveTab: (tab: 'console' | 'serial' | 'plotter' | 'processos') => void;
  selectedPort: string;
  setSelectedPort?: (port: string) => void;
  ports?: any[];
  isUploading: boolean;
  isCompiling?: boolean;
  selectedBoard?: any;
  activeProcessStep?: number;
  totalProcessSteps?: number;
  processName?: string;
  processPercentage?: number;
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
  isUploading,
  isCompiling = false,
  selectedBoard,
  activeProcessStep = 0,
  totalProcessSteps = 4,
  processName = 'Ocioso',
  processPercentage = 0
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

  const isBusy = isCompiling || isUploading;

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

          {/* Aba Processos do Sistema */}
          <button
            onClick={() => {
              setActiveTab('processos');
              if (!isOpen) onToggleOpen();
            }}
            className={`flex items-center gap-1.5 px-3 h-7 text-xs font-medium rounded-t border-b-2 transition-colors ${
              activeTab === 'processos' && isOpen
                ? 'border-[#00E5FF] text-white bg-[#0F0F13]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span>Processos Ativos</span>
            {isBusy && (
              <span className="flex h-2 w-2 relative ml-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
            )}
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

          {/* Aba 2: Monitor Serial */}
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

          {/* Aba 4: Processos do Sistema em Tempo Real */}
          <div className={`h-full w-full p-4 overflow-y-auto ${activeTab === 'processos' ? 'flex flex-col gap-4' : 'hidden'}`}>
            {/* Header de Status Geral */}
            <div className="flex flex-col md:flex-row md:items-center justify-between bg-[#151520] border border-[#2B2B3E] rounded-xl p-3.5 gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${isBusy ? 'bg-cyan-950/60 border border-cyan-500/50' : 'bg-gray-800/50'}`}>
                  <Activity className={`w-5 h-5 ${isBusy ? 'text-[#00E5FF] animate-spin' : 'text-gray-400'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      {isBusy ? `Processo Ativo: Etapa ${activeProcessStep}/${totalProcessSteps}` : 'Sistema Ocioso'}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${
                      isBusy ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-gray-800 text-gray-400'
                    }`}>
                      {isBusy ? `~${processPercentage}% Concluído` : 'Pronto'}
                    </span>
                  </div>
                  <p className="text-xs text-cyan-200 mt-0.5">
                    {processName}
                  </p>
                </div>
              </div>

              {/* Barra de Progresso Geral */}
              <div className="flex flex-col min-w-[200px] max-w-xs">
                <div className="flex justify-between text-[11px] text-gray-400 font-mono mb-1">
                  <span>Velocidade Estimada:</span>
                  <span className="text-amber-400 font-bold">{processPercentage}%</span>
                </div>
                <div className="w-full h-2.5 bg-[#20202E] rounded-full overflow-hidden border border-[#303046]">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-amber-400 transition-all duration-300 ease-out"
                    style={{ width: `${Math.max(processPercentage, isBusy ? 8 : 0)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Pipeline de Etapas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
              {[
                { step: 1, title: 'Preparação & Partição', desc: 'Configuração Huge App 3MB e indexação de abas' },
                { step: 2, title: 'Compilação Paralela C++', desc: 'Geração de objetos com GCC/G++ em paralelo' },
                { step: 3, title: 'Handshake Serial', desc: 'Sincronização bootloader e limpeza de setores da Flash' },
                { step: 4, title: 'Gravação Flash SPI', desc: 'Transferência de blocos para a memória física a 921k' }
              ].map((item) => {
                const isCompleted = activeProcessStep > item.step || (!isBusy && activeProcessStep === 0 && processPercentage === 100);
                const isCurrent = isBusy && activeProcessStep === item.step;
                return (
                  <div 
                    key={item.step}
                    className={`p-3 rounded-lg border flex flex-col transition-all ${
                      isCurrent
                        ? 'bg-cyan-950/30 border-cyan-500/60 shadow-md shadow-cyan-950/50'
                        : isCompleted
                          ? 'bg-[#141A22] border-teal-500/30 text-gray-300'
                          : 'bg-[#12121A] border-[#222230] opacity-60 text-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[11px] font-bold font-mono ${isCurrent ? 'text-cyan-300' : isCompleted ? 'text-teal-400' : 'text-gray-400'}`}>
                        Etapa {item.step}/4
                      </span>
                      {isCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                      ) : isCurrent ? (
                        <Zap className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-gray-600" />
                      )}
                    </div>
                    <span className="text-xs font-semibold text-white truncate">{item.title}</span>
                    <span className="text-[10px] text-gray-400 mt-1 leading-snug">{item.desc}</span>
                  </div>
                );
              })}
            </div>

            {/* Tabela de Executáveis e Processos em Segundo Plano */}
            <div className="bg-[#12121A] border border-[#242436] rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-[#171724] border-b border-[#242436] text-[11px] font-bold text-gray-300 uppercase tracking-wider flex items-center justify-between">
                <span>Processos de Sistema Orquestrados</span>
                <span className="text-[10px] text-cyan-400 font-mono">Ambiente: Windows ARM64 / WoA</span>
              </div>
              <div className="divide-y divide-[#1E1E2C] text-xs font-mono">
                <div className="px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span className="font-semibold text-gray-200">arduino-cli.exe</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-800/40">ARM64 Nativo</span>
                  </div>
                  <span className="text-gray-400">{isBusy ? 'Executando Orquestração' : 'Pronto em Espera'}</span>
                </div>

                <div className="px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isCompiling ? 'bg-cyan-400 animate-ping' : 'bg-gray-600'}`}></span>
                    <span className="font-semibold text-gray-200">xtensa-esp32-elf-g++ / riscv32</span>
                    <span className="text-[10px] text-amber-400 bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-800/40">WoA Prism / x64</span>
                  </div>
                  <span className={isCompiling ? 'text-cyan-300 font-bold' : 'text-gray-500'}>
                    {isCompiling ? 'Compilando código & bibliotecas C++' : 'Aguardando Compilação'}
                  </span>
                </div>

                <div className="px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isUploading ? 'bg-orange-400 animate-ping' : 'bg-gray-600'}`}></span>
                    <span className="font-semibold text-gray-200">Flasher / esptool (Diferencial)</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-800/40">Cache Inteligente</span>
                    <span className="text-[10px] text-sky-400 bg-sky-950/40 px-1.5 py-0.2 rounded border border-sky-800/40">921.6k Baud</span>
                  </div>
                  <span className={isUploading ? 'text-orange-300 font-bold' : 'text-gray-500'}>
                    {isUploading ? `Gravando em ${selectedPort || 'Porta COM'}` : 'Aguardando Upload'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
