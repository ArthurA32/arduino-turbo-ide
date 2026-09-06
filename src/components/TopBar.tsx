import React, { useState } from 'react';
import { 
  Check, 
  ArrowRight, 
  Cpu, 
  Usb, 
  Terminal, 
  Bug, 
  FolderOpen, 
  Save, 
  RefreshCw, 
  DownloadCloud, 
  ChevronDown, 
  Zap, 
  BookOpen, 
  Binary, 
  ShieldAlert,
  Wrench,
  Code2
} from 'lucide-react';

interface TopBarProps {
  onCompile: () => void;
  onUpload: () => void;
  isCompiling: boolean;
  isUploading: boolean;
  onExportBinary: () => void;
  isExportingBinary: boolean;
  onReadChipFirmware: () => void;
  isReadingFirmware?: boolean;
  selectedBoard: any;
  setSelectedBoard: (board: any) => void;
  boards: any[];
  selectedPort: string;
  setSelectedPort: (port: string) => void;
  ports: any[];
  onRefreshPorts: () => void;
  isRefreshingPorts: boolean;
  onToggleSerial: () => void;
  isSerialOpen: boolean;
  onOpenLibraryModal: () => void;
  onOpenDebugModal: () => void;
  onOpenReportModal: () => void;
  onOpenCoreModal: () => void;
  onOpenFile: () => void;
  onSaveFile: () => void;
  fileName: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  onCompile,
  onUpload,
  isCompiling,
  isUploading,
  onExportBinary,
  isExportingBinary,
  onReadChipFirmware,
  isReadingFirmware = false,
  selectedBoard,
  setSelectedBoard,
  boards,
  selectedPort,
  setSelectedPort,
  ports,
  onRefreshPorts,
  isRefreshingPorts,
  onToggleSerial,
  isSerialOpen,
  onOpenLibraryModal,
  onOpenDebugModal,
  onOpenReportModal,
  onOpenCoreModal,
  onOpenFile,
  onSaveFile,
  fileName
}) => {
  const [boardDropdownOpen, setBoardDropdownOpen] = useState(false);
  const [portDropdownOpen, setPortDropdownOpen] = useState(false);
  const [chipMenuOpen, setChipMenuOpen] = useState(false);
  const [boardFilter, setBoardFilter] = useState('');

  const filteredBoards = boards.filter(b => 
    b.name.toLowerCase().includes(boardFilter.toLowerCase()) ||
    b.family.toLowerCase().includes(boardFilter.toLowerCase())
  );

  return (
    <header className="h-13 bg-[#131318] border-b border-[#242430] flex items-center justify-between px-3 text-xs z-30 relative select-none shadow-md">
      
      {/* 1. GRUPO ESQUERDO: AÇÕES DE COMPILAÇÃO, GRAVAÇÃO E SELEÇÃO */}
      <div className="flex items-center gap-1.5">
        
        {/* Botão Verificar / Compilar */}
        <button
          onClick={onCompile}
          disabled={isCompiling || isUploading || isExportingBinary || isReadingFirmware}
          title="Verificar / Compilar Código (Ctrl+R)"
          className={`flex items-center gap-1.5 h-8 px-3 rounded-lg font-semibold text-white transition-all shadow-sm ${
            isCompiling 
              ? 'bg-[#007D82] opacity-80 cursor-wait' 
              : 'bg-[#00979C] hover:bg-[#00B4B9] active:scale-95 shadow-[#00979C]/20'
          }`}
        >
          <Check className={`w-3.5 h-3.5 stroke-[2.5] ${isCompiling ? 'animate-spin' : ''}`} />
          <span>{isCompiling ? 'Compilando...' : 'Verificar'}</span>
        </button>

        {/* Botão Carregar / Upload */}
        <button
          onClick={onUpload}
          disabled={isCompiling || isUploading || isExportingBinary || isReadingFirmware || !selectedPort}
          title={!selectedPort ? 'Selecione uma porta COM primeiro' : 'Carregar para a Placa (Ctrl+U)'}
          className={`flex items-center gap-1.5 h-8 px-3 rounded-lg font-semibold text-white transition-all shadow-sm ${
            isUploading 
              ? 'bg-[#b85310] opacity-80 cursor-wait' 
              : !selectedPort
                ? 'bg-[#252530] text-gray-400 cursor-not-allowed border border-[#323242]'
                : 'bg-[#E47128] hover:bg-[#fa8234] active:scale-95 shadow-[#E47128]/20'
          }`}
        >
          <ArrowRight className={`w-3.5 h-3.5 stroke-[2.5] ${isUploading ? 'animate-bounce' : ''}`} />
          <span>{isUploading ? 'Gravando...' : 'Carregar'}</span>
        </button>

        {/* GRUPO LER & DESCOMPILAR CHIP (ao lado de Carregar) */}
        <div className="relative flex items-center">
          <div className="flex items-center rounded-lg overflow-hidden border border-cyan-500/40 shadow-sm shadow-cyan-900/20">
            <button
              onClick={onReadChipFirmware}
              disabled={isCompiling || isUploading || isExportingBinary || isReadingFirmware || !selectedPort}
              title={!selectedPort ? 'Conecte a uma porta COM para ler o chip' : 'Ler e Descompilar Código em Silício do Chip'}
              className={`flex items-center gap-1.5 h-8 px-3 font-semibold text-white transition-all ${
                isReadingFirmware
                  ? 'bg-cyan-800 opacity-90 cursor-wait'
                  : !selectedPort
                    ? 'bg-[#1e1e28] text-gray-500 cursor-not-allowed'
                    : 'bg-cyan-600 hover:bg-cyan-500 active:scale-95'
              }`}
            >
              <Cpu className={`w-3.5 h-3.5 ${isReadingFirmware ? 'animate-spin' : ''}`} />
              <span>{isReadingFirmware ? 'Lendo Chip...' : 'Ler / Descompilar Chip'}</span>
            </button>

            <button
              onClick={() => setChipMenuOpen(!chipMenuOpen)}
              disabled={isCompiling || isUploading || isExportingBinary || isReadingFirmware || !selectedPort}
              className="h-8 px-1.5 bg-cyan-700 hover:bg-cyan-600 text-white border-l border-cyan-500/40 transition flex items-center justify-center"
              title="Opções de Leitura e Exportação do Chip"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Menu Dropdown de Opções de Firmware */}
          {chipMenuOpen && (
            <div className="absolute left-0 top-9 w-64 bg-[#14141C] border border-cyan-500/30 rounded-xl shadow-2xl z-50 p-2 backdrop-blur-md animate-in fade-in duration-150">
              <button
                onClick={() => {
                  setChipMenuOpen(false);
                  onReadChipFirmware();
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#1E1E2A] rounded-lg text-xs font-medium text-cyan-300 hover:text-cyan-200 flex items-center gap-2 transition"
              >
                <Cpu className="w-4 h-4 text-cyan-400" />
                <div>
                  <div className="font-bold">Ler & Descompilar Chip</div>
                  <div className="text-[10px] text-gray-400">Puxa o código da Flash e descompila para C</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setChipMenuOpen(false);
                  onExportBinary();
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#1E1E2A] rounded-lg text-xs font-medium text-emerald-300 hover:text-emerald-200 flex items-center gap-2 transition border-t border-gray-800 mt-1"
              >
                <Binary className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="font-bold">Exportar Binário Compilado</div>
                  <div className="text-[10px] text-gray-400">Salva o binário (.bin/.hex) do projeto atual</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Botão Exportar Binário Rápido */}
        <button
          onClick={onExportBinary}
          disabled={isCompiling || isUploading || isExportingBinary || !selectedBoard}
          title="Exportar Binário Compilado (.bin / .hex) para a Área de Trabalho"
          className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg border transition-all text-xs font-medium ${
            isExportingBinary
              ? 'bg-[#261E38] border-purple-600 text-purple-200 cursor-wait'
              : 'bg-[#181822] hover:bg-[#222232] border-[#2A2A3A] hover:border-purple-600/50 text-gray-300 hover:text-white active:scale-95'
          }`}
        >
          <Binary className={`w-3.5 h-3.5 text-purple-400 ${isExportingBinary ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isExportingBinary ? 'Exportando...' : 'Exportar Binário'}</span>
        </button>


        <div className="h-5 w-[1px] bg-[#2A2A3A] mx-1" />

        {/* Seletor de Placa */}
        <div className="relative">
          <button
            onClick={() => {
              setBoardDropdownOpen(!boardDropdownOpen);
              setPortDropdownOpen(false);
            }}
            className="flex items-center gap-2 h-8 bg-[#181822] hover:bg-[#222230] border border-[#2A2A3A] hover:border-[#3D3D52] px-2.5 rounded-lg text-gray-200 transition-all"
          >
            <Cpu className="w-3.5 h-3.5 text-[#00B4B9]" />
            <span className="max-w-[140px] truncate font-medium">
              {selectedBoard ? selectedBoard.name : 'Selecione a Placa'}
            </span>
            <ChevronDown className="w-3 h-3 text-gray-400 opacity-75" />
          </button>

          {boardDropdownOpen && (
            <div className="absolute left-0 mt-1 w-72 bg-[#14141C] border border-[#2E2E40] rounded-xl shadow-2xl z-50 p-2.5 backdrop-blur-md">
              <input
                type="text"
                placeholder="Buscar placa (ex: ESP32-C5, Uno)..."
                value={boardFilter}
                onChange={(e) => setBoardFilter(e.target.value)}
                className="w-full bg-[#1C1C26] border border-[#2E2E40] rounded-lg px-2.5 py-1.5 text-xs text-white mb-2 focus:outline-none focus:border-[#00979C]"
                autoFocus
              />
              <div className="max-h-60 overflow-y-auto space-y-1">
                {filteredBoards.map((b) => (
                  <button
                    key={b.fqbn}
                    onClick={() => {
                      setSelectedBoard(b);
                      setBoardDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                      selectedBoard?.fqbn === b.fqbn 
                        ? 'bg-[#00979C] text-white font-semibold shadow-sm' 
                        : 'hover:bg-[#222230] text-gray-300'
                    }`}
                  >
                    <span>{b.name}</span>
                    <span className="text-[10px] opacity-60 uppercase font-mono">{b.family}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Seletor de Porta COM */}
        <div className="relative">
          <button
            onClick={() => {
              setPortDropdownOpen(!portDropdownOpen);
              setBoardDropdownOpen(false);
            }}
            className="flex items-center gap-2 h-8 bg-[#181822] hover:bg-[#222230] border border-[#2A2A3A] hover:border-[#3D3D52] px-2.5 rounded-lg text-gray-200 transition-all"
          >
            <Usb className={`w-3.5 h-3.5 ${selectedPort ? 'text-[#00B4B9]' : 'text-gray-400'}`} />
            <span className="font-medium">
              {selectedPort ? selectedPort : 'Sem Porta'}
            </span>
            <ChevronDown className="w-3 h-3 text-gray-400 opacity-75" />
          </button>

          {portDropdownOpen && (
            <div className="absolute left-0 mt-1 w-80 bg-[#14141C] border border-[#2E2E40] rounded-xl shadow-2xl z-50 p-2.5 backdrop-blur-md">
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-[#282838]">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Portas Detectadas</span>
                <button
                  onClick={onRefreshPorts}
                  className="flex items-center gap-1 text-xs text-[#00B4B9] hover:underline"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshingPorts ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
              </div>

              {ports.length === 0 ? (
                <div className="p-3 text-center text-xs text-gray-400">
                  Nenhuma placa detectada.<br />Conecte o cabo USB e clique em Atualizar.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {ports.map((p) => (
                    <button
                      key={p.port}
                      onClick={() => {
                        setSelectedPort(p.port);
                        setPortDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex flex-col transition-colors ${
                        selectedPort === p.port 
                          ? 'bg-[#00979C] text-white font-semibold' 
                          : 'hover:bg-[#222230] text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{p.port}</span>
                        <span className="text-[10px] opacity-75">{p.boardGuess || 'Serial'}</span>
                      </div>
                      <span className="text-[11px] opacity-80 truncate">{p.friendlyName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. GRUPO CENTRAL: IDENTIFICAÇÃO DO PROJETO */}
      <div className="hidden lg:flex items-center gap-1.5 text-xs text-gray-300 font-mono bg-[#181822] px-3 h-7 rounded-lg border border-[#2A2A38]">
        <Code2 className="w-3.5 h-3.5 text-[#00B4B9]" />
        <span>{fileName || 'sketch.ino'}</span>
      </div>

      {/* 3. GRUPO DIREITO: FERRAMENTAS INTEGRADAS E UTILITÁRIOS */}
      <div className="flex items-center gap-1.5">
        
        {/* Abrir / Salvar */}
        <div className="flex items-center bg-[#181822] border border-[#2A2A3A] rounded-lg p-0.5">
          <button
            onClick={onOpenFile}
            title="Abrir Arquivo (.ino / .cpp)"
            className="p-1.5 rounded-md hover:bg-[#252535] text-gray-400 hover:text-white transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onSaveFile}
            title="Salvar Código Atual (Ctrl+S)"
            className="p-1.5 rounded-md hover:bg-[#252535] text-gray-400 hover:text-white transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-5 w-[1px] bg-[#2A2A3A] mx-0.5" />

        {/* Gerenciador de Bibliotecas */}
        <button
          onClick={onOpenLibraryModal}
          title="Gerenciador de Bibliotecas do Arduino (Nuvem e Instaladas)"
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[#181822] hover:bg-[#222232] border border-[#2A2A3A] hover:border-teal-500/50 text-gray-300 hover:text-white text-xs font-medium transition-all active:scale-95"
        >
          <BookOpen className="w-3.5 h-3.5 text-teal-400" />
          <span className="hidden md:inline">Bibliotecas</span>
        </button>

        {/* Depuração GDB & JTAG */}
        <button
          onClick={onOpenDebugModal}
          title="Depuração de Hardware (GDB / JTAG / OpenOCD)"
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[#181822] hover:bg-[#222232] border border-[#2A2A3A] hover:border-amber-500/50 text-gray-300 hover:text-white text-xs font-medium transition-all active:scale-95"
        >
          <Wrench className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden md:inline">Depurar</span>
        </button>

        {/* Gerenciar Cores / Drivers */}
        <button
          onClick={onOpenCoreModal}
          title="Gerenciador de Cores e Drivers de Placas (ESP32, AVR, SAMD)"
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[#181822] hover:bg-[#222232] border border-[#2A2A3A] hover:border-sky-500/50 text-gray-300 hover:text-white text-xs font-medium transition-all active:scale-95"
        >
          <DownloadCloud className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden md:inline">Cores / Drivers</span>
        </button>

        {/* Relatório de Erros & Diagnóstico */}
        <button
          onClick={onOpenReportModal}
          title="Exportar Relatório de Erros e Diagnóstico de Sistema"
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[#181822] hover:bg-[#28181E] border border-[#2A2A3A] hover:border-rose-500/50 text-gray-300 hover:text-rose-200 text-xs font-medium transition-all active:scale-95"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden md:inline">Diagnóstico</span>
        </button>

        <div className="h-5 w-[1px] bg-[#2A2A3A] mx-0.5" />

        {/* Monitor Serial Nativo */}
        <button
          onClick={onToggleSerial}
          title="Abrir / Alternar Monitor Serial"
          className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border transition-all active:scale-95 shadow-sm ${
            isSerialOpen
              ? 'bg-[#00979C] text-white border-[#00979C] shadow-[#00979C]/20'
              : 'bg-[#181822] text-gray-200 border-[#2A2A3A] hover:bg-[#222230] hover:text-white'
          }`}
        >
          <Terminal className={`w-3.5 h-3.5 ${isSerialOpen ? 'text-white' : 'text-[#E47128]'}`} />
          <span>Monitor Serial</span>
        </button>

      </div>
    </header>
  );
};


