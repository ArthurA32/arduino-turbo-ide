import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, 
  Square, 
  Pause, 
  Trash2, 
  Sliders, 
  Power, 
  Activity, 
  Eye, 
  EyeOff, 
  Camera, 
  Zap 
} from 'lucide-react';

interface SerialPlotterProps {
  selectedPort: string;
  setSelectedPort?: (port: string) => void;
  ports?: any[];
  isUploading?: boolean;
  isActiveTab?: boolean;
}

// Paleta de alta intensidade fluorescente (Estilo Osciloscópio / Analisador Lógico)
const CHANNEL_COLORS = [
  '#00FF88', // Ch 1: Verde Neon
  '#00E5FF', // Ch 2: Ciano Elétrico
  '#FF007F', // Ch 3: Magenta / Rosa Neon
  '#FFE600', // Ch 4: Amarelo Elétrico
  '#FF6B00', // Ch 5: Laranja Neon
  '#B347FF', // Ch 6: Roxo Fluorescente
  '#FF3366', // Ch 7: Coral Vivo
  '#00FFD1', // Ch 8: Turquesa
  '#76FF03', // Ch 9: Chartreuse
  '#F50057', // Ch 10: Rosa Choque
];

export type ScaleMode = 'auto' | 'digital' | 'adc10' | 'adc12' | 'pm100' | 'pm500' | 'v5';

interface ChannelData {
  name: string;
  values: number[];
  color: string;
  lastValue: number;
  minValue: number;
  maxValue: number;
  hidden: boolean;
}

export const SerialPlotter: React.FC<SerialPlotterProps> = ({ 
  selectedPort,
  setSelectedPort,
  ports = [],
  isUploading = false,
  isActiveTab = true
}) => {
  const [isPlotterRunning, setIsPlotterRunning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [sampleWindow, setSampleWindow] = useState<number>(150);
  const [scaleMode, setScaleMode] = useState<ScaleMode>('auto');
  const [channels, setChannels] = useState<{ [key: string]: ChannelData }>({});
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [hoverCursor, setHoverCursor] = useState<{ x: number; y: number; sampleIdx: number } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const channelsRef = useRef<{ [key: string]: ChannelData }>({});
  const isPlotterRunningRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const sampleWindowRef = useRef<number>(150);
  const scaleModeRef = useRef<ScaleMode>('auto');
  const animationFrameRef = useRef<number | null>(null);
  const hoverCursorRef = useRef<{ x: number; y: number; sampleIdx: number } | null>(null);

  isPlotterRunningRef.current = isPlotterRunning;
  isPausedRef.current = isPaused;
  sampleWindowRef.current = sampleWindow;
  scaleModeRef.current = scaleMode;
  hoverCursorRef.current = hoverCursor;

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

  // Ouvir status de conexão serial
  useEffect(() => {
    const unsubStatus = window.electronAPI.onSerialStatus((status) => {
      setIsConnected(status.connected);
      if (status.baudRate) {
        setBaudRate(status.baudRate);
      }
    });

    return () => {
      unsubStatus();
    };
  }, []);

  // Processamento de linhas seriais com suporte a múltiplos canais (CSV, Key:Value, Tab, etc.)
  const parseSerialLine = useCallback((text: string) => {
    if (!isPlotterRunningRef.current || isPausedRef.current) return;
    const clean = text.trim();
    if (!clean) return;

    let points: { name: string; value: number }[] = [];

    // 1. Tentar capturar pares Chave:Valor ou Chave=Valor (ex: "Hall_A: 1, Hall_B: 0, Hall_C: 1" ou "S1=12.5 S2=45.8")
    const kvRegex = /([a-zA-Z0-9_#\s-]+?)\s*[:=]\s*(-?\d+(?:\.\d+)?)/g;
    let match;
    while ((match = kvRegex.exec(clean)) !== null) {
      const rawName = match[1].replace(/[,;\t]/g, '').trim();
      const val = parseFloat(match[2]);
      if (rawName && !isNaN(val)) {
        points.push({ name: rawName, value: val });
      }
    }

    // 2. Se não houver pares Chave:Valor, extrair todos os números puros separados por vírgula, tab, espaço ou ponto-e-vírgula
    if (points.length === 0) {
      const numRegex = /[-+]?\b\d+(?:\.\d+)?\b/g;
      let numMatch;
      let idx = 1;
      while ((numMatch = numRegex.exec(clean)) !== null) {
        const val = parseFloat(numMatch[0]);
        if (!isNaN(val)) {
          points.push({ name: `Canal ${idx}`, value: val });
          idx++;
        }
      }
    }

    if (points.length === 0) return;

    const current = channelsRef.current;
    let colorIndex = Object.keys(current).length;

    for (const pt of points) {
      if (!current[pt.name]) {
        current[pt.name] = {
          name: pt.name,
          values: [],
          color: CHANNEL_COLORS[colorIndex % CHANNEL_COLORS.length],
          lastValue: pt.value,
          minValue: pt.value,
          maxValue: pt.value,
          hidden: false
        };
        colorIndex++;
      }

      const chan = current[pt.name];
      chan.values.push(pt.value);
      chan.lastValue = pt.value;
      chan.minValue = Math.min(chan.minValue, pt.value);
      chan.maxValue = Math.max(chan.maxValue, pt.value);

      // Buffer circular limitado à janela máxima
      if (chan.values.length > sampleWindowRef.current * 3) {
        chan.values = chan.values.slice(-sampleWindowRef.current * 2);
      }
    }

    channelsRef.current = current;
  }, []);

  const parseSerialLineRef = useRef(parseSerialLine);
  parseSerialLineRef.current = parseSerialLine;

  // Ouvir dados da serial nativa
  useEffect(() => {
    const unsub = window.electronAPI.onSerialData((text) => {
      parseSerialLineRef.current(text);
    });

    return () => {
      unsub();
    };
  }, []);

  // Conectar serial direto do plotter
  const handleConnect = async () => {
    const targetPort = selectedPort || (ports.length > 0 ? ports[0].port : '');
    if (!targetPort) return;

    setIsConnecting(true);
    try {
      const result = await window.electronAPI.connectSerial(targetPort, baudRate);
      if (result.success) {
        setIsConnected(true);
      }
    } catch (err) {
      console.error('Erro ao conectar serial pelo plotter:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await window.electronAPI.disconnectSerial();
      setIsConnected(false);
    } catch (err) {
      console.error('Erro ao desconectar serial:', err);
    }
  };

  // Alternar visibilidade de canal individual
  const toggleChannelVisibility = (chanName: string) => {
    const current = { ...channelsRef.current };
    if (current[chanName]) {
      current[chanName] = {
        ...current[chanName],
        hidden: !current[chanName].hidden
      };
      channelsRef.current = current;
      setChannels(current);
    }
  };

  // Capturar snapshot do gráfico em PNG
  const handleExportSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `osciloscopio_plotter_${Date.now()}.png`;
      a.click();
    } catch (e) {
      console.error('Erro ao exportar snapshot:', e);
    }
  };

  // Loop Principal de Renderização em Canvas 2D (Osciloscópio de Alta Precisão)
  useEffect(() => {
    if (!isActiveTab) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isSubscribed = true;

    // Ajuste dinâmico de resolução HiDPI
    const resizeCanvas = () => {
      const container = containerRef.current;
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      const targetWidth = Math.floor(rect.width * dpr);
      const targetHeight = Math.floor(rect.height * dpr);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }
    };

    const render = () => {
      if (!isSubscribed) return;
      resizeCanvas();

      const width = canvas.width;
      const height = canvas.height;
      const dpr = window.devicePixelRatio || 1;

      // 1. Limpar Fundo Osciloscópio (Dark profundo de alta fidelidade)
      ctx.save();
      ctx.fillStyle = '#0B0C11';
      ctx.fillRect(0, 0, width, height);

      // Margens do Grid
      const padLeft = 65 * dpr;
      const padRight = 20 * dpr;
      const padTop = 22 * dpr;
      const padBottom = 26 * dpr;
      const plotW = width - padLeft - padRight;
      const plotH = height - padTop - padBottom;

      // Desenhar Fundo da Área de Plotagem
      ctx.fillStyle = '#0F1118';
      ctx.fillRect(padLeft, padTop, plotW, plotH);
      ctx.strokeStyle = '#222738';
      ctx.lineWidth = 1.5 * dpr;
      ctx.strokeRect(padLeft, padTop, plotW, plotH);

      const currentChannels = channelsRef.current;
      const channelKeys = Object.keys(currentChannels);
      const visibleChannels = channelKeys.filter(k => !currentChannels[k].hidden);

      // 2. Determinar limites do Eixo Y (Auto-Scale Inteligente ou Presets)
      let minVal = Infinity;
      let maxVal = -Infinity;

      const currentScaleMode = scaleModeRef.current;
      if (currentScaleMode === 'digital') {
        minVal = -0.15;
        maxVal = 1.15;
      } else if (currentScaleMode === 'adc10') {
        minVal = 0;
        maxVal = 1023;
      } else if (currentScaleMode === 'adc12') {
        minVal = 0;
        maxVal = 4095;
      } else if (currentScaleMode === 'pm100') {
        minVal = -100;
        maxVal = 100;
      } else if (currentScaleMode === 'pm500') {
        minVal = -500;
        maxVal = 500;
      } else if (currentScaleMode === 'v5') {
        minVal = 0;
        maxVal = 5.0;
      } else {
        // Auto-Scale dinâmico baseado apenas nos canais visíveis
        for (const k of visibleChannels) {
          const vals = currentChannels[k].values.slice(-sampleWindowRef.current);
          for (const v of vals) {
            if (v < minVal) minVal = v;
            if (v > maxVal) maxVal = v;
          }
        }

        if (minVal === Infinity || maxVal === -Infinity) {
          minVal = 0;
          maxVal = 100;
        } else if (minVal === maxVal) {
          // Sinal constante (ex: tudo 0 ou tudo 1)
          if (minVal === 0) {
            minVal = -0.2;
            maxVal = 1.2;
          } else {
            const pad = Math.abs(minVal) * 0.2 || 1;
            minVal -= pad;
            maxVal += pad;
          }
        } else {
          // Se for sinal puramente digital 0 e 1
          if (minVal >= 0 && maxVal <= 1 && maxVal - minVal <= 1) {
            minVal = -0.15;
            maxVal = 1.15;
          } else {
            // Adicionar margem de 8% para não colar nas bordas
            const delta = maxVal - minVal;
            const margin = delta * 0.08;
            minVal -= margin;
            maxVal += margin;
          }
        }
      }

      // 3. Desenhar Grade do Osciloscópio (Linhas horizontais e verticais com pontilhado de divisão)
      const numDivsY = 6;
      ctx.setLineDash([3 * dpr, 4 * dpr]);
      ctx.strokeStyle = '#1D2233';
      ctx.lineWidth = 1 * dpr;

      for (let i = 1; i < numDivsY; i++) {
        const y = padTop + (plotH / numDivsY) * i;
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(padLeft + plotW, y);
        ctx.stroke();
      }

      const numDivsX = 8;
      for (let i = 1; i < numDivsX; i++) {
        const x = padLeft + (plotW / numDivsX) * i;
        ctx.beginPath();
        ctx.moveTo(x, padTop);
        ctx.lineTo(x, padTop + plotH);
        ctx.stroke();
      }
      ctx.setLineDash([]); // Resetar dash

      // Linha de Referência Zero (se 0 estiver dentro do intervalo)
      if (minVal < 0 && maxVal > 0) {
        const zeroY = padTop + plotH - ((0 - minVal) / (maxVal - minVal)) * plotH;
        ctx.strokeStyle = '#38415C';
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        ctx.moveTo(padLeft, zeroY);
        ctx.lineTo(padLeft + plotW, zeroY);
        ctx.stroke();
      }

      // 4. Desenhar Rótulos e Escalas do Eixo Y
      ctx.fillStyle = '#7E869E';
      ctx.font = `${Math.max(10, Math.floor(10 * dpr))}px "JetBrains Mono", Consolas, monospace`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      for (let i = 0; i <= numDivsY; i++) {
        const y = padTop + (plotH / numDivsY) * i;
        const val = maxVal - ((maxVal - minVal) / numDivsY) * i;
        const textVal = Math.abs(val) < 0.001 && Math.abs(val) > -0.001 
          ? '0.00' 
          : (Math.abs(val) >= 1000 ? val.toFixed(0) : val.toFixed(2));
        ctx.fillText(textVal, padLeft - 8 * dpr, y);
      }

      // Rótulos do Eixo X (Tempo / Amostras)
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`-${sampleWindowRef.current}`, padLeft, padTop + plotH + 6 * dpr);
      ctx.fillText(`-${Math.round(sampleWindowRef.current / 2)}`, padLeft + plotW / 2, padTop + plotH + 6 * dpr);
      ctx.fillText(`0 (Tempo Real)`, padLeft + plotW, padTop + plotH + 6 * dpr);

      // 5. Mensagens Informativas caso esteja desconectado ou aguardando
      if (!isConnected) {
        ctx.fillStyle = 'rgba(11, 12, 17, 0.75)';
        ctx.fillRect(padLeft, padTop, plotW, plotH);
        ctx.fillStyle = '#EF4444';
        ctx.font = `bold ${Math.floor(13 * dpr)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('🔴 Porta Serial Desconectada', padLeft + plotW / 2, padTop + plotH / 2 - 14 * dpr);
        ctx.font = `${Math.floor(11 * dpr)}px sans-serif`;
        ctx.fillStyle = '#94A3B8';
        ctx.fillText('Conecte a porta serial e ligue o Plotter para capturar curvas.', padLeft + plotW / 2, padTop + plotH / 2 + 10 * dpr);
      } else if (!isPlotterRunningRef.current && channelKeys.length === 0) {
        ctx.fillStyle = 'rgba(11, 12, 17, 0.75)';
        ctx.fillRect(padLeft, padTop, plotW, plotH);
        ctx.fillStyle = '#38BDF8';
        ctx.font = `bold ${Math.floor(13 * dpr)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('⏸ Osciloscópio em Espera', padLeft + plotW / 2, padTop + plotH / 2 - 14 * dpr);
        ctx.font = `${Math.floor(11 * dpr)}px sans-serif`;
        ctx.fillStyle = '#94A3B8';
        ctx.fillText('Clique em "▶ Ligar Osciloscópio" no topo para iniciar a captura gráfica.', padLeft + plotW / 2, padTop + plotH / 2 + 10 * dpr);
      } else if (channelKeys.length === 0) {
        ctx.fillStyle = 'rgba(11, 12, 17, 0.6)';
        ctx.fillRect(padLeft, padTop, plotW, plotH);
        ctx.fillStyle = '#00FF88';
        ctx.font = `bold ${Math.floor(13 * dpr)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('⚡ Osciloscópio Ativo • Aguardando Dados Seriais...', padLeft + plotW / 2, padTop + plotH / 2 - 14 * dpr);
        ctx.font = `${Math.floor(11 * dpr)}px "JetBrains Mono", monospace`;
        ctx.fillStyle = '#94A3B8';
        ctx.fillText('Ex: Serial.println("1, 0, 1") ou Serial.printf("Hall_A:%d,Hall_B:%d\\n", a, b);', padLeft + plotW / 2, padTop + plotH / 2 + 10 * dpr);
      }

      // 6. Desenhar Curvas de cada Canal Ativo com Efeito Glow de Fósforo
      const windowSize = sampleWindowRef.current;
      const stepX = plotW / Math.max(1, windowSize - 1);

      for (const k of visibleChannels) {
        const chan = currentChannels[k];
        const vals = chan.values.slice(-windowSize);
        if (vals.length < 2) continue;

        const startIndex = windowSize - vals.length;

        // Desenhar Traço Principal Fluorescente
        ctx.strokeStyle = chan.color;
        ctx.lineWidth = 2.2 * dpr;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.shadowColor = chan.color;
        ctx.shadowBlur = 6 * dpr;

        ctx.beginPath();
        for (let i = 0; i < vals.length; i++) {
          const x = padLeft + (startIndex + i) * stepX;
          const normalized = (vals[i] - minVal) / (maxVal - minVal);
          // Inverter Y e aplicar clamp dentro dos limites da plotagem
          const clampedNorm = Math.max(0, Math.min(1, normalized));
          const y = padTop + plotH - clampedNorm * plotH;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        // Ponto de Cabeça (Último valor capturado com brilho pontual)
        const lastX = padLeft + (startIndex + vals.length - 1) * stepX;
        const lastNorm = Math.max(0, Math.min(1, (vals[vals.length - 1] - minVal) / (maxVal - minVal)));
        const lastY = padTop + plotH - lastNorm * plotH;

        ctx.shadowBlur = 10 * dpr;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(lastX, lastY, 3.5 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = chan.color;
        ctx.beginPath();
        ctx.arc(lastX, lastY, 2 * dpr, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0; // Desligar glow para as próximas operações
      }

      // 7. Cursor de Medição / Mira Crosshair no Hover
      const cursor = hoverCursorRef.current;
      if (cursor && isConnected && channelKeys.length > 0) {
        const canvasX = cursor.x * dpr;
        if (canvasX >= padLeft && canvasX <= padLeft + plotW) {
          // Linha Vertical da Mira
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 1 * dpr;
          ctx.setLineDash([2 * dpr, 2 * dpr]);
          ctx.beginPath();
          ctx.moveTo(canvasX, padTop);
          ctx.lineTo(canvasX, padTop + plotH);
          ctx.stroke();
          ctx.setLineDash([]);

          // Calcular índice da amostra sob o cursor
          const relX = canvasX - padLeft;
          const pointFraction = relX / plotW;
          const targetIndex = Math.round(pointFraction * (windowSize - 1));

          // Desenhar Tooltip HUD com valores instantâneos
          const tooltipLines: { color: string; text: string }[] = [];
          for (const k of visibleChannels) {
            const chan = currentChannels[k];
            const vals = chan.values.slice(-windowSize);
            const offset = windowSize - vals.length;
            const idxInVals = targetIndex - offset;
            if (idxInVals >= 0 && idxInVals < vals.length) {
              tooltipLines.push({
                color: chan.color,
                text: `${chan.name}: ${vals[idxInVals].toFixed(2)}`
              });
            }
          }

          if (tooltipLines.length > 0) {
            const hudX = Math.min(canvasX + 12 * dpr, padLeft + plotW - 140 * dpr);
            const hudY = Math.max(padTop + 10 * dpr, cursor.y * dpr - 20 * dpr);
            const hudH = (tooltipLines.length * 16 + 18) * dpr;
            const hudW = 135 * dpr;

            ctx.fillStyle = 'rgba(15, 17, 24, 0.92)';
            ctx.strokeStyle = '#38BDF8';
            ctx.lineWidth = 1 * dpr;
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(hudX, hudY, hudW, hudH, 4 * dpr) : ctx.rect(hudX, hudY, hudW, hudH);
            ctx.fill();
            ctx.stroke();

            ctx.textAlign = 'left';
            ctx.font = `bold ${Math.floor(9 * dpr)}px sans-serif`;
            ctx.fillStyle = '#94A3B8';
            ctx.fillText(`AMOSTRA: -${windowSize - targetIndex}`, hudX + 8 * dpr, hudY + 12 * dpr);

            let lineY = hudY + 26 * dpr;
            ctx.font = `${Math.floor(10 * dpr)}px "JetBrains Mono", monospace`;
            for (const item of tooltipLines) {
              ctx.fillStyle = item.color;
              ctx.fillText(item.text, hudX + 8 * dpr, lineY);
              lineY += 15 * dpr;
            }
          }
        }
      }

      ctx.restore();

      // Sincronizar estado React para legenda
      setChannels({ ...currentChannels });

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      isSubscribed = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isActiveTab, isConnected]);

  // Limpar canais
  const handleClear = () => {
    channelsRef.current = {};
    setChannels({});
    setHoverCursor(null);
  };

  // Alternar Ligar / Desligar
  const togglePlotterRunning = () => {
    const next = !isPlotterRunning;
    setIsPlotterRunning(next);
    if (!next) {
      setIsPaused(false);
    }
  };

  // Rastreamento de Mouse para Crosshair
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setHoverCursor({ x, y, sampleIdx: 0 });
  };

  const handleMouseLeave = () => {
    setHoverCursor(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#0B0C11] text-gray-200 text-xs font-sans select-none overflow-hidden">
      {/* Barra de Ferramentas Superior - Estilo Instrumento de Bancada */}
      <div className="h-10 bg-[#12141D] border-b border-[#1F2433] flex items-center justify-between px-3 gap-2 flex-wrap">
        {/* Bloco Esquerdo: Controle Principal & Ações */}
        <div className="flex items-center gap-2">
          {/* Botão Principal: Ligar / Desligar Osciloscópio */}
          <button
            onClick={togglePlotterRunning}
            className={`flex items-center gap-1.5 px-3 py-1 rounded font-semibold text-xs transition-all shadow-sm ${
              isPlotterRunning
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/40'
                : 'bg-[#00979C] hover:bg-[#00B4B9] text-white shadow-[#00979C]/30'
            }`}
            title={isPlotterRunning ? 'Desligar captura gráfica' : 'Iniciar osciloscópio em tempo real'}
          >
            <Power className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{isPlotterRunning ? 'Desligar' : 'Ligar Osciloscópio'}</span>
          </button>

          {/* Botão Congelar / Pausar */}
          {isPlotterRunning && (
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors border font-medium ${
                isPaused 
                  ? 'bg-green-950/80 border-green-500 text-green-300 animate-pulse' 
                  : 'bg-[#1C202E] border-[#2A3147] hover:bg-[#252B3E] text-gray-200'
              }`}
              title={isPaused ? 'Retomar fluxo em tempo real' : 'Congelar forma de onda para medição'}
            >
              {isPaused ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3 fill-current" />}
              <span>{isPaused ? 'Retomar' : 'Congelar (Pause)'}</span>
            </button>
          )}

          {/* Botão Limpar Buffer */}
          <button
            onClick={handleClear}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1C202E] hover:bg-red-950/60 hover:text-red-300 border border-[#2A3147] text-gray-300 transition-colors text-xs"
            title="Limpar todos os canais e forma de onda"
          >
            <Trash2 className="w-3 h-3" />
            <span>Limpar</span>
          </button>

          {/* Snapshot PNG */}
          <button
            onClick={handleExportSnapshot}
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#1C202E] hover:bg-sky-950/60 hover:text-sky-300 border border-[#2A3147] text-gray-300 transition-colors text-xs"
            title="Salvar imagem PNG do osciloscópio"
          >
            <Camera className="w-3 h-3" />
            <span>Foto</span>
          </button>

          <div className="h-4 w-[1px] bg-[#222738] mx-0.5" />

          {/* Status Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#0F1118] border border-[#1F2433] text-[11px]">
            <span className={`w-2 h-2 rounded-full ${
              !isConnected 
                ? 'bg-red-500' 
                : isPlotterRunning 
                  ? (isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse') 
                  : 'bg-yellow-500'
            }`} />
            <span className="font-mono text-gray-300">
              {!isConnected 
                ? 'Serial Desconectada' 
                : isPlotterRunning 
                  ? (isPaused ? 'CONGELADO' : `RODANDO (${selectedPort || 'COM'})`) 
                  : 'STANDBY'}
            </span>
          </div>

          {/* Conexão Rápida se desconectado */}
          {!isConnected && (
            <button
              onClick={handleConnect}
              disabled={isUploading || isConnecting || (!selectedPort && ports.length === 0)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-xs transition-colors shadow-sm disabled:opacity-50"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{isConnecting ? 'Conectando...' : 'Conectar Serial'}</span>
            </button>
          )}

          {isConnected && (
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-200 text-[11px] transition-colors"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
              <span>Desconectar</span>
            </button>
          )}
        </div>

        {/* Bloco Direito: Escala Y & Janela de Tempo */}
        <div className="flex items-center gap-3">
          {/* Seletor de Modo de Escala (Y-Axis) */}
          <div className="flex items-center gap-1.5 text-gray-400 text-xs">
            <Zap className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-gray-300">Escala Y:</span>
            <select
              value={scaleMode}
              onChange={(e) => setScaleMode(e.target.value as ScaleMode)}
              className="bg-[#0F1118] border border-[#2A3147] rounded px-2 py-0.5 text-xs text-sky-200 focus:outline-none focus:border-sky-500"
            >
              <option value="auto">Auto (Dinâmico)</option>
              <option value="digital">Digital Lógica (0 / 1)</option>
              <option value="adc10">ADC 10-bit (0 - 1023)</option>
              <option value="adc12">ADC 12-bit (0 - 4095)</option>
              <option value="v5">Tensão 5V (0 - 5.0V)</option>
              <option value="pm100">Simétrica (±100)</option>
              <option value="pm500">Simétrica (±500)</option>
            </select>
          </div>

          {/* Seletor de Amostragem X */}
          <div className="flex items-center gap-1.5 text-gray-400 text-xs">
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-gray-300">Janela:</span>
            <select
              value={sampleWindow}
              onChange={(e) => setSampleWindow(Number(e.target.value))}
              className="bg-[#0F1118] border border-[#2A3147] rounded px-2 py-0.5 text-xs text-emerald-200 focus:outline-none focus:border-emerald-500"
            >
              <option value={50}>50 pts</option>
              <option value={100}>100 pts</option>
              <option value={150}>150 pts</option>
              <option value={300}>300 pts</option>
              <option value={500}>500 pts</option>
              <option value={1000}>1000 pts</option>
            </select>
          </div>
        </div>
      </div>

      {/* Barra de Canais & Legenda Interativa */}
      {Object.keys(channels).length > 0 && (
        <div className="bg-[#0F1118] px-3 py-1.5 border-b border-[#1A1E2B] flex items-center gap-3 flex-wrap text-xs font-mono">
          <span className="text-[11px] font-sans text-gray-400 uppercase tracking-wider font-semibold mr-1 flex items-center gap-1">
            <Activity className="w-3 h-3 text-sky-400" />
            Canais:
          </span>
          {Object.values(channels).map((chan) => (
            <button
              key={chan.name}
              onClick={() => toggleChannelVisibility(chan.name)}
              className={`flex items-center gap-2 px-2.5 py-1 rounded border transition-all text-xs ${
                chan.hidden
                  ? 'bg-[#141620] border-[#222738] text-gray-500 opacity-60 line-through'
                  : 'bg-[#161924] border-[#283045] hover:border-[#3E4A6B] text-gray-200'
              }`}
              title={chan.hidden ? `Clique para reexibir ${chan.name}` : `Clique para ocultar ${chan.name}`}
            >
              {/* Indicador de Cor Fluorescente */}
              <span 
                className="w-2.5 h-2.5 rounded-full shadow-sm" 
                style={{ 
                  backgroundColor: chan.hidden ? '#555566' : chan.color,
                  boxShadow: chan.hidden ? 'none' : `0 0 6px ${chan.color}`
                }} 
              />
              <span className="font-bold">{chan.name}:</span>
              <span className="font-semibold text-white tracking-tight">
                {chan.lastValue !== undefined ? chan.lastValue.toFixed(2) : '--'}
              </span>
              <span className="text-[10px] text-gray-400 font-sans ml-0.5">
                (min: {chan.minValue.toFixed(1)} | max: {chan.maxValue.toFixed(1)})
              </span>
              {chan.hidden ? <EyeOff className="w-3 h-3 text-gray-500 ml-1" /> : <Eye className="w-3 h-3 text-sky-400/80 ml-1" />}
            </button>
          ))}
        </div>
      )}

      {/* Área Gráfica Canvas (Osciloscópio) */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden p-2">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full rounded border border-[#1A1E2B] block cursor-crosshair"
        />
      </div>
    </div>
  );
};

