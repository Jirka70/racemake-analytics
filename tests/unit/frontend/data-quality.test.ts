import { describe, expect, test } from "bun:test";
import { createDataQualitySummary } from "../../../frontend/src/analysis/data-quality";
import type { DiagnosticsResponse } from "../../../src/http/contracts";

const DIAGNOSTICS: DiagnosticsResponse = {
	analysisId: "sha256:diagnostics-test",
	sessionId: "diagnostics-test",
	frameAudit: {
		receivedFrameCount: 7_195,
		retainedTimelineFrameCount: 7_195,
		excludedTimelineFrameCount: 0,
		samplingBaseline: {
			medianIntervalMs: 55,
			maximumContinuousIntervalMs: 275,
		},
		issues: [
			createIssue("gap-1", "SAMPLING_GAP", "split-timeline"),
			createIssue("gap-2", "SAMPLING_GAP", "split-timeline"),
			createIssue(
				"outlier-1",
				"LOCAL_OUTLIER",
				"exclude-channel-value",
				["engineRpm", "normalizedTrackPosition"],
			),
		],
		channelDiscontinuities: [
			{
				previousSourceIndex: 10,
				currentSourceIndex: 11,
				channels: ["speedKmh", "tyreCoreTemperatureC.frontLeft"],
			},
		],
	},
	thresholds: {
		steering: {
			status: "calculated",
			lowThresholdDegrees: 0.16,
			highThresholdDegrees: 5.85,
		},
		brakeActivity: {
			status: "calculated",
			lowThresholdRatio: 0.004,
			highThresholdRatio: 0.313,
		},
	},
	detectorFailures: [],
};

describe("data quality presentation", () => {
	test("summarizes frame audit and calculated thresholds", () => {
		const summary = createDataQualitySummary(DIAGNOSTICS);

		expect(summary).toEqual({
			status: "usable",
			statusLabel: "Usable",
			description:
				"Coaching results are supported by the available telemetry.",
			framesRetained: 7_195,
			entireFramesExcluded: 0,
			detectorFailureCount: 0,
			typicalIntervalMs: 55,
			maximumContinuousIntervalMs: 275,
			samplingGapCount: 2,
			ignoredInvalidReadingCount: 1,
			affectedSignalCount: 4,
			affectedSignalLabels: [
				"speed",
				"engine RPM",
				"track position",
				"tyre temperatures",
			],
			signalDiscontinuityCount: 1,
			brakeAppliedPercent: 31.3,
			brakeReleasedPercent: 0.4,
			cornerSteeringDegrees: 5.85,
		});
	});

	test("reports unavailable thresholds without inventing values", () => {
		const summary = createDataQualitySummary({
			...DIAGNOSTICS,
			thresholds: {
				steering: { status: "unavailable" },
				brakeActivity: { status: "unavailable" },
			},
		});

		expect(summary.brakeAppliedPercent).toBeNull();
		expect(summary.brakeReleasedPercent).toBeNull();
		expect(summary.cornerSteeringDegrees).toBeNull();
	});

	test("marks diagnostics as limited when a coaching detector fails", () => {
		const summary = createDataQualitySummary({
			...DIAGNOSTICS,
			detectorFailures: [
				{
					code: "COACHING_DETECTOR_FAILED",
					phenomena: ["LATE_BRAKE_RELEASE"],
					lapNumber: 4,
					trackRegionId: "C3",
					errorName: "RangeError",
				},
			],
		});

		expect(summary.status).toBe("limited");
		expect(summary.statusLabel).toBe("Limited");
		expect(summary.detectorFailureCount).toBe(1);
	});
});

function createIssue(
	id: string,
	code: DiagnosticsResponse["frameAudit"]["issues"][number]["code"],
	action: DiagnosticsResponse["frameAudit"]["issues"][number]["action"],
	channels?: DiagnosticsResponse["frameAudit"]["issues"][number]["channels"],
): DiagnosticsResponse["frameAudit"]["issues"][number] {
	return {
		id,
		code,
		action,
		severity: "warning",
		scope: "transition",
		message: id,
		...(channels ? { channels } : {}),
	};
}
