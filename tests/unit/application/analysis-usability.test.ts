import { describe, expect, test } from "bun:test";
import {
	findAnalysisUsability,
	findAnalysisUsabilityStatus,
	MINIMUM_RACING_LAPS,
	type AnalysisUsabilityReason,
} from "../../../src/application/analysis-usability";
import type { TelemetryAuditPipelineResult } from "../../../src/application/telemetry-audit-pipeline";
import type { CoachingDetectorFailure } from "../../../src/analytics/coach/phenomena/coaching-phenomenon-types";
import type {
	DetectedLap,
	DetectedLapEligibilityResult,
	LapEligibilityReason,
} from "../../../src/analytics/lap-detect/lap-detect-types";

describe("analysis usability", () => {
	test("marks only a blocking reason as globally unavailable", () => {
		const informationalReason: AnalysisUsabilityReason = {
			code: "TIMELINE_DISCONTINUITIES",
			severity: "none",
			evidence: { discontinuities: [] },
		};
		const limitationReason: AnalysisUsabilityReason = {
			code: "TRACK_REGIONS_UNAVAILABLE",
			severity: "limitation",
			evidence: { detectedCornerCount: 0 },
		};
		const blockingReason: AnalysisUsabilityReason = {
			code: "NO_COMPLETE_LAPS",
			severity: "blocking",
			evidence: { detectedCrossingCount: 1 },
		};

		expect(findAnalysisUsabilityStatus([])).toBe("usable");
		expect(findAnalysisUsabilityStatus([informationalReason])).toBe("usable");
		expect(
			findAnalysisUsabilityStatus([informationalReason, limitationReason]),
		).toBe("usable");
		expect(
			findAnalysisUsabilityStatus([limitationReason, blockingReason]),
		).toBe("unavailable");
	});

	test("blocks every analysis capability without a usable timeline", () => {
		const usability = findAnalysisUsability(
			createAnalysis({
				hasUsableTimeline: false,
			}),
		);

		expect(usability.status).toBe("unavailable");
		expect(usability.primaryReason?.code).toBe("USABLE_TIMELINE_UNAVAILABLE");
		expect(usability.availableCapabilities).toEqual([]);
		expect(usability.unavailableCapabilities).toEqual([
			"lap-comparison",
			"region-comparison",
			"ideal-lap",
			"coaching",
		]);
	});

	test("reports the required lap count when comparison is impossible", () => {
		const rejectedReason: LapEligibilityReason = {
			code: "BOUNDARY_CONFIDENCE_BELOW_MINIMUM",
			observedValue: 0.4,
			requiredMinimum: 0.5,
		};
		const usability = findAnalysisUsability(
			createAnalysis({
				detectedLapCount: 2,
				racingLapCount: 1,
				rejectedLapReasons: new Map([[2, [rejectedReason]]]),
			}),
		);

		expect(usability.status).toBe("unavailable");
		expect(usability.primaryReason).toEqual({
			code: "INSUFFICIENT_RACING_LAPS",
			severity: "blocking",
			evidence: {
				detectedLapCount: 2,
				racingLapCount: 1,
				requiredRacingLapCount: MINIMUM_RACING_LAPS,
				rejectedLaps: [
					{
						lapNumber: 2,
						reasons: [rejectedReason],
					},
				],
			},
		});
	});

	test("keeps the analysis usable while region-dependent capabilities are unavailable", () => {
		const usability = findAnalysisUsability(
			createAnalysis({
				detectedCornerCount: 0,
			}),
		);

		expect(usability.status).toBe("usable");
		expect(usability.primaryReason?.code).toBe("TRACK_REGIONS_UNAVAILABLE");
		expect(usability.availableCapabilities).toEqual(["lap-comparison"]);
		expect(usability.unavailableCapabilities).toEqual([
			"region-comparison",
			"ideal-lap",
			"coaching",
		]);
	});

	test("keeps the dataset usable when a damaged lap is excluded but comparison remains possible", () => {
		const rejectedReason: LapEligibilityReason = {
			code: "LAP_TIME_CONFIDENCE_BELOW_MINIMUM",
			observedValue: 0.4,
			requiredMinimum: 0.5,
		};
		const usability = findAnalysisUsability(
			createAnalysis({
				detectedLapCount: 3,
				racingLapCount: 2,
				rejectedLapReasons: new Map([[3, [rejectedReason]]]),
			}),
		);

		expect(usability.status).toBe("usable");
		expect(usability.primaryReason).toEqual({
			code: "LAPS_EXCLUDED_FROM_COMPARISON",
			severity: "limitation",
			evidence: {
				rejectedLaps: [
					{
						lapNumber: 3,
						reasons: [rejectedReason],
					},
				],
			},
		});
		expect(usability.unavailableCapabilities).toEqual([]);
	});
});

interface AnalysisFixtureOptions {
	readonly hasUsableTimeline?: boolean;
	readonly detectedLapCount?: number;
	readonly racingLapCount?: number;
	readonly detectedCornerCount?: number;
	readonly rejectedLapReasons?: ReadonlyMap<
		number,
		readonly LapEligibilityReason[]
	>;
	readonly detectorFailures?: readonly CoachingDetectorFailure[];
}

function createAnalysis(
	options: AnalysisFixtureOptions = {},
): TelemetryAuditPipelineResult {
	const detectedLapCount = options.detectedLapCount ?? 2;
	const racingLapCount = options.racingLapCount ?? detectedLapCount;
	const laps = Array.from({ length: detectedLapCount }, (_, index) =>
		createLap(index + 1),
	);
	const racingLaps = laps.slice(0, racingLapCount);
	const lapEligibilityResults = laps.map((lap) =>
		createEligibility(
			lap.lapNumber,
			options.rejectedLapReasons?.get(lap.lapNumber) ?? [],
		),
	);

	return {
		auditResult: {
			usableTimeline:
				options.hasUsableTimeline === false
					? null
					: { frames: [], excludedFrames: [], transitions: [] },
			timelineTransitions: [],
		},
		lapDetectionResult: {
			laps,
			lapCrossings: [],
			linearGrid:
				detectedLapCount === 0
					? null
					: {
							cellCount: 1,
							positionStep: 1,
							positions: [0, 1],
							medianUsablePositionSampleCountPerLap: 1,
						},
			lapEligibilityResults,
		},
		cornerDetectionResult: {
			corners: Array.from(
				{ length: options.detectedCornerCount ?? 1 },
				() => ({}),
			),
		},
		coachCallsResult: {
			racingLaps,
			coachingPhenomena: {
				detectorFailures: options.detectorFailures ?? [],
			},
		},
	} as unknown as TelemetryAuditPipelineResult;
}

function createLap(lapNumber: number): DetectedLap {
	return {
		lapNumber,
		lapTimeMs: 60_000,
		startCrossing: {
			timestampMs: lapNumber * 60_000,
		} as DetectedLap["startCrossing"],
		endCrossing: {
			timestampMs: (lapNumber + 1) * 60_000,
		} as DetectedLap["endCrossing"],
		confidence: {
			boundaryConfidence: 1,
			lapTimeConfidence: 1,
			overallConfidence: 1,
		},
		limitations: [],
	};
}

function createEligibility(
	lapNumber: number,
	reasons: readonly LapEligibilityReason[],
): DetectedLapEligibilityResult {
	const eligible = reasons.length === 0;

	return {
		lapNumber,
		eligibility: {
			timeEligible: { eligible: true, reasons: [] },
			realRacing: { eligible, reasons },
		},
	};
}
