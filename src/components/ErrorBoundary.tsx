import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, copied: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('Uncaught React Error:', error, errorInfo);
  }

  private handleCopy = () => {
    const errorText = `[ERRO NA INTERFACE]\n${this.state.error?.toString()}\n\nStack:\n${this.state.error?.stack}\n\nComponent Stack:\n${this.state.errorInfo?.componentStack}`;
    navigator.clipboard.writeText(errorText);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-[#1E1E1E] text-white flex flex-col items-center justify-center p-6 text-center select-none font-sans">
          <div className="bg-[#252526] border border-red-700/60 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 bg-red-950/60 rounded-full flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h1 className="text-lg font-bold text-red-300">
              Ocorreu um erro na interface do aplicativo
            </h1>

            <p className="text-xs text-gray-400 leading-relaxed">
              O processo principal continua ativo. Você pode copiar os detalhes abaixo para correção ou recarregar a interface.
            </p>

            <div className="bg-[#141414] border border-[#3E3E42] rounded p-3 text-left font-mono text-[11px] text-red-300 max-h-32 overflow-y-auto select-text">
              {this.state.error?.toString()}
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleCopy}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#3E3E42] hover:bg-[#4E4E52] text-xs font-medium transition-colors"
              >
                {this.state.copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{this.state.copied ? 'Copiado!' : 'Copiar Erro'}</span>
              </button>

              <button
                onClick={this.handleReload}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#00979C] hover:bg-[#00B4B9] text-xs font-semibold text-white shadow-md transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recarregar App</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
