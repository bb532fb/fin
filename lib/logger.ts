type LogLevel = "info" | "warn" | "error";
type LogContext = Record<string, string | number | boolean | null | undefined>;

function write(level: LogLevel, message: string, context?: LogContext): void {
  const entry = JSON.stringify({ level, message, time: new Date().toISOString(), ...context });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

/** Structured JSON logger. Never pass secrets or API keys in context. */
export const logger = {
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
  error: (message: string, context?: LogContext) => write("error", message, context),
};
