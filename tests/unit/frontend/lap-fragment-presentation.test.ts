import { describe, expect, test } from "bun:test";
import { createLapFragmentPresentations } from "../../../frontend/src/analysis/lap-fragment-presentation";

describe("lap fragment presentation", () => {
	test("places opening and closing fragments around the complete laps", () => {
		expect(
			createLapFragmentPresentations(
				[
					{ startPosition: 0.4, endPosition: 1 },
					{ startPosition: 0, endPosition: 0.42 },
				],
				[1, 2, 3, 4],
			),
		).toEqual([
			{
				key: "0:0.4:1",
				fragmentIndex: 0,
				lapNumber: 0,
				label: "Start fragment",
				startPosition: 0.4,
				endPosition: 1,
				capturedRatio: 0.6,
				capturedRanges: [{ startPosition: 0.4, endPosition: 1 }],
			},
			{
				key: "1:0:0.42",
				fragmentIndex: 1,
				lapNumber: 5,
				label: "End fragment",
				startPosition: 0,
				endPosition: 0.42,
				capturedRatio: 0.42,
				capturedRanges: [{ startPosition: 0, endPosition: 0.42 }],
			},
		]);
	});

	test("splits a fragment that crosses the start-finish line into two bar ranges", () => {
		const [fragment] = createLapFragmentPresentations(
			[{ startPosition: 0.8, endPosition: 0.2 }],
			[],
		);

		expect(fragment?.capturedRatio).toBeCloseTo(0.4);
		expect(fragment?.capturedRanges).toEqual([
			{ startPosition: 0.8, endPosition: 1 },
			{ startPosition: 0, endPosition: 0.2 },
		]);
	});

	test("returns no cards when the API reports no fragments", () => {
		expect(createLapFragmentPresentations([], [1, 2])).toEqual([]);
	});
});
