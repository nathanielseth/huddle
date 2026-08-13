const IS_PROD = process.env.NODE_ENV === "production";

type Level = "debug" | "info" | "warn" | "error";

// debug is dev-only noise, suppressed in prod
const MIN_LEVEL: Level = IS_PROD ? "info" : "debug";
const LEVEL_RANK: Record<Level, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

function write(
	level: Level,
	msg: string,
	meta?: Record<string, unknown>,
): void {
	if (LEVEL_RANK[level] < LEVEL_RANK[MIN_LEVEL]) return;

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
	debug: (msg: string, meta?: Record<string, unknown>) => {
		write("debug", msg, meta);
	},
	info: (msg: string, meta?: Record<string, unknown>) => {
		write("info", msg, meta);
	},
	warn: (msg: string, meta?: Record<string, unknown>) => {
		write("warn", msg, meta);
	},
	error: (msg: string, meta?: Record<string, unknown>) => {
		write("error", msg, meta);
	},
};

export type Logger = typeof logger;