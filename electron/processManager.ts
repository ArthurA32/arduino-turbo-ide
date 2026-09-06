import { execSync, ChildProcess } from 'child_process';
import { app } from 'electron';

class ProcessManager {
  private activePids: Set<number> = new Set();
  private isTerminating: boolean = false;

  constructor() {
    this.hookGlobalExitHandlers();
  }

  public register(proc: ChildProcess) {
    if (proc && proc.pid) {
      this.activePids.add(proc.pid);
      proc.on('close', () => {
        if (proc.pid) {
          this.activePids.delete(proc.pid);
        }
      });
      proc.on('error', () => {
        if (proc.pid) {
          this.activePids.delete(proc.pid);
        }
      });
    }
  }

  public unregister(proc: ChildProcess) {
    if (proc && proc.pid) {
      this.activePids.delete(proc.pid);
    }
  }

  public killAll() {
    if (this.isTerminating) return;
    this.isTerminating = true;

    for (const pid of this.activePids) {
      try {
        execSync(`taskkill /F /PID ${pid} /T`, { stdio: 'ignore' });
      } catch {}
    }
    this.activePids.clear();
  }

  public exitAppNow(exitCode: number = 0) {
    this.killAll();
    try {
      app.exit(exitCode);
    } catch {
      process.exit(exitCode);
    }
  }

  private hookGlobalExitHandlers() {
    const handleTermination = () => {
      this.killAll();
    };

    process.on('exit', handleTermination);
    process.on('SIGINT', () => this.exitAppNow(0));
    process.on('SIGTERM', () => this.exitAppNow(0));
    process.on('uncaughtException', (err) => {
      console.error('Fatal Uncaught Exception:', err);
      this.killAll();
      this.exitAppNow(1);
    });

    if (app) {
      app.on('before-quit', handleTermination);
      app.on('will-quit', handleTermination);
      app.on('window-all-closed', () => this.exitAppNow(0));
    }
  }
}

export const processManager = new ProcessManager();
