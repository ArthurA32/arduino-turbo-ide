import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  Download, 
  Trash2, 
  Check, 
  RefreshCw, 
  BookOpen, 
  ExternalLink,
  PackageCheck,
  Globe
} from 'lucide-react';

interface LibraryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LibraryManagerModal: React.FC<LibraryManagerModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'explore' | 'installed'>('explore');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [installedLibs, setInstalledLibs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [installingMap, setInstallingMap] = useState<{ [name: string]: boolean }>({});
  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadInstalled();
      if (activeTab === 'explore' && searchResults.length === 0) {
        handleSearch('esp32');
      }
    }
  }, [isOpen, activeTab]);

  const loadInstalled = async () => {
    try {
      const list = await window.electronAPI.listInstalledLibraries();
      setInstalledLibs(list || []);
    } catch (e) {
      console.error('Falha ao listar bibliotecas instaladas:', e);
    }
  };

  const handleSearch = async (queryToSearch: string) => {
    setIsLoading(true);
    setStatusMessage('Buscando bibliotecas na nuvem oficial do Arduino...');
    try {
      const results = await window.electronAPI.searchLibraries(queryToSearch);
      setSearchResults(results || []);
      setStatusMessage(results.length > 0 ? `${results.length} bibliotecas encontradas.` : 'Nenhuma biblioteca encontrada para o termo.');
    } catch (e: any) {
      setStatusMessage(`Erro na busca: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstall = async (libName: string) => {
    setInstallingMap((prev) => ({ ...prev, [libName]: true }));
    setStatusMessage(`Instalando ${libName}...`);
    try {
      const success = await window.electronAPI.installLibrary(libName);
      if (success) {
        setStatusMessage(`✔ Biblioteca '${libName}' instalada com sucesso!`);
        await loadInstalled();
      } else {
        setStatusMessage(`❌ Falha ao instalar '${libName}'. Verifique a conexão com a internet.`);
      }
    } catch (e: any) {
      setStatusMessage(`Erro: ${e.message}`);
    } finally {
      setInstallingMap((prev) => ({ ...prev, [libName]: false }));
    }
  };

  const handleUninstall = async (libName: string) => {
    setInstallingMap((prev) => ({ ...prev, [libName]: true }));
    setStatusMessage(`Removendo ${libName}...`);
    try {
      const success = await window.electronAPI.uninstallLibrary(libName);
      if (success) {
        setStatusMessage(`✔ '${libName}' removida com sucesso.`);
        await loadInstalled();
      } else {
        setStatusMessage(`❌ Falha ao remover '${libName}'.`);
      }
    } catch (e: any) {
      setStatusMessage(`Erro: ${e.message}`);
    } finally {
      setInstallingMap((prev) => ({ ...prev, [libName]: false }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[#16161D] border border-[#2B2B36] rounded-xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden text-gray-200 animate-modalPop">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2B2B36] bg-[#121217]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#00979C]/20 border border-[#00979C]/40 text-[#00B4B9]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Gerenciador de Bibliotecas</h2>
              <p className="text-xs text-gray-400">Instale e gerencie drivers, sensores e bibliotecas para seus projetos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#202028] text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Abas e Pesquisa */}
        <div className="p-4 border-b border-[#2B2B36] bg-[#1A1A22] flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('explore')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'explore'
                  ? 'bg-[#00979C] text-white shadow-md'
                  : 'bg-[#121217] text-gray-400 hover:text-gray-200 border border-[#2B2B36]'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>Explorar Nuvem</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('installed');
                loadInstalled();
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'installed'
                  ? 'bg-[#00979C] text-white shadow-md'
                  : 'bg-[#121217] text-gray-400 hover:text-gray-200 border border-[#2B2B36]'
              }`}
            >
              <PackageCheck className="w-4 h-4" />
              <span>Instaladas ({installedLibs.length})</span>
            </button>
          </div>

          {activeTab === 'explore' && (
            <div className="flex items-center gap-2 w-full sm:w-80">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Pesquisar (ex: NeoPixel, ArduinoJson)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch(searchQuery);
                  }}
                  className="w-full bg-[#121217] border border-[#2B2B36] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00979C]"
                />
              </div>
              <button
                onClick={() => handleSearch(searchQuery)}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-lg bg-[#252530] hover:bg-[#303040] text-xs text-white border border-[#3E3E50] transition-colors"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Buscar'}
              </button>
            </div>
          )}
        </div>

        {/* Mensagem de Status */}
        {statusMessage && (
          <div className="px-6 py-2 bg-[#121217] border-b border-[#2B2B36] text-[11px] text-[#00B4B9] font-mono flex items-center justify-between">
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Lista de Resultados */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0F0F13]">
          {activeTab === 'explore' ? (
            searchResults.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-xs">
                {isLoading ? 'Consultando índice do Arduino...' : 'Digite o nome de uma biblioteca e pressione Enter.'}
              </div>
            ) : (
              searchResults.map((lib, idx) => {
                const isInstalled = installedLibs.some(
                  (i) => i.name.toLowerCase() === lib.name.toLowerCase()
                );
                const isInstalling = installingMap[lib.name];

                return (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[#16161D] border border-[#262633] hover:border-[#38384A] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{lib.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#20202C] text-gray-300 border border-[#303040]">
                          v{lib.latestVersion}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950/40 text-blue-300 border border-blue-800/40">
                          {lib.category}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed">{lib.sentence}</p>
                      <div className="flex items-center gap-4 text-[11px] text-gray-400 pt-1">
                        <span>Autor: <strong className="text-gray-300">{lib.author}</strong></span>
                        {lib.website && (
                          <a
                            href={lib.website}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-[#00B4B9] hover:underline"
                          >
                            <span>Docs / GitHub</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isInstalled ? (
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-xs text-green-400 px-3 py-1.5 rounded-lg bg-green-950/30 border border-green-800/40 font-medium">
                            <Check className="w-3.5 h-3.5" />
                            Instalada
                          </span>
                          <button
                            onClick={() => handleUninstall(lib.name)}
                            disabled={isInstalling}
                            title="Desinstalar biblioteca"
                            className="p-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleInstall(lib.name)}
                          disabled={isInstalling}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#00979C] hover:bg-[#00B4B9] active:scale-95 text-white font-medium text-xs transition-all shadow-md disabled:opacity-50"
                        >
                          <Download className={`w-3.5 h-3.5 ${isInstalling ? 'animate-bounce' : ''}`} />
                          <span>{isInstalling ? 'Instalando...' : 'Instalar'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )
          ) : (
            installedLibs.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-xs">
                Nenhuma biblioteca instalada no momento. Vá para a aba "Explorar Nuvem" para instalar.
              </div>
            ) : (
              installedLibs.map((lib, idx) => {
                const isInstalling = installingMap[lib.name];
                return (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[#16161D] border border-[#262633] flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{lib.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-green-950/40 text-green-300 border border-green-800/40 font-mono">
                          {lib.version}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{lib.sentence || lib.location}</p>
                    </div>

                    <button
                      onClick={() => handleUninstall(lib.name)}
                      disabled={isInstalling}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 text-xs transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isInstalling ? 'Removendo...' : 'Desinstalar'}</span>
                    </button>
                  </div>
                );
              })
            )
          )}
        </div>

        {/* Rodapé */}
        <div className="px-6 py-3 border-t border-[#2B2B36] bg-[#121217] flex items-center justify-between text-xs text-gray-400">
          <span>Bibliotecas oficiais salvas no diretório global do Arduino.</span>
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