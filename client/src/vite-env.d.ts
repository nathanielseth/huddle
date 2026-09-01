/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_SERVER_URL?: string;
	/** Dev-only — the standalone live sim server from `npm run sim:live -w server` (default http://localhost:4100). Used only by /sandbox/sim. */
	readonly VITE_SIM_SERVER_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}