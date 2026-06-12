import { useState, useEffect } from "react";

const QUERY = "(pointer: coarse)";

function getIsMobile(): boolean {
	if (typeof window === "undefined") return false;
	return window.matchMedia(QUERY).matches;
}

export function useIsMobile(): boolean {
	const [isMobile, setIsMobile] = useState(getIsMobile);

	useEffect(() => {
		const mql = window.matchMedia(QUERY);
		const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
		mql.addEventListener("change", handler);
		return () => mql.removeEventListener("change", handler);
	}, []);

	return isMobile;
}