import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Download, 
  Copy, 
  FileCode, 
  Search, 
  RefreshCw, 
  X, 
  Check, 
  Code2, 
  FileText, 
  Layers, 
  Zap, 
  ArrowRight, 
  Sliders, 
  Sparkles,
  AlertCircle,
  Radio
} from 'lucide-react';

export interface DetectedPinOffset {
  fileOffset: number;
  hexOffset: string;
  instruction?: string;
  kind: 'bitmask' | 'immediate';
}

export interface DetectedPin {
  id: string;
  originalPin: number;
  currentPin: number;
  label: string;
  role: 'OUTPUT' | 'INPUT' | 'PWM' | 'I2C/SPI' | 'SERIAL' | 'GERAL';
  occurrences: number;
  offsets: DetectedPinOffset[];
}

export interface FirmwareReadData {
  arch: 'esp32' | 'avr' | 'unknown';
  chipName: string;
  sizeBytes: number;
  binaryPath?: string;
  decompiledC: string;
  extractedStrings: Array<{ offset: string; text: string }>;
  functions: Array<{ address: string; name: string; instructions: string[] }>;
  detectedPins: DetectedPin[];
  error?: string;
}

interface FirmwareReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  data: FirmwareReadData | null;
  onReRead: () => void;
  onCopyToEditor: (code: string) => void;
  onExportBinary: () => void;
  port: string;
  boardName: string;
  fqbn?: string;
}

export const FirmwareReaderModal: React.FC<FirmwareReaderModalProps> = ({
  isOpen,
  onClose,
  isLoading,
  data,
  onReRead,
  onCopyToEditor,
  onExportBinary,
  port,
  boardName,
  fqbn
}) => {
  const [activeTab, setActiveTab] = useState<'pins' | 'code' | 'strings' | 'functions'>('pins');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [pinMappings, setPinMappings] = useState<Record<number, number>>({});
  const [isPatching, setIsPatching] = useState(false);
  const [patchStatusMessage, setPatchStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Inicializa os pinos mapeados assim que os dados forem carregados
  useEffect(() => {
    if (data?.detectedPins && data.detectedPins.length > 0) {
      const initial: Record<number, number> = {};
      data.detectedPins.forEach((p) => {
        initial[p.originalPin] = p.originalPin;
      });
      setPinMappings(initial);
      setActiveTab('pins'); // Foca no remapeador de portas por padrão conforme solicitado pelo usuário
    }
  }, [data]);

  if (!isOpen) return null;

  const arch = data?.arch || 'esp32';

  // Lista de portas válidas para seleção no dropdown
  const availablePins = arch === 'esp32'
    ? [0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35]
    : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

  const getPinDisplayName = (pin: number) => {
    if (arch === 'esp32') return `GPIO ${pin}`;
    if (pin >= 14 && pin <= 19) return `A${pin - 14} (Analógico)`;
    return `D${pin} (Digital)`;
  };

  const handlePinChange = (originalPin: number, newPin: number) => {
    setPinMappings((prev) => ({ ...prev, [originalPin]: newPin }));
    setPatchStatusMessage(null);
  };

  const modifiedCount = Object.entries(pinMappings).filter(
    ([orig, target]) => Number(orig) !== Number(target)
  ).length;

  // Aplica o patch no binário e regrava diretamente no microcontrolador conectado
  const handleFlashPatched = async () => {
    if (!data?.binaryPath) return;
    setIsPatching(true);
    setPatchStatusMessage(null);

    try {
      const mappingList = Object.entries(pinMappings).map(([orig, target]) => ({
        originalPin: Number(orig),
        newPin: Number(target)
      }));

      // 1. Gera o binário com o patch das novas portas
      const patchRes = await window.electronAPI.patchChipPins({
        sourceBinaryPath: data.binaryPath,
        pinMappings: mappingList
      });

      if (!patchRes.success || !patchRes.patchedPath) {
        throw new Error(patchRes.error || 'Falha ao aplicar alterações de pinos no binário.');
      }

      // 2. Grava de volta na memória Flash do chip
      const flashRes = await window.electronAPI.flashChipPatched({
        port,
        fqbn: fqbn || 'esp32:esp32:esp32',
        binaryPath: patchRes.patchedPath
      });

      if (flashRes.success) {
        setPatchStatusMessage({
          type: 'success',
          text: `✔ ${modifiedCount} porta(s) alterada(s) e regravadas com sucesso no chip ${data.chipName} via ${port}!`
        });
      } else {
        throw new Error(flashRes.message);
      }
    } catch (err: any) {
      setPatchStatusMessage({
        type: 'error',
        text: `❌ Falha na regravação: ${err?.message || err}`
      });
    } finally {
      setIsPatching(false);
    }
  };

  // Exporta o binário com as portas modificadas para o computador
  const handleExportPatchedBinary = async () => {
    if (!data?.binaryPath) return;
    try {
      const mappingList = Object.entries(pinMappings).map(([orig, target]) => ({
        originalPin: Number(orig),
        newPin: Number(target)
      }));

      const patchRes = await window.electronAPI.patchChipPins({
        sourceBinaryPath: data.binaryPath,
        pinMappings: mappingList
      });

      if (patchRes.success && patchRes.patchedPath) {
        await window.electronAPI.exportChipFirmware({
          sourceBinaryPath: patchRes.patchedPath,
          chipName: `${data.chipName}_patch_portas`
        });
      }
    } catch (err: any) {
      alert(`Erro ao exportar: ${err.message}`);
    }
  };

  // Atualiza o código C reconstruído com os novos pinos escolhidos
  const getUpdatedCCode = () => {
    if (!data?.decompiledC) return '';
    let updatedCode = data.decompiledC;
    Object.entries(pinMappings).forEach(([orig, target]) => {
      const pinName = arch === 'esp32' ? `PIN_GPIO_${orig}` : `PIN_D${orig}`;
      const reg = new RegExp(`(#define\\s+${pinName}\\s+)\\d+`, 'g');
      updatedCode = updatedCode.replace(reg, `$1${target}`);
    });
    return updatedCode;
  };

  const handleCopyCode = () => {
    const code = getUpdatedCCode();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsertIntoEditor = () => {
    const code = getUpdatedCCode();
    onCopyToEditor(code);
  };

  const filteredStrings = data?.extractedStrings.filter(s =>
    s.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.offset.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const filteredFunctions = data?.functions.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.address.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#181824] border border-cyan-500/40 rounded-xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-200">
        
        {/* Modal Header */}
        <div className="bg-[#12121b] px-6 py-3.5 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#222232] text-cyan-400 rounded-lg shadow-inner">
              <Cpu className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Leitor & Remapeador de Silício
                <span className="text-xs bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 px-2 py-0.5 rounded-full font-mono font-semibold">
                  {data?.chipName || 'MICROCONTROLADOR'}
                </span>
                {modifiedCount > 0 && (
                  <span className="text-xs bg-amber-950 text-amber-300 border border-amber-600/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> {modifiedCount} porta(s) modificada(s)
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Porta: <span className="text-gray-200 font-mono font-medium">{port || 'N/A'}</span> | Placa: <span className="text-gray-200">{boardName || 'Desconhecida'}</span>
                {data?.sizeBytes ? ` | Memória Flash: ${(data.sizeBytes / 1024).toFixed(0)} KB` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onReRead}
              disabled={isLoading || isPatching}
              className="px-3 py-1.5 bg-[#222232] hover:bg-[#2e2e42] text-gray-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition border border-gray-700/50 disabled:opacity-50"
              title="Ler novamente o chip"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
              Re-Ler Chip
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin"></div>
              <Cpu className="w-8 h-8 text-cyan-400 absolute inset-0 m-auto" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-semibold text-white">Lendo Memória Flash do Silício...</h3>
              <p className="text-xs text-gray-400 max-w-md mt-1">
                Conectando à porta <span className="text-cyan-300 font-mono">{port}</span>, analisando instruções, extraindo portas GPIO e strings da Flash.
              </p>
            </div>
          </div>
        ) : data?.error ? (
          /* Error State */
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3 text-center">
            <div className="p-3 bg-red-950/50 border border-red-800 text-red-400 rounded-full">
              <X className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-red-400">Falha ao Ler Firmware do Chip</h3>
            <p className="text-xs text-gray-300 max-w-lg bg-[#11111b] p-3 rounded-lg border border-red-900/40 font-mono text-left">
              {data.error}
            </p>
            <button
              onClick={onReRead}
              className="mt-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg text-xs flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Tentar Novamente
            </button>
          </div>
        ) : (
          /* Main Content View */
          <>
            {/* Toolbar */}
            <div className="bg-[#14141e] px-6 py-2.5 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3">
              {/* Tab Selectors */}
              <div className="flex items-center gap-1 bg-[#1e1e2c] p-1 rounded-lg border border-gray-800">
                <button
                  onClick={() => setActiveTab('pins')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                    activeTab === 'pins'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-amber-400 hover:text-amber-200'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Remapeador de Portas GPIO ({data?.detectedPins?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('code')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                    activeTab === 'code'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  Código C / Pseudo-C
                </button>
                <button
                  onClick={() => setActiveTab('strings')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                    activeTab === 'strings'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Strings ({data?.extractedStrings?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('functions')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                    activeTab === 'functions'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Funções ({data?.functions?.length || 0})
                </button>
              </div>

              {/* Actions Header */}
              <div className="flex items-center gap-2">
                {(activeTab === 'strings' || activeTab === 'functions') && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      placeholder="Filtrar por texto ou endereço..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-[#1e1e2c] border border-gray-700 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 w-48"
                    />
                  </div>
                )}

                <button
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 bg-[#222232] hover:bg-[#2e2e42] text-gray-200 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-gray-700 transition"
                  title="Copiar código C descompilado"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copiado!' : 'Copiar C'}
                </button>

                <button
                  onClick={handleExportPatchedBinary}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm transition"
                  title="Salvar binário com as portas modificadas no disco"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exportar Binário
                </button>

                <button
                  onClick={handleInsertIntoEditor}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm transition"
                  title="Inserir o código descompilado no editor principal"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  Abrir no Editor
                </button>
              </div>
            </div>

            {/* Notification Banner */}
            {patchStatusMessage && (
              <div className={`px-6 py-2 text-xs flex items-center gap-2 border-b ${
                patchStatusMessage.type === 'success' 
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' 
                  : 'bg-red-950/80 text-red-300 border-red-800'
              }`}>
                {patchStatusMessage.type === 'success' ? <Check className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                <span className="font-medium">{patchStatusMessage.text}</span>
              </div>
            )}

            {/* Tab Views */}
            <div className="flex-1 overflow-auto bg-[#0f0f17] p-5 font-mono text-xs text-gray-300">
              
              {/* TAB 1: REMAPEADOR DE PORTAS GPIO */}
              {activeTab === 'pins' && (
                <div className="space-y-4 max-w-4xl mx-auto">
                  {/* Explicação & Status */}
                  <div className="bg-[#181826] border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
                    <Zap className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">Alteração Direta de Portas no Firmware do Chip</h4>
                      <p className="text-xs text-gray-300 font-sans leading-relaxed">
                        Foram identificadas as portas físicas e pinos que o firmware gravado no silício está usando para controlar módulos e periféricos. 
                        Escolha um novo pino no seletor para redirecionar as conexões de hardware sem precisar recompilar o código-fonte original.
                      </p>
                    </div>
                  </div>

                  {/* Lista de Portas Detectadas */}
                  <div className="space-y-2">
                    {data?.detectedPins && data.detectedPins.length > 0 ? (
                      data.detectedPins.map((pin) => {
                        const currentTarget = pinMappings[pin.originalPin] ?? pin.originalPin;
                        const isChanged = currentTarget !== pin.originalPin;

                        return (
                          <div 
                            key={pin.id} 
                            className={`flex flex-wrap items-center justify-between p-3 rounded-xl border transition-all ${
                              isChanged
                                ? 'bg-amber-950/30 border-amber-500/60 shadow-md shadow-amber-950/20'
                                : 'bg-[#151520] border-gray-800/80 hover:border-gray-700'
                            }`}
                          >
                            {/* Identificação do Pino Original */}
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${isChanged ? 'bg-amber-900/50 text-amber-300' : 'bg-[#222232] text-cyan-400'}`}>
                                <Radio className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="font-bold text-white flex items-center gap-2">
                                  <span>{pin.label}</span>
                                  <span className="text-[10px] bg-[#222232] text-gray-400 px-1.5 py-0.5 rounded border border-gray-700 font-sans">
                                    {pin.role}
                                  </span>
                                  <span className="text-[10px] text-gray-500 font-sans">
                                    ({pin.occurrences} {pin.occurrences === 1 ? 'referência' : 'referências'})
                                  </span>
                                </div>
                                <div className="text-[11px] text-gray-400 font-sans mt-0.5">
                                  Endereço na Flash: <span className="font-mono text-cyan-400">{pin.offsets[0]?.hexOffset || 'N/A'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Direcionamento para Nova Porta */}
                            <div className="flex items-center gap-3 mt-2 sm:mt-0">
                              <span className="text-xs text-gray-400 font-sans flex items-center gap-1">
                                Redirecionar para:
                                <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                              </span>

                              <select
                                value={currentTarget}
                                onChange={(e) => handlePinChange(pin.originalPin, Number(e.target.value))}
                                className={`px-3 py-1.5 rounded-lg border text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-500 transition ${
                                  isChanged
                                    ? 'bg-amber-950 text-amber-200 border-amber-500'
                                    : 'bg-[#1f1f2e] text-gray-200 border-gray-700 hover:border-gray-600'
                                }`}
                              >
                                {availablePins.map((p) => (
                                  <option key={p} value={p}>
                                    {getPinDisplayName(p)} {p === pin.originalPin ? '(Original)' : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-gray-500 text-center py-10 font-sans">
                        Nenhuma porta específica identificada nas rotinas lidas.
                      </div>
                    )}
                  </div>

                  {/* Barra de Ação de Patch */}
                  <div className="bg-[#151522] border border-gray-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 mt-6">
                    <div>
                      <div className="text-xs font-bold text-white">
                        {modifiedCount === 0 
                          ? 'Nenhuma alteração de porta pendente' 
                          : `${modifiedCount} porta(s) configurada(s) para alteração`}
                      </div>
                      <div className="text-[11px] text-gray-400 font-sans">
                        Grave diretamente na placa via USB ou exporte o arquivo modificado.
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleFlashPatched}
                        disabled={isPatching || isLoading || modifiedCount === 0}
                        className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg transition ${
                          modifiedCount === 0
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                            : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30 active:scale-95'
                        }`}
                      >
                        <Zap className={`w-4 h-4 ${isPatching ? 'animate-spin' : ''}`} />
                        {isPatching ? 'Gravando no Chip...' : '⚡ Gravar Novas Portas no Chip'}
                      </button>

                      <button
                        onClick={handleInsertIntoEditor}
                        className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                      >
                        <FileCode className="w-4 h-4" />
                        Gerar Código C Atualizado
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CÓDIGO C DESCOMPILADO */}
              {activeTab === 'code' && (
                <pre className="leading-relaxed whitespace-pre-wrap select-text selection:bg-cyan-900 selection:text-cyan-200">
                  {getUpdatedCCode() || '// Nenhum código C descompilado disponível'}
                </pre>
              )}

              {/* TAB 3: STRINGS EXTRAÍDAS */}
              {activeTab === 'strings' && (
                <div className="space-y-1.5">
                  <div className="text-gray-400 text-xs mb-3 font-sans border-b border-gray-800 pb-2">
                    Constantes de texto e mensagens identificadas na memória Flash do chip:
                  </div>
                  {filteredStrings.length > 0 ? (
                    filteredStrings.map((s, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-1.5 bg-[#181826] hover:bg-[#202032] rounded border border-gray-800/60">
                        <span className="text-cyan-400 font-bold select-all min-w-[90px]">{s.offset}</span>
                        <span className="text-emerald-300 font-mono select-all flex-1">"{s.text}"</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 py-8 text-center font-sans">Nenhuma string correspondente encontrada.</div>
                  )}
                </div>
              )}

              {/* TAB 4: FUNÇÕES & INSTRUÇÕES */}
              {activeTab === 'functions' && (
                <div className="space-y-4">
                  <div className="text-gray-400 text-xs mb-2 font-sans border-b border-gray-800 pb-2">
                    Rotinas e blocos de código identificados por endereço na memória Flash:
                  </div>
                  {filteredFunctions.length > 0 ? (
                    filteredFunctions.map((fn, idx) => (
                      <div key={idx} className="bg-[#181826] border border-gray-800 rounded-lg p-3">
                        <div className="flex items-center justify-between text-cyan-400 font-bold mb-2 pb-1 border-b border-gray-800">
                          <span>{fn.name}()</span>
                          <span className="text-xs text-gray-500 font-normal">{fn.address}</span>
                        </div>
                        <pre className="text-gray-300 text-[11px] leading-snug font-mono whitespace-pre-wrap">
                          {fn.instructions.slice(0, 50).join('\n')}
                          {fn.instructions.length > 50 ? `\n... e mais ${fn.instructions.length - 50} instruções` : ''}
                        </pre>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 py-8 text-center font-sans">Nenhuma função encontrada no firmware.</div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
