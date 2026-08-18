import { describe, expect, test } from "bun:test";
import {
	calculateLapTelemetryCoverageRatio,
	calculateSamplingGapRatio,
	createSamplingGapPositionSegments,
	createVisibleSamplingGapSegments,
	findVisibleSamplingGaps,
	MINIMUM_VISIBLE_SAMPLING_GAP_RATIO,
} from "../../../frontend/src/analysis/telemetry-gaps";
import type { LapSamplingGapResponse } from "../../../src/http/contracts";

describe("telemetry gap presentation", () => {
	test("shows a material gap only for a selected lap", () => {
		const gap = createGap({ lapNumber: 1, fromPosition: 0.5, toPosition: 0.545 });

		expect(findVisibleSamplingGaps([gap], [1])).toEqual([gap]);
		expect(findVisibleSamplingGaps([gap], [2])).toEqual([]);
	});

	test("keeps gaps below the named visual threshold in diagnostics only", () => {
		const gap = createGap({
			fromPosition: 0.5,
			toPosition: 0.5 + MINIMUM_VISIBLE_SAMPLING_GAP_RATIO - 0.001,
		});

		expect(findVisibleSamplingGaps([gap], [1])).toEqual([]);
	});

	test("calculates lap coverage from all reported gaps", () => {
		const gaps = [
			createGap({ fromPosition: 0.1, toPosition: 0.15 }),
			createGap({ fromPosition: 0.7, toPosition: 0.72 }),
		];

		expect(calculateLapTelemetryCoverageRatio(gaps)).toBeCloseTo(0.93);
	});

	test("splits a start-finish gap into two exact position segments", () => {
		const gap = createGap({ fromPosition: 0.98, toPosition: 0.02 });

		expect(calculateSamplingGapRatio(gap)).toBeCloseTo(0.04);
		expect(createSamplingGapPositionSegments(gap)).toEqual([
			{ startPercent: 98, endPercent: 100 },
			{ startPercent: 0, endPercent: 2 },
		]);
	});

	test("clips the amber band to the current horizontal viewport", () => {
		const gap = createGap({ fromPosition: 0.5, toPosition: 0.55 });

		const [segment] = createVisibleSamplingGapSegments([gap], {
			startPercent: 52,
			endPercent: 72,
		});

		expect(segment?.gap).toBe(gap);
		expect(segment?.startPercent).toBe(0);
		expect(segment?.endPercent).toBeCloseTo(15);
	});
});

function createGap(
	overrides: Partial<LapSamplingGapResponse> = {},
): LapSamplingGapResponse {
	return {
		lapNumber: 1,
		code: "SAMPLING_GAP_WITHIN_LAP",
		severity: "warning",
		message: "Missing telemetry",
		gapStartTimestampMs: 1_000,
		gapEndTimestampMs: 3_000,
		gapDurationMs: 2_000,
		fromPosition: 0.5,
		toPosition: 0.55,
		...overrides,
	};
}
