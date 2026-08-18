import type {
	DetectedLapEligibilityResult,
	LapEligibilityReason,
} from "../analytics/lap-detect/lap-detect-types";
import type { TelemetryAuditPipelineResult } from "./telemetry-audit-pipeline";

export const MINIMUM_RACING_LAPS = 2;

export type AnalysisUsabilityStatus = "usable" | "unavailable";

export type AnalysisUsabilitySeverity = "none" | "limitation" | "blocking";

export type AnalysisCapability =
	| "lap-comparison"
	| "region-comparison"
	| "ideal-lap"
	| "coaching";

export interface RejectedLap {
	readonly lapNumber: number;
	readonly reasons: readonly LapEligibilityReason[];
}

export interface TimelineDiscontinuityEvidence {
	readonly type: "sampling-gap" | "timestamp-regression";
	readonly fromTimestampMs: number;
	readonly toTimestampMs: number;
	readonly durationMs: number;
	readonly affectedLapNumber?: number;
}

export interface AnalysisUsabilityReasonDefinitionMap {
	readonly USABLE_TIMELINE_UNAVAILABLE: {
		readonly severity: "blocking";
		readonly evidence: Record<string, never>;
	};
	readonly NO_COMPLETE_LAPS: {
		readonly severity: "blocking";
		readonly evidence: {
			readonly detectedCrossingCount: number;
		};
	};
	readonly POSITION_GRID_UNAVAILABLE: {
		readonly severity: "blocking";
		readonly evidence: Record<string, never>;
	};
	readonly INSUFFICIENT_RACING_LAPS: {
		readonly severity: "blocking";
		readonly evidence: {
			readonly detectedLapCount: number;
			readonly racingLapCount: number;
			readonly requiredRacingLapCount: number;
			readonly rejectedLaps: readonly RejectedLap[];
		};
	};
	readonly TIMELINE_DISCONTINUITIES: {
		readonly severity: AnalysisUsabilitySeverity;
		readonly evidence: {
			readonly discontinuities: readonly TimelineDiscontinuityEvidence[];
		};
	};
	readonly LAPS_EXCLUDED_FROM_COMPARISON: {
		readonly severity: "limitation";
		readonly evidence: {
			readonly rejectedLaps: readonly RejectedLap[];
		};
	};
	readonly TRACK_REGIONS_UNAVAILABLE: {
		readonly severity: "limitation";
		readonly evidence: {
			readonly detectedCornerCount: number;
		};
	};
	readonly COACHING_DETECTOR_FAILURES: {
		readonly severity: "limitation";
		readonly evidence: {
			readonly failureCount: number;
		};
	};
}

export type AnalysisUsabilityReasonCode =
	keyof AnalysisUsabilityReasonDefinitionMap;

export type AnalysisUsabilityReason = {
	readonly [Code in AnalysisUsabilityReasonCode]: Readonly<
		{
			readonly code: Code;
		} & AnalysisUsabilityReasonDefinitionMap[Code]
	>;
}[AnalysisUsabilityReasonCode];

export interface AnalysisUsability {
	readonly status: AnalysisUsabilityStatus;
	readonly primaryReason: AnalysisUsabilityReason | null;
	readonly reasons: readonly AnalysisUsabilityReason[];
	readonly availableCapabilities: readonly AnalysisCapability[];
	readonly unavailableCapabilities: readonly AnalysisCapability[];
}

const ALL_ANALYSIS_CAPABILITIES: readonly AnalysisCapability[] = [
	"lap-comparison",
	"region-comparison",
	"ideal-lap",
	"coaching",
];

const ANALYSIS_USABILITY_SEVERITY_PRIORITY = {
	none: 0,
	limitation: 1,
	blocking: 2,
} as const satisfies Readonly<Record<AnalysisUsabilitySeverity, number>>;

const ANALYSIS_USABILITY_REASON_PRIORITY = {
	USABLE_TIMELINE_UNAVAILABLE: 100,
	NO_COMPLETE_LAPS: 90,
	POSITION_GRID_UNAVAILABLE: 85,
	INSUFFICIENT_RACING_LAPS: 80,
	TIMELINE_DISCONTINUITIES: 70,
	LAPS_EXCLUDED_FROM_COMPARISON: 60,
	TRACK_REGIONS_UNAVAILABLE: 20,
	COACHING_DETECTOR_FAILURES: 10,
} as const satisfies Readonly<Record<AnalysisUsabilityReasonCode, number>>;

const DATA_QUALITY_LAP_REASON_CODES = new Set<LapEligibilityReason["code"]>([
	"BOUNDARY_CONFIDENCE_BELOW_MINIMUM",
	"LAP_TIME_CONFIDENCE_BELOW_MINIMUM",
	"NON_POSITIVE_LAP_TIME",
	"POSITION_COVERAGE_BELOW_MINIMUM",
	"POSITION_HOLE_EXCEEDS_MAXIMUM",
	"SAMPLING_GAP_WITHIN_LAP",
	"MOVEMENT_OBSERVATION_BELOW_MINIMUM",
]);

export function findAnalysisUsability(
	analysis: TelemetryAuditPipelineResult,
): AnalysisUsability {
	const reasons = orderAnalysisUsabilityReasons(
		findAnalysisUsabilityReasons(analysis),
	);
	const status = findAnalysisUsabilityStatus(reasons);
	const unavailableCapabilities = findUnavailableAnalysisCapabilities(
		status,
		reasons,
	);
	const unavailableCapabilitySet = new Set(unavailableCapabilities);
	const availableCapabilities = ALL_ANALYSIS_CAPABILITIES.filter(
		(capability) => !unavailableCapabilitySet.has(capability),
	);

	return {
		status,
		primaryReason: reasons.find(({ severity }) => severity !== "none") ?? null,
		reasons,
		availableCapabilities,
		unavailableCapabilities,
	};
}

export function findAnalysisUsabilityStatus(
	reasons: readonly AnalysisUsabilityReason[],
): AnalysisUsabilityStatus {
	// Global usability is deliberately binary. Non-blocking limitations remain
	// visible through reasons and capability availability without making an
	// otherwise operable analysis a third, ambiguous status.
	if (reasons.some(({ severity }) => severity === "blocking")) {
		return "unavailable";
	}

	return "usable";
}

function findAnalysisUsabilityReasons(
	analysis: TelemetryAuditPipelineResult,
): readonly AnalysisUsabilityReason[] {
	if (analysis.auditResult.usableTimeline === null) {
		return [
			{
				code: "USABLE_TIMELINE_UNAVAILABLE",
				severity: "blocking",
				evidence: {},
			},
		];
	}

	const timelineReason = findTimelineDiscontinuitiesReason(analysis);
	const detectedLaps = analysis.lapDetectionResult.laps;

	if (detectedLaps.length === 0) {
		return [
			{
				code: "NO_COMPLETE_LAPS",
				severity: "blocking",
				evidence: {
					detectedCrossingCount:
						analysis.lapDetectionResult.lapCrossings.length,
				},
			},
			...(timelineReason === null ? [] : [timelineReason]),
		];
	}

	if (analysis.lapDetectionResult.linearGrid === null) {
		return [
			{
				code: "POSITION_GRID_UNAVAILABLE",
				severity: "blocking",
				evidence: {},
			},
			...(timelineReason === null ? [] : [timelineReason]),
		];
	}

	const reasons: AnalysisUsabilityReason[] = [];
	if (timelineReason !== null) reasons.push(timelineReason);

	const racingLapCount = analysis.coachCallsResult.racingLaps.length;
	const rejectedLaps = findRejectedLaps(analysis);

	if (racingLapCount < MINIMUM_RACING_LAPS) {
		reasons.push({
			code: "INSUFFICIENT_RACING_LAPS",
			severity: "blocking",
			evidence: {
				detectedLapCount: detectedLaps.length,
				racingLapCount,
				requiredRacingLapCount: MINIMUM_RACING_LAPS,
				rejectedLaps,
			},
		});

		return reasons;
	}

	const dataQualityRejectedLaps = rejectedLaps.filter(({ reasons }) =>
		reasons.some(({ code }) => DATA_QUALITY_LAP_REASON_CODES.has(code)),
	);

	if (dataQualityRejectedLaps.length > 0) {
		reasons.push({
			code: "LAPS_EXCLUDED_FROM_COMPARISON",
			severity: "limitation",
			evidence: { rejectedLaps: dataQualityRejectedLaps },
		});
	}

	if (analysis.cornerDetectionResult.corners.length === 0) {
		reasons.push({
			code: "TRACK_REGIONS_UNAVAILABLE",
			severity: "limitation",
			evidence: { detectedCornerCount: 0 },
		});
	}

	const detectorFailureCount =
		analysis.coachCallsResult.coachingPhenomena.detectorFailures.length;

	if (detectorFailureCount > 0) {
		reasons.push({
			code: "COACHING_DETECTOR_FAILURES",
			severity: "limitation",
			evidence: { failureCount: detectorFailureCount },
		});
	}

	return reasons;
}

function findTimelineDiscontinuitiesReason(
	analysis: TelemetryAuditPipelineResult,
): Extract<
	AnalysisUsabilityReason,
	{ readonly code: "TIMELINE_DISCONTINUITIES" }
> | null {
	const detectedLaps = analysis.lapDetectionResult.laps;
	const samplingGaps =
		analysis.auditResult.usableTimeline?.transitions
			.filter(({ timeContinuity }) => timeContinuity === "gap")
			.map(({ previous, current, timestampDeltaMs }) =>
				createTimelineDiscontinuityEvidence(
					"sampling-gap",
					previous.timestampMs,
					current.timestampMs,
					timestampDeltaMs,
					detectedLaps,
				),
			) ?? [];
	const timestampRegressions = analysis.auditResult.timelineTransitions
		.filter(({ relation }) => relation === "timestamp-regression")
		.map(({ previous, current, timestampDeltaMs }) =>
			createTimelineDiscontinuityEvidence(
				"timestamp-regression",
				previous.timestampMs,
				current.timestampMs,
				Math.abs(timestampDeltaMs),
				detectedLaps,
			),
		);
	const discontinuities = [...samplingGaps, ...timestampRegressions].sort(
		(first, second) =>
			first.fromTimestampMs - second.fromTimestampMs ||
			first.toTimestampMs - second.toTimestampMs,
	);

	if (discontinuities.length === 0) return null;

	const affectedLapNumbers = new Set(
		discontinuities.flatMap(({ affectedLapNumber }) =>
			affectedLapNumber === undefined ? [] : [affectedLapNumber],
		),
	);
	const hasRejectedAffectedLap =
		analysis.lapDetectionResult.lapEligibilityResults.some(
			({ lapNumber, eligibility }) =>
				affectedLapNumbers.has(lapNumber) && !eligibility.realRacing.eligible,
		);
	const severity: AnalysisUsabilitySeverity = hasRejectedAffectedLap
		? analysis.coachCallsResult.racingLaps.length < MINIMUM_RACING_LAPS
			? "blocking"
			: "limitation"
		: "limitation";

	return {
		code: "TIMELINE_DISCONTINUITIES",
		severity,
		evidence: { discontinuities },
	};
}

function createTimelineDiscontinuityEvidence(
	type: TimelineDiscontinuityEvidence["type"],
	fromTimestampMs: number,
	toTimestampMs: number,
	durationMs: number,
	laps: TelemetryAuditPipelineResult["lapDetectionResult"]["laps"],
): TimelineDiscontinuityEvidence {
	const affectedLap = laps.find(
		(lap) =>
			fromTimestampMs >= lap.startCrossing.timestampMs &&
			toTimestampMs <= lap.endCrossing.timestampMs,
	);

	return {
		type,
		fromTimestampMs,
		toTimestampMs,
		durationMs,
		...(affectedLap === undefined
			? {}
			: { affectedLapNumber: affectedLap.lapNumber }),
	};
}

function findRejectedLaps(
	analysis: TelemetryAuditPipelineResult,
): readonly RejectedLap[] {
	return analysis.lapDetectionResult.lapEligibilityResults
		.filter(({ eligibility }) => !eligibility.realRacing.eligible)
		.map((result) => ({
			lapNumber: result.lapNumber,
			reasons: findConcreteLapEligibilityReasons(result),
		}));
}

function findConcreteLapEligibilityReasons(
	result: DetectedLapEligibilityResult,
): readonly LapEligibilityReason[] {
	return result.eligibility.realRacing.reasons;
}

function orderAnalysisUsabilityReasons(
	reasons: readonly AnalysisUsabilityReason[],
): readonly AnalysisUsabilityReason[] {
	return [...reasons].sort(
		(first, second) =>
			ANALYSIS_USABILITY_SEVERITY_PRIORITY[second.severity] -
				ANALYSIS_USABILITY_SEVERITY_PRIORITY[first.severity] ||
			ANALYSIS_USABILITY_REASON_PRIORITY[second.code] -
				ANALYSIS_USABILITY_REASON_PRIORITY[first.code],
	);
}

function findUnavailableAnalysisCapabilities(
	status: AnalysisUsabilityStatus,
	reasons: readonly AnalysisUsabilityReason[],
): readonly AnalysisCapability[] {
	if (status === "unavailable") return ALL_ANALYSIS_CAPABILITIES;

	const unavailableCapabilities = new Set<AnalysisCapability>();
	if (reasons.some(({ code }) => code === "TRACK_REGIONS_UNAVAILABLE")) {
		unavailableCapabilities.add("region-comparison");
		unavailableCapabilities.add("ideal-lap");
		unavailableCapabilities.add("coaching");
	}

	return ALL_ANALYSIS_CAPABILITIES.filter((capability) =>
		unavailableCapabilities.has(capability),
	);
}
