import React, { useState } from 'react';
import { Plus, X, FileCode, FileText, Code2 } from 'lucide-react';

export interface SketchFile {
  id: string;
  name: string;
  content: string;
  isMain?: boolean;
}

interface EditorTabsProps {
  files: SketchFile[];
  activeFileId: string;
  onSelectTab: (id: string) => void;
  onAddTab: (name: string) => void;
  onCloseTab: (id: string) => void;
}

export const EditorTabs: React.FC<EditorTabsProps> = ({
  files,
  activeFileId,
  onSelectTab,
  onAddTab,
  onCloseTab
}) => {
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.ino')) {
      return <Code2 className="w-3.5 h-3.5 text-[#00B4B9]" />;
    }
    if (fileName.endsWith('.h') || fileName.endsWith('.hpp')) {
      return <FileCode className="w-3.5 h-3.5 text-[#B388FF]" />;
    }
    if (fileName.endsWith('.cpp') || fileName.endsWith('.c')) {
      return <FileText className="w-3.5 h-3.5 text-[#64B5F6]" />;
    }
    return <FileCode className="w-3.5 h-3.5 text-gray-400" />;
  };

  const handleConfirmAdd = () => {
    let name = newFileName.trim();
    if (!name) {
      setIsAdding(false);
      return;
    }

    if (!name.includes('.')) {
      name += '.h';
    }

    const validExtensions = ['.h', '.hpp', '.cpp', '.c', '.ino'];
    const hasValidExt = validExtensions.some(ext => name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      setErrorMessage('Extensão inválida. Use .h, .cpp ou .c');
      return;
    }

    const exists = files.some(f => f.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      setErrorMessage('Já existe um arquivo com este nome.');
      return;
    }

    onAddTab(name);
    setNewFileName('');
    setErrorMessage('');
    setIsAdding(false);
  };

  return (
    <div className="h-9 bg-[#14141A] border-b border-[#2B2B36] flex items-center px-2 select-none overflow-x-auto gap-1">
      {files.map((file) => {
        const isActive = file.id === activeFileId;
        return (
          <div
            key={file.id}
            onClick={() => onSelectTab(file.id)}
            className={`group flex items-center gap-2 h-7 px-3 rounded-t text-xs font-mono transition-all cursor-pointer border-t-2 ${
              isActive
                ? 'bg-[#1E1E26] text-white border-[#00979C] shadow-sm'
                : 'bg-[#121217] text-gray-400 hover:text-gray-200 hover:bg-[#181820] border-transparent'
            }`}
          >
            {getFileIcon(file.name)}
            <span>{file.name}</span>

            {!file.isMain && files.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(file.id);
                }}
                className="opacity-0 group-hover:opacity-100 hover:bg-red-900/50 p-0.5 rounded text-gray-400 hover:text-red-300 transition-all ml-1"
                title={`Fechar ${file.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}

      {/* Botão de Adicionar Aba */}
      {isAdding ? (
        <div className="flex items-center gap-1 bg-[#1A1A24] border border-[#00979C] px-2 py-0.5 rounded text-xs">
          <input
            type="text"
            placeholder="nome.h ou .cpp"
            value={newFileName}
            onChange={(e) => {
              setNewFileName(e.target.value);
              setErrorMessage('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmAdd();
              if (e.key === 'Escape') setIsAdding(false);
            }}
            autoFocus
            className="bg-transparent text-white text-xs w-28 focus:outline-none font-mono"
          />
          <button
            onClick={handleConfirmAdd}
            className="text-[#00B4B9] hover:text-white text-[11px] font-bold px-1"
          >
            OK
          </button>
          <button
            onClick={() => setIsAdding(false)}
            className="text-gray-400 hover:text-white text-[11px] px-1"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          title="Adicionar Novo Arquivo (.h / .cpp) ao Sketch"
          className="p-1 rounded hover:bg-[#20202C] text-gray-400 hover:text-[#00B4B9] transition-colors ml-1"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}

      {errorMessage && (
        <span className="text-[11px] text-red-400 ml-2 font-sans">{errorMessage}</span>
      )}
    </div>
  );
};
