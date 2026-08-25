import { describe, expect, test } from "bun:test";
import {
	createLapDataDetails,
	hasLimitedLapTime,
	type LapDataQualityInput,
} from "../../../frontend/src/analysis/lap-data-quality";

describe("lap data quality presentation", () => {
	test("turns uncertain finish evidence into plain-language details", () => {
		const lap = createLimitedLap();

		expect(hasLimitedLapTime(lap)).toBeTrue();
		expect(createLapDataDetails(lap, "1:13.590")).toEqual({
			summary:
				"The recorder missed the exact moment the car crossed the finish line.",
			whatHappened: [
				"250 ms between samples around the finish",
				"Track position jumped from 98.7% to 1.1%",
				"Lap counter did not advance",
			],
			whatThisAffects: [
				"~1:13.590 is shown for review only",
				"Not used for fastest lap or ranking; full-lap delta is approximate",
			],
			stillAvailable: [
				"Recorded telemetry",
				"Recorded sections for manual review",
			],
		});
	});

	test("keeps a verified lap with a sampling gap eligible for timing", () => {
		const lap: LapDataQualityInput = {
			...createLimitedLap(),
			timing: { status: "verified", lapTimeMs: 73_789 },
			usage: {
				telemetryReview: "recorded-sections-only",
				lapTimeComparison: "verified-only",
				lapRanking: "ranked",
				coaching: "supported-regions-only",
			},
		};

		expect(hasLimitedLapTime(lap)).toBeFalse();
	});

	test("explains a possible merged lap without exposing technical confidence", () => {
		const lap: LapDataQualityInput = {
			...createLimitedLap(),
			quality: {
				status: "limited",
				label: "Limited data",
				summary:
					"Recording stopped around start/finish. This duration may contain more than one lap.",
				limitations: [
					{
						code: "SAMPLING_GAP_WITHIN_LAP",
						severity: "warning",
						message:
							"Recording stopped around start/finish. This duration may contain more than one lap.",
						gapStartTimestampMs: 73_400,
						gapEndTimestampMs: 78_292,
						gapDurationMs: 4_892,
						fromPosition: 0.98,
						toPosition: 0.02,
					},
				],
			},
		};

		expect(createLapDataDetails(lap, "2:27.108")).toEqual({
			summary:
				"Recording stopped around start/finish. This duration may contain more than one lap.",
			whatHappened: [
				"Recording stopped around start/finish. This duration may contain more than one lap.",
				"4.9 s without telemetry from 98.0% to 2.0%",
			],
			whatThisAffects: [
				"~2:27.108 is shown for review only",
				"Not used for fastest lap or ranking; full-lap delta is approximate",
			],
			stillAvailable: [
				"Recorded telemetry",
				"Recorded sections for manual review",
			],
		});
	});
});

function createLimitedLap(): LapDataQualityInput {
	return {
		lapNumber: 4,
		timing: { status: "unverified", lapTimeMs: 73_590 },
		quality: {
			status: "limited",
			label: "Limited data",
			summary: "Finish crossing was not captured clearly.",
			limitations: [
				{
					code: "FINISH_BOUNDARY_UNCERTAIN",
					severity: "warning",
					message: "Finish crossing was not captured clearly.",
					boundary: "finish",
					crossingBoundaryConfidence: 0.43,
					lapBoundaryConfidence: 0.43,
					requiredLapBoundaryConfidence: 0.5,
					evidence: {
						fromPosition: 0.987,
						toPosition: 0.011,
						transitionDurationMs: 250,
						lapCounterEvidence: "missing",
						usablePositionRateSamplesBefore: 6,
						usablePositionRateSamplesAfter: 0,
						reasonCodes: [
							"POSITION_INTERPOLATION_SPAN_EXCEEDED",
							"POSITION_RATE_LIMIT_EXCEEDED",
							"LAP_COUNTER_CONFIRMATION_MISSING",
							"LOCAL_POSITION_RATE_CONTEXT_UNAVAILABLE",
						],
					},
				},
			],
		},
		usage: {
			telemetryReview: "recorded-sections-only",
			lapTimeComparison: "excluded",
			lapRanking: "excluded",
			coaching: "none",
		},
		coverage: {
			capturedRatio: 0.989,
			startPosition: 0,
			endPosition: 1,
		},
	};
}
