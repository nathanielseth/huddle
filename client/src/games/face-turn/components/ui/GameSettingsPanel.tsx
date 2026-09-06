import {
	AUDIO_VOLUME_DEFAULT,
	AUDIO_VOLUME_MAX,
	AUDIO_VOLUME_MIN,
	CARD_SIZE_DEFAULT,
	CARD_SIZE_MAX,
	CARD_SIZE_MIN,
	useGameSettingsStore,
} from "../../../../lib/settings/gameSettings";
import { SettingsSliderRow } from "./SettingsSliderRow";

function MonitorIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			className="w-3.5 h-3.5"
			fill="none"
			stroke="currentColor"
			strokeWidth={2.2}
		>
			<rect x={3} y={4} width={18} height={13} rx={2} />
			<path d="M8 21h8M12 17v4" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

function SpeakerIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			className="w-3.5 h-3.5"
			fill="none"
			stroke="currentColor"
			strokeWidth={2.2}
		>
			<path
				d="M4 9v6h4l5 4V5L8 9H4z"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M16.5 8.5a5 5 0 010 7"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

export function GameSettingsPanel() {
	const cardSizePct = useGameSettingsStore((s) => s.cardSizePct);
	const setCardSizePct = useGameSettingsStore((s) => s.setCardSizePct);
	const audioVolumePct = useGameSettingsStore((s) => s.audioVolumePct);
	const setAudioVolumePct = useGameSettingsStore((s) => s.setAudioVolumePct);

	return (
		<div className="flex flex-col gap-3 p-3 w-72">
			<div className="flex flex-col gap-1">
				<span className="text-[9px] font-black uppercase tracking-widest text-white/30">
					Game settings
				</span>
				<span className="text-[10px] text-white/35 leading-snug">
					Personal preferences, saved on this device.
				</span>
			</div>

			<SettingsSliderRow
				icon={<MonitorIcon />}
				label="Card size"
				value={cardSizePct}
				valueLabel={`${cardSizePct}%`}
				min={CARD_SIZE_MIN}
				max={CARD_SIZE_MAX}
				step={5}
				minCaption="Smaller"
				midCaption="Default"
				maxCaption="Larger"
				onChange={setCardSizePct}
			/>

			<SettingsSliderRow
				icon={<SpeakerIcon />}
				label="Sound effects"
				value={audioVolumePct}
				valueLabel={`${audioVolumePct}%`}
				min={AUDIO_VOLUME_MIN}
				max={AUDIO_VOLUME_MAX}
				step={5}
				minCaption="Muted"
				midCaption="Default"
				maxCaption="Louder"
				onChange={setAudioVolumePct}
			/>

			<button
				type="button"
				disabled={
					cardSizePct === CARD_SIZE_DEFAULT &&
					audioVolumePct === AUDIO_VOLUME_DEFAULT
				}
				onClick={() => {
					setCardSizePct(CARD_SIZE_DEFAULT);
					setAudioVolumePct(AUDIO_VOLUME_DEFAULT);
				}}
				className="self-start px-2 py-1 -mt-1 rounded text-[10px] font-bold uppercase tracking-widest text-white/35 hover:text-white/70 hover:bg-white/5 disabled:opacity-0 disabled:pointer-events-none transition-all cursor-pointer"
			>
				Reset to default
			</button>
		</div>
	);
}