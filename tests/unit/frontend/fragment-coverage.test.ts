import { describe, expect, test } from "bun:test";
import {
	createVisibleUnrecordedSegments,
	findVisibleFragmentBoundary,
} from "../../../frontend/src/analysis/fragment-coverage";
import { createLapFragmentPresentations } from "../../../frontend/src/analysis/lap-fragment-presentation";

describe("fragment chart coverage", () => {
	test("marks the missing opening portion on a full-lap viewport", () => {
		const fragment = createLapFragmentPresentations(
			[{ startPosition: 0.4, endPosition: 1 }],
			[1],
		)[0];
		if (!fragment) throw new TypeError("Expected a fragment presentation");

		expect(
			createVisibleUnrecordedSegments(fragment, {
				startPercent: 0,
				endPercent: 100,
			}),
		).toEqual([{ startPercent: 0, endPercent: 40 }]);
		expect(
			findVisibleFragmentBoundary(fragment.startPosition, {
				startPercent: 0,
				endPercent: 100,
			}),
		).toBe(40);
	});

	test("clips missing coverage to a zoomed viewport", () => {
		const fragment = createLapFragmentPresentations(
			[{ startPosition: 0, endPosition: 0.42 }],
			[1],
		)[0];
		if (!fragment) throw new TypeError("Expected a fragment presentation");

		expect(
			createVisibleUnrecordedSegments(fragment, {
				startPercent: 30,
				endPercent: 70,
			}),
		).toEqual([{ startPercent: 30, endPercent: 100 }]);
	});
});
