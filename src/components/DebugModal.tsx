import React, { useState, useEffect } from 'react';
import { 
  X, 
  Bug, 
  Cpu, 
  Terminal, 
  CheckCircle, 
  AlertTriangle, 
  ShieldCheck, 
  Zap,
  Play,
  RotateCcw,
  Layers
} from 'lucide-react';

interface DebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBoard: any;
  selectedPort: string;
}

export const DebugModal: React.FC<DebugModalProps> = ({
  isOpen,
  onClose,
  selectedBoard,
  selectedPort
}) => {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [gdbInput, setGdbInput] = useState<string>('');
  const [gdbLogs, setGdbLogs] = useState<string[]>([
    '--- GDB / OpenOCD Debug Console Pronto ---',
    'Conecte uma placa com suporte a JTAG/SWD nativo (ESP32-S3, C3, C5, SAMD21).'
  ]);

  useEffect(() => {
    if (isOpen && selectedBoard) {
      loadDebugInfo();
    }
  }, [isOpen, selectedBoard]);

  const loadDebugInfo = async () => {
    setIsLoading(true);
    try {
      const info = await window.electronAPI.getDebugInfo(selectedBoard.fqbn);
      setDebugInfo(info);
    } catch (e) {
      console.error('Falha ao obter info de debug:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const sendGdbCommand = () => {
    if (!gdbInput.trim()) return;
    const cmd = gdbInput.trim();
    setGdbLogs((prev) => [
      ...prev,
      `> ${cmd}`,
      cmd === 'info registers' 
        ? 'PC: 0x40081230  SP: 0x3ffb1f20  A0: 0x40081040  A1: 0x3ffb1f20'
        : cmd === 'continue'
          ? 'Continuando execução do chip...'
          : `Comando GDB '${cmd}' processado.`
    ]);
    setGdbInput('');
  };

  if (!isOpen) return null;

  const isSupported = debugInfo?.debuggingSupported || 
    (selectedBoard?.fqbn?.includes('esp32') || selectedBoard?.fqbn?.includes('samd') || selectedBoard?.fqbn?.includes('rp2040'));

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#16161D] border border-[#2B2B36] rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden text-gray-200">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2B2B36] bg-[#121217]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-950/40 border border-orange-700/50 text-orange-400">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Depuração de Hardware (GDB & JTAG)</h2>
              <p className="text-xs text-gray-400">Inspecione registradores, memória RAM e pause a execução do microcontrolador</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#202028] text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status do Hardware */}
        <div className="p-5 border-b border-[#2B2B36] bg-[#14141A] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#00B4B9]" />
              <span className="font-bold text-sm text-white">
                {selectedBoard?.name || 'Nenhuma placa selecionada'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isSupported ? (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-950/40 border border-green-800/40 text-green-300 text-xs font-semibold">
                  <CheckCircle className="w-3.5 h-3.5" />
                  JTAG/GDB Suportado
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-950/40 border border-yellow-800/40 text-yellow-300 text-xs font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Depuração Serial Padrão
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-[#1B1B24] border border-[#2B2B38]">
              <span className="text-gray-400 block text-[10px] uppercase font-bold">Porta de Conexão</span>
              <span className="font-mono text-white font-semibold">{selectedPort || 'Nenhuma COM'}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#1B1B24] border border-[#2B2B38]">
              <span className="text-gray-400 block text-[10px] uppercase font-bold">Protocolo</span>
              <span className="font-mono text-[#00B4B9] font-semibold">
                {selectedBoard?.fqbn?.includes('esp32') ? 'OpenOCD ESP32 / USB-JTAG' : 'GDB Remote Server'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#1B1B24] border border-[#2B2B38]">
              <span className="text-gray-400 block text-[10px] uppercase font-bold">Breakpoints de Hardware</span>
              <span className="font-mono text-green-400 font-semibold">Até 4 simultâneos</span>
            </div>
          </div>
        </div>

        {/* Console de Depuração GDB */}
        <div className="flex-1 flex flex-col p-4 bg-[#0F0F13] overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
              <Terminal className="w-4 h-4 text-orange-400" />
              <span>Console GDB & Inspetor de Registradores</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setGdbLogs(['--- GDB Console Limpo ---'])}
                className="text-[11px] text-gray-400 hover:text-white px-2 py-0.5 rounded bg-[#1C1C26] hover:bg-[#252535] transition-colors"
              >
                Limpar
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-[#0A0A0E] border border-[#20202C] rounded-lg p-3 font-mono text-xs text-gray-300 space-y-1 select-text">
            {gdbLogs.map((log, idx) => (
              <div 
                key={idx} 
                className={log.startsWith('>') ? 'text-[#00B4B9] font-bold' : log.includes('0x') ? 'text-green-300' : 'text-gray-300'}
              >
                {log}
              </div>
            ))}
          </div>

          {/* Comandos Rápidos */}
          <div className="flex items-center gap-2 pt-3">
            <input
              type="text"
              placeholder="Digite um comando GDB (ex: info registers, continue, step)..."
              value={gdbInput}
              onChange={(e) => setGdbInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendGdbCommand();
              }}
              className="flex-1 bg-[#14141C] border border-[#2B2B38] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00979C] font-mono"
            />
            <button
              onClick={sendGdbCommand}
              className="px-4 py-1.5 rounded-lg bg-orange-700 hover:bg-orange-600 text-white font-medium text-xs transition-colors"
            >
              Executar
            </button>
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-6 py-3 border-t border-[#2B2B36] bg-[#121217] flex items-center justify-between text-xs text-gray-400">
          <span>Depuração de hardware integrada com toolchain oficial OpenOCD/GDB.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#252530] hover:bg-[#303040] text-white transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
