import { describe, expect, test } from "bun:test";
import {
	createTelemetryViewportForRange,
	createTrackRegionSegments,
	createVisibleTrackRegionSegments,
	moveTelemetryViewport,
	resizeTelemetryViewport,
} from "../../../frontend/src/analysis/telemetry-viewport";
import type { CornerRegionResponse } from "../../../src/http/contracts";

describe("telemetry viewport", () => {
	test("zooms around the current center and clamps at lap boundaries", () => {
		expect(
			resizeTelemetryViewport({ startPercent: 80, endPercent: 100 }, 40),
		).toEqual({ startPercent: 60, endPercent: 100 });
	});

	test("moves a zoomed viewport without changing its visible span", () => {
		expect(
			moveTelemetryViewport({ startPercent: 15, endPercent: 55 }, 42),
		).toEqual({ startPercent: 42, endPercent: 82 });
	});

	test("clamps horizontal viewport movement at both lap boundaries", () => {
		expect(
			moveTelemetryViewport({ startPercent: 20, endPercent: 50 }, -12),
		).toEqual({ startPercent: 0, endPercent: 30 });
		expect(
			moveTelemetryViewport({ startPercent: 20, endPercent: 50 }, 92),
		).toEqual({ startPercent: 70, endPercent: 100 });
	});

	test("keeps a useful minimum span when zooming to a short region", () => {
		expect(createTelemetryViewportForRange(18, 22)).toEqual({
			startPercent: 15,
			endPercent: 25,
		});
	});

	test("splits a start-finish corner without duplicating its label", () => {
		const corner: CornerRegionResponse = {
			type: "corner",
			id: "C1" as CornerRegionResponse["id"],
			interval: {
				startNormalizedTrackPosition: 0.96,
				endNormalizedTrackPosition: 0.03,
				crossesStartFinishLine: true,
			},
			phases: [],
		};

		const segments = createTrackRegionSegments([corner]);

		expect(segments).toHaveLength(2);
		expect(segments.map((segment) => segment.showsLabel)).toEqual([
			false,
			true,
		]);
		expect(
			segments.map(({ startPercent, endPercent }) => [
				startPercent,
				endPercent,
			]),
		).toEqual([
			[0, 3],
			[96, 100],
		]);
	});

	test("projects visible regions into the same horizontal viewport as the charts", () => {
		const corner: CornerRegionResponse = {
			type: "corner",
			id: "C6" as CornerRegionResponse["id"],
			interval: {
				startNormalizedTrackPosition: 0.71,
				endNormalizedTrackPosition: 0.78,
				crossesStartFinishLine: false,
			},
			phases: [],
		};

		const [segment] = createVisibleTrackRegionSegments([corner], {
			startPercent: 24,
			endPercent: 77,
		});

		expect(segment?.startPercent).toBeCloseTo(88.68, 2);
		expect(segment?.endPercent).toBeCloseTo(100, 2);
		expect(segment?.showsLabel).toBe(true);
	});

	test("hides regions outside the visible chart range", () => {
		const corner: CornerRegionResponse = {
			type: "corner",
			id: "C1" as CornerRegionResponse["id"],
			interval: {
				startNormalizedTrackPosition: 0.04,
				endNormalizedTrackPosition: 0.11,
				crossesStartFinishLine: false,
			},
			phases: [],
		};

		expect(
			createVisibleTrackRegionSegments([corner], {
				startPercent: 24,
				endPercent: 77,
			}),
		).toEqual([]);
	});
});
