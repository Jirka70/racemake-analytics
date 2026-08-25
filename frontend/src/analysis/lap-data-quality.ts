import type {
	LapBoundaryLimitationResponse,
	LapCoverageResponse,
	LapQualityResponse,
	LapSamplingGapLimitationResponse,
	LapTimingResponse,
	LapUsageResponse,
} from "../../../src/http/contracts";

export interface LapDataQualityInput {
	readonly lapNumber: number;
	readonly timing: LapTimingResponse;
	readonly quality: LapQualityResponse;
	readonly usage: LapUsageResponse;
	readonly coverage: LapCoverageResponse;
}

export interface LapDataDetails {
	readonly summary: string;
	readonly whatHappened: readonly string[];
	readonly whatThisAffects: readonly string[];
	readonly stillAvailable: readonly string[];
}

export function hasLimitedLapTime(lap: LapDataQualityInput): boolean {
	return (
		lap.timing.status === "unverified" ||
		lap.usage.lapTimeComparison === "excluded" ||
		lap.usage.lapRanking === "excluded"
	);
}

export function createLapDataDetails(
	lap: LapDataQualityInput,
	formattedLapTime: string,
): LapDataDetails | null {
	if (lap.quality.status !== "limited") return null;

	const boundaryLimitation = findPrimaryBoundaryLimitation(lap.quality);
	const whatHappened = boundaryLimitation
		? createBoundaryEvidenceItems(boundaryLimitation)
		: lap.quality.limitations.flatMap(createLimitationEvidenceItems);
	const approximateLapTime = `~${formattedLapTime}`;

	return {
		summary: boundaryLimitation
			? createBoundarySummary(boundaryLimitation)
			: lap.quality.summary,
		whatHappened,
		whatThisAffects: createUsageImpactItems(lap.usage, approximateLapTime),
		stillAvailable: createAvailableItems(lap.usage),
	};
}

function createLimitationEvidenceItems(
	limitation: Extract<
		LapQualityResponse,
		{ status: "limited" }
	>["limitations"][number],
): readonly string[] {
	if (limitation.code !== "SAMPLING_GAP_WITHIN_LAP") {
		return [limitation.message];
	}

	return createSamplingGapEvidenceItems(limitation);
}

function createSamplingGapEvidenceItems(
	limitation: LapSamplingGapLimitationResponse,
): readonly string[] {
	return [
		limitation.message,
		`${formatDuration(limitation.gapDurationMs)} without telemetry from ${formatPosition(limitation.fromPosition)} to ${formatPosition(limitation.toPosition)}`,
	];
}

function createBoundarySummary(
	limitation: LapBoundaryLimitationResponse,
): string {
	return limitation.boundary === "finish"
		? "The recorder missed the exact moment the car crossed the finish line."
		: "The recorder missed the exact moment the lap started.";
}

function findPrimaryBoundaryLimitation(
	quality: Extract<LapQualityResponse, { status: "limited" }>,
): LapBoundaryLimitationResponse | null {
	return (
		quality.limitations.find(
			(limitation): limitation is LapBoundaryLimitationResponse =>
				limitation.code === "FINISH_BOUNDARY_UNCERTAIN",
		) ??
		quality.limitations.find(
			(limitation): limitation is LapBoundaryLimitationResponse =>
				limitation.code === "START_BOUNDARY_UNCERTAIN",
		) ??
		null
	);
}

function createBoundaryEvidenceItems(
	limitation: LapBoundaryLimitationResponse,
): readonly string[] {
	const boundaryLabel = limitation.boundary === "finish" ? "finish" : "start";
	const items = [
		`${Math.round(limitation.evidence.transitionDurationMs)} ms between samples around the ${boundaryLabel}`,
		`Track position jumped from ${formatPosition(limitation.evidence.fromPosition)} to ${formatPosition(limitation.evidence.toPosition)}`,
	];

	if (limitation.evidence.lapCounterEvidence === "missing") {
		items.push("Lap counter did not advance");
	} else if (limitation.evidence.lapCounterEvidence === "mismatch") {
		items.push("Lap counter reported a conflicting change");
	} else if (limitation.evidence.lapCounterEvidence === "nearby") {
		items.push("Lap counter advanced shortly after the crossing");
	}

	return items;
}

function createUsageImpactItems(
	usage: LapUsageResponse,
	approximateLapTime: string,
): readonly string[] {
	const items: string[] = [];

	if (usage.lapTimeComparison === "excluded") {
		items.push(`${approximateLapTime} is shown for review only`);
	}
	if (usage.lapRanking === "excluded") {
		items.push(
			"Not used for fastest lap or ranking; full-lap delta is approximate",
		);
	}
	if (usage.coaching === "supported-regions-only") {
		items.push("Coaching is limited to sections with enough recorded data");
	}

	return items.length > 0
		? items
		: ["Calculations that cross the affected section are left out"];
}

function createAvailableItems(usage: LapUsageResponse): readonly string[] {
	if (usage.telemetryReview === "full") {
		return ["Recorded telemetry", "Lap charts and supported comparisons"];
	}
	if (usage.coaching === "none") {
		return ["Recorded telemetry", "Recorded sections for manual review"];
	}

	return ["Recorded telemetry", "Supported corners and sections"];
}

function formatDuration(durationMs: number): string {
	if (durationMs < 1_000) return `${Math.round(durationMs)} ms`;
	return `${(durationMs / 1_000).toFixed(1)} s`;
}

function formatPosition(position: number): string {
	return `${(position * 100).toFixed(1)}%`;
}
