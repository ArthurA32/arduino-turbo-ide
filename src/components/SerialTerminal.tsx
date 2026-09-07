import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Send, Trash2, ArrowDownCircle, Clock, Play, Square, ArrowDown } from 'lucide-react';

interface SerialTerminalProps {
  selectedPort: string;
  setSelectedPort?: (port: string) => void;
  ports?: any[];
  isUploading: boolean;
  isActiveTab?: boolean;
}

interface LogEntry {
  id: number;
  text: string;
  time: string;
  type: 'in' | 'out' | 'info';
}

const BAUD_RATES = [
  9600, 19200, 38400, 57600, 74880, 115200, 230400, 460800, 921600
];

export const SerialTerminal: React.FC<SerialTerminalProps> = ({ 
  selectedPort, 
  setSelectedPort, 
  ports = [], 
  isUploading,
  isActiveTab = true
}) => {
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [lineEnding, setLineEnding] = useState<string>('crlf');
  const [inputCommand, setInputCommand] = useState<string>('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [showTimestamps, setShowTimestamps] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isPausedForUpload, setIsPausedForUpload] = useState<boolean>(false);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pendingLogsRef = useRef<LogEntry[]>([]);
  const isRafScheduledRef = useRef<boolean>(false);
  const nextIdRef = useRef<number>(1);
  const isUserScrolledUpRef = useRef<boolean>(false);
  const autoScrollRef = useRef<boolean>(true);

  const isConnectedRef = useRef(isConnected);
  const isPausedForUploadRef = useRef(isPausedForUpload);
  const baudRateRef = useRef(baudRate);
  const selectedPortRef = useRef(selectedPort);
  const portsRef = useRef(ports);

  isConnectedRef.current = isConnected;
  isPausedForUploadRef.current = isPausedForUpload;
  baudRateRef.current = baudRate;
  selectedPortRef.current = selectedPort;
  portsRef.current = ports;
  autoScrollRef.current = autoScroll;
  isUserScrolledUpRef.current = isUserScrolledUp;

  // Rolagem forçada direta para o fim
  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      setIsUserScrolledUp(false);
      isUserScrolledUpRef.current = false;
    }
  }, []);

  // Sincronizar status do backend ao montar
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.getSerialStatus) {
      window.electronAPI.getSerialStatus().then((status) => {
        if (status && status.isConnected) {
          setIsConnected(true);
          if (status.baudRate) setBaudRate(status.baudRate);
        }
      }).catch(() => {});
    }
  }, []);

  // Quando a aba do Monitor Serial é reativada, atualiza a rolagem
  useEffect(() => {
    if (isActiveTab && autoScroll && !isUserScrolledUpRef.current) {
      const timer = setTimeout(scrollToBottom, 30);
      return () => clearTimeout(timer);
    }
  }, [isActiveTab, autoScroll, scrollToBottom]);

  // Descarrega o lote de logs de forma segura e com limite estrito para nunca travar a UI
  const flushLogsBatch = useCallback(() => {
    isRafScheduledRef.current = false;
    const batch = pendingLogsRef.current;
    if (batch.length === 0) return;
    pendingLogsRef.current = [];

    const maxLines = 1500;
    setLogs((prev) => {
      const combined = prev.length === 0 ? batch : [...prev, ...batch];
      if (combined.length > maxLines) {
        return combined.slice(-maxLines);
      }
      return combined;
    });
  }, []);

  const scheduleFlush = useCallback(() => {
    if (isRafScheduledRef.current) return;
    isRafScheduledRef.current = true;

    // Se a janela estiver minimizada/oculta, requestAnimationFrame é suspenso pelo Chromium.
    // Usamos setTimeout para garantir que os dados continuem fluindo e sendo descartados do buffer!
    if (typeof document !== 'undefined' && document.hidden) {
      setTimeout(flushLogsBatch, 150);
    } else {
      requestAnimationFrame(flushLogsBatch);
    }
  }, [flushLogsBatch]);

  // Enfileiramento ultra veloz com suporte a chunks multi-linha e proteção contra estouro de memória
  const queueLog = useCallback((text: string, type: 'in' | 'out' | 'info') => {
    if (!text && text !== '') return;
    const time = new Date().toLocaleTimeString();

    // Se o texto vier com múltiplas linhas (\n), divide em entradas individuais
    const rawLines = text.includes('\n') ? text.split(/\r?\n/) : [text];

    for (const rawLine of rawLines) {
      if (rawLine.length === 0 && rawLines.length > 1) continue;
      pendingLogsRef.current.push({
        id: nextIdRef.current++,
        text: rawLine,
        time,
        type
      });
    }

    // Proteção de memória: se a janela ficou muito tempo minimizada com fluxo pesado, limita a fila pendente
    const MAX_PENDING = 2000;
    if (pendingLogsRef.current.length > MAX_PENDING * 2) {
      pendingLogsRef.current = pendingLogsRef.current.slice(-MAX_PENDING);
    }

    scheduleFlush();
  }, [scheduleFlush]);

  const queueLogRef = useRef(queueLog);
  queueLogRef.current = queueLog;

  // useLayoutEffect garante rolagem síncrona imediata ANTES de qualquer repintura ou evento de scroll
  useLayoutEffect(() => {
    if (autoScroll && !isUserScrolledUpRef.current && isActiveTab && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll, isActiveTab]);

  // Detector de scroll inteligente (só ativa se o usuário realmente subir a rolagem com o mouse)
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Se estiver a menos de 40px do fundo, considera que está no fim e mantém autoscroll
    if (distanceFromBottom <= 40) {
      if (isUserScrolledUpRef.current) {
        setIsUserScrolledUp(false);
        isUserScrolledUpRef.current = false;
      }
    } else if (distanceFromBottom > 80) {
      // Se subiu mais de 80px do fundo, o usuário pausou para ler histórico
      if (!isUserScrolledUpRef.current) {
        setIsUserScrolledUp(true);
        isUserScrolledUpRef.current = true;
      }
    }
  };

  // Alternar autoscroll
  const toggleAutoScroll = () => {
    const nextState = !autoScroll;
    setAutoScroll(nextState);
    if (nextState) {
      setIsUserScrolledUp(false);
      isUserScrolledUpRef.current = false;
      scrollToBottom();
    }
  };

  // Ouvir dados e status do NativeSerial (Registrado 1x no mount para nunca perder dados em reconexões)
  useEffect(() => {
    const unsubData = window.electronAPI.onSerialData((text) => {
      queueLogRef.current(text, 'in');
    });

    const unsubStatus = window.electronAPI.onSerialStatus((status) => {
      setIsConnected(status.connected);
      if (status.connected) {
        queueLogRef.current(`[CONEXÃO] ✔ Porta ${status.port} conectada com sucesso (${status.baudRate || baudRateRef.current} baud)!`, 'info');
      } else {
        if (status.error) {
          queueLogRef.current(`[ERRO] ${status.error}`, 'info');
        }
      }
    });

    const unsubPause = window.electronAPI.onSerialPause(() => {
      if (isConnectedRef.current) {
        setIsPausedForUpload(true);
        queueLogRef.current(`[PAUSA] Monitor Serial pausado para gravação na placa...`, 'info');
      }
    });

    const unsubResume = window.electronAPI.onSerialResume(() => {
      if (isPausedForUploadRef.current) {
        setIsPausedForUpload(false);
        queueLogRef.current(`[RETOMADA] Gravação finalizada! Reconectando Monitor Serial...`, 'info');
        setTimeout(() => {
          handleConnect();
        }, 1200);
      }
    });

    const handleVisibility = () => {
      if (!document.hidden) {
        flushLogsBatch();
        if (autoScrollRef.current && !isUserScrolledUpRef.current) {
          scrollToBottom();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    let unsubRestored: (() => void) | undefined;
    if (window.electronAPI && window.electronAPI.onWindowRestored) {
      unsubRestored = window.electronAPI.onWindowRestored(() => {
        handleVisibility();
      });
    }

    return () => {
      unsubData();
      unsubStatus();
      unsubPause();
      unsubResume();
      document.removeEventListener('visibilitychange', handleVisibility);
      if (unsubRestored) unsubRestored();
    };
  }, [flushLogsBatch, scrollToBottom]);

  const handleConnect = async () => {
    const targetPort = selectedPort || (ports && ports.length > 0 ? ports[0]?.port : '') || '';
    if (!targetPort) {
      queueLog('[AVISO] Nenhuma porta COM selecionada. Selecione uma porta no seletor.', 'info');
      return;
    }

    setIsConnecting(true);
    queueLog(`[CONEXÃO] Abrindo porta ${targetPort} a ${baudRate} baud...`, 'info');

    try {
      const result = await window.electronAPI.connectSerial(targetPort, baudRate);
      if (!result.success) {
        queueLog(`[ERRO] Falha ao abrir porta serial (${targetPort}): ${result.error || 'Acesso negado ou porta ocupada.'}`, 'info');
        setIsConnected(false);
      }
    } catch (err: any) {
      queueLog(`[ERRO] Exceção ao conectar: ${err.message}`, 'info');
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await window.electronAPI.disconnectSerial();
      setIsConnected(false);
      queueLog(`[CONEXÃO] Porta ${selectedPort || 'Serial'} desconectada.`, 'info');
    } catch (e: any) {
      console.error('Falha ao desconectar serial:', e);
    }
  };

  const handlePortChange = (newPort: string) => {
    if (setSelectedPort) {
      setSelectedPort(newPort);
    }
    if (isConnected) {
      handleDisconnect();
    }
    queueLog(`[PORTA] Selecionada porta: ${newPort}`, 'info');
  };

  const sendData = async () => {
    if (!inputCommand.trim() || !isConnected) return;

    let payload = inputCommand;
    if (lineEnding === 'lf') payload += '\n';
    else if (lineEnding === 'cr') payload += '\r';
    else if (lineEnding === 'crlf') payload += '\r\n';

    try {
      await window.electronAPI.sendSerialData(payload);
      queueLog(`> ${inputCommand}`, 'out');
      setInputCommand('');
    } catch (err: any) {
      queueLog(`[ERRO ENVIO] ${err.message}`, 'info');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1E1E1E] text-gray-200 text-xs font-mono select-none relative">
      {/* Barra de Controles do Monitor Serial */}
      <div className="h-10 bg-[#252526] border-b border-[#3E3E42] flex items-center justify-between px-3 gap-2">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-800 hover:bg-red-700 text-white font-sans text-xs transition-colors"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Desconectar</span>
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isUploading || isConnecting || (!selectedPort && (!ports || ports.length === 0))}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#00979C] hover:bg-[#00B4B9] text-white font-sans text-xs transition-colors shadow-sm disabled:opacity-50"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{isConnecting ? 'Conectando...' : 'Conectar Serial'}</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#1E1E1E] border border-[#3E3E42] text-[11px]">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span>{isConnected ? `Conectado (${selectedPort})` : 'Desconectado'}</span>
          </div>

          {/* Seletor de Porta COM no próprio Monitor Serial */}
          <div className="flex items-center gap-1">
            <span className="text-gray-400 text-[11px]">Porta:</span>
            <select
              value={selectedPort}
              onChange={(e) => handlePortChange(e.target.value)}
              disabled={isConnected}
              className="bg-[#1E1E1E] border border-[#3E3E42] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
            >
              {!ports || ports.length === 0 ? (
                <option value="">Nenhuma porta</option>
              ) : (
                ports.map((p: any) => (
                  <option key={p.port} value={p.port}>{p.port} ({p.boardGuess || 'Serial'})</option>
                ))
              )}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-gray-400 text-[11px]">Baud:</span>
            <select
              value={baudRate}
              onChange={(e) => setBaudRate(Number(e.target.value))}
              disabled={isConnected}
              className="bg-[#1E1E1E] border border-[#3E3E42] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
            >
              {BAUD_RATES.map((b) => (
                <option key={b} value={b}>{b} baud</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-gray-400 text-[11px]">Terminação:</span>
            <select
              value={lineEnding}
              onChange={(e) => setLineEnding(e.target.value)}
              className="bg-[#1E1E1E] border border-[#3E3E42] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
            >
              <option value="none">Nenhum</option>
              <option value="lf">Nova Linha (LF)</option>
              <option value="cr">Retorno (CR)</option>
              <option value="crlf">Ambos (CRLF)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTimestamps(!showTimestamps)}
            className={`p-1 rounded text-xs flex items-center gap-1 border transition-colors ${
              showTimestamps ? 'bg-[#00979C]/20 border-[#00979C] text-[#00B4B9]' : 'border-transparent text-gray-400 hover:bg-[#2D2D2D]'
            }`}
            title="Mostrar Horários"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={toggleAutoScroll}
            className={`p-1 rounded text-xs flex items-center gap-1 border transition-colors ${
              autoScroll ? 'bg-[#00979C]/20 border-[#00979C] text-[#00B4B9]' : 'border-transparent text-gray-400 hover:bg-[#2D2D2D]'
            }`}
            title={autoScroll ? "Autoscroll Ativo (Seguir novas linhas)" : "Autoscroll Pausado"}
          >
            <ArrowDownCircle className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setLogs([])}
            className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-[#2D2D2D] transition-colors"
            title="Limpar Saída"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Janela de Saída Serial com Rolagem de Alta Performance */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 p-3 overflow-y-auto font-mono text-xs select-text bg-[#141414] relative"
      >
        {logs.length === 0 ? (
          <div className="text-gray-500 italic p-4 text-center">
            Monitor Serial nativo pronto. Selecione a porta {selectedPort || 'COM'} e clique em "Conectar Serial".
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-baseline leading-snug py-0.5">
              {showTimestamps && (
                <span className="text-gray-500 mr-2 select-none text-[10px] shrink-0 font-mono">{log.time}</span>
              )}
              <span className={`whitespace-pre font-mono ${
                log.type === 'info' 
                  ? 'text-yellow-400 font-medium' 
                  : log.type === 'out' 
                    ? 'text-[#00B4B9]' 
                    : 'text-gray-200'
              }`}>
                {log.text}
              </span>
            </div>
          ))
        )}

        {/* Botão Flutuante: Rolar para o fim quando o usuário estiver no histórico */}
        {isUserScrolledUp && (
          <button
            onClick={scrollToBottom}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 bg-[#00979C] hover:bg-[#00B4B9] text-white rounded-full shadow-lg text-[11px] font-sans font-semibold transition-all hover:scale-105 border border-[#00B4B9]/50 animate-bounce"
          >
            <ArrowDown className="w-3 h-3 stroke-[2.5]" />
            <span>⬇ Rolar até o fim (Novas leituras)</span>
          </button>
        )}
      </div>

      {/* Barra de Entrada / Envio de Comandos */}
      <div className="h-10 bg-[#252526] border-t border-[#3E3E42] px-3 flex items-center gap-2">
        <input
          type="text"
          placeholder={isConnected ? "Digite uma mensagem para enviar..." : "Conecte a porta serial para enviar dados"}
          disabled={!isConnected}
          value={inputCommand}
          onChange={(e) => setInputCommand(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              sendData();
            }
          }}
          className="flex-1 bg-[#1E1E1E] border border-[#3E3E42] rounded px-3 py-1 text-xs text-white focus:outline-none focus:border-[#00979C] disabled:opacity-50 font-sans"
        />
        <button
          onClick={sendData}
          disabled={!isConnected || !inputCommand.trim()}
          className="flex items-center gap-1 px-3 py-1 bg-[#00979C] hover:bg-[#00B4B9] disabled:bg-[#3E3E42] disabled:opacity-50 text-white rounded text-xs font-sans transition-colors"
        >
          <Send className="w-3 h-3" />
          <span>Enviar</span>
        </button>
      </div>
    </div>
  );
};
