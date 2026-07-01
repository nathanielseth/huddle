import { z } from "zod";

// drafting
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

// mulligan
const MulliganSchema = z.object({
	type: z.literal("mulligan"),
	redraw: z.boolean(),
});

// rps
const RpsChoiceSchema = z.object({
	type: z.literal("rps_choice"),
	choice: z.enum(["rock", "paper", "scissors"]),
});

// active turn

const PlayMoveSchema = z.object({
	type: z.literal("play_move"),
	moveId: z.string(),
	targetCrewSlot: z.number().int().min(0).max(2).optional(),
	targetAllySlot: z.number().int().min(0).max(2).optional(),
	targetPlayerId: z.string().optional(),
});

// strike targets an enemy crew; unturn targets the player's own face-up crew
const DeclareClassActionSchema = z.object({
	type: z.literal("declare_class_action"),
	action: z.enum(["strike", "collect", "unturn"]),
	targetCrewSlot: z.number().int().min(0).max(2).optional(),
	targetAllySlot: z.number().int().min(0).max(1).optional(),
	targetPlayerId: z.string().optional(),
});

// handles both The Razor and The Dealer
const UseBossCommandSchema = z.object({
	type: z.literal("use_boss_command"),
	guessClass: z.enum(["striker", "blocker", "collector", "turner"]).optional(),
	targetCrewSlot: z.number().int().min(0).max(1).optional(),
	targetAllySlot: z.number().int().min(0).max(1).optional(),
	reserveCrewId: z.string().optional(),
	targetPlayerId: z.string().optional(),
});

const UseBossSkillSchema = z.object({
	type: z.literal("use_boss_skill"),
	targetCrewSlot: z.number().int().min(0).max(1),
	targetPlayerId: z.string().optional(),
});

const EndTurnSchema = z.object({
	type: z.literal("end_turn"),
});

// challenge / response windows

const ChallengeSchema = z.object({
	type: z.literal("challenge"),
});

const BlockSchema = z.object({
	type: z.literal("block"),
});

const PassChallengeSchema = z.object({
	type: z.literal("pass_challenge"),
});

// move chain window

// burst resolves instantly and never enters the stack; slow moves are pushed
// two consecutive passes from both participants trigger lifo resolution
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

// block declared, the original striker accepts or counter-challenges the block
const AcceptBlockSchema = z.object({
	type: z.literal("accept_block"),
});

const ChallengeBlockSchema = z.object({
	type: z.literal("challenge_block"),
});

// sub-action responses (pending interaction resolutions)

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

// Empty The Clip: player picks how many cards (0..maxCount) to discard
const ResolveChooseDiscardCountSchema = z.object({
	type: z.literal("resolve_choose_discard_count"),
	count: z.number().int().min(0),
});

// Take It Back: player picks one card from their own discard pile
const ResolveChooseFromDiscardSchema = z.object({
	type: z.literal("resolve_choose_from_discard"),
	cardId: z.string(),
});

// Dig Deep: player picks one of the revealed top-of-deck cards to draw
const ResolveDigDeepPickSchema = z.object({
	type: z.literal("resolve_dig_deep_pick"),
	cardId: z.string(),
});

// Switch Up: player picks one face-up slot to unturn and a DIFFERENT
// face-down slot to turn, in the same action
const ResolveSwitchUpPickSchema = z.object({
	type: z.literal("resolve_switch_up_pick"),
	unturnSlot: z.number().int().min(0).max(1),
	turnSlot: z.number().int().min(0).max(1),
});

// Tactical Support: actor optionally unturns one of the target ally's
// face-up Crew. slot is omitted/undefined when the actor declines
const ResolveTacticalSupportUnturnOfferSchema = z.object({
	type: z.literal("resolve_tactical_support_unturn_offer"),
	slot: z.number().int().min(0).max(1).optional(),
});

// Bear Bones: optional bonus strike after a successful challenge call
const ResolveBearBonesBonusStrikeSchema = z.object({
	type: z.literal("resolve_bear_bones_bonus_strike"),
	confirmed: z.boolean(),
	targetPlayerId: z.string().optional(),
	targetCrewSlot: z.number().int().min(0).max(1).optional(),
});

// Too Big: once-per-game optional self-unturn after a successful challenge
// call. Pure yes/no, the only eligible target is Too Big's own slot
const ResolveTooBigUnturnOfferSchema = z.object({
	type: z.literal("resolve_too_big_unturn_offer"),
	confirmed: z.boolean(),
});

// Void Legs: at start of turn, actor may discard 1 card for 5 damage
const ResolveVoidLegsChoiceSchema = z.object({
	type: z.literal("resolve_void_legs_choice"),
	confirmed: z.boolean(),
});

// Background Check: before a challenge resolves, the CHALLENGER declares
// the class of one of the challenged player's face-down Crew slots
const ResolveBackgroundCheckGuessSchema = z.object({
	type: z.literal("resolve_background_check_guess"),
	targetCrewSlot: z.number().int().min(0).max(1),
	guessClass: z.enum(["striker", "blocker", "collector", "turner"]),
});

// The Watcher passive: optional unturn offer to the challenger after they
// win a challenge. slot omitted/undefined when the actor declines
const ResolveWatcherUnturnOfferSchema = z.object({
	type: z.literal("resolve_watcher_unturn_offer"),
	slot: z.number().int().min(0).max(1).optional(),
});

// Handles: card text is "you may turn one [face-up ally Crew] face down"
// slot omitted/undefined when the actor declines, same optional-response
// shape as ResolveWatcherUnturnOfferSchema and
// ResolveTacticalSupportUnturnOfferSchema
const ResolveHandlesUnturnOfferSchema = z.object({
	type: z.literal("resolve_handles_unturn_offer"),
	slot: z.number().int().min(0).max(1).optional(),
});

const ResolveLighthouseDisablePickSchema = z.object({
	type: z.literal("resolve_lighthouse_disable_pick"),
	targetPlayerId: z.string(),
	crewSlot: z.number().int().min(0).max(1),
});

// Tag Out: actor picks one of their own Crew slots and one of a teammate's
// Crew slots to swap (teams mode only)
const ResolveTagOutPickSchema = z.object({
	type: z.literal("resolve_tag_out_pick"),
	ownSlot: z.number().int().min(0).max(1),
	teammateSlot: z.number().int().min(0).max(1),
});

// Truth Serum: the TARGET (not the actor) picks which of their own
// face-down Crew slots to reveal
const ResolveTruthSerumRevealSchema = z.object({
	type: z.literal("resolve_truth_serum_reveal"),
	crewSlot: z.number().int().min(0).max(1),
});

// combined discriminated union - every player action is validated by zod before the engine's onAction handler receives it
export const FaceturnsActionSchema = z.discriminatedUnion("type", [
	// draft
	SelectBossSchema,
	SelectCrewSchema,
	DeselectCrewSchema,
	SelectMoveSchema,
	DeselectMoveSchema,
	LockDraftSchema,
	// mulligan
	MulliganSchema,
	// rps
	RpsChoiceSchema,
	// active turn
	PlayMoveSchema,
	DeclareClassActionSchema,
	UseBossCommandSchema,
	UseBossSkillSchema,
	EndTurnSchema,
	// challenge windows
	ChallengeSchema,
	BlockSchema,
	PassChallengeSchema,
	// move chain window
	ChainPlayBurstSchema,
	ChainPlaySlowSchema,
	ChainPassSchema,
	// block challenge
	AcceptBlockSchema,
	ChallengeBlockSchema,
	// sub-action responses
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
	ResolveTooBigUnturnOfferSchema,
	ResolveVoidLegsChoiceSchema,
	ResolveBackgroundCheckGuessSchema,
	ResolveWatcherUnturnOfferSchema,
	ResolveTagOutPickSchema,
	ResolveTruthSerumRevealSchema,
	ResolveLighthouseDisablePickSchema,
	ResolveHandlesUnturnOfferSchema,
]);

export type FaceturnsAction = z.infer<typeof FaceturnsActionSchema>;