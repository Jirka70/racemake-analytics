import { describe, expect, test } from "bun:test";
import { createFragmentSeriesRequestPath } from "../../../frontend/src/hooks/use-fragment-series-query";
import type { AnalysisId } from "../../../src/http/contracts";

const analysisId = `sha256:${"a".repeat(64)}` as AnalysisId;

describe("fragment series request", () => {
	test("requests one fragment and only the selected channels", () => {
		expect(
			createFragmentSeriesRequestPath(analysisId, {
				fragment: 1,
				channels: ["speedKmh", "steeringDegrees"],
			}),
		).toBe(
			`/fragment-series?analysisId=${encodeURIComponent(analysisId)}&fragment=1&channels=speedKmh%2CsteeringDegrees`,
		);
	});

	test("rejects an invalid fragment index before making a request", () => {
		expect(() =>
			createFragmentSeriesRequestPath(analysisId, { fragment: -1 }),
		).toThrow(RangeError);
	});
});
