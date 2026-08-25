import { describe, expect, test } from "bun:test";
import {
	areComparedLapRolesSwapped,
	createDefaultLapComparisonSelection,
	createLapReviewPlan,
	findAdjacentLapToReview,
	type LapComparisonSelection,
	selectLapToCompareWith,
	selectLapToReview,
	swapComparedLaps,
} from "../../../frontend/src/analysis/lap-comparison-selection";

const SELECTION: LapComparisonSelection = {
	comparedLapNumber: 4,
	referenceLapNumber: 2,
};

describe("lap comparison selection", () => {
	test("uses an explicit one-lap plan and ignores a stale self-comparison", () => {
		expect(
			createLapReviewPlan(
				[{ lapNumber: 1, lapTimeMs: 73_789 }],
				[{ lapNumber: 1, lapTimeMs: 73_789 }],
				1,
				{
					comparedLapNumber: 1,
					referenceLapNumber: 1,
				},
			),
		).toEqual({
			mode: "single-lap",
			selection: null,
			reviewedLapNumber: 1,
			referenceLapNumber: null,
			seriesLapNumbers: [1],
		});
	});

	test("replaces a stale self-comparison with two distinct laps", () => {
		expect(
			createLapReviewPlan(
				[
					{ lapNumber: 1, lapTimeMs: 73_789 },
					{ lapNumber: 2, lapTimeMs: 73_518 },
				],
				[
					{ lapNumber: 1, lapTimeMs: 73_789 },
					{ lapNumber: 2, lapTimeMs: 73_518 },
				],
				2,
				{ comparedLapNumber: 1, referenceLapNumber: 1 },
			),
		).toEqual({
			mode: "comparison",
			selection: { comparedLapNumber: 1, referenceLapNumber: 2 },
			reviewedLapNumber: 1,
			referenceLapNumber: 2,
			seriesLapNumbers: [1, 2],
		});
	});

	test("keeps one racing lap reviewable without creating a comparison", () => {
		expect(
			createDefaultLapComparisonSelection(
				[{ lapNumber: 1, lapTimeMs: 76_187 }],
				[{ lapNumber: 1, lapTimeMs: 76_187 }],
				1,
			),
		).toBeNull();
	});

	test("creates a comparison only from two distinct racing laps", () => {
		expect(
			createDefaultLapComparisonSelection(
				[
					{ lapNumber: 1, lapTimeMs: 76_187 },
					{ lapNumber: 2, lapTimeMs: 73_518 },
				],
				[
					{ lapNumber: 1, lapTimeMs: 76_187 },
					{ lapNumber: 2, lapTimeMs: 73_518 },
				],
				2,
			),
		).toEqual({ comparedLapNumber: 1, referenceLapNumber: 2 });
	});

	test("keeps a limited lap reviewable while requiring a verified reference", () => {
		const reviewableLaps = [
			{ lapNumber: 2, lapTimeMs: 73_518 },
			{ lapNumber: 4, lapTimeMs: 72_911 },
		];
		const verifiedReferenceLaps = [{ lapNumber: 2, lapTimeMs: 73_518 }];

		expect(
			createLapReviewPlan(reviewableLaps, verifiedReferenceLaps, 2, {
				comparedLapNumber: 4,
				referenceLapNumber: 2,
			}),
		).toEqual({
			mode: "comparison",
			selection: { comparedLapNumber: 4, referenceLapNumber: 2 },
			reviewedLapNumber: 4,
			referenceLapNumber: 2,
			seriesLapNumbers: [4, 2],
		});
	});

	test("never accepts a limited lap as the reference", () => {
		const reviewableLaps = [
			{ lapNumber: 2, lapTimeMs: 73_518 },
			{ lapNumber: 3, lapTimeMs: 74_069 },
			{ lapNumber: 4, lapTimeMs: 72_911 },
		];
		const verifiedReferenceLaps = reviewableLaps.slice(0, 2);

		expect(
			createLapReviewPlan(reviewableLaps, verifiedReferenceLaps, 2, {
				comparedLapNumber: 3,
				referenceLapNumber: 4,
			}),
		).toMatchObject({
			mode: "comparison",
			selection: { comparedLapNumber: 3, referenceLapNumber: 2 },
		});
	});

	test("changes only the lap being reviewed", () => {
		expect(selectLapToReview(SELECTION, 3)).toEqual({
			comparedLapNumber: 3,
			referenceLapNumber: 2,
		});
	});

	test("never hides a swap behind selecting the comparison lap card", () => {
		expect(selectLapToReview(SELECTION, 2)).toBe(SELECTION);
	});

	test("changes only the explicitly selected comparison lap", () => {
		expect(selectLapToCompareWith(SELECTION, 3)).toEqual({
			comparedLapNumber: 4,
			referenceLapNumber: 3,
		});
		expect(selectLapToCompareWith(SELECTION, 4)).toBe(SELECTION);
	});

	test("swaps roles only through the explicit action", () => {
		expect(swapComparedLaps(SELECTION)).toEqual({
			comparedLapNumber: 2,
			referenceLapNumber: 4,
		});
	});

	test("recognizes a pure role swap without treating a different pair as one", () => {
		expect(
			areComparedLapRolesSwapped(SELECTION, swapComparedLaps(SELECTION)),
		).toBe(true);
		expect(
			areComparedLapRolesSwapped(SELECTION, {
				comparedLapNumber: 2,
				referenceLapNumber: 3,
			}),
		).toBe(false);
	});

	test("finds the next reviewable lap without selecting the comparison lap", () => {
		const selection = {
			comparedLapNumber: 3,
			referenceLapNumber: 2,
		};

		expect(
			findAdjacentLapToReview(selection, [2, 3, 4], "previous"),
		).toBeNull();
		expect(findAdjacentLapToReview(selection, [2, 3, 4], "next")).toBe(4);
	});

	test("skips the comparison lap when stepping through racing laps", () => {
		const selection = {
			comparedLapNumber: 4,
			referenceLapNumber: 3,
		};

		expect(findAdjacentLapToReview(selection, [2, 3, 4], "previous")).toBe(2);
	});
});
