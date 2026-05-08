interface ShowOfHandsPrompt {
	crew: string;
}
interface FingerPointingPrompt {
	crew: string;
}
interface FingerBlastPrompt {
	crew: string;
}
interface ThumbShotPrompt {
	crew: [string, string, string];
}
interface FaceTurnPrompt {
	crew: string;
}
interface GlitchPrompt {
	crew: [string, string, string];
	impostor: [string, string, string];
}

interface SussyPromptBank {
	show_of_hands: ShowOfHandsPrompt[];
	finger_pointing: FingerPointingPrompt[];
	finger_blast: FingerBlastPrompt[];
	thumb_shot: ThumbShotPrompt[];
	face_turn: FaceTurnPrompt[];
	glitch_in_the_chat: GlitchPrompt[];
}

export const PROMPT_BANK: SussyPromptBank = {
	show_of_hands: [
		{ crew: "Raise your hand if you've" },
	],
	finger_pointing: [
		{ crew: "Point at the person most likely to" },
	],
	finger_blast: [ // holding up fingers
		{
			crew: "How many pets do you have?)",
		},
	],
	thumb_shot: [
		{ crew: ["Ube or Mango?", "Dogs or Cats?", "Early bird or Night owl?"] },
	],
	face_turn: [
		{ crew: "Make a face when ure pooping" },
	],
	glitch_in_the_chat: [
		{
			crew: [
				"What's your most embarrassing moment from high school?",
				"What's a food most people love that you actually hate?",
				"What's the weirdest thing you've ever Googled?",
			],
			impostor: [
				"What's your favorite moment ever?",
				"What's a food you pretend to enjoy but secretly don't?",
				"What's a weird habit you have that nobody knows about?",
			],
		},
	],
};
