import type { LapSamplingGapResponse } from "../../../src/http/contracts";
import type { TelemetryViewport } from "./telemetry-viewport";

// Gaps covering at least four percent of a lap are large enough to materially
// affect visual comparison. Smaller gaps remain available in data diagnostics.
export const MINIMUM_VISIBLE_SAMPLING_GAP_RATIO = 0.04;

export interface SamplingGapPositionSegment {
	readonly startPercent: number;
	readonly endPercent: number;
}

export interface VisibleSamplingGapSegment extends SamplingGapPositionSegment {
	readonly gap: LapSamplingGapResponse;
}

export interface LapTelemetryGapSummary {
	readonly visibleGaps: readonly LapSamplingGapResponse[];
	readonly coveragePercent: number;
}

export function calculateSamplingGapRatio(gap: LapSamplingGapResponse): number {
	if (gap.toPosition >= gap.fromPosition) {
		return gap.toPosition - gap.fromPosition;
	}

	return 1 - gap.fromPosition + gap.toPosition;
}

export function findVisibleSamplingGaps(
	gaps: readonly LapSamplingGapResponse[],
	lapNumbers: readonly number[],
): readonly LapSamplingGapResponse[] {
	const selectedLapNumbers = new Set(lapNumbers);

	return gaps.filter(
		(gap) =>
			selectedLapNumbers.has(gap.lapNumber) &&
			calculateSamplingGapRatio(gap) >= MINIMUM_VISIBLE_SAMPLING_GAP_RATIO,
	);
}

export function calculateLapTelemetryCoverageRatio(
	gaps: readonly LapSamplingGapResponse[],
): number {
	const missingRatio = gaps.reduce(
		(total, gap) => total + calculateSamplingGapRatio(gap),
		0,
	);

	return Math.max(0, Math.min(1, 1 - missingRatio));
}

export function createLapTelemetryGapSummary(
	lapNumber: number,
	gaps: readonly LapSamplingGapResponse[],
): LapTelemetryGapSummary {
	const lapGaps = gaps.filter((gap) => gap.lapNumber === lapNumber);

	return {
		visibleGaps: findVisibleSamplingGaps(lapGaps, [lapNumber]),
		coveragePercent: calculateLapTelemetryCoverageRatio(lapGaps) * 100,
	};
}

export function findAvailableComparisonLapNumber(
	gap: LapSamplingGapResponse,
	gaps: readonly LapSamplingGapResponse[],
	selectedLapNumbers: readonly number[],
): number | null {
	const comparisonLapNumber = selectedLapNumbers.find(
		(lapNumber) => lapNumber !== gap.lapNumber,
	);
	if (comparisonLapNumber === undefined) return null;

	const missingOnComparisonLap = gaps
		.filter((candidate) => candidate.lapNumber === comparisonLapNumber)
		.some((candidate) => samplingGapsOverlap(gap, candidate));

	return missingOnComparisonLap ? null : comparisonLapNumber;
}

export function createSamplingGapPositionSegments(
	gap: LapSamplingGapResponse,
): readonly SamplingGapPositionSegment[] {
	const startPercent = gap.fromPosition * 100;
	const endPercent = gap.toPosition * 100;

	if (gap.toPosition >= gap.fromPosition) {
		return [{ startPercent, endPercent }];
	}

	return [
		{ startPercent, endPercent: 100 },
		{ startPercent: 0, endPercent },
	];
}

export function createVisibleSamplingGapSegments(
	gaps: readonly LapSamplingGapResponse[],
	viewport: TelemetryViewport,
): readonly VisibleSamplingGapSegment[] {
	const viewportSpan = viewport.endPercent - viewport.startPercent;
	if (viewportSpan <= 0) return [];

	return gaps.flatMap((gap) =>
		createSamplingGapPositionSegments(gap).flatMap((segment) => {
			const visibleStart = Math.max(
				segment.startPercent,
				viewport.startPercent,
			);
			const visibleEnd = Math.min(segment.endPercent, viewport.endPercent);
			if (visibleEnd <= visibleStart) return [];

			return [
				{
					gap,
					startPercent:
						((visibleStart - viewport.startPercent) / viewportSpan) * 100,
					endPercent:
						((visibleEnd - viewport.startPercent) / viewportSpan) * 100,
				},
			];
		}),
	);
}

function samplingGapsOverlap(
	first: LapSamplingGapResponse,
	second: LapSamplingGapResponse,
): boolean {
	return createSamplingGapPositionSegments(first).some((firstSegment) =>
		createSamplingGapPositionSegments(second).some(
			(secondSegment) =>
				firstSegment.startPercent < secondSegment.endPercent &&
				secondSegment.startPercent < firstSegment.endPercent,
		),
	);
}
