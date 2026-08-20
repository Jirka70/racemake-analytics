import { describe, expect, test } from "bun:test";
import {
	classifyCoachingPriority,
	createCoachingChartMarkers,
	createCoachingMeasurementDetails,
	createCoachingNextLapGoal,
	findCoachingBaseRegionId,
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
	createRankedPhenomenon(1, 1, 8, 3, "C5-entry"),
	createRankedPhenomenon(2, 0.44, 9, 3, "C6"),
	createRankedPhenomenon(3, 0.23, 9, 3, "C8"),
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
			findCoachingPhenomenaForLap(RANKED_PHENOMENA, 9).map(({ rank }) => rank),
		).toEqual([2, 3]);
	});

	test("returns no findings without a lap under review", () => {
		expect(findCoachingPhenomenaForLap(RANKED_PHENOMENA, null)).toEqual([]);
	});

	test("describes how unnecessary braking time loss was measured", () => {
		const finding = createRankedPhenomenon(
			1,
			1,
			8,
			3,
			"C5-entry",
			"UNNECESSARY_BRAKING",
		).finding;

		expect(createCoachingMeasurementDetails(finding)).toEqual({
			regionName: "C5",
			fastestPassLabel: "Quickest C5 time",
			measuredSection: "Braking start → C5 exit",
			timeLossLabel: "Time lost from braking start to C5 exit",
		});
	});

	test("describes how late brake release time loss was measured", () => {
		const finding = createRankedPhenomenon(
			2,
			0.44,
			9,
			3,
			"C6",
			"LATE_BRAKE_RELEASE",
		).finding;

		expect(createCoachingMeasurementDetails(finding)).toEqual({
			regionName: "C6",
			fastestPassLabel: "Quickest C6 time",
			measuredSection: "Where Lap 3 stopped braking → C6 exit",
			timeLossLabel: "Time lost from where Lap 3 stopped braking to C6 exit",
		});
	});

	test("promotes the actionable instruction ahead of detailed evidence", () => {
		expect(
			createCoachingNextLapGoal(
				createRankedPhenomenon(1, 1, 8, 3, "C5-entry", "UNNECESSARY_BRAKING")
					.finding,
			),
		).toEqual({
			label: "NEXT-LAP GOAL",
			instruction: "Keep C5 brake-free.",
		});
		expect(
			createCoachingNextLapGoal(
				createRankedPhenomenon(2, 0.7, 9, 3, "C6", "LATE_BRAKE_RELEASE")
					.finding,
			).instruction,
		).toBe("Release the brake earlier through C6.");
	});

	test("maps a phase finding to its selectable corner", () => {
		expect(findCoachingBaseRegionId("C5-entry")).toBe("C5");
		expect(findCoachingBaseRegionId("C8")).toBe("C8");
	});

	test("makes track position and speed scope explicit", () => {
		expect(formatCoachingTrackPosition(1 / 6)).toBe("Lap position: 16.7%");
		expect(formatCoachingSpeedMeasurement("entry", "C6")).toBe(
			"Speed at C6 entry",
		);
		expect(formatCoachingSpeedMeasurement("minimum", "C6")).toBe(
			"Lowest speed through C6",
		);
		expect(formatCoachingSpeedMeasurement("steering-peak", "C6")).toBe(
			"Lowest speed where you used the most steering in C6",
		);
		expect(formatCoachingSpeedMeasurement("exit", "C6")).toBe(
			"Speed at C6 exit",
		);
		expect(formatReviewedPassLabel()).toBe("Reviewed lap");
		expect(formatQuickestRegionPassLabel("C5")).toBe("Quickest C5 time");
	});

	test("formats machine identifiers for coaches", () => {
		expect(formatCoachingPhenomenon("LATE_BRAKE_RELEASE")).toBe(
			"LATE BRAKE RELEASE",
		);
		expect(formatCoachingRegionId("C5-entry")).toBe("C5 Entry");
	});

	test("creates chart markers only from findings with measured lap positions", () => {
		const findingWithPosition = createRankedPhenomenon(1, 1, 8, 3, "C5-entry");
		const markerSource: RankedCoachingPhenomenonResponse = {
			...findingWithPosition,
			finding: {
				...findingWithPosition.finding,
				metrics: [
					{
						kind: "event-position",
						role: "evidence",
						event: "braking-onset",
						regionId: "C5-entry",
						location: "before-region",
						analyzedPass: {
							lapNumber: 8,
							normalizedTrackPosition: 1 / 6,
						},
					},
				],
			},
		};
		const findingWithoutPosition = createRankedPhenomenon(
			2,
			0.44,
			9,
			3,
			"C6",
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
			regionName: "C5",
			timeLossMs: 320,
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
			impactTimeLossMs: 320,
			message: "Synthetic coaching finding.",
			evidence: [],
			metrics: [],
			limitations: [],
		},
	};
}
