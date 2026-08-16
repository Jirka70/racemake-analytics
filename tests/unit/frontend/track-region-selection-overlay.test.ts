import { describe, expect, test } from "bun:test";
import { createVisibleTrackRegionSelectionSegments } from "../../../frontend/src/components/analysis/charts/TrackRegionSelectionOverlay";
import type { CornerRegionResponse } from "../../../src/http/contracts";

const CORNER_REGION: CornerRegionResponse = {
	type: "corner",
	id: "C2",
	interval: {
		startNormalizedTrackPosition: 0.2,
		endNormalizedTrackPosition: 0.28,
		crossesStartFinishLine: false,
	},
	phases: [],
};

describe("track region selection overlay", () => {
	test("positions a selected region within the full lap", () => {
		const [segment] = createVisibleTrackRegionSelectionSegments(CORNER_REGION, {
			startPercent: 0,
			endPercent: 100,
		});

		expect(segment?.startPercent).toBeCloseTo(20);
		expect(segment?.widthPercent).toBeCloseTo(8);
	});

	test("clips the selection to the current horizontal viewport", () => {
		const [segment] = createVisibleTrackRegionSelectionSegments(CORNER_REGION, {
			startPercent: 24,
			endPercent: 34,
		});

		expect(segment?.startPercent).toBeCloseTo(0);
		expect(segment?.widthPercent).toBeCloseTo(40);
	});

	test("hides a selected region outside the current viewport", () => {
		expect(
			createVisibleTrackRegionSelectionSegments(CORNER_REGION, {
				startPercent: 40,
				endPercent: 60,
			}),
		).toEqual([]);
	});
});
