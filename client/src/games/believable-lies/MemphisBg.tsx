export function MemphisBg() {
	return (
		<div className="bl-memphis" aria-hidden="true">
			<svg
				width="100%"
				height="100%"
				viewBox="0 0 390 844"
				preserveAspectRatio="xMidYMid slice"
				xmlns="http://www.w3.org/2000/svg"
				style={{ opacity: 0.13 }}
			>
				{/* Top zone */}
				<circle
					cx="350"
					cy="55"
					r="32"
					stroke="#FF3CAC"
					strokeWidth="3.5"
					fill="none"
				/>
				<circle cx="18" cy="170" r="18" fill="#FFE600" />
				<rect
					x="270"
					y="130"
					width="22"
					height="22"
					fill="#00F5FF"
					transform="rotate(32 281 141)"
				/>
				<path d="M8 290 L30 268 L52 290 Z" fill="#FF6B6B" />
				<path
					d="M140 40 Q165 18 190 40 Q215 62 240 40"
					stroke="#FFE600"
					strokeWidth="2.5"
					fill="none"
				/>
				<circle cx="185" cy="120" r="7" fill="#FF3CAC" />

				{/* Mid-upper zone */}
				<circle cx="362" cy="310" r="13" fill="#00FF94" />
				<path
					d="M290 390 Q312 368 334 390 Q356 412 378 390"
					stroke="#FF3CAC"
					strokeWidth="3"
					fill="none"
				/>
				<path
					d="M0 445 Q22 423 44 445 Q66 467 88 445"
					stroke="#FFE600"
					strokeWidth="3"
					fill="none"
				/>
				<rect
					x="12"
					y="490"
					width="18"
					height="18"
					fill="#6B10CC"
					transform="rotate(45 21 499)"
				/>

				{/* Mid zone */}
				<circle
					cx="355"
					cy="540"
					r="24"
					stroke="#00F5FF"
					strokeWidth="3"
					fill="none"
				/>
				<path d="M45 615 L68 592 L91 615 Z" fill="#FF3CAC" />
				<circle cx="8" cy="670" r="14" fill="#FFE600" />
				<path
					d="M305 695 Q327 673 349 695 Q371 717 393 695"
					stroke="#00FF94"
					strokeWidth="3"
					fill="none"
				/>

				{/* Lower zone */}
				<rect
					x="255"
					cy="752"
					width="16"
					height="16"
					fill="#FF6B6B"
					transform="rotate(22 263 760)"
				/>
				<circle
					cx="38"
					cy="810"
					r="26"
					stroke="#6B10CC"
					strokeWidth="3"
					fill="none"
				/>
				<path
					d="M110 748 Q132 726 154 748 Q176 770 198 748"
					stroke="#00F5FF"
					strokeWidth="2.5"
					fill="none"
				/>
				<circle
					cx="200"
					cy="835"
					r="15"
					stroke="#FF3CAC"
					strokeWidth="2.5"
					fill="none"
				/>

				{/* Scattered dots */}
				<circle cx="310" cy="180" r="5" fill="#00FF94" />
				<circle cx="72" cy="375" r="4" fill="#FF3CAC" />
				<circle cx="328" cy="625" r="6" fill="#FFE600" />
				<circle cx="95" cy="730" r="5" fill="#00F5FF" />
				<circle cx="200" cy="270" r="4" fill="#FF6B6B" />

				{/* Triangle accents */}
				<path d="M340 430 L358 405 L376 430 Z" fill="#FFE600" opacity="0.7" />
				<path d="M5  540 L22  518 L39  540 Z" fill="#00F5FF" opacity="0.7" />
				<path d="M165 790 L183 768 L201 790 Z" fill="#FF3CAC" opacity="0.7" />

				{/* Plus / cross marks */}
				<g stroke="#FF3CAC" strokeWidth="2.5" opacity="0.6">
					<line x1="80" y1="210" x2="80" y2="226" />
					<line x1="72" y1="218" x2="88" y2="218" />
				</g>
				<g stroke="#FFE600" strokeWidth="2.5" opacity="0.6">
					<line x1="330" y1="490" x2="330" y2="506" />
					<line x1="322" y1="498" x2="338" y2="498" />
				</g>
				<g stroke="#00F5FF" strokeWidth="2.5" opacity="0.5">
					<line x1="180" y1="640" x2="180" y2="656" />
					<line x1="172" y1="648" x2="188" y2="648" />
				</g>

				{/* Squiggle lines */}
				<path
					d="M0 580 Q10 570 20 580 Q30 590 40 580 Q50 570 60 580"
					stroke="#6B10CC"
					strokeWidth="2.5"
					fill="none"
					opacity="0.8"
				/>
				<path
					d="M310 760 Q320 750 330 760 Q340 770 350 760 Q360 750 370 760"
					stroke="#FF3CAC"
					strokeWidth="2.5"
					fill="none"
					opacity="0.8"
				/>
			</svg>
		</div>
	);
}