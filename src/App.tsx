import React, { useState, useEffect } from 'react';
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
      setBoards(boardList);
      if (boardList.length > 0) {
        setSelectedBoard(boardList[0]);
      }
    });

    // 2. Carregar portas COM
    refreshPorts();

    // 3. Checar status do CLI e cores instalados
    refreshCliStatus();

    // 4. Ouvir logs em tempo real e extrair uso de memória (Flash e RAM)
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
    });

    return () => {
      unsubLogs();
    };
  }, []);

  const handlePortChange = (newPort: string) => {
    setSelectedPort(newPort);
    // Desconecta a porta serial anterior para liberar recursos e travas do SO
    window.electronAPI.disconnectSerial();
  };

  const refreshPorts = async () => {
    setIsRefreshingPorts(true);
    try {
      const portList = await window.electronAPI.listPorts();
      setPorts(portList);
      if (portList.length > 0) {
        if (!portList.some((p) => p.port === selectedPort)) {
          setSelectedPort(portList[0].port);
        }
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

  // Ação: Compilar (Multi-Abas)
  const handleCompile = async () => {
    if (!selectedBoard) {
      alert('Por favor, selecione uma placa primeiro.');
      return;
    }

    setIsCompiling(true);
    setStatusMessage('Indexando e compilando arquivos...');
    setDrawerTab('console');
    setIsDrawerOpen(true);
    setLogs((prev) => [
      ...prev,
      {
        type: 'info',
        text: `\n--- [INÍCIO DA COMPILAÇÃO] ---\nPlaca: ${selectedBoard.name} (${selectedBoard.fqbn})\nArquivos: ${files.map((f) => f.name).join(', ')}\n`
      }
    ]);

    try {
      const mainFile = files.find((f) => f.isMain) || files[0];
      const payload = files.map((f) => ({ name: f.name, content: f.content }));
      const result = await window.electronAPI.compileSketch(mainFile.content, selectedBoard.fqbn, payload);
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

    setIsUploading(true);
    setStatusMessage('Gravando sketch na memória Flash...');
    setDrawerTab('console');
    setIsDrawerOpen(true);
    setLogs((prev) => [
      ...prev,
      {
        type: 'info',
        text: `\n--- [INÍCIO DO UPLOAD] ---\nPlaca: ${selectedBoard.name}\nPorta: ${selectedPort}\n`
      }
    ]);

    try {
      const mainFile = files.find((f) => f.isMain) || files[0];
      const payload = files.map((f) => ({ name: f.name, content: f.content }));
      const success = await window.electronAPI.uploadSketch(
        mainFile.content,
        selectedBoard.fqbn,
        selectedPort,
        payload
      );
      if (success) {
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
      setIsUploading(false);
    }
  };

  // Ação: Exportar Binário Compilado (.bin / .hex)
  const handleExportBinary = async () => {
    if (!selectedBoard) {
      alert('Por favor, selecione uma placa antes de exportar o binário.');
      return;
    }

    setIsExportingBinary(true);
    setStatusMessage('Gerando binário final e exportando para a Área de Trabalho...');
    setDrawerTab('console');
    setIsDrawerOpen(true);
    setLogs((prev) => [
      ...prev,
      {
        type: 'info',
        text: `\n--- [EXPORTAÇÃO DE BINÁRIO] ---\nPlaca: ${selectedBoard.name} (${selectedBoard.fqbn})\n`
      }
    ]);

    try {
      const payload = files.map((f) => ({ name: f.name, content: f.content }));
      const result = await window.electronAPI.exportBinary(payload, selectedBoard.fqbn);
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
        setSelectedBoard={setSelectedBoard}
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

