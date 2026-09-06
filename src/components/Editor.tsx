import React, { useEffect, useRef } from 'react';
import MonacoEditor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { EditorTabs, SketchFile } from './EditorTabs';
import { registerArduinoIntellisense, lintArduinoCode } from '../services/arduinoIntellisense';

// Configurar Monaco para carregar 100% localmente do bundle (sem requisições externas para CDN)
loader.config({ monaco });

// Registrar IntelliSense do Arduino & C++
registerArduinoIntellisense();

interface EditorProps {
  files: SketchFile[];
  activeFileId: string;
  onSelectTab: (id: string) => void;
  onAddTab: (name: string) => void;
  onCloseTab: (id: string) => void;
  onChange: (value: string | undefined) => void;
  onCompile: () => void;
  onUpload: () => void;
  onSave: () => void;
}

export const Editor: React.FC<EditorProps> = ({
  files,
  activeFileId,
  onSelectTab,
  onAddTab,
  onCloseTab,
  onChange,
  onCompile,
  onUpload,
  onSave
}) => {
  const activeFile = files.find((f) => f.id === activeFileId) || files[0];
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // Executar linter de sintaxe em tempo real no modelo ativo
  const runDiagnostics = (code: string) => {
    if (!editorRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;

    const rawErrors = lintArduinoCode(code);
    const markers: monaco.editor.IMarkerData[] = rawErrors.map((err) => ({
      startLineNumber: err.line,
      startColumn: err.startColumn,
      endLineNumber: err.line,
      endColumn: err.endColumn,
      message: err.message,
      severity: err.severity
    }));

    monaco.editor.setModelMarkers(model, 'arduino-linter', markers);
  };

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    if (activeFile?.content) {
      runDiagnostics(activeFile.content);
    }
  };

  // Revalidar diagnóstico quando o arquivo ativo mudar
  useEffect(() => {
    if (activeFile?.content) {
      runDiagnostics(activeFile.content);
    }
  }, [activeFile?.id]);

  const handleCodeChange = (value: string | undefined) => {
    onChange(value);
    if (value !== undefined) {
      runDiagnostics(value);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        onCompile();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        onUpload();
      } else if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCompile, onUpload, onSave]);

  return (
    <div className="flex-1 w-full h-full bg-[#1E1E1E] flex flex-col overflow-hidden">
      {/* Barra de abas de arquivos do sketch (.ino, .h, .cpp) */}
      <EditorTabs
        files={files}
        activeFileId={activeFile?.id || activeFileId}
        onSelectTab={onSelectTab}
        onAddTab={onAddTab}
        onCloseTab={onCloseTab}
      />

      {/* Editor de Código Monaco */}
      <div className="flex-1 w-full overflow-hidden">
        <MonacoEditor
          height="100%"
          language="cpp"
          theme="vs-dark"
          value={activeFile ? activeFile.content : ''}
          onChange={handleCodeChange}
          onMount={handleEditorDidMount}
          options={{
            fontSize: 14,
            fontFamily: "'Cascadia Code', 'Fira Code', Consolas, 'Courier New', monospace",
            fontLigatures: true,
            minimap: { enabled: true, maxColumn: 80 },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            renderLineHighlight: 'all',
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            lineNumbers: 'on',
            bracketPairColorization: { enabled: true },
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            suggestOnTriggerCharacters: true,
            quickSuggestions: {
              other: true,
              comments: false,
              strings: true
            },
            parameterHints: {
              enabled: true,
              cycle: true
            },
            hover: {
              enabled: true,
              delay: 200
            },
            formatOnType: true,
            formatOnPaste: true
          }}
        />
      </div>
    </div>
  );
};


