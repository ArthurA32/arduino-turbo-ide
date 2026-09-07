import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Check, 
  ArrowRight, 
  Cpu, 
  Usb, 
  Terminal, 
  FolderOpen, 
  Save, 
  RefreshCw, 
  DownloadCloud, 
  ChevronDown, 
  BookOpen, 
  Binary, 
  ShieldAlert,
  Wrench,
  Code2,
  Search,
  X,
  Layers,
  Sparkles
} from 'lucide-react';
import appLogo from '../assets/logo.png';

export interface PartitionSchemeInfo {
  id: string;
  labelShort: string;
  labelFull: string;
  desc: string;
  recommended?: boolean;
}

export const ESP32_PARTITIONS: PartitionSchemeInfo[] = [
  {
    id: 'huge_app',
    labelShort: 'Huge App (3MB)',
    labelFull: 'Huge App (3.14MB Sem OTA)',
    desc: '3.14MB livres para o sketch. Recomendado para BLE, WiFi e projetos complexos.',
    recommended: true
  },
  {
    id: 'default',
    labelShort: 'Padrão (1.3MB)',
    labelFull: 'Padrão (1.31MB Com OTA)',
    desc: '1.31MB para o sketch com suporte a atualizações remotas OTA.'
  },
  {
    id: 'min_spiffs',
    labelShort: 'Min SPIFFS (1.9MB)',
    labelFull: 'Mínimo SPIFFS (1.9MB Com OTA)',
    desc: '1.9MB para sketch com OTA e SPIFFS reduzido.'
  },
  {
    id: 'no_ota',
    labelShort: 'Sem OTA (2MB)',
    labelFull: 'Sem OTA (2.0MB App / 2MB SPIFFS)',
    desc: '2MB para o sketch e 2MB para sistema de arquivos SPIFFS/LittleFS.'
  }
];

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
  onToggleSerial?: () => void;
  isSerialOpen?: boolean;
  onOpenLibraryModal: () => void;
  onOpenDebugModal: () => void;
  onOpenReportModal: () => void;
  onOpenCoreModal: () => void;
  onOpenFile: () => void;
  onSaveFile: () => void;
  fileName: string;
  partitionScheme?: string;
  onPartitionSchemeChange?: (scheme: string) => void;
  versionInfo?: { version: string; build: number; arch: string; targetName: string; fullString: string };
  updateInfo?: any;
  onOpenUpdateModal?: () => void;
  onCheckForUpdates?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  versionInfo,
  updateInfo,
  onOpenUpdateModal,
  onCheckForUpdates,
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
  fileName,
  partitionScheme = 'huge_app',
  onPartitionSchemeChange
}) => {
  const [boardDropdownOpen, setBoardDropdownOpen] = useState(false);
  const [portDropdownOpen, setPortDropdownOpen] = useState(false);
  const [chipMenuOpen, setChipMenuOpen] = useState(false);
  const [partitionDropdownOpen, setPartitionDropdownOpen] = useState(false);
  const [boardFilter, setBoardFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Todas' | 'ESP32' | 'Arduino' | 'Outros'>('Todas');

  const boardDropdownRef = useRef<HTMLDivElement>(null);
  const portDropdownRef = useRef<HTMLDivElement>(null);
  const chipMenuRef = useRef<HTMLDivElement>(null);
  const partitionDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isEsp32 = selectedBoard && (
    (selectedBoard.family || '').toUpperCase().includes('ESP32') ||
    (selectedBoard.platform || '').toLowerCase() === 'esp32' ||
    (selectedBoard.fqbn || '').toLowerCase().includes('esp32')
  );

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (boardDropdownRef.current && !boardDropdownRef.current.contains(event.target as Node)) {
        setBoardDropdownOpen(false);
      }
      if (portDropdownRef.current && !portDropdownRef.current.contains(event.target as Node)) {
        setPortDropdownOpen(false);
      }
      if (chipMenuRef.current && !chipMenuRef.current.contains(event.target as Node)) {
        setChipMenuOpen(false);
      }
      if (partitionDropdownRef.current && !partitionDropdownRef.current.contains(event.target as Node)) {
        setPartitionDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Foco seguro ao abrir o dropdown de placas sem disparar scrolls indesejados
  useEffect(() => {
    if (boardDropdownOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus({ preventScroll: true });
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setBoardFilter('');
    }
  }, [boardDropdownOpen]);

  // Função para normalização de busca (ignora espaços, traços, sublinhados e acentos)
  const normalizeText = (text: string) =>
    (text || '')
      .toLowerCase()
      .replace(/[\s\-_]/g, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  // Filtragem inteligente e resiliente
  const filteredBoards = useMemo(() => {
    const safeBoards = Array.isArray(boards) ? boards : [];
    const rawFilter = boardFilter.trim().toLowerCase();
    const normFilter = normalizeText(rawFilter);
    const filterTokens = rawFilter.split(/\s+/).filter(Boolean);

    return safeBoards.filter((b) => {
      if (!b) return false;

      // Filtro de Categoria por Família
      const bFamily = (b.family || '').toUpperCase();
      if (selectedCategory === 'ESP32' && !bFamily.includes('ESP32')) return false;
      if (selectedCategory === 'Arduino' && !bFamily.includes('ARDUINO') && !bFamily.includes('AVR')) return false;
      if (selectedCategory === 'Outros' && (bFamily.includes('ESP32') || bFamily.includes('ARDUINO') || bFamily.includes('AVR'))) return false;

      if (!rawFilter) return true;

      const name = (b.name || '').toLowerCase();
      const fqbn = (b.fqbn || '').toLowerCase();
      const family = (b.family || '').toLowerCase();

      // 1. Match exato de substring
      if (name.includes(rawFilter) || fqbn.includes(rawFilter) || family.includes(rawFilter)) {
        return true;
      }

      // 2. Match normalizado (ex: esp32s3 -> ESP32-S3, uno -> Arduino Uno)
      const nameNorm = normalizeText(name);
      const fqbnNorm = normalizeText(fqbn);
      if (nameNorm.includes(normFilter) || fqbnNorm.includes(normFilter)) {
        return true;
      }

      // 3. Match multi-termo (todas as palavras presentes em qualquer ordem)
      if (filterTokens.length > 1) {
        return filterTokens.every((token) => name.includes(token) || fqbn.includes(token) || family.includes(token));
      }

      return false;
    });
  }, [boards, boardFilter, selectedCategory]);

  return (
    <header className="h-13 bg-[#131318] border-b border-[#242430] flex items-center justify-between px-2.5 text-xs z-40 relative select-none shadow-md overflow-visible flex-nowrap min-w-0">
      
      {/* 1. GRUPO ESQUERDO: LOGO, COMPILAÇÃO, GRAVAÇÃO E SELEÇÃO */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 flex-nowrap min-w-0">
        
        {/* Logotipo Oficial */}
        <div className="flex items-center gap-1.5 pr-1 shrink-0 select-none">
          <img 
            src={appLogo} 
            alt="Logo" 
            className="w-6 h-6 rounded-lg shadow-sm border border-cyan-500/30 object-cover"
          />
          <span className="font-extrabold text-[12px] tracking-wider bg-gradient-to-r from-cyan-400 via-teal-300 to-amber-400 bg-clip-text text-transparent hidden sm:inline">
            TURBO IDE
          </span>
          <button 
            type="button"
            onClick={onCheckForUpdates || onOpenUpdateModal}
            className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-900/90 text-cyan-300 hover:text-cyan-100 border border-cyan-500/40 hover:border-cyan-400 shrink-0 hidden md:inline shadow-sm cursor-pointer transition-all hover:scale-105 active:scale-95"
            title={`Arduino Turbo IDE v${versionInfo?.version || '0.1.3'} [${versionInfo?.arch === 'arm64' ? 'ARM64 Nativo' : 'x64'}] - Clique para verificar atualizações no servidor local`}
          >
            v{versionInfo?.version || '0.1.3'}
          </button>

          {updateInfo?.available && (
            <button
              onClick={onOpenUpdateModal}
              title={`Nova versão v${updateInfo?.serverInfo?.version || 'nova'} disponível no servidor local! Clique para atualizar.`}
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-300 border border-cyan-400/60 hover:from-cyan-500/50 hover:to-blue-500/50 transition-all animate-pulse shadow-[0_0_12px_rgba(6,182,212,0.5)] cursor-pointer shrink-0"
            >
              <Sparkles className="w-3 h-3 text-cyan-400 animate-spin" />
              <span>Update v{updateInfo?.serverInfo?.version}</span>
            </button>
          )}
        </div>

        <div className="h-5 w-[1px] bg-[#2A2A3A] mr-0.5 shrink-0" />

        {/* Botão Verificar / Compilar */}
        <button
          onClick={onCompile}
          disabled={isCompiling || isUploading || isExportingBinary || isReadingFirmware}
          title="Verificar / Compilar Código (Ctrl+R)"
          className={`flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg font-semibold text-white transition-all shadow-sm shrink-0 whitespace-nowrap ${
            isCompiling 
              ? 'bg-[#007D82] opacity-80 cursor-wait' 
              : 'bg-[#00979C] hover:bg-[#00B4B9] active:scale-95 shadow-[#00979C]/20'
          }`}
        >
          <Check className={`w-3.5 h-3.5 stroke-[2.5] shrink-0 ${isCompiling ? 'animate-spin' : ''}`} />
          <span className="whitespace-nowrap hidden sm:inline">{isCompiling ? 'Compilando...' : 'Verificar'}</span>
        </button>

        {/* Botão Carregar / Upload */}
        <button
          onClick={onUpload}
          disabled={isCompiling || isUploading || isExportingBinary || isReadingFirmware || !selectedPort}
          title={!selectedPort ? 'Selecione uma porta COM primeiro' : 'Carregar para a Placa (Ctrl+U)'}
          className={`flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg font-semibold text-white transition-all shadow-sm shrink-0 whitespace-nowrap ${
            isUploading 
              ? 'bg-[#b85310] opacity-80 cursor-wait' 
              : !selectedPort
                ? 'bg-[#252530] text-gray-400 cursor-not-allowed border border-[#323242]'
                : 'bg-[#E47128] hover:bg-[#fa8234] active:scale-95 shadow-[#E47128]/20'
          }`}
        >
          <ArrowRight className={`w-3.5 h-3.5 stroke-[2.5] shrink-0 ${isUploading ? 'animate-bounce' : ''}`} />
          <span className="whitespace-nowrap hidden sm:inline">{isUploading ? 'Gravando...' : 'Carregar'}</span>
        </button>

        {/* GRUPO LER & DESCOMPILAR CHIP (ao lado de Carregar) */}
        <div ref={chipMenuRef} className="relative flex items-center shrink-0 whitespace-nowrap">
          <div className="flex items-center rounded-lg overflow-hidden border border-cyan-500/40 shadow-sm shadow-cyan-900/20 shrink-0 whitespace-nowrap">
            <button
              onClick={onReadChipFirmware}
              disabled={isCompiling || isUploading || isExportingBinary || isReadingFirmware || !selectedPort}
              title={!selectedPort ? 'Conecte a uma porta COM para ler o chip' : 'Ler e Descompilar Código em Silício do Chip'}
              className={`flex items-center gap-1.5 h-8 px-2.5 font-semibold text-white transition-all whitespace-nowrap shrink-0 ${
                isReadingFirmware
                  ? 'bg-cyan-800 opacity-90 cursor-wait'
                  : !selectedPort
                    ? 'bg-[#1e1e28] text-gray-500 cursor-not-allowed'
                    : 'bg-cyan-600 hover:bg-cyan-500 active:scale-95'
              }`}
            >
              <Cpu className={`w-3.5 h-3.5 shrink-0 ${isReadingFirmware ? 'animate-spin' : ''}`} />
              <span className="whitespace-nowrap hidden sm:inline leading-normal">
                {isReadingFirmware ? 'Lendo...' : 'Ler Chip'}
              </span>
            </button>

            <button
              onClick={() => {
                setChipMenuOpen(!chipMenuOpen);
                setBoardDropdownOpen(false);
                setPortDropdownOpen(false);
                setPartitionDropdownOpen(false);
              }}
              disabled={isCompiling || isUploading || isExportingBinary || isReadingFirmware || !selectedPort}
              className="h-8 px-1.5 bg-cyan-700 hover:bg-cyan-600 text-white border-l border-cyan-500/40 transition flex items-center justify-center shrink-0"
              title="Opções de Leitura e Exportação do Chip"
            >
              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>

          {/* Menu Dropdown de Opções de Firmware */}
          {chipMenuOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-64 bg-[#14141C] border border-cyan-500/30 rounded-xl shadow-2xl z-50 p-2 backdrop-blur-md animate-dropdownSlideDown">
              <button
                onClick={() => {
                  setChipMenuOpen(false);
                  onReadChipFirmware();
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#1E1E2A] rounded-lg text-xs font-medium text-cyan-300 hover:text-cyan-200 flex items-center gap-2 transition"
              >
                <Cpu className="w-4 h-4 text-cyan-400 shrink-0" />
                <div>
                  <div className="font-bold whitespace-nowrap">Ler & Descompilar Chip</div>
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
                <Binary className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-bold whitespace-nowrap">Salvar Firmware (.BIN)</div>
                  <div className="text-[10px] text-gray-400">Exporta binário bruto para seu computador</div>
                </div>
              </button>
            </div>
          )}
        </div>

        <div className="h-5 w-[1px] bg-[#2A2A3A] mx-0.5 shrink-0" />

        {/* Seletor de Placa */}
        <div ref={boardDropdownRef} className="relative shrink-0">
          <button
            onClick={() => {
              setBoardDropdownOpen(!boardDropdownOpen);
              setPortDropdownOpen(false);
              setChipMenuOpen(false);
              setPartitionDropdownOpen(false);
            }}
            className="flex items-center gap-1.5 sm:gap-2 h-8 bg-[#181822] hover:bg-[#222230] border border-[#2A2A3A] hover:border-[#3D3D52] px-2 sm:px-2.5 rounded-lg text-gray-200 transition-all shrink-0 whitespace-nowrap shadow-sm"
          >
            <Cpu className="w-3.5 h-3.5 text-[#00B4B9] shrink-0" />
            <span className="max-w-[105px] sm:max-w-[130px] md:max-w-[160px] truncate font-medium">
              {selectedBoard ? selectedBoard.name : 'Selecione a Placa'}
            </span>
            <ChevronDown className={`w-3 h-3 text-gray-400 opacity-75 shrink-0 transition-transform duration-200 ease-out ${boardDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {boardDropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-84 max-w-[90vw] bg-[#14141C] border border-[#2E2E40] rounded-xl shadow-2xl z-50 p-2.5 backdrop-blur-md animate-dropdownSlideDown">
              {/* Campo de Busca Inteligente */}
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar placa (ex: ESP32-C5, Uno, Wemos)..."
                  value={boardFilter}
                  onChange={(e) => setBoardFilter(e.target.value)}
                  className="w-full bg-[#1C1C26] border border-[#2E2E40] rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00979C]"
                />
                {boardFilter && (
                  <button
                    onClick={() => setBoardFilter('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-0.5"
                    title="Limpar busca"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Categorias Rápidas */}
              <div className="flex items-center gap-1 mb-2 pb-1.5 border-b border-[#242434]">
                {(['Todas', 'ESP32', 'Arduino', 'Outros'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      selectedCategory === cat
                        ? 'bg-[#00979C] text-white'
                        : 'bg-[#1C1C26] text-gray-400 hover:text-white hover:bg-[#222230]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
                <span className="text-[10px] text-gray-500 ml-auto font-mono">
                  {filteredBoards.length} placas
                </span>
              </div>

              {/* Lista de Placas Filtradas */}
              {filteredBoards.length === 0 ? (
                <div className="py-6 px-3 text-center text-gray-400">
                  <Cpu className="w-6 h-6 mx-auto mb-1.5 opacity-40 text-[#00B4B9]" />
                  <div className="text-xs font-semibold text-gray-300">Nenhuma placa encontrada</div>
                  <div className="text-[11px] text-gray-500 mt-1">
                    Não encontramos resultados para "{boardFilter}".
                  </div>
                  <button
                    onClick={() => {
                      setBoardDropdownOpen(false);
                      onOpenCoreModal();
                    }}
                    className="mt-2.5 px-3 py-1 bg-[#1E1E2A] hover:bg-[#252538] text-cyan-400 rounded-lg text-[11px] border border-cyan-500/30 transition"
                  >
                    Abrir Gerenciador de Cores
                  </button>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                  {filteredBoards.map((b) => {
                    const isSelected = selectedBoard?.fqbn === b.fqbn;
                    return (
                      <button
                        key={b.fqbn}
                        onClick={() => {
                          setSelectedBoard(b);
                          setBoardDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-[#00979C] text-white font-semibold shadow-sm'
                            : 'hover:bg-[#222230] text-gray-300'
                        }`}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="truncate font-medium">{b.name}</span>
                          <span className={`text-[10px] truncate font-mono ${isSelected ? 'text-cyan-100/70' : 'opacity-50'}`}>
                            {b.fqbn}
                          </span>
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-mono shrink-0 ${
                          isSelected ? 'bg-black/20 text-white' : 'bg-[#181824] text-gray-400 border border-gray-800'
                        }`}>
                          {b.family}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Seletor de Porta COM */}
        <div ref={portDropdownRef} className="relative shrink-0">
          <button
            onClick={() => {
              setPortDropdownOpen(!portDropdownOpen);
              setBoardDropdownOpen(false);
              setChipMenuOpen(false);
              setPartitionDropdownOpen(false);
            }}
            className="flex items-center gap-2 h-8 bg-[#181822] hover:bg-[#222230] border border-[#2A2A3A] hover:border-[#3D3D52] px-2.5 rounded-lg text-gray-200 transition-all shrink-0 whitespace-nowrap shadow-sm"
          >
            <Usb className={`w-3.5 h-3.5 ${selectedPort ? 'text-[#00B4B9]' : 'text-gray-400'} shrink-0`} />
            <span className="font-medium">
              {selectedPort ? selectedPort : 'Sem Porta'}
            </span>
            <ChevronDown className={`w-3 h-3 text-gray-400 opacity-75 shrink-0 transition-transform duration-200 ease-out ${portDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {portDropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-80 bg-[#14141C] border border-[#2E2E40] rounded-xl shadow-2xl z-50 p-2.5 backdrop-blur-md animate-dropdownSlideDown">
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

        {/* Seletor de Esquema de Partição Flash (Exclusivo ESP32) */}
        {isEsp32 && (
          <div ref={partitionDropdownRef} className="relative shrink-0">
            <button
              onClick={() => {
                setPartitionDropdownOpen(!partitionDropdownOpen);
                setBoardDropdownOpen(false);
                setPortDropdownOpen(false);
                setChipMenuOpen(false);
              }}
              title="Configuração do Esquema de Partição da Memória Flash (ESP32)"
              className="flex items-center gap-1 sm:gap-1.5 h-8 bg-[#181822] hover:bg-[#222230] border border-amber-500/30 hover:border-amber-500/60 px-2 sm:px-2.5 rounded-lg text-amber-200 transition-all shrink-0 whitespace-nowrap shadow-sm text-xs font-medium"
            >
              <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-semibold text-amber-300 hidden lg:inline truncate max-w-[110px]">
                {ESP32_PARTITIONS.find(p => p.id === partitionScheme)?.labelShort || 'Huge App (3MB)'}
              </span>
              <span className="font-semibold text-amber-300 lg:hidden text-[11px]">
                3MB
              </span>
              <ChevronDown className={`w-3 h-3 text-amber-400/80 opacity-75 shrink-0 transition-transform duration-200 ease-out ${partitionDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {partitionDropdownOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-76 bg-[#14141C] border border-[#2E2E40] rounded-xl shadow-2xl z-50 p-2 backdrop-blur-md animate-dropdownSlideDown">
                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-[#282838] px-1">
                  <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Esquema de Partição Flash</span>
                  <span className="text-[10px] text-gray-500 font-mono">ESP32</span>
                </div>

                <div className="space-y-1">
                  {ESP32_PARTITIONS.map((part) => {
                    const isSelected = (partitionScheme || 'huge_app') === part.id;
                    return (
                      <button
                        key={part.id}
                        onClick={() => {
                          onPartitionSchemeChange?.(part.id);
                          setPartitionDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex flex-col transition-colors ${
                          isSelected
                            ? 'bg-amber-500/20 border border-amber-500/50 text-amber-200 font-semibold'
                            : 'hover:bg-[#222230] text-gray-300 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold flex items-center gap-1.5">
                            {part.labelFull}
                            {part.recommended && (
                              <span className="text-[9px] bg-amber-500/30 text-amber-300 px-1 py-0.2 rounded font-mono font-normal">
                                Recomendado
                              </span>
                            )}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                        </div>
                        <span className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                          {part.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. GRUPO DIREITO: FERRAMENTAS INTEGRADAS E UTILITÁRIOS */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 whitespace-nowrap ml-auto">
        
        {/* Abrir / Salvar */}
        <div className="flex items-center bg-[#181822] border border-[#2A2A3A] rounded-lg p-0.5 shrink-0">
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

        <div className="h-5 w-[1px] bg-[#2A2A3A] mx-0.5 shrink-0" />

        {/* Gerenciador de Bibliotecas */}
        <button
          onClick={onOpenLibraryModal}
          title="Gerenciador de Bibliotecas do Arduino (Nuvem e Instaladas)"
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#181822] hover:bg-[#222232] border border-[#2A2A3A] hover:border-teal-500/50 text-gray-300 hover:text-white transition-all active:scale-95 shrink-0"
        >
          <BookOpen className="w-3.5 h-3.5 text-teal-400 shrink-0" />
        </button>

        {/* Depuração GDB & JTAG */}
        <button
          onClick={onOpenDebugModal}
          title="Depuração de Hardware (GDB / JTAG / OpenOCD)"
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#181822] hover:bg-[#222232] border border-[#2A2A3A] hover:border-amber-500/50 text-gray-300 hover:text-white transition-all active:scale-95 shrink-0"
        >
          <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        </button>

        {/* Gerenciar Cores / Drivers */}
        <button
          onClick={onOpenCoreModal}
          title="Gerenciador de Cores e Drivers de Placas (ESP32, AVR, SAMD)"
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#181822] hover:bg-[#222232] border border-[#2A2A3A] hover:border-sky-500/50 text-gray-300 hover:text-white transition-all active:scale-95 shrink-0"
        >
          <DownloadCloud className="w-3.5 h-3.5 text-sky-400 shrink-0" />
        </button>

        {/* Relatório de Erros & Diagnóstico */}
        <button
          onClick={onOpenReportModal}
          title="Exportar Relatório de Erros e Diagnóstico de Sistema"
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#181822] hover:bg-[#28181E] border border-[#2A2A3A] hover:border-rose-500/50 text-gray-300 hover:text-rose-200 transition-all active:scale-95 shrink-0"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
        </button>

      </div>
    </header>
  );
};
