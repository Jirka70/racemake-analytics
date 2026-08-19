export const TELEMETRY_CONTROLS_GUIDE_STORAGE_KEY =
	"racemake.telemetry-controls-guide.v3";

const TELEMETRY_CONTROLS_GUIDE_SEEN_VALUE = "seen";

export interface TelemetryControlsGuideStorage {
	readonly getItem: (key: string) => string | null;
	readonly setItem: (key: string, value: string) => void;
}

export type TelemetryControlsGuideStepId = "zoom" | "move" | "inspect";

export interface TelemetryControlsGuideStep {
	readonly id: TelemetryControlsGuideStepId;
	readonly title: string;
	readonly description: string;
}

export function createTelemetryControlsGuideSteps(
	presentation: "desktop" | "compact",
): readonly TelemetryControlsGuideStep[] {
	return [
		{
			id: "zoom",
			title: "Zoom the chart",
			description:
				"Drag the zoom slider or use the magnifier buttons below the chart.",
		},
		{
			id: "move",
			title: "Move through the lap",
			description:
				presentation === "compact"
					? "After zooming in, swipe left or right on the chart to move."
					: "After zooming in, drag the chart or swipe horizontally on a trackpad to move.",
		},
		{
			id: "inspect",
			title: "Inspect a series",
			description:
				presentation === "compact"
					? "Tap a telemetry line to inspect its values."
					: "Move over a telemetry line to highlight it, then click that highlighted line to inspect it.",
		},
	];
}

export function hasSeenTelemetryControlsGuide(
	storage: TelemetryControlsGuideStorage | null,
): boolean {
	if (storage === null) return false;

	try {
		return (
			storage.getItem(TELEMETRY_CONTROLS_GUIDE_STORAGE_KEY) ===
			TELEMETRY_CONTROLS_GUIDE_SEEN_VALUE
		);
	} catch {
		return false;
	}
}

export function markTelemetryControlsGuideSeen(
	storage: TelemetryControlsGuideStorage | null,
): boolean {
	if (storage === null) return false;

	try {
		storage.setItem(
			TELEMETRY_CONTROLS_GUIDE_STORAGE_KEY,
			TELEMETRY_CONTROLS_GUIDE_SEEN_VALUE,
		);
		return true;
	} catch {
		return false;
	}
}
