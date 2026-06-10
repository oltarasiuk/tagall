import { env } from "~/env";

const isProd = env.NODE_ENV === "production";

export const logger = {
  /** Verbose diagnostics; silenced in production. */
  debug: (...args: unknown[]) => {
    if (!isProd) console.log(...args);
  },
  info: (...args: unknown[]) => {
    console.log(...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};
