import type { LapFragmentPresentation } from "./lap-fragment-presentation";
import type { TelemetryViewport } from "./telemetry-viewport";

export interface VisibleFragmentCoverageSegment {
	readonly startPercent: number;
	readonly endPercent: number;
}

export function createVisibleUnrecordedSegments(
	fragment: LapFragmentPresentation,
	viewport: TelemetryViewport,
): readonly VisibleFragmentCoverageSegment[] {
	const missingRanges = createMissingRanges(fragment);
	const viewportSpan = viewport.endPercent - viewport.startPercent;
	if (viewportSpan <= 0) return [];

	return missingRanges.flatMap((range) => {
		const globalStart = range.startPosition * 100;
		const globalEnd = range.endPosition * 100;
		const visibleStart = Math.max(globalStart, viewport.startPercent);
		const visibleEnd = Math.min(globalEnd, viewport.endPercent);
		if (visibleEnd <= visibleStart) return [];

		return [
			{
				startPercent:
					((visibleStart - viewport.startPercent) / viewportSpan) * 100,
				endPercent: ((visibleEnd - viewport.startPercent) / viewportSpan) * 100,
			},
		];
	});
}

export function findVisibleFragmentBoundary(
	position: number,
	viewport: TelemetryViewport,
): number | null {
	const positionPercent = position * 100;
	if (
		positionPercent < viewport.startPercent ||
		positionPercent > viewport.endPercent
	) {
		return null;
	}

	const viewportSpan = viewport.endPercent - viewport.startPercent;
	if (viewportSpan <= 0) return null;

	return ((positionPercent - viewport.startPercent) / viewportSpan) * 100;
}

function createMissingRanges(fragment: LapFragmentPresentation): readonly {
	readonly startPosition: number;
	readonly endPosition: number;
}[] {
	const ranges = [...fragment.capturedRanges].sort(
		(first, second) => first.startPosition - second.startPosition,
	);
	const missingRanges: Array<{
		readonly startPosition: number;
		readonly endPosition: number;
	}> = [];
	let cursor = 0;

	for (const range of ranges) {
		if (range.startPosition > cursor) {
			missingRanges.push({
				startPosition: cursor,
				endPosition: range.startPosition,
			});
		}
		cursor = Math.max(cursor, range.endPosition);
	}

	if (cursor < 1) {
		missingRanges.push({ startPosition: cursor, endPosition: 1 });
	}

	return missingRanges;
}
