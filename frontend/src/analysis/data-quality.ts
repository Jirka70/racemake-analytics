import type { DiagnosticsResponse } from "../../../src/http/contracts";

export interface DataQualitySummary {
	readonly status: "usable" | "limited";
	readonly statusLabel: "Usable" | "Limited";
	readonly description: string;
	readonly framesRetained: number;
	readonly entireFramesExcluded: number;
	readonly detectorFailureCount: number;
	readonly typicalIntervalMs: number | null;
	readonly maximumContinuousIntervalMs: number | null;
	readonly samplingGapCount: number;
	readonly ignoredInvalidReadingCount: number;
	readonly affectedSignalCount: number;
	readonly affectedSignalLabels: readonly string[];
	readonly signalDiscontinuityCount: number;
	readonly brakeAppliedPercent: number | null;
	readonly brakeReleasedPercent: number | null;
	readonly cornerSteeringDegrees: number | null;
}

export function createDataQualitySummary(
	diagnostics: DiagnosticsResponse,
): DataQualitySummary {
	const detectorFailureCount = diagnostics.detectorFailures.length;
	const status = detectorFailureCount > 0 ? "limited" : "usable";
	const brakeThresholds = diagnostics.thresholds.brakeActivity;
	const steeringThresholds = diagnostics.thresholds.steering;
	const affectedSignals = findAffectedSignals(diagnostics);

	return {
		status,
		statusLabel: status === "usable" ? "Usable" : "Limited",
		description:
			status === "usable"
				? "Coaching results are supported by the available telemetry."
				: "Some coaching checks could not be completed with the available telemetry.",
		framesRetained: diagnostics.frameAudit.retainedTimelineFrameCount,
		entireFramesExcluded: diagnostics.frameAudit.excludedTimelineFrameCount,
		detectorFailureCount,
		typicalIntervalMs:
			diagnostics.frameAudit.samplingBaseline?.medianIntervalMs ?? null,
		maximumContinuousIntervalMs:
			diagnostics.frameAudit.samplingBaseline?.maximumContinuousIntervalMs ??
			null,
		samplingGapCount: diagnostics.frameAudit.issues.filter(
			(issue) => issue.code === "SAMPLING_GAP",
		).length,
		ignoredInvalidReadingCount: diagnostics.frameAudit.issues.filter(
			(issue) => issue.action === "exclude-channel-value",
		).length,
		affectedSignalCount: affectedSignals.size,
		affectedSignalLabels: createAffectedSignalLabels(affectedSignals),
		signalDiscontinuityCount:
			diagnostics.frameAudit.channelDiscontinuities.length,
		brakeAppliedPercent:
			brakeThresholds.status === "calculated"
				? brakeThresholds.highThresholdRatio * 100
				: null,
		brakeReleasedPercent:
			brakeThresholds.status === "calculated"
				? brakeThresholds.lowThresholdRatio * 100
				: null,
		cornerSteeringDegrees:
			steeringThresholds.status === "calculated"
				? steeringThresholds.highThresholdDegrees
				: null,
	};
}

function findAffectedSignals(
	diagnostics: DiagnosticsResponse,
): ReadonlySet<string> {
	const affectedSignals = new Set<string>();

	for (const issue of diagnostics.frameAudit.issues) {
		if (issue.action !== "exclude-channel-value") continue;
		for (const channel of issue.channels ?? []) affectedSignals.add(channel);
	}

	for (const discontinuity of diagnostics.frameAudit.channelDiscontinuities) {
		for (const channel of discontinuity.channels) affectedSignals.add(channel);
	}

	return affectedSignals;
}

function createAffectedSignalLabels(
	affectedSignals: ReadonlySet<string>,
): readonly string[] {
	const labels: string[] = [];

	if (affectedSignals.has("speedKmh")) labels.push("speed");
	if (affectedSignals.has("engineRpm")) labels.push("engine RPM");
	if (affectedSignals.has("normalizedTrackPosition")) {
		labels.push("track position");
	}
	if (
		[...affectedSignals].some((channel) =>
			channel.startsWith("tyreCoreTemperatureC."),
		)
	) {
		labels.push("tyre temperatures");
	}
	if (affectedSignals.has("throttleRatio")) labels.push("throttle");
	if (affectedSignals.has("brakeRatio")) labels.push("brake");
	if (affectedSignals.has("steeringDegrees")) labels.push("steering");
	if (affectedSignals.has("gear")) labels.push("gear");
	if (affectedSignals.has("timestampMs")) labels.push("timing");
	if (affectedSignals.has("recordedLapNumber")) labels.push("lap counter");

	return labels;
}
