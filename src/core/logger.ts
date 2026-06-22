// ============================================
// LOGGER CENTRALIZADO
// Para uso futuro en agentes y services
// ============================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private level: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  private levels = { debug: 0, info: 1, warn: 2, error: 3 };

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.level];
  }

  private format(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const icon = { debug: '🔍', info: 'ℹ️', warn: '⚠️', error: '❌' }[level];
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] ${icon} [${level.toUpperCase()}] ${message}${dataStr}`;
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog('debug')) console.log(this.format('debug', message, data));
  }

  info(message: string, data?: any): void {
    if (this.shouldLog('info')) console.log(this.format('info', message, data));
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog('warn')) console.warn(this.format('warn', message, data));
  }

  error(message: string, data?: any): void {
    if (this.shouldLog('error')) console.error(this.format('error', message, data));
  }
}

export const logger = new Logger();
