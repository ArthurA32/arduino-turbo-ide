import React, { useState, useEffect, useRef } from 'react';
import { TopBar } from './components/TopBar';
import { Editor } from './components/Editor';
import { ConsoleDrawer } from './components/ConsoleDrawer';
import { StatusBar } from './components/StatusBar';
import { DiagnosticsModal } from './components/DiagnosticsModal';
import { CoreInstallerModal } from './components/CoreInstallerModal';
import { LibraryManagerModal } from './components/LibraryManagerModal';
import { DebugModal } from './components/DebugModal';
import { FirmwareReaderModal, FirmwareReadData } from './components/FirmwareReaderModal';
import { SketchFile } from './components/EditorTabs';


const DEFAULT_SKETCH = `void setup() {
  // put your setup code here, to run once:

}

void loop() {
  // put your main code here, to run repeatedly:

}
`;


export const App: React.FC = () => {
  const [files, setFiles] = useState<SketchFile[]>([
    { id: 'main', name: 'sketch_turbo.ino', content: DEFAULT_SKETCH, isMain: true }
  ]);
  const [activeFileId, setActiveFileId] = useState<string>('main');
  const [currentFilePath, setCurrentFilePath] = useState<string>('');

  const [boards, setBoards] = useState<any[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<any>(null);

  const [ports, setPorts] = useState<any[]>([]);
  const [selectedPort, setSelectedPort] = useState<string>('');
  const [isRefreshingPorts, setIsRefreshingPorts] = useState<boolean>(false);

  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isExportingBinary, setIsExportingBinary] = useState<boolean>(false);

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');
  const [partitionScheme, setPartitionScheme] = useState<string>(() => {
    try {
      return localStorage.getItem('turbo_partition_scheme') || 'huge_app';
    } catch {
      return 'huge_app';
    }
  });

  const isUploadingRef = useRef<boolean>(false);
  useEffect(() => {
    isUploadingRef.current = isUploading;
  }, [isUploading]);

  const [flashUsage, setFlashUsage] = useState<string>('');
  const [ramUsage, setRamUsage] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');

  const [logs, setLogs] = useState<{ type: string; text: string }[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(true);
  const [drawerTab, setDrawerTab] = useState<'console' | 'serial' | 'plotter'>('console');

  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isCoreModalOpen, setIsCoreModalOpen] = useState<boolean>(false);
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState<boolean>(false);
  const [isDebugModalOpen, setIsDebugModalOpen] = useState<boolean>(false);
  const [installedCores, setInstalledCores] = useState<string[]>([]);

  const [isFirmwareModalOpen, setIsFirmwareModalOpen] = useState<boolean>(false);
  const [isReadingFirmware, setIsReadingFirmware] = useState<boolean>(false);
  const [firmwareData, setFirmwareData] = useState<FirmwareReadData | null>(null);


  useEffect(() => {
    // 1. Carregar lista de placas
    window.electronAPI.listBoards().then((boardList) => {
      const safeList = Array.isArray(boardList) ? boardList : [];
      setBoards(safeList);
      if (safeList.length > 0) {
        let chosenBoard = safeList[0];
        try {
          const savedFqbn = localStorage.getItem('turbo_selected_board_fqbn');
          if (savedFqbn) {
            const found = safeList.find((b) => b.fqbn === savedFqbn);
            if (found) chosenBoard = found;
          }
        } catch {}
        setSelectedBoard(chosenBoard);
      }
    }).catch((err) => {
      console.warn('Falha ao obter lista de placas:', err);
    });

    // 2. Carregar portas COM
    refreshPorts();

    // 3. Checar status do CLI e cores instalados
    refreshCliStatus();

    // 4. Ouvir logs em tempo real e extrair uso de memória (Flash e RAM) e progresso de Upload
    const unsubLogs = window.electronAPI.onLogOutput((data) => {
      setLogs((prev) => [...prev, data]);

      // Parse de uso de memória Flash
      const flashMatch = data.text.match(/Sketch uses \d+ bytes \((\d+%)\)/i);
      if (flashMatch) {
        setFlashUsage(flashMatch[1]);
      }

      // Parse de uso de memória RAM
      const ramMatch = data.text.match(/Global variables use \d+ bytes \((\d+%)\)/i);
      if (ramMatch) {
        setRamUsage(ramMatch[1]);
      }

      // Parse dinâmico de progresso de gravação Flash (esptool e avrdude)
      const text = data.text;
      if (data.type === 'upload' || isUploadingRef.current) {
        if (/Connecting\.\.\./i.test(text)) {
          setUploadStatusText('Conectando à placa via Serial...');
          setUploadProgress((prev) => (prev === null || prev < 5 ? 5 : prev));
        } else if (/Erasing flash/i.test(text)) {
          setUploadStatusText('Apagando setores da Flash...');
          setUploadProgress((prev) => (prev === null || prev < 15 ? 15 : prev));
        } else if (/Writing at 0x/i.test(text) || /\b\d{1,3}\s*%/i.test(text)) {
          // Captura porcentagens do esptool (ex: Writing at 0x00010000... (42 %))
          const espMatches = [...text.matchAll(/(?:Writing at 0x[0-9a-fA-F]+\.\.\.\s*\(|\()(\d{1,3})\s*%\)/gi)];
          if (espMatches.length > 0) {
            const lastPct = parseInt(espMatches[espMatches.length - 1][1], 10);
            if (!isNaN(lastPct) && lastPct >= 0 && lastPct <= 100) {
              setUploadProgress(lastPct);
              setUploadStatusText(`Gravando na memória Flash (${lastPct}%)...`);
            }
          } else {
            // Captura porcentagens do avrdude (ex: Writing | ####### | 45%)
            const avrMatches = [...text.matchAll(/Writing\s*\|\s*#*\s*\|\s*(\d{1,3})%/gi)];
            if (avrMatches.length > 0) {
              const lastPct = parseInt(avrMatches[avrMatches.length - 1][1], 10);
              if (!isNaN(lastPct) && lastPct >= 0 && lastPct <= 100) {
                setUploadProgress(lastPct);
                setUploadStatusText(`Gravando Flash AVR (${lastPct}%)...`);
              }
            } else {
              // Genérico
              const genericMatches = [...text.matchAll(/\b(\d{1,3})\s*%/g)];
              if (genericMatches.length > 0 && text.toLowerCase().includes('writing')) {
                const lastPct = parseInt(genericMatches[genericMatches.length - 1][1], 10);
                if (!isNaN(lastPct) && lastPct >= 0 && lastPct <= 100) {
                  setUploadProgress(lastPct);
                  setUploadStatusText(`Gravando Flash (${lastPct}%)...`);
                }
              }
            }
          }
        } else if (/Hash of data verified|flash verified|Leaving\.\.\./i.test(text)) {
          setUploadProgress(100);
          setUploadStatusText('Flash gravada com sucesso (100%)');
        } else if (/Hard resetting/i.test(text)) {
          setUploadProgress(100);
          setUploadStatusText('Reiniciando microcontrolador...');
        }
      }
    });

    return () => {
      unsubLogs();
    };
  }, []);

  const handleSelectBoard = (board: any) => {
    setSelectedBoard(board);
    if (board?.fqbn) {
      try {
        localStorage.setItem('turbo_selected_board_fqbn', board.fqbn);
      } catch {}
    }
  };

  const handlePortChange = (newPort: string) => {
    setSelectedPort(newPort);
    if (newPort) {
      try {
        localStorage.setItem('turbo_selected_port', newPort);
      } catch {}
    }
    // Desconecta a porta serial anterior para liberar recursos e travas do SO
    window.electronAPI.disconnectSerial();
  };

  const refreshPorts = async () => {
    setIsRefreshingPorts(true);
    try {
      const portList = await window.electronAPI.listPorts();
      const safePorts = Array.isArray(portList) ? portList : [];
      setPorts(safePorts);
      if (safePorts.length > 0) {
        let chosenPort = safePorts[0].port;
        try {
          const savedPort = localStorage.getItem('turbo_selected_port');
          if (savedPort && safePorts.some((p) => p.port === savedPort)) {
            chosenPort = savedPort;
          }
        } catch {}
        setSelectedPort(chosenPort);
      } else {
        setSelectedPort('');
      }
    } catch (e) {
      console.error('Falha ao atualizar portas:', e);
    } finally {
      setIsRefreshingPorts(false);
    }
  };

  const refreshCliStatus = async () => {
    try {
      const status = await window.electronAPI.getCliStatus();
      if (status && status.cores) {
        setInstalledCores(status.cores);
      }
    } catch (e) {
      console.error('Falha ao obter status do CLI:', e);
    }
  };

  // Gerenciamento de Abas do Sketch
  const handleCodeChange = (val: string | undefined) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === activeFileId ? { ...f, content: val || '' } : f))
    );
  };

  const handleAddTab = (name: string) => {
    const newId = Date.now().toString();
    const defaultContent = name.endsWith('.h') || name.endsWith('.hpp')
      ? `#pragma once\n\n// Definições e Protótipos para ${name}\n`
      : `// Implementação ${name}\n#include <Arduino.h>\n\n`;

    const newFile: SketchFile = {
      id: newId,
      name,
      content: defaultContent,
      isMain: false
    };

    setFiles((prev) => [...prev, newFile]);
    setActiveFileId(newId);
  };

  const handleCloseTab = (id: string) => {
    setFiles((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      if (activeFileId === id && updated.length > 0) {
        setActiveFileId(updated[0].id);
      }
      return updated;
    });
  };

  const handlePartitionSchemeChange = (scheme: string) => {
    setPartitionScheme(scheme);
    try {
      localStorage.setItem('turbo_partition_scheme', scheme);
    } catch {}
  };

  const getEffectiveFqbn = (baseFqbn: string) => {
    if (!baseFqbn || !baseFqbn.includes('esp32')) return baseFqbn;
    const scheme = partitionScheme || 'huge_app';
    if (/PartitionScheme=[^,:]+/i.test(baseFqbn)) {
      return baseFqbn.replace(/PartitionScheme=[^,:]+/i, `PartitionScheme=${scheme}`);
    }
    const colonCount = (baseFqbn.match(/:/g) || []).length;
    if (colonCount >= 3) {
      return `${baseFqbn},PartitionScheme=${scheme}`;
    } else if (colonCount === 2) {
      return `${baseFqbn}:PartitionScheme=${scheme}`;
    }
    return baseFqbn;
  };

  // Ação: Compilar (Multi-Abas)
  const handleCompile = async () => {
    if (!selectedBoard) {
      alert('Por favor, selecione uma placa primeiro.');
      return;
    }

    const targetFqbn = getEffectiveFqbn(selectedBoard.fqbn);
    setIsCompiling(true);
    setStatusMessage('Indexando e compilando arquivos...');
    setDrawerTab('console');
    setIsDrawerOpen(true);
    setLogs((prev) => [
      ...prev,
      {
        type: 'info',
        text: `\n--- [INÍCIO DA COMPILAÇÃO] ---\nPlaca: ${selectedBoard.name} (${targetFqbn})\nArquivos: ${files.map((f) => f.name).join(', ')}\n`
      }
    ]);

    try {
      const mainFile = files.find((f) => f.isMain) || files[0];
      const payload = files.map((f) => ({ name: f.name, content: f.content }));
      const result = await window.electronAPI.compileSketch(mainFile.content, targetFqbn, payload);
      if (result.success) {
        setStatusMessage('✔ Compilação concluída com sucesso!');
      } else {
        setStatusMessage('❌ Erro na compilação.');
      }
    } catch (err: any) {
      setLogs((prev) => [...prev, { type: 'error', text: `❌ Erro inesperado: ${err.message}` }]);
      setStatusMessage('❌ Erro inesperado.');
    } finally {
      setIsCompiling(false);
    }
  };

  // Ação: Upload (Multi-Abas)
  const handleUpload = async () => {
    if (!selectedBoard) {
      alert('Selecione uma placa.');
      return;
    }
    if (!selectedPort) {
      alert('Selecione uma porta COM.');
      return;
    }

    const targetFqbn = getEffectiveFqbn(selectedBoard.fqbn);
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatusText('Iniciando gravação Flash...');
    setStatusMessage('Gravando sketch na memória Flash...');
    setDrawerTab('console');
    setIsDrawerOpen(true);
    setLogs((prev) => [
      ...prev,
      {
        type: 'info',
        text: `\n--- [INÍCIO DO UPLOAD] ---\nPlaca: ${selectedBoard.name}\nPorta: ${selectedPort}\nFQBN: ${targetFqbn}\n`
      }
    ]);

    try {
      const mainFile = files.find((f) => f.isMain) || files[0];
      const payload = files.map((f) => ({ name: f.name, content: f.content }));
      const success = await window.electronAPI.uploadSketch(
        mainFile.content,
        targetFqbn,
        selectedPort,
        payload
      );
      if (success) {
        setUploadProgress(100);
        setUploadStatusText('✔ Flash gravada com sucesso! (100%)');
        setStatusMessage('✔ Gravação concluída! Pronto para monitorar.');
        setTimeout(() => {
          setDrawerTab('serial');
        }, 1500);
      } else {
        setStatusMessage('❌ Erro na gravação.');
      }
    } catch (err: any) {
      setLogs((prev) => [...prev, { type: 'error', text: `❌ Erro no envio: ${err.message}` }]);
      setStatusMessage('❌ Erro no envio.');
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(null);
        setUploadStatusText('');
      }, 1500);
    }
  };

  // Ação: Exportar Binário Compilado (.bin / .hex)
  const handleExportBinary = async () => {
    if (!selectedBoard) {
      alert('Por favor, selecione uma placa antes de exportar o binário.');
      return;
    }

    const targetFqbn = getEffectiveFqbn(selectedBoard.fqbn);
    setIsExportingBinary(true);
    setStatusMessage('Gerando binário final e exportando para a Área de Trabalho...');
    setDrawerTab('console');
    setIsDrawerOpen(true);
    setLogs((prev) => [
      ...prev,
      {
        type: 'info',
        text: `\n--- [EXPORTAÇÃO DE BINÁRIO] ---\nPlaca: ${selectedBoard.name} (${targetFqbn})\n`
      }
    ]);

    try {
      const payload = files.map((f) => ({ name: f.name, content: f.content }));
      const result = await window.electronAPI.exportBinary(payload, targetFqbn);
      if (result.success) {
        setStatusMessage('✔ Binário exportado com sucesso na pasta Desktop!');
        setLogs((prev) => [
          ...prev,
          { type: 'info', text: `✔ Binário gerado na pasta: ${result.filePath}\n` }
        ]);
      } else {
        setStatusMessage('❌ Falha ao exportar binário.');
      }
    } catch (err: any) {
      setLogs((prev) => [...prev, { type: 'error', text: `❌ Erro na exportação: ${err.message}` }]);
      setStatusMessage('❌ Erro na exportação.');
    } finally {
      setIsExportingBinary(false);
    }
  };

  // Ação: Ler e Descompilar Firmware do Silício do Chip
  const handleReadChipFirmware = async () => {
    if (!selectedPort) {
      alert('Selecione uma porta COM conectada ao chip primeiro!');
      return;
    }
    setIsFirmwareModalOpen(true);
    setIsReadingFirmware(true);
    setFirmwareData(null);
    setStatusMessage('Lendo firmware e descompilando código do silício...');

    try {
      const res = await window.electronAPI.readChipFirmware({
        port: selectedPort,
        fqbn: selectedBoard?.fqbn || 'esp32:esp32:esp32'
      });
      setFirmwareData(res);
    } catch (err: any) {
      setFirmwareData({
        arch: 'unknown',
        chipName: 'N/A',
        sizeBytes: 0,
        decompiledC: '',
        extractedStrings: [],
        functions: [],
        detectedPins: [],
        error: err?.message || String(err)
      });

    } finally {
      setIsReadingFirmware(false);
      setStatusMessage('');
    }
  };

  const handleExportChipBinary = async () => {
    if (!firmwareData?.binaryPath) {
      alert('Nenhum firmware lido no momento. Realize a leitura do chip primeiro.');
      return;
    }
    await window.electronAPI.exportChipFirmware({
      sourceBinaryPath: firmwareData.binaryPath,
      chipName: firmwareData.chipName
    });
  };

  const handleCopyToEditor = (code: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === activeFileId ? { ...f, content: code } : f))
    );
    setIsFirmwareModalOpen(false);
  };

  // Ação: Abrir Arquivo
  const handleOpenFile = async () => {
    try {
      const fileData = await window.electronAPI.openFile();
      if (fileData) {
        setFiles([
          { id: 'main', name: fileData.name, content: fileData.content, isMain: true }
        ]);
        setActiveFileId('main');
        setCurrentFilePath(fileData.path);
      }
    } catch (e) {
      console.error('Falha ao abrir arquivo:', e);
    }
  };

  // Ação: Salvar Arquivo Ativo
  const handleSaveFile = async () => {
    try {
      const activeFile = files.find((f) => f.id === activeFileId) || files[0];
      const saved = await window.electronAPI.saveFile(activeFile.content, currentFilePath || activeFile.name);
      if (saved) {
        setFiles((prev) =>
          prev.map((f) => (f.id === activeFile.id ? { ...f, name: saved.name } : f))
        );
        setCurrentFilePath(saved.path);
      }
    } catch (e) {
      console.error('Falha ao salvar arquivo:', e);
    }
  };

  const activeFile = files.find((f) => f.id === activeFileId) || files[0];

  const isSelectedBoardEsp32 = selectedBoard && (
    (selectedBoard.family || '').toUpperCase().includes('ESP32') ||
    (selectedBoard.platform || '').toLowerCase() === 'esp32' ||
    (selectedBoard.fqbn || '').toLowerCase().includes('esp32')
  );

  const partitionSchemeLabel = isSelectedBoardEsp32
    ? partitionScheme === 'huge_app'
      ? 'Huge App (3MB)'
      : partitionScheme === 'min_spiffs'
      ? 'Min SPIFFS (1.9MB)'
      : partitionScheme === 'no_ota'
      ? 'Sem OTA (2MB)'
      : 'Padrão (1.3MB)'
    : undefined;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0F0F13] overflow-hidden font-sans">
      {/* Barra de Ferramentas Superior */}
      <TopBar
        onCompile={handleCompile}
        onUpload={handleUpload}
        isCompiling={isCompiling}
        isUploading={isUploading}
        onExportBinary={handleExportBinary}
        isExportingBinary={isExportingBinary}
        onReadChipFirmware={handleReadChipFirmware}
        isReadingFirmware={isReadingFirmware}
        selectedBoard={selectedBoard}
        setSelectedBoard={handleSelectBoard}
        boards={boards}
        selectedPort={selectedPort}
        setSelectedPort={handlePortChange}
        ports={ports}
        onRefreshPorts={refreshPorts}
        isRefreshingPorts={isRefreshingPorts}
        onToggleSerial={() => {
          setDrawerTab('serial');
          setIsDrawerOpen(true);
        }}
        isSerialOpen={isDrawerOpen && drawerTab === 'serial'}
        onOpenLibraryModal={() => setIsLibraryModalOpen(true)}
        onOpenDebugModal={() => setIsDebugModalOpen(true)}
        onOpenReportModal={() => setIsReportModalOpen(true)}
        onOpenCoreModal={() => setIsCoreModalOpen(true)}
        onOpenFile={handleOpenFile}
        onSaveFile={handleSaveFile}
        fileName={activeFile?.name || 'sketch.ino'}
        partitionScheme={partitionScheme}
        onPartitionSchemeChange={handlePartitionSchemeChange}
      />


      {/* Editor Multi-Abas Principal */}
      <div className="flex-1 overflow-hidden relative">
        <Editor
          files={files}
          activeFileId={activeFileId}
          onSelectTab={(id) => setActiveFileId(id)}
          onAddTab={handleAddTab}
          onCloseTab={handleCloseTab}
          onChange={handleCodeChange}
          onCompile={handleCompile}
          onUpload={handleUpload}
          onSave={handleSaveFile}
        />
      </div>

      {/* Gaveta Inferior Modulável (Console, Serial Monitor & Plotter Gráfico) */}
      <ConsoleDrawer
        logs={logs}
        onClearLogs={() => setLogs([])}
        isOpen={isDrawerOpen}
        onToggleOpen={() => setIsDrawerOpen(!isDrawerOpen)}
        activeTab={drawerTab}
        setActiveTab={setDrawerTab}
        selectedPort={selectedPort}
        setSelectedPort={handlePortChange}
        ports={ports}
        isUploading={isUploading}
      />

      {/* Barra de Status e Progresso de Indexação/Memória */}
      <StatusBar
        isCompiling={isCompiling}
        isUploading={isUploading}
        selectedBoard={selectedBoard}
        selectedPort={selectedPort}
        flashUsage={flashUsage}
        ramUsage={ramUsage}
        statusMessage={statusMessage}
        uploadProgress={uploadProgress}
        uploadStatusText={uploadStatusText}
        partitionSchemeLabel={partitionSchemeLabel}
      />

      {/* Modais */}
      <LibraryManagerModal
        isOpen={isLibraryModalOpen}
        onClose={() => setIsLibraryModalOpen(false)}
      />

      <DebugModal
        isOpen={isDebugModalOpen}
        onClose={() => setIsDebugModalOpen(false)}
        selectedBoard={selectedBoard}
        selectedPort={selectedPort}
      />

      <DiagnosticsModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />

      <CoreInstallerModal
        isOpen={isCoreModalOpen}
        onClose={() => setIsCoreModalOpen(false)}
        installedCores={installedCores}
        onRefreshStatus={refreshCliStatus}
      />

      <FirmwareReaderModal
        isOpen={isFirmwareModalOpen}
        onClose={() => setIsFirmwareModalOpen(false)}
        isLoading={isReadingFirmware}
        data={firmwareData}
        onReRead={handleReadChipFirmware}
        onCopyToEditor={handleCopyToEditor}
        onExportBinary={handleExportChipBinary}
        port={selectedPort}
        boardName={selectedBoard?.name || ''}
        fqbn={selectedBoard?.fqbn}
      />

    </div>
  );
};

