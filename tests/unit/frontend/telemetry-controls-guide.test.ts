import { describe, expect, test } from "bun:test";
import {
	createTelemetryControlsGuideSteps,
	hasSeenTelemetryControlsGuide,
	markTelemetryControlsGuideSeen,
	TELEMETRY_CONTROLS_GUIDE_STORAGE_KEY,
	type TelemetryControlsGuideStorage,
} from "../../../frontend/src/analysis/telemetry-controls-guide";

class MemoryGuideStorage implements TelemetryControlsGuideStorage {
	readonly values = new Map<string, string>();

	getItem(key: string): string | null {
		return this.values.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		this.values.set(key, value);
	}
}

describe("telemetry controls guide", () => {
	test("uses a versioned storage key and only becomes seen after dismissal", () => {
		const storage = new MemoryGuideStorage();

		expect(TELEMETRY_CONTROLS_GUIDE_STORAGE_KEY).toEndWith(".v3");
		expect(hasSeenTelemetryControlsGuide(storage)).toBe(false);
		expect(markTelemetryControlsGuideSeen(storage)).toBe(true);
		expect(hasSeenTelemetryControlsGuide(storage)).toBe(true);
	});

	test("fails open when browser storage is unavailable", () => {
		const unavailableStorage: TelemetryControlsGuideStorage = {
			getItem: () => {
				throw new Error("unavailable");
			},
			setItem: () => {
				throw new Error("unavailable");
			},
		};

		expect(hasSeenTelemetryControlsGuide(null)).toBe(false);
		expect(hasSeenTelemetryControlsGuide(unavailableStorage)).toBe(false);
		expect(markTelemetryControlsGuideSeen(unavailableStorage)).toBe(false);
	});

	test("describes only interactions supported by the chart", () => {
		const desktopSteps = createTelemetryControlsGuideSteps("desktop");
		const compactSteps = createTelemetryControlsGuideSteps("compact");
		const allCopy = [...desktopSteps, ...compactSteps]
			.flatMap((step) => [step.title, step.description])
			.join(" ");

		expect(desktopSteps.map((step) => step.id)).toEqual([
			"zoom",
			"move",
			"inspect",
		]);
		expect(allCopy).not.toMatch(/pinch|mouse wheel|scroll to zoom/i);
		expect(desktopSteps[1]?.description).toContain("drag the chart");
		expect(desktopSteps[2]?.description).toContain("highlight");
		expect(compactSteps[1]?.description).toContain("swipe");
		expect(compactSteps[2]?.description).toContain("Tap");
	});
});
