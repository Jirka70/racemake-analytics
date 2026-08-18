import { useEffect, useState } from "react";

// The full desktop workspace needs room for the lap strip, chart stack and
// coaching rail at the same time. Keep tablet and narrow-laptop widths on the
// compact composition instead of squeezing desktop controls until they wrap.
export const COMPACT_ANALYSIS_MAX_WIDTH_PX = 1279;

const COMPACT_ANALYSIS_LAYOUT_QUERY = `(max-width: ${COMPACT_ANALYSIS_MAX_WIDTH_PX}px)`;

export function isCompactAnalysisViewport(viewportWidthPx: number): boolean {
	return viewportWidthPx <= COMPACT_ANALYSIS_MAX_WIDTH_PX;
}

export function useCompactAnalysisLayout(): boolean {
	const [isCompact, setIsCompact] = useState(() =>
		globalThis.matchMedia
			? globalThis.matchMedia(COMPACT_ANALYSIS_LAYOUT_QUERY).matches
			: false,
	);

	useEffect(() => {
		const mediaQuery = globalThis.matchMedia?.(COMPACT_ANALYSIS_LAYOUT_QUERY);
		if (!mediaQuery) return;

		function updateLayout(): void {
			setIsCompact(mediaQuery.matches);
		}

		updateLayout();
		mediaQuery.addEventListener("change", updateLayout);

		return () => mediaQuery.removeEventListener("change", updateLayout);
	}, []);

	return isCompact;
}
