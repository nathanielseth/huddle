import { z } from "zod";

export const FaceturnsConfigPayloadSchema = z.object({
	mode: z.enum(["duel", "ffa", "teams"]),
	teamChoices: z.record(z.string(), z.enum(["A", "B"])),
});
export type FaceturnsConfigPayload = z.infer<
	typeof FaceturnsConfigPayloadSchema
>;

export const DEFAULT_FACETURN_CONFIG: FaceturnsConfigPayload = {
	mode: "duel",
	teamChoices: {},
};

export const FaceturnsConfigActionSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("set_mode"),
		mode: z.enum(["duel", "ffa", "teams"]),
	}),
	z.object({ kind: z.literal("set_team"), team: z.enum(["A", "B"]) }),
]);
export type FaceturnsConfigAction = z.infer<typeof FaceturnsConfigActionSchema>;

const SelectBossSchema = z.object({
	type: z.literal("select_boss"),
	bossId: z.string(),
});

const SelectCrewSchema = z.object({
	type: z.literal("select_crew"),
	crewId: z.string(),
});

const DeselectCrewSchema = z.object({
	type: z.literal("deselect_crew"),
	crewId: z.string(),
});

const SelectMoveSchema = z.object({
	type: z.literal("select_move"),
	moveId: z.string(),
});

const DeselectMoveSchema = z.object({
	type: z.literal("deselect_move"),
	moveId: z.string(),
});

const LockDraftSchema = z.object({
	type: z.literal("lock_draft"),
});

const RandomizeDraftSchema = z.object({
	type: z.literal("randomize_draft"),
});

const LoadDraftSchema = z.object({
	type: z.literal("load_draft"),
	bossId: z.string().nullable(),
	crewIds: z.array(z.string()),
	moveIds: z.array(z.string()),
});

const MulliganSchema = z.object({
	type: z.literal("mulligan"),
	redraw: z.boolean(),
});

const RpsChoiceSchema = z.object({
	type: z.literal("rps_choice"),
	choice: z.enum(["rock", "paper", "scissors"]),
});

const PlayMoveSchema = z.object({
	type: z.literal("play_move"),
	moveId: z.string(),
	targetCrewSlot: z.number().int().min(0).max(2).optional(),
	targetAllySlot: z.number().int().min(0).max(2).optional(),
	targetPlayerId: z.string().optional(),
});

// strike targets enemy crew; unturn targets the player's own face-up crew
const DeclareClassActionSchema = z.object({
	type: z.literal("declare_class_action"),
	action: z.enum(["strike", "collect", "unturn"]),
	targetCrewSlot: z.number().int().min(0).max(2).optional(),
	targetAllySlot: z.number().int().min(0).max(1).optional(),
	targetPlayerId: z.string().optional(),
});

// shared by the razor and dealer boss commands
const UseBossCommandSchema = z.object({
	type: z.literal("use_boss_command"),
	guessClass: z.enum(["striker", "blocker", "collector", "turner"]).optional(),
	targetCrewSlot: z.number().int().min(0).max(1).optional(),
	targetAllySlot: z.number().int().min(0).max(1).optional(),
	targetPlayerId: z.string().optional(),
});

const UseFaceTurnSchema = z.object({
	type: z.literal("use_face_turn"),
	targetPlayerId: z.string(),
	targetCrewSlot: z.number().int().min(0).max(1).optional(),
});

const EndTurnSchema = z.object({
	type: z.literal("end_turn"),
});

const ChallengeSchema = z.object({
	type: z.literal("challenge"),
});

const BlockSchema = z.object({
	type: z.literal("block"),
});

const PassChallengeSchema = z.object({
	type: z.literal("pass_challenge"),
});

const ChainPlayBurstSchema = z.object({
	type: z.literal("chain_play_burst"),
	moveId: z.string(),
	targetCrewSlot: z.number().int().min(0).max(2).optional(),
	targetAllySlot: z.number().int().min(0).max(2).optional(),
	targetPlayerId: z.string().optional(),
});

const ChainPlaySlowSchema = z.object({
	type: z.literal("chain_play_slow"),
	moveId: z.string(),
	targetCrewSlot: z.number().int().min(0).max(2).optional(),
	targetAllySlot: z.number().int().min(0).max(2).optional(),
	targetPlayerId: z.string().optional(),
});

const ChainPassSchema = z.object({
	type: z.literal("chain_pass"),
});

// accepting the block ends the challenge
const AcceptBlockSchema = z.object({
	type: z.literal("accept_block"),
});

const ChallengeBlockSchema = z.object({
	type: z.literal("challenge_block"),
});

const ResolvePeekDiscardSchema = z.object({
	type: z.literal("resolve_peek_discard"),
	discardMoveId: z.string(),
});

const ResolveCrewReactivateSchema = z.object({
	type: z.literal("resolve_crew_reactivate"),
	crewSlot: z.number().int().min(0).max(2),
});

const DiscardActiveMoveSchema = z.object({
	type: z.literal("discard_active_move"),
	slotIndex: z.number().int().min(0).max(2),
});

const ResolvePoisonTargetSchema = z.object({
	type: z.literal("resolve_poison_target"),
	targetPlayerId: z.string(),
});

const ResolveChooseCrewToTurnSchema = z.object({
	type: z.literal("resolve_choose_crew_to_turn"),
	crewSlot: z.number().int().min(0).max(1),
});

// empty the clip: player picks how many cards to discard (0 to max)
const ResolveChooseDiscardCountSchema = z.object({
	type: z.literal("resolve_choose_discard_count"),
	count: z.number().int().min(0),
});

// take it back: player picks one card from their own discard pile
const ResolveChooseFromDiscardSchema = z.object({
	type: z.literal("resolve_choose_from_discard"),
	cardId: z.string(),
});

// dig deep: player picks one of the revealed top-of-deck cards to draw
const ResolveDigDeepPickSchema = z.object({
	type: z.literal("resolve_dig_deep_pick"),
	cardIds: z.array(z.string()).min(1),
});

// switch up: picks a face-up slot to unturn and a different face-down slot to turn
const ResolveSwitchUpPickSchema = z.object({
	type: z.literal("resolve_switch_up_pick"),
	unturnSlot: z.number().int().min(0).max(1),
	turnSlot: z.number().int().min(0).max(1),
});

// tactical support: optionally unturns an ally's face-up crew; omit slot to decline
const ResolveTacticalSupportUnturnOfferSchema = z.object({
	type: z.literal("resolve_tactical_support_unturn_offer"),
	slot: z.number().int().min(0).max(1).optional(),
});

// bear bones: optional bonus strike after a successful challenge call
const ResolveBearBonesBonusStrikeSchema = z.object({
	type: z.literal("resolve_bear_bones_bonus_strike"),
	confirmed: z.boolean(),
	targetPlayerId: z.string().optional(),
	targetCrewSlot: z.number().int().min(0).max(1).optional(),
});

// void legs: at start of turn, may discard 1 card for 5 damage
const ResolveVoidLegsChoiceSchema = z.object({
	type: z.literal("resolve_void_legs_choice"),
	confirmed: z.boolean(),
});

// background check: challenger guesses class of a face-down crew before challenge resolves
const ResolveBackgroundCheckGuessSchema = z.object({
	type: z.literal("resolve_background_check_guess"),
	targetCrewSlot: z.number().int().min(0).max(1),
	guessClass: z.enum(["striker", "blocker", "collector", "turner"]),
});

// watcher passive: optional unturn after challenge win; omit slot to decline.
// targetPlayerId picks teammate (teams) or self.
const ResolveWatcherUnturnOfferSchema = z.object({
	type: z.literal("resolve_watcher_unturn_offer"),
	slot: z.number().int().min(0).max(1).optional(),
	targetPlayerId: z.string().optional(),
});

const ResolveLighthouseDisablePickSchema = z.object({
	type: z.literal("resolve_lighthouse_disable_pick"),
	picks: z
		.array(
			z.object({
				targetPlayerId: z.string(),
				crewSlot: z.number().int().min(0).max(1),
			}),
		)
		.min(1)
		.max(2),
});

// tag out: swap one own crew slot with a teammate's (teams mode only)
const ResolveTagOutPickSchema = z.object({
	type: z.literal("resolve_tag_out_pick"),
	ownSlot: z.number().int().min(0).max(1),
	teammateSlot: z.number().int().min(0).max(1),
});

// truth serum: the target (not the actor) picks which face-down crew to reveal
const ResolveTruthSerumRevealSchema = z.object({
	type: z.literal("resolve_truth_serum_reveal"),
	crewSlot: z.number().int().min(0).max(1),
});

export const FaceturnsActionSchema = z.discriminatedUnion("type", [
	SelectBossSchema,
	SelectCrewSchema,
	DeselectCrewSchema,
	SelectMoveSchema,
	DeselectMoveSchema,
	LockDraftSchema,
	RandomizeDraftSchema,
	LoadDraftSchema,
	MulliganSchema,
	RpsChoiceSchema,
	PlayMoveSchema,
	DeclareClassActionSchema,
	UseBossCommandSchema,
	UseFaceTurnSchema,
	EndTurnSchema,
	ChallengeSchema,
	BlockSchema,
	PassChallengeSchema,
	ChainPlayBurstSchema,
	ChainPlaySlowSchema,
	ChainPassSchema,
	AcceptBlockSchema,
	ChallengeBlockSchema,
	ResolvePeekDiscardSchema,
	ResolveCrewReactivateSchema,
	DiscardActiveMoveSchema,
	ResolvePoisonTargetSchema,
	ResolveChooseCrewToTurnSchema,
	ResolveChooseDiscardCountSchema,
	ResolveChooseFromDiscardSchema,
	ResolveDigDeepPickSchema,
	ResolveSwitchUpPickSchema,
	ResolveTacticalSupportUnturnOfferSchema,
	ResolveBearBonesBonusStrikeSchema,
	ResolveVoidLegsChoiceSchema,
	ResolveBackgroundCheckGuessSchema,
	ResolveWatcherUnturnOfferSchema,
	ResolveTagOutPickSchema,
	ResolveTruthSerumRevealSchema,
	ResolveLighthouseDisablePickSchema,
]);

export type FaceturnsAction = z.infer<typeof FaceturnsActionSchema>;