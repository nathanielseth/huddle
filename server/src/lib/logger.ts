const IS_PROD = process.env.NODE_ENV === "production";

type Level = "debug" | "info" | "warn" | "error";

function write(
	level: Level,
	msg: string,
	meta?: Record<string, unknown>,
): void {
	if (IS_PROD) {
		process.stdout.write(
			JSON.stringify({ ts: Date.now(), level, msg, ...meta }) + "\n",
		);
	} else {
		const tag = ("[" + level.toUpperCase() + "]").padEnd(7);
		const extras =
			meta && Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
		const fn =
			level === "error"
				? console.error
				: level === "warn"
					? console.warn
					: console.log;
		fn(tag + " " + msg + extras);
	}
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => { write("debug", msg, meta); },
  info:  (msg: string, meta?: Record<string, unknown>) => { write("info",  msg, meta); },
  warn:  (msg: string, meta?: Record<string, unknown>) => { write("warn",  msg, meta); },
  error: (msg: string, meta?: Record<string, unknown>) => { write("error", msg, meta); },
};

export type Logger = typeof logger;