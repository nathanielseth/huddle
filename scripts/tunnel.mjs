import { spawn } from "node:child_process";
import { existsSync, mkdirSync, chmodSync, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import os from "node:os";

const CLIENT_PORT = 3000;
const BIN_DIR = path.resolve(os.homedir(), ".huddle", "bin");
const TUNNEL_URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

const color = {
	cyan: (s) => `\x1b[36m${s}\x1b[0m`,
	green: (s) => `\x1b[32m${s}\x1b[0m`,
	yellow: (s) => `\x1b[33m${s}\x1b[0m`,
	dim: (s) => `\x1b[2m${s}\x1b[0m`,
	bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function platformBinaryInfo() {
	const platform = os.platform();
	const arch = os.arch();

	if (platform === "darwin") {
		return {
			file: "cloudflared-darwin-amd64.tgz",
			isArchive: true,
			binName: "cloudflared",
		};
	}
	if (platform === "linux") {
		const suffix = arch === "arm64" ? "arm64" : "amd64";
		return {
			file: `cloudflared-linux-${suffix}`,
			isArchive: false,
			binName: "cloudflared",
		};
	}
	if (platform === "win32") {
		return {
			file: "cloudflared-windows-amd64.exe",
			isArchive: false,
			binName: "cloudflared.exe",
		};
	}
	throw new Error(`Unsupported platform for auto-download: ${platform}`);
}

async function downloadCloudflared() {
	const info = platformBinaryInfo();
	const destPath = path.join(BIN_DIR, info.binName);

	if (existsSync(destPath)) return destPath;

	mkdirSync(BIN_DIR, { recursive: true });

	const url = `https://github.com/cloudflare/cloudflared/releases/latest/download/${info.file}`;
	console.log(color.dim(`  [tunnel] downloading cloudflared (first run only)...`));

	const res = await fetch(url, { redirect: "follow" });
	if (!res.ok || !res.body) {
		throw new Error(`Failed to download cloudflared: HTTP ${res.status}`);
	}

	if (info.isArchive) {
		const tmpArchive = path.join(BIN_DIR, info.file);
		await pipeline(res.body, createWriteStream(tmpArchive));
		await new Promise((resolve, reject) => {
			const tar = spawn("tar", ["-xzf", tmpArchive, "-C", BIN_DIR]);
			tar.on("exit", (code) =>
				code === 0 ? resolve() : reject(new Error("tar extraction failed")),
			);
		});
	} else {
		await pipeline(res.body, createWriteStream(destPath));
	}

	if (os.platform() !== "win32") {
		chmodSync(destPath, 0o755);
	}

	return destPath;
}

async function resolveCloudflaredPath() {
	// prefer a system install if the user already has one on PATH.
	const which = os.platform() === "win32" ? "where" : "which";
	const check = spawn(which, ["cloudflared"]);
	const found = await new Promise((resolve) => {
		let out = "";
		check.stdout.on("data", (d) => (out += d));
		check.on("exit", (code) => resolve(code === 0 ? out.trim().split("\n")[0] : null));
		check.on("error", () => resolve(null));
	});
	if (found) return found;

	return downloadCloudflared();
}

async function startTunnel() {
	const binPath = await resolveCloudflaredPath();

	const proc = spawn(
		binPath,
		["tunnel", "--url", `http://localhost:${CLIENT_PORT}`],
		{ stdio: ["ignore", "pipe", "pipe"] },
	);

	let urlPrinted = false;

	const handleChunk = (chunk) => {
		const text = chunk.toString();
		if (!urlPrinted) {
			const match = text.match(TUNNEL_URL_PATTERN);
			if (match) {
				urlPrinted = true;
				printBanner(match[0]);
			}
		}
	};

	proc.stdout.on("data", handleChunk);
	proc.stderr.on("data", handleChunk); // cloudflared logs to stderr by default

	proc.on("exit", (code) => {
		if (code !== 0 && code !== null && !urlPrinted) {
			console.error(
				color.yellow(
					"\n[tunnel] cloudflared couldn't reach Cloudflare's network (blocked network, or offline).",
				),
			);
			console.error(
				color.dim(
					"  Your dev servers are running fine. You can keep playing locally.\n" +
						"  If you're on a restrictive Wi-Fi/VPN, try a different network and re-run `npm run dev:remote`.\n",
				),
			);
		}
	});

	return proc;
}

function printBanner(url) {
	const line = "─".repeat(Math.min(url.length + 4, 60));
	console.log("");
	console.log(color.cyan(line));
	console.log(color.bold(color.green("  🌐 Friends can join at:")));
	console.log("  " + color.bold(color.cyan(url)));
	console.log(color.cyan(line));
	console.log(color.dim("  This URL is temporary, it stops working when you close this terminal."));
	console.log(color.dim("  Open it yourself first (as host), then send it to other players.\n"));
}

function startDevProcesses() {
	return spawn("npm run dev", { stdio: "inherit", shell: true });
}

async function main() {
	console.log(color.dim("[tunnel] starting dev servers + remote tunnel...\n"));

	const dev = startDevProcesses();

	const shutdown = () => {
		tunnel?.kill();
		dev.kill();
		process.exit(0);
	};
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	dev.on("exit", shutdown);

	let tunnel;
	try {
		tunnel = await startTunnel();
	} catch (err) {
		console.error(color.yellow(`\n[tunnel] couldn't start cloudflared: ${err.message}`));
		console.error(
			color.dim(
				"  Your dev servers are running fine. You can keep playing locally.\n" +
					"  You can also install cloudflared yourself and re-run: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/\n",
			),
		);
		// don't exit - local dev is still usable even if the tunnel failed.
	}
}

main();
