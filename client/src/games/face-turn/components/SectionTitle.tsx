export function SectionTitle({ children }: { children: React.ReactNode }) {
	return (
		<span className="text-[9px] font-black tracking-widest uppercase text-white/25">
			{children}
		</span>
	);
}