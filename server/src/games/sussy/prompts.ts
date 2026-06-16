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
		{ crew: "Raise your hand if you've cheated on an academic exam" },
		{ crew: "Raise your hand if you've avoided paying on a public commute" },
		{ crew: "Raise your hand if you've ever worn panties" },
		{ crew: "Raise your hand if you're wearing a bra" },
		{ crew: "Raise your hand if you've ever farted in public" },
		{
			crew: "Raise your hand if you've ever gone outside in public with no underwear",
		},
		{ crew: "Raise your hand if you haven't showered today" },
		{ crew: "Raise your hand if broken a device/gadget from a rage quit" },
		{ crew: "Raise your hand if you've ever gone 3 days without showering" },
		{ crew: "Raise your hand if you've ever lied to sneak out of the house" },
		{ crew: "Raise your hand if you have a secret social media account" },
		{ crew: "Raise your hand if you've ever stalked someone on social media" },
		{ crew: "Raise your hand if you've ever been bitten by an animal before" },
		{ crew: "Raise your hand if you're willing to go vegan for a week" },
		{
			crew: "Raise your hand if you're willing to go without social media for a year",
		},
		{
			crew: "Raise your hand if you're willing to go a year without your phone",
		},
		{
			crew: "Raise your hand if you've ever hit yourself while opening a door in public",
		},
		{ crew: "Raise your hand if you've ever played a musical instrument" },
		{
			crew: "Raise your hand if you've ever worn clothing backwards in public",
		},
		{
			crew: "Raise your hand if you've ever held an actual, deep conversation with an AI (Not just questions)",
		},
		{
			crew: "Raise your hand if you've ever sent a risky chat to the wrong person",
		},
		{
			crew: "Raise your hand if you've ever deleted a post because there weren't enough reactions",
		},
		{
			crew: "Raise your hand if you've ever acted out of character because of a crush",
		},
	],
	finger_pointing: [
		{ crew: "Point at the person who sucks the most at video games" },
		{ crew: "Point at the person who'd make for the best parent" },
		{ crew: "Point at the person who'd make for the worst parent" },
		{ crew: "Point at the person most likely to be the last to get a j*b" },
		{ crew: "Point at the person most likely to be an NBA player" },
		{ crew: "Point at the person that's asleep most of the time" },
		{ crew: "Point at the person with the most unhealthy lifestyle" },
		{
			crew: "Point at the person that's most likely to crash out over nothing",
		},
		{ crew: "Point at the person that's most likely to go missing" },
		{ crew: "Point at the person you'd most trust with your money" },
		{ crew: "Point at the person who'd fall for an Instagram thot bot" },
		{ crew: "Point at the person most likely to have an erotic body pillow" },
		{ crew: "Point at the person most likely to get cancelled" },
		{ crew: "Point at the person most likely to get arrested first" },
		{ crew: "Point at the zestiest person" },
		{ crew: "Point at the person most likely to be a supervillain" },
		{ crew: "Point at the person who dies first in a horror movie" },
		{
			crew: "Point at the person who's most likely to survive a zombie apocalypse",
		},
		{
			crew: "Point at the person who'd be eaten first when stranded in a deserted island",
		},
		{ crew: "Point at the best person to fight a gorilla" },
		{
			crew: 'Point at the person who\'s the biggest "sore loser" when playing games',
		},
		{
			crew: "Point at the person who'd most likely cry over a movie or TV show",
		},
		{
			crew: "Point at the person who's most qualified to be an Avenger (Marvel)",
		},
		{ crew: "Point at the person who'd most likely leave the friend group" },
		{
			crew: "Point at the person who'd make the best scout leader in a camping situation",
		},
		{ crew: "Point at the person who'd be a the group's tank" },
		{ crew: "Point at the person who'd die for the stupidest reasons" },
		{
			crew: "Point at the person who'd have a romantic relationship with an AI",
		},
		{ crew: "Point at the person who's most likely to crossdress" },
		{
			crew: "Point at the person who'd be the biggest threat if the friend group had to fight them",
		},
		{
			crew: "Point at the person who'd get eliminated first in the friend group free-for-all",
		},
		{ crew: "Point at the person who's most likely to fall for ragebait" },
		{ crew: "Point at the person who'd land a role in Hollywood" },
		{ crew: "Point at the person who'd be the best impostor" },
		{
			crew: "Point at the person who'd spend all their money on something stupid",
		},
		{
			crew: "Point at the person who'd most likely break something on accident",
		},
		{
			crew: "Point at the person who'd most likely have the most hours played in an erotic game",
		},
		{
			crew: "Point at the person who's in danger of getting traded away from the friend group",
		},
		{ crew: "Point at the person who'd have the most embarassing photos" },
	],
	finger_blast: [
		{ crew: "How many pets do you have?" },
		{ crew: "How many relationships have you had?" },
		{ crew: "How many siblings do you have?" },
		{ crew: "How many social media apps do you use?" },
		{ crew: "How many times do you brush your teeth in a day?" },
		{
			crew: 'How many "batang pasaways" can you beat in a fight? (One-by-one, no rests in between)',
		},
		{ crew: "How many times do you pray in a day?" },
	],
	thumb_shot: [
		{ crew: ["Ube or Mango?", "Dogs or Cats?", "Early bird or Night owl?"] },
	],
	face_turn: [
		{ crew: "A face you'd make when you're pooping" },
		{ crew: "A face you'd make when Lebron James takes you out for dinner" },
		{ crew: "A face you'd make when you know someone's capping" },
		{
			crew: "A face you'd make when a teacher is crying in front of the class",
		},
		{
			crew: "A face you'd make when you stumble upon a fat stack of cash in the street",
		},
		{ crew: "A face you'd make during church" },
		{ crew: "A face you'd make when the waiter hands you your food" },
		{ crew: "A face you'd make when you're cheering up a baby" },
		{
			crew: "A face you'd make when a person cuts in front of you in the line",
		},
		{ crew: "A face you'd make when PE class has a dancing activity" },
		{ crew: "A face you'd make when you have to commute to classes" },
		{ crew: "A face you'd make when someone walks in on you naked" },
		{ crew: "A face you'd make when you've been drafted to the military" },
		{ crew: "A face you'd make when you've gone bankrupt" },
		{ crew: "A face you'd make when you're swimming" },
		{ crew: "A face you'd make when you farted in public" },
		{ crew: "A face you'd make when your stomach is hurting" },
		{ crew: "A face you'd make when you Lebron James is retiring" },
		{ crew: "A face you'd make when the waiter got your order wrong" },
		{ crew: "A face you'd make for your yearbook picture" },
		{ crew: "A face you'd make when you finally get your first j*b" },
		{ crew: "A face you'd make when you're trying to hold in a laugh" },
		{ crew: "A face you'd make in the middle of a heatwave" },
		{ crew: "A face you'd make when you get a brain freeze" },
		{
			crew: "A face you'd make when a stranger is sneaking looks at your phone",
		},
		{ crew: "A face you'd make when you're falling from a high place" },
		{ crew: "A face you'd make to ragebait" },
		{
			crew: "A face you'd make when you prove you're right after being told you were wrong",
		},
		{ crew: "A face you'd make when someone's been yapping for too long" },
		{ crew: "A face you'd make when the group chat gets leaked" },
		{ crew: "A face you'd make during the dinner prayer" },
		{ crew: "A face you'd make when you realize your phone is missing" },
		{ crew: "A face you'd make when the 10/10 walks past you" },
		{
			crew: "A face you'd make when the gorilla crushes the skull of the first person in the 1 v 100",
		},
		{ crew: "A face you'd make when you wake up buried alive" },
		{ crew: "A face you'd make if you were acting dead" },
		{
			crew: "A face you'd make when you pull an Ultra-Rare on the first gacha pull",
		},
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
