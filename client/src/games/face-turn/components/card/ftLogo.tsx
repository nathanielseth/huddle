import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;

export function FaceTurnLogo(props: IconProps) {
	return (
		<svg
			viewBox="0 0 1000 1000"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
			focusable="false"
			fill="currentColor"
			{...props}
		>
			<defs>
				<path
					id="ft-logo"
					d="M680 120c-30-60-280-60-280 160v140c0 60-120 75-290 80h310v120l80-130V220c0-40 80-100 180-100"
				/>
			</defs>

			<use href="#ft-logo" />
			<use href="#ft-logo" transform="rotate(180 500 500)" />
		</svg>
	);
}