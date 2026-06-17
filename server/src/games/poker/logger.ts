const SUIT: Record<string, string> = { h: "♥", d: "♦", c: "♣", s: "♠" };

function fmtCard(c: string): string {
	const suit = c.slice(-1);
	return `${c.slice(0, -1)}${SUIT[suit] ?? suit}`;
}

function fmtCards(arr: unknown): string {
	if (!Array.isArray(arr) || arr.length === 0) return "——";
	return arr.map((c) => fmtCard(String(c))).join(" ");
}

function fmtChips(n: number): string {
	return `₱${n.toLocaleString("en-PH")}`;
}

function fmtPid(id: string): string {
	return id.startsWith("ai::") ? id : id.slice(0, 8);
}

function rpad(s: string, w: number): string {
	return s.length >= w ? s : s + " ".repeat(w - s.length);
}

function lpad(s: string, w: number): string {
	return s.length >= w ? s : " ".repeat(w - s.length) + s;
}

function asNum(v: unknown): number {
	return typeof v === "number" ? v : 0;
}

function asStr(v: unknown): string {
	return typeof v === "string" ? v : "";
}

interface BufferedBlinds {
	sbId: string;
	sbAmt: number;
	bbId: string;
	bbAmt: number;
}

interface BufferedAI {
	playerId: string;
	equity: number;
	evEdge: number;
}

export class PokerLogger {
	private readonly room: string;

	// per-hand caches — cleared at hand_start
	private readonly hc = new Map<string, string>(); // "K♥ Q♠"
	private readonly lbl = new Map<string, string>(); // display label
	private readonly stk = new Map<string, number>(); // last known stack
	private readonly ai = new Set<string>(); // AI player IDs this hand

	private blindsBuf: BufferedBlinds | null = null;
	private aiBuf: BufferedAI | null = null;

	constructor(roomCode: string) {
		this.room = roomCode;
	}

	// "[KUH7  #1]" — consistent 11-char prefix
	private tag(hand: number | null): string {
		const r = this.room.substring(0, 4).padEnd(4);
		const h = hand !== null ? `#${hand}` : "  ";
		return `[${r} ${h.padStart(3)}]`;
	}

	private out(hand: number | null, msg: string): void {
		console.log(`${this.tag(hand)}  ${msg}`);
	}

	private sep(hand: number | null): void {
		console.log(this.tag(hand));
	}

	// seat line at hand start: id, cards, stack, optional role
	private seatLine(
		id: string,
		cards: string,
		stack: number,
		role?: "SB" | "BB",
	): string {
		const p = rpad(fmtPid(id), 10);
		const star = this.ai.has(id) ? "★" : " ";
		const c = rpad(cards, 6);
		const s = lpad(fmtChips(stack), 7);
		const name = this.ai.has(id) ? `   ${this.lbl.get(id) ?? fmtPid(id)}` : "";
		const roleStr = role ? `    ${role}` : "";
		return `  ${p}  ${star}  ${c}   ${s}${name}${roleStr}`;
	}

	// action line during a betting round, with optional AI equity
	private actionLine(
		id: string,
		action: string,
		amount: number | null,
		stack: number | null,
		ai?: BufferedAI,
	): string {
		const p = rpad(fmtPid(id), 10);
		const star = this.ai.has(id) ? "★" : " ";
		const act = rpad(action.replace("_", "-"), 8);
		const amt = amount !== null ? lpad(fmtChips(amount), 7) : rpad("", 7);
		const stk =
			stack !== null ? `   stack ${lpad(fmtChips(stack), 7)}` : rpad("", 19);
		const eq = ai
			? `   eq ${ai.equity.toFixed(3)}  ev ${ai.evEdge >= 0 ? "+" : ""}${ai.evEdge.toFixed(3)}`
			: "";
		return `  ${p}  ${star}   ${act}  ${amt}${stk}${eq}`;
	}

	log(
		event: string,
		hand: number | null,
		payload: Record<string, unknown>,
	): void {
		switch (event) {
			case "game_start": {
				const humans = asNum(payload["playerCount"]);
				const bots = asNum(payload["aiCount"]);
				const stack = asNum(payload["startingStack"]);
				const bl = payload["blinds"] as { sb: number; bb: number } | undefined;
				const parts: string[] = [];
				if (humans > 0) parts.push(`${humans} human${humans !== 1 ? "s" : ""}`);
				if (bots > 0) parts.push(`${bots} bot${bots !== 1 ? "s" : ""}`);
				parts.push(fmtChips(stack), `Blinds ${bl?.sb ?? 0}/${bl?.bb ?? 0}`);
				this.sep(null);
				this.out(null, `══ GAME  ${parts.join(" · ")}`);
				this.sep(null);
				break;
			}

			// buffered — merged into hand_start
			case "blinds_posted": {
				const sb = payload["sb"] as
					| { playerId: string; posted: number }
					| undefined;
				const bb = payload["bb"] as
					| { playerId: string; posted: number }
					| undefined;
				if (sb && bb) {
					this.blindsBuf = {
						sbId: sb.playerId,
						sbAmt: sb.posted,
						bbId: bb.playerId,
						bbAmt: bb.posted,
					};
				}
				break;
			}

			case "hand_start": {
				// reset per-hand state
				this.hc.clear();
				this.lbl.clear();
				this.stk.clear();
				this.ai.clear();
				this.aiBuf = null;

				const players =
					(payload["players"] as Array<Record<string, unknown>> | undefined) ??
					[];
				const dealerId = asStr(payload["dealerId"]);
				const betToCall = asNum(payload["betToCall"]);

				for (const p of players) {
					const id = asStr(p["id"]);
					const dn = asStr(p["displayName"] || "");
					const pid = asStr(p["personalityId"] || "");
					const isAI = Boolean(p["isAI"]);
					const holeCards = p["holeCards"] as string[] | undefined;
					const stack = asNum(p["stack"]);

					this.lbl.set(id, dn ? (pid ? `${dn} · ${pid}` : dn) : fmtPid(id));
					this.stk.set(id, stack);
					if (isAI) this.ai.add(id);
					if (holeCards?.length) this.hc.set(id, fmtCards(holeCards));
				}

				const b = this.blindsBuf;
				this.blindsBuf = null;

				const divider = "─".repeat(Math.max(2, 58 - String(hand ?? "").length));
				this.sep(hand);
				this.out(hand, `─── HAND ${hand} ${divider}`);

				const dealerLabel = this.lbl.get(dealerId) ?? fmtPid(dealerId);
				let headerLine = `Dealer ${fmtPid(dealerId)} · ${dealerLabel}`;
				if (b) {
					headerLine +=
						`   SB ${fmtPid(b.sbId)} ${fmtChips(b.sbAmt)}` +
						`   BB ${fmtPid(b.bbId)} ${fmtChips(b.bbAmt)}`;
				}
				this.out(hand, headerLine);
				this.sep(hand);

				for (const p of players) {
					const id = asStr(p["id"]);
					const status = asStr(p["status"]);
					if (status === "out") continue;

					const role =
						b?.sbId === id
							? ("SB" as const)
							: b?.bbId === id
								? ("BB" as const)
								: undefined;

					this.out(
						hand,
						this.seatLine(
							id,
							this.hc.get(id) ?? "?? ??",
							asNum(p["stack"]),
							role,
						),
					);
				}

				// pre-flop header (no street_advance fires for the first street)
				this.sep(hand);
				this.out(hand, `PRE-FLOP  to call ${fmtChips(betToCall)}`);
				break;
			}

			case "street_advance": {
				const phase = asStr(payload["newPhase"]).toUpperCase();
				const board = (payload["communityCards"] as string[] | undefined) ?? [];
				const potTotal = asNum(payload["potTotal"]);
				this.sep(hand);
				this.out(
					hand,
					`${rpad(phase, 8)}${fmtCards(board)}   pot ${fmtChips(potTotal)}`,
				);
				break;
			}

			case "runout_street": {
				const phase = asStr(payload["newPhase"]).toUpperCase();
				const board = (payload["communityCards"] as string[] | undefined) ?? [];
				this.sep(hand);
				this.out(hand, `${rpad(phase, 8)}${fmtCards(board)}   (runout)`);
				break;
			}

			// buffered — merged into next player_action for same player
			case "ai_action": {
				this.aiBuf = {
					playerId: asStr(payload["playerId"]),
					equity: asNum(payload["equity"]),
					evEdge: asNum(payload["evEdge"]),
				};
				break;
			}

			case "player_action": {
				const id = asStr(payload["playerId"]);
				const type = asStr(payload["type"]);

				let amount: number | null = null;
				if (type === "call") amount = asNum(payload["callAmount"]);
				if (type === "raise") amount = asNum(payload["raiseTo"]);
				if (type === "all_in") amount = asNum(payload["totalAmount"]);

				if (payload["remainingStack"] !== undefined) {
					this.stk.set(id, asNum(payload["remainingStack"]));
				} else if (type === "all_in") {
					this.stk.set(id, 0);
				}

				const showStack =
					type === "call" || type === "raise" || type === "all_in";
				const stack = showStack ? (this.stk.get(id) ?? null) : null;

				let ai: BufferedAI | undefined;
				if (this.aiBuf?.playerId === id) {
					ai = this.aiBuf;
					this.aiBuf = null;
				}

				this.out(hand, this.actionLine(id, type, amount, stack, ai));
				break;
			}

			case "player_action_timeout": {
				const id = asStr(payload["playerId"]);
				const auto = asStr(payload["autoAction"]);
				this.out(hand, `  ${rpad(fmtPid(id), 10)}    TIMEOUT → ${auto}`);
				break;
			}

			case "showdown_resolved": {
				const board = (payload["communityCards"] as string[] | undefined) ?? [];
				const playerInfo =
					(payload["playerInfo"] as
						| Record<
								string,
								{
									cards: string[];
									hand: string | null;
									won: number;
								}
						  >
						| undefined) ?? {};
				const stacks =
					(payload["stacks"] as Record<string, number> | undefined) ?? {};

				for (const [id, info] of Object.entries(playerInfo)) {
					if (info.cards?.length) this.hc.set(id, fmtCards(info.cards));
					this.stk.set(id, stacks[id] ?? 0);
				}

				this.sep(hand);
				this.out(hand, `SHOWDOWN  ${fmtCards(board)}`);
				this.sep(hand);

				for (const [id, info] of Object.entries(playerInfo)) {
					const p = rpad(fmtPid(id), 10);
					const star = this.ai.has(id) ? "★" : " ";
					const c = rpad(this.hc.get(id) ?? "?? ??", 6);
					const desc = rpad(info.hand ?? "——", 22);
					const won =
						info.won > 0 ? `${lpad(fmtChips(info.won), 9)}  ✓` : rpad("——", 9);
					this.out(hand, `  ${p}  ${star}  ${c}   ${desc}  ${won}`);
				}

				this.sep(hand);
				const stackLine = Object.entries(stacks)
					.map(([id, s]) => `${fmtPid(id)} ${fmtChips(s)}`)
					.join("  ·  ");
				this.out(hand, `Stacks  ${stackLine}`);
				this.out(hand, "─".repeat(64));
				this.sep(hand);
				break;
			}

			case "game_over": {
				const winner = payload["winner"]
					? fmtPid(asStr(payload["winner"]))
					: "nobody";
				const finalStacks =
					(payload["finalStacks"] as Record<string, number> | undefined) ?? {};

				const stackParts: string[] = [];
				for (const [id, s] of Object.entries(finalStacks)) {
					if (s > 0) stackParts.push(`${fmtPid(id)} ${fmtChips(s)}`);
				}
				const stackLine = stackParts.join("  ·  ");

				this.sep(null);
				this.out(
					null,
					`══ GAME OVER  Winner: ${winner}${stackLine ? `   ${stackLine}` : ""}`,
				);
				this.sep(null);
				break;
			}

			case "ai_invalid_action":
				this.out(
					hand,
					`⚠ BUG ai_invalid_action  ${asStr(payload["playerId"])}  ${JSON.stringify(payload["action"])}`,
				);
				break;

			case "ai_no_personality":
				this.out(
					hand,
					`⚠ BUG ai_no_personality  ${asStr(payload["playerId"])}`,
				);
				break;

			case "ai_seats_filled":
				break;

			default:
				this.out(hand, `${rpad(event, 20)}  ${JSON.stringify(payload)}`);
				break;
		}
	}
}