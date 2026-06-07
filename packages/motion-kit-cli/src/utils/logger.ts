export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  verbose(message: string): void;
}

export interface LoggerOptions {
  verbose?: boolean;
}

const TAG = "motion-kit";

export function createLogger(options: LoggerOptions = {}): Logger {
  return {
    info(message) {
      console.log(`[${TAG}] ${message}`);
    },
    warn(message) {
      console.warn(`[${TAG}] warn: ${message}`);
    },
    error(message) {
      console.error(`[${TAG}] error: ${message}`);
    },
    verbose(message) {
      if (options.verbose) console.log(`[${TAG}] verbose: ${message}`);
    },
  };
}
