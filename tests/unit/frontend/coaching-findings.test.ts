import { describe, expect, test } from "bun:test";
import {
	classifyCoachingPriority,
	createCoachingChartMarkers,
	createCoachingMeasurementDetails,
	findCoachingPhenomenaForLap,
	formatCoachingPhenomenon,
	formatCoachingRegionId,
	formatCoachingSpeedMeasurement,
	formatCoachingTrackPosition,
	formatQuickestRegionPassLabel,
	formatReviewedPassLabel,
} from "../../../frontend/src/analysis/coaching-findings";
import type { RankedCoachingPhenomenonResponse } from "../../../src/http/contracts";

const RANKED_PHENOMENA: readonly RankedCoachingPhenomenonResponse[] = [
	createRankedPhenomenon(1, 1, 3, 2, "C2-entry"),
	createRankedPhenomenon(2, 0.337, 4, 2, "C3"),
	createRankedPhenomenon(3, 0.177, 4, 2, "C7"),
];

describe("coaching finding presentation", () => {
	test("classifies relative coaching priority", () => {
		expect(classifyCoachingPriority(1)).toBe("CRITICAL");
		expect(classifyCoachingPriority(0.95)).toBe("CRITICAL");
		expect(classifyCoachingPriority(0.949)).toBe("HIGH");
		expect(classifyCoachingPriority(0.6)).toBe("HIGH");
		expect(classifyCoachingPriority(0.25)).toBe("MODERATE");
		expect(classifyCoachingPriority(0.249)).toBe("LOW");
	});

	test("keeps every finding for the lap under review", () => {
		expect(
			findCoachingPhenomenaForLap(RANKED_PHENOMENA, 4).map(({ rank }) => rank),
		).toEqual([2, 3]);
	});

	test("returns no findings without a lap under review", () => {
		expect(findCoachingPhenomenaForLap(RANKED_PHENOMENA, null)).toEqual([]);
	});

	test("describes how unnecessary braking time loss was measured", () => {
		const finding = createRankedPhenomenon(
			1,
			1,
			3,
			2,
			"C2-entry",
			"UNNECESSARY_BRAKING",
		).finding;

		expect(createCoachingMeasurementDetails(finding)).toEqual({
			regionName: "C2",
			fastestPassLabel: "Quickest C2 time",
			measuredSection: "Braking start → C2 exit",
			timeLossLabel: "Time lost from braking start to C2 exit",
		});
	});

	test("describes how late brake release time loss was measured", () => {
		const finding = createRankedPhenomenon(
			2,
			0.337,
			4,
			2,
			"C3",
			"LATE_BRAKE_RELEASE",
		).finding;

		expect(createCoachingMeasurementDetails(finding)).toEqual({
			regionName: "C3",
			fastestPassLabel: "Quickest C3 time",
			measuredSection: "Where Lap 2 stopped braking → C3 exit",
			timeLossLabel: "Time lost from where Lap 2 stopped braking to C3 exit",
		});
	});

	test("makes track position and speed scope explicit", () => {
		expect(formatCoachingTrackPosition(1 / 6)).toBe("Lap position: 16.7%");
		expect(formatCoachingSpeedMeasurement("entry", "C3")).toBe(
			"Speed at C3 entry",
		);
		expect(formatCoachingSpeedMeasurement("minimum", "C3")).toBe(
			"Lowest speed through C3",
		);
		expect(formatCoachingSpeedMeasurement("steering-peak", "C3")).toBe(
			"Lowest speed where you used the most steering in C3",
		);
		expect(formatCoachingSpeedMeasurement("exit", "C3")).toBe(
			"Speed at C3 exit",
		);
		expect(formatReviewedPassLabel()).toBe("Reviewed lap");
		expect(formatQuickestRegionPassLabel("C2")).toBe("Quickest C2 time");
	});

	test("formats machine identifiers for coaches", () => {
		expect(formatCoachingPhenomenon("LATE_BRAKE_RELEASE")).toBe(
			"LATE BRAKE RELEASE",
		);
		expect(formatCoachingRegionId("C2-entry")).toBe("C2 Entry");
	});

	test("creates chart markers only from findings with measured lap positions", () => {
		const findingWithPosition = createRankedPhenomenon(1, 1, 3, 2, "C2-entry");
		const markerSource: RankedCoachingPhenomenonResponse = {
			...findingWithPosition,
			finding: {
				...findingWithPosition.finding,
				metrics: [
					{
						kind: "event-position",
						role: "evidence",
						event: "braking-onset",
						regionId: "C2-entry",
						location: "before-region",
						analyzedPass: {
							lapNumber: 3,
							normalizedTrackPosition: 1 / 6,
						},
					},
				],
			},
		};
		const findingWithoutPosition = createRankedPhenomenon(
			2,
			0.337,
			4,
			2,
			"C3",
			"LATE_BRAKE_RELEASE",
		);

		const markers = createCoachingChartMarkers([
			markerSource,
			findingWithoutPosition,
		]);

		expect(markers).toHaveLength(1);
		expect(markers[0]).toMatchObject({
			rank: 1,
			priority: "CRITICAL",
			title: "UNNECESSARY BRAKING",
			regionName: "C2",
			timeLossMs: 459,
		});
		expect(markers[0]?.positionPercent).toBeCloseTo(100 / 6);
	});
});

function createRankedPhenomenon(
	rank: number,
	priority: number,
	lapNumber: number,
	comparedWithLapNumber: number,
	analysisRegionId: RankedCoachingPhenomenonResponse["finding"]["analysisRegionId"],
	phenomenon: RankedCoachingPhenomenonResponse["finding"]["phenomenon"] = "UNNECESSARY_BRAKING",
): RankedCoachingPhenomenonResponse {
	return {
		rank,
		priority,
		finding: {
			phenomenon,
			lapNumber,
			comparedWithLapNumber,
			analysisRegionId,
			occurredAtLapElapsedMs: 12_000,
			impactTimeLossMs: 459,
			message: "Synthetic coaching finding.",
			evidence: [],
			metrics: [],
			limitations: [],
		},
	};
}
