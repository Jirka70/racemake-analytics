import type { DiagnosticsResponse } from "../../../src/http/contracts";

type AnalysisCapability =
	DiagnosticsResponse["usability"]["availableCapabilities"][number];
type AnalysisUsabilityReason =
	DiagnosticsResponse["usability"]["reasons"][number];
type RejectedLap = Extract<
	AnalysisUsabilityReason,
	{ readonly code: "LAPS_EXCLUDED_FROM_COMPARISON" }
>["evidence"]["rejectedLaps"][number];

export interface DataQualityExcludedLap {
	readonly lapNumber: number;
	readonly missingTelemetryMs: number | null;
	readonly uncoveredLapPercent: number | null;
}

export interface DataQualityCapability {
	readonly code: AnalysisCapability;
	readonly label: string;
}

export interface DataQualitySummary {
	readonly status: "usable" | "unavailable";
	readonly statusLabel: "Usable" | "Unavailable";
	readonly headline: string;
	readonly description: string;
	readonly bannerDescription: string;
	readonly excludedLaps: readonly DataQualityExcludedLap[];
	readonly availableCapabilities: readonly DataQualityCapability[];
	readonly unavailableCapabilities: readonly DataQualityCapability[];
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

const CAPABILITY_LABELS = {
	"lap-comparison": "Lap comparison",
	"region-comparison": "Corner comparison",
	"ideal-lap": "Ideal lap",
	coaching: "Coaching",
} as const satisfies Readonly<Record<AnalysisCapability, string>>;

export function createDataQualitySummary(
	diagnostics: DiagnosticsResponse,
	racingLapCount = 0,
): DataQualitySummary {
	const detectorFailureCount = diagnostics.detectorFailures.length;
	const { status, reasons } = diagnostics.usability;
	const hasLimitations = reasons.some(
		(reason) => reason.severity === "limitation",
	);
	const brakeThresholds = diagnostics.thresholds.brakeActivity;
	const steeringThresholds = diagnostics.thresholds.steering;
	const affectedSignals = findAffectedSignals(diagnostics);
	const excludedLaps = findExcludedLaps(diagnostics);
	const availableCapabilities = createCapabilitySummaries(
		diagnostics.usability.availableCapabilities,
	);
	const unavailableCapabilities = createCapabilitySummaries(
		diagnostics.usability.unavailableCapabilities,
	);

	return {
		status,
		statusLabel: status === "usable" ? "Usable" : "Unavailable",
		headline:
			status === "unavailable"
				? "Analysis cannot be completed reliably"
				: hasLimitations
					? "Analysis is available"
					: "Analysis is fully available",
		description: createDataQualityDescription(
			status,
			hasLimitations,
			excludedLaps,
			racingLapCount,
			availableCapabilities,
		),
		bannerDescription: createBannerDescription(
			status,
			hasLimitations,
			excludedLaps,
			racingLapCount,
			availableCapabilities,
		),
		excludedLaps,
		availableCapabilities,
		unavailableCapabilities,
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

function findExcludedLaps(
	diagnostics: DiagnosticsResponse,
): readonly DataQualityExcludedLap[] {
	const rejectedLaps = new Map<number, RejectedLap>();

	for (const reason of diagnostics.usability.reasons) {
		if (
			reason.code !== "LAPS_EXCLUDED_FROM_COMPARISON" &&
			reason.code !== "INSUFFICIENT_RACING_LAPS"
		) {
			continue;
		}

		for (const rejectedLap of reason.evidence.rejectedLaps) {
			rejectedLaps.set(rejectedLap.lapNumber, rejectedLap);
		}
	}

	const discontinuities = diagnostics.usability.reasons.flatMap((reason) =>
		reason.code === "TIMELINE_DISCONTINUITIES"
			? reason.evidence.discontinuities
			: [],
	);

	return [...rejectedLaps.values()]
		.map((rejectedLap): DataQualityExcludedLap => {
			const missingTelemetryMs = discontinuities
				.filter(
					(discontinuity) =>
						discontinuity.type === "sampling-gap" &&
						discontinuity.affectedLapNumber === rejectedLap.lapNumber,
				)
				.reduce((total, discontinuity) => total + discontinuity.durationMs, 0);
			const uncoveredLapRatios = rejectedLap.reasons.flatMap((reason) =>
				reason.code === "POSITION_HOLE_EXCEEDS_MAXIMUM"
					? [reason.observedValue]
					: [],
			);

			return {
				lapNumber: rejectedLap.lapNumber,
				missingTelemetryMs: missingTelemetryMs > 0 ? missingTelemetryMs : null,
				uncoveredLapPercent:
					uncoveredLapRatios.length > 0
						? Math.max(...uncoveredLapRatios) * 100
						: null,
			};
		})
		.sort((first, second) => first.lapNumber - second.lapNumber);
}

function createCapabilitySummaries(
	capabilities: readonly AnalysisCapability[],
): readonly DataQualityCapability[] {
	return capabilities.map((code) => ({
		code,
		label: CAPABILITY_LABELS[code],
	}));
}

function createDataQualityDescription(
	status: DataQualitySummary["status"],
	hasLimitations: boolean,
	excludedLaps: readonly DataQualityExcludedLap[],
	racingLapCount: number,
	availableCapabilities: readonly DataQualityCapability[],
): string {
	if (status === "unavailable") {
		return "The telemetry does not contain enough reliable information for a defensible lap comparison.";
	}

	if (excludedLaps.length > 0) {
		const lapSubject = formatLapList(
			excludedLaps.map(({ lapNumber }) => lapNumber),
		);
		const exclusionVerb = excludedLaps.length === 1 ? "was" : "were";
		const telemetryPronoun = excludedLaps.length === 1 ? "it" : "them";
		const availability = createAvailabilitySentence(
			racingLapCount,
			availableCapabilities,
		);

		return `${lapSubject} ${exclusionVerb} excluded because missing telemetry makes ${telemetryPronoun} unreliable. ${availability}`;
	}

	if (hasLimitations) {
		return "Analysis is usable. Non-blocking data-quality issues remain available in the details below.";
	}

	return "The available telemetry supports lap comparison and coaching.";
}

function createBannerDescription(
	status: DataQualitySummary["status"],
	hasLimitations: boolean,
	excludedLaps: readonly DataQualityExcludedLap[],
	racingLapCount: number,
	availableCapabilities: readonly DataQualityCapability[],
): string {
	if (status === "unavailable") {
		return "Open data details to see what is missing and which parts of the analysis are unavailable.";
	}
	if (!hasLimitations) {
		return "The available telemetry supports the complete analysis.";
	}

	const availability = createAvailabilitySentence(
		racingLapCount,
		availableCapabilities,
	);
	if (excludedLaps.length !== 1) {
		return createDataQualityDescription(
			status,
			hasLimitations,
			excludedLaps,
			racingLapCount,
			availableCapabilities,
		);
	}

	const excludedLap = excludedLaps[0];
	if (!excludedLap) return availability;
	const missingTelemetry =
		excludedLap.missingTelemetryMs === null
			? "telemetry is incomplete"
			: `${formatSeconds(excludedLap.missingTelemetryMs)} of telemetry is missing`;

	return `Lap ${excludedLap.lapNumber} was excluded because ${missingTelemetry}. ${availability}`;
}

function createAvailabilitySentence(
	racingLapCount: number,
	availableCapabilities: readonly DataQualityCapability[],
): string {
	const lapLabel = racingLapCount === 1 ? "lap remains" : "laps remain";
	const capabilityLabels = availableCapabilities.map(({ label }) =>
		label.toLocaleLowerCase("en-US"),
	);
	if (capabilityLabels.length === 0) {
		return `${racingLapCount} complete racing ${lapLabel}, but comparison is not reliable.`;
	}

	return `${racingLapCount} complete racing ${lapLabel}, so ${formatNaturalList(capabilityLabels)} ${capabilityLabels.length === 1 ? "is" : "are"} available.`;
}

function formatLapList(lapNumbers: readonly number[]): string {
	return formatNaturalList(lapNumbers.map((lapNumber) => `Lap ${lapNumber}`));
}

function formatNaturalList(values: readonly string[]): string {
	if (values.length === 0) return "the remaining analysis";
	return new Intl.ListFormat("en-US", {
		style: "long",
		type: "conjunction",
	}).format(values);
}

function formatSeconds(milliseconds: number): string {
	return `${(milliseconds / 1_000).toFixed(1)} s`;
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
