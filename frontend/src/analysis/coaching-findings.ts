import type { RankedCoachingPhenomenonResponse } from "../../../src/http/contracts";

export type CoachingPriorityLabel = "CRITICAL" | "HIGH" | "MODERATE" | "LOW";

export interface CoachingMeasurementDetails {
	readonly regionName: string;
	readonly fastestPassLabel: string;
	readonly measuredSection: string;
	readonly timeLossLabel: string;
}

export interface CoachingChartMarker {
	readonly rank: number;
	readonly priority: CoachingPriorityLabel;
	readonly positionPercent: number;
	readonly title: string;
	readonly regionName: string;
	readonly timeLossMs: number;
}

type CoachingSpeedMeasurement = Extract<
	RankedCoachingPhenomenonResponse["finding"]["metrics"][number],
	{ readonly kind: "speed" }
>["measurement"];

export function classifyCoachingPriority(
	priority: number,
): CoachingPriorityLabel {
	if (priority >= 0.95) return "CRITICAL";
	if (priority >= 0.6) return "HIGH";
	if (priority >= 0.25) return "MODERATE";
	return "LOW";
}

export function findCoachingPhenomenaForLap(
	rankedPhenomena: readonly RankedCoachingPhenomenonResponse[],
	lapNumber: number | null,
): readonly RankedCoachingPhenomenonResponse[] {
	if (lapNumber === null) return [];

	return rankedPhenomena.filter(
		({ finding }) => finding.lapNumber === lapNumber,
	);
}

export function createCoachingChartMarkers(
	findings: readonly RankedCoachingPhenomenonResponse[],
): readonly CoachingChartMarker[] {
	return findings.flatMap(({ rank, priority, finding }) => {
		const positionMetric = finding.metrics.find(
			(metric) => metric.kind === "event-position",
		);
		if (!positionMetric) return [];

		return [
			{
				rank,
				priority: classifyCoachingPriority(priority),
				positionPercent:
					positionMetric.analyzedPass.normalizedTrackPosition * 100,
				title: formatCoachingPhenomenon(finding.phenomenon),
				regionName: findBaseRegionName(finding.analysisRegionId),
				timeLossMs: finding.impactTimeLossMs,
			},
		];
	});
}

export function createCoachingMeasurementDetails(
	finding: RankedCoachingPhenomenonResponse["finding"],
): CoachingMeasurementDetails {
	const regionName = findBaseRegionName(finding.analysisRegionId);

	return {
		regionName,
		fastestPassLabel: `Quickest ${regionName} time`,
		measuredSection: findMeasuredSection(
			finding.phenomenon,
			regionName,
			finding.comparedWithLapNumber,
		),
		timeLossLabel: findTimeLossLabel(
			finding.phenomenon,
			regionName,
			finding.comparedWithLapNumber,
		),
	};
}

export function formatCoachingTrackPosition(
	normalizedTrackPosition: number,
): string {
	return `Lap position: ${(normalizedTrackPosition * 100).toFixed(1)}%`;
}

export function formatCoachingSpeedMeasurement(
	measurement: CoachingSpeedMeasurement,
	regionName: string,
): string {
	switch (measurement) {
		case "entry":
			return `Speed at ${regionName} entry`;
		case "minimum":
			return `Lowest speed through ${regionName}`;
		case "steering-peak":
			return `Lowest speed where you used the most steering in ${regionName}`;
		case "exit":
			return `Speed at ${regionName} exit`;
	}
}

export function formatReviewedPassLabel(): string {
	return "Reviewed lap";
}

export function formatQuickestRegionPassLabel(regionName: string): string {
	return `Quickest ${regionName} time`;
}

export function formatCoachingPhenomenon(
	phenomenon: RankedCoachingPhenomenonResponse["finding"]["phenomenon"],
): string {
	return phenomenon.replaceAll("_", " ");
}

export function formatCoachingRegionId(regionId: string): string {
	return regionId
		.split("-")
		.map((part, index) =>
			index === 0 ? part : `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
		)
		.join(" ");
}

function findBaseRegionName(regionId: string): string {
	return regionId.replace(/-(entry|apex-proxy|exit)$/, "");
}

function findMeasuredSection(
	phenomenon: RankedCoachingPhenomenonResponse["finding"]["phenomenon"],
	regionName: string,
	fastestPassLapNumber: number,
): string {
	switch (phenomenon) {
		case "UNNECESSARY_BRAKING":
			return `Braking start → ${regionName} exit`;
		case "LATE_BRAKE_RELEASE":
			return `Where Lap ${fastestPassLapNumber} stopped braking → ${regionName} exit`;
		case "LATE_BRAKING":
		case "EARLY_BRAKING":
			return `Full ${regionName} region`;
		default:
			return `Analyzed ${regionName} section`;
	}
}

function findTimeLossLabel(
	phenomenon: RankedCoachingPhenomenonResponse["finding"]["phenomenon"],
	regionName: string,
	fastestPassLapNumber: number,
): string {
	switch (phenomenon) {
		case "UNNECESSARY_BRAKING":
			return `Time lost from braking start to ${regionName} exit`;
		case "LATE_BRAKE_RELEASE":
			return `Time lost from where Lap ${fastestPassLapNumber} stopped braking to ${regionName} exit`;
		default:
			return `Time lost through ${regionName}`;
	}
}
