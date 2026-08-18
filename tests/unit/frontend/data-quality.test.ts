import { describe, expect, test } from "bun:test";
import { createDataQualitySummary } from "../../../frontend/src/analysis/data-quality";
import type { DiagnosticsResponse } from "../../../src/http/contracts";

const DIAGNOSTICS: DiagnosticsResponse = {
	analysisId: "sha256:diagnostics-test",
	sessionId: "diagnostics-test",
	usability: {
		status: "usable",
		primaryReason: null,
		reasons: [],
		availableCapabilities: [
			"lap-comparison",
			"region-comparison",
			"ideal-lap",
			"coaching",
		],
		unavailableCapabilities: [],
	},
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
			createIssue("outlier-1", "LOCAL_OUTLIER", "exclude-channel-value", [
				"engineRpm",
				"normalizedTrackPosition",
			]),
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
			headline: "Analysis is fully available",
			description:
				"The available telemetry supports lap comparison and coaching.",
			bannerDescription:
				"The available telemetry supports the complete analysis.",
			excludedLaps: [],
			availableCapabilities: [
				{ code: "lap-comparison", label: "Lap comparison" },
				{ code: "region-comparison", label: "Corner comparison" },
				{ code: "ideal-lap", label: "Ideal lap" },
				{ code: "coaching", label: "Coaching" },
			],
			unavailableCapabilities: [],
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

	test("reports a blocking analysis as unavailable", () => {
		const summary = createDataQualitySummary({
			...DIAGNOSTICS,
			usability: {
				status: "unavailable",
				primaryReason: {
					code: "NO_COMPLETE_LAPS",
					severity: "blocking",
					evidence: { detectedCrossingCount: 1 },
				},
				reasons: [
					{
						code: "NO_COMPLETE_LAPS",
						severity: "blocking",
						evidence: { detectedCrossingCount: 1 },
					},
				],
				availableCapabilities: [],
				unavailableCapabilities: DIAGNOSTICS.usability.availableCapabilities,
			},
		});

		expect(summary.status).toBe("unavailable");
		expect(summary.statusLabel).toBe("Unavailable");
		expect(summary.headline).toBe("Analysis cannot be completed reliably");
	});

	test("keeps diagnostics usable when a coaching detector fails", () => {
		const summary = createDataQualitySummary({
			...DIAGNOSTICS,
			usability: {
				status: "usable",
				primaryReason: {
					code: "COACHING_DETECTOR_FAILURES",
					severity: "limitation",
					evidence: { failureCount: 1 },
				},
				reasons: [
					{
						code: "COACHING_DETECTOR_FAILURES",
						severity: "limitation",
						evidence: { failureCount: 1 },
					},
				],
				availableCapabilities: DIAGNOSTICS.usability.availableCapabilities,
				unavailableCapabilities: [],
			},
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

		expect(summary.status).toBe("usable");
		expect(summary.statusLabel).toBe("Usable");
		expect(summary.headline).toBe("Analysis is available");
		expect(summary.detectorFailureCount).toBe(1);
	});

	test("explains an excluded lap using measured gap and coverage evidence", () => {
		const summary = createDataQualitySummary(
			{
				...DIAGNOSTICS,
				usability: {
					status: "usable",
					primaryReason: {
						code: "TIMELINE_DISCONTINUITIES",
						severity: "limitation",
						evidence: {
							discontinuities: [
								{
									type: "sampling-gap",
									fromTimestampMs: 92_520,
									toTimestampMs: 95_192,
									durationMs: 2_672,
									affectedLapNumber: 1,
								},
							],
						},
					},
					reasons: [
						{
							code: "TIMELINE_DISCONTINUITIES",
							severity: "limitation",
							evidence: {
								discontinuities: [
									{
										type: "sampling-gap",
										fromTimestampMs: 92_520,
										toTimestampMs: 95_192,
										durationMs: 2_672,
										affectedLapNumber: 1,
									},
								],
							},
						},
						{
							code: "LAPS_EXCLUDED_FROM_COMPARISON",
							severity: "limitation",
							evidence: {
								rejectedLaps: [
									{
										lapNumber: 1,
										reasons: [
											{
												code: "POSITION_HOLE_EXCEEDS_MAXIMUM",
												observedValue: 0.0451,
												allowedMaximum: 0.02,
											},
											{ code: "SAMPLING_GAP_WITHIN_LAP" },
										],
									},
								],
							},
						},
					],
					availableCapabilities: DIAGNOSTICS.usability.availableCapabilities,
					unavailableCapabilities: [],
				},
			},
			3,
		);

		expect(summary.bannerDescription).toBe(
			"Lap 1 was excluded because 2.7 s of telemetry is missing. 3 complete racing laps remain, so lap comparison, corner comparison, ideal lap, and coaching are available.",
		);
		expect(summary.description).toBe(
			"Lap 1 was excluded because missing telemetry makes it unreliable. 3 complete racing laps remain, so lap comparison, corner comparison, ideal lap, and coaching are available.",
		);
		expect(summary.excludedLaps).toEqual([
			{
				lapNumber: 1,
				missingTelemetryMs: 2_672,
				uncoveredLapPercent: 4.51,
			},
		]);
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
