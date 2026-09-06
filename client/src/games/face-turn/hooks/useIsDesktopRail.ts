import { useEffect, useState } from "react";

// matches lg breakpoint used by rail and other ui; mobile layout is a different component tree
const QUERY = "(min-width: 1024px)";

function getIsDesktopRail(): boolean {
	if (typeof window === "undefined") return true;
	return window.matchMedia(QUERY).matches;
}

export function useIsDesktopRail(): boolean {
	const [isDesktop, setIsDesktop] = useState(getIsDesktopRail);

	useEffect(() => {
		const mql = window.matchMedia(QUERY);
		const handler = (e: MediaQueryListEvent) => {
			setIsDesktop(e.matches);
		};
		mql.addEventListener("change", handler);
		return () => {
			mql.removeEventListener("change", handler);
		};
	}, []);

	return isDesktop;
}