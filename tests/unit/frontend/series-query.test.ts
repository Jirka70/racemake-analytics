import { describe, expect, test } from "bun:test";
import { createSeriesRequestPath } from "../../../frontend/src/hooks/use-series-query";
import type { AnalysisId } from "../../../src/http/contracts";

const ANALYSIS_ID = `sha256:${"a".repeat(64)}` as AnalysisId;

describe("series request path", () => {
	test("serializes the selected laps, channels, and track range", () => {
		const path = createSeriesRequestPath(ANALYSIS_ID, {
			laps: [2, 4],
			channels: ["speedKmh", "brakeRatio", "gear"],
			positionFrom: 0.18,
			positionTo: 0.26,
		});
		const url = new URL(path, "http://localhost");

		expect(url.pathname).toBe("/series");
		expect(url.searchParams.get("analysisId")).toBe(ANALYSIS_ID);
		expect(url.searchParams.get("laps")).toBe("2,4");
		expect(url.searchParams.get("channels")).toBe(
			"speedKmh,brakeRatio,gear",
		);
		expect(url.searchParams.get("positionFrom")).toBe("0.18");
		expect(url.searchParams.get("positionTo")).toBe("0.26");
	});

	test("keeps optional filters out of the request when omitted", () => {
		const path = createSeriesRequestPath(ANALYSIS_ID, { laps: [3] });
		const url = new URL(path, "http://localhost");

		expect(url.searchParams.get("laps")).toBe("3");
		expect(url.searchParams.has("channels")).toBeFalse();
		expect(url.searchParams.has("positionFrom")).toBeFalse();
		expect(url.searchParams.has("positionTo")).toBeFalse();
	});

	test("rejects an empty lap selection", () => {
		expect(() => createSeriesRequestPath(ANALYSIS_ID, { laps: [] })).toThrow(
			"A series request requires at least one lap",
		);
	});
});
