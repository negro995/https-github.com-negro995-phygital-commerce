type Level = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

function log(level: Level, msg: string, meta?: Record<string, unknown>) {
  const line = JSON.stringify({ level, time: new Date().toISOString(), msg, ...meta });
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const consoleLogger: Logger = {
  debug: (m, meta) => {
    if (process.env.LOG_LEVEL === "debug") log("debug", m, meta);
  },
  info: (m, meta) => log("info", m, meta),
  warn: (m, meta) => log("warn", m, meta),
  error: (m, meta) => log("error", m, meta),
};

export const silentLogger: Logger = { debug() {}, info() {}, warn() {}, error() {} };
