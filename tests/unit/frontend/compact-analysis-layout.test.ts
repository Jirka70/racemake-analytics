import { describe, expect, test } from "bun:test";
import { isCompactAnalysisViewport } from "../../../frontend/src/hooks/use-compact-analysis-layout";

describe("compact analysis layout", () => {
	test("covers narrow desktop and tablet-sized viewports without affecting full desktop", () => {
		expect(isCompactAnalysisViewport(390)).toBe(true);
		expect(isCompactAnalysisViewport(800)).toBe(true);
		expect(isCompactAnalysisViewport(1023)).toBe(true);
		expect(isCompactAnalysisViewport(1024)).toBe(true);
		expect(isCompactAnalysisViewport(1279)).toBe(true);
		expect(isCompactAnalysisViewport(1280)).toBe(false);
	});
});
