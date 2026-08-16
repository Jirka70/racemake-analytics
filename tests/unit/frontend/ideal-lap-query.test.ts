import { describe, expect, test } from "bun:test";
import { createIdealLapRequestPath } from "../../../frontend/src/hooks/use-ideal-lap-query";
import type { AnalysisId } from "../../../src/http/contracts";

const ANALYSIS_ID = `sha256:${"a".repeat(64)}` as AnalysisId;

describe("ideal lap request path", () => {
	test("serializes channels and track range without lap numbers", () => {
		const path = createIdealLapRequestPath(ANALYSIS_ID, {
			channels: ["speedKmh", "brakeRatio"],
			positionFrom: 0.18,
			positionTo: 0.26,
		});
		const url = new URL(path, "http://localhost");

		expect(url.pathname).toBe("/ideal-lap");
		expect(url.searchParams.get("analysisId")).toBe(ANALYSIS_ID);
		expect(url.searchParams.get("channels")).toBe("speedKmh,brakeRatio");
		expect(url.searchParams.get("positionFrom")).toBe("0.18");
		expect(url.searchParams.get("positionTo")).toBe("0.26");
		expect(url.searchParams.has("laps")).toBeFalse();
	});

	test("keeps optional filters out of the request when omitted", () => {
		const path = createIdealLapRequestPath(ANALYSIS_ID, {});
		const url = new URL(path, "http://localhost");

		expect(url.searchParams.has("channels")).toBeFalse();
		expect(url.searchParams.has("positionFrom")).toBeFalse();
		expect(url.searchParams.has("positionTo")).toBeFalse();
	});

	test("rejects an empty channel selection", () => {
		expect(() =>
			createIdealLapRequestPath(ANALYSIS_ID, { channels: [] }),
		).toThrow("Selected ideal lap channels cannot be empty");
	});
});
