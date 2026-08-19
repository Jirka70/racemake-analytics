const MINIMUM_TRACK_POSITION_PERCENT = 0;
const MAXIMUM_TRACK_POSITION_PERCENT = 100;

export function readTelemetryChartCursorPosition(
	event: unknown,
): number | null {
	if (!isRecord(event) || event.currTrigger === "leave") return null;
	if (!Array.isArray(event.axesInfo)) return null;

	for (const axisInfo of event.axesInfo) {
		if (!isRecord(axisInfo) || axisInfo.axisDim !== "x") continue;

		const positionPercent = readFiniteNumber(axisInfo.value);
		if (positionPercent === null) continue;

		return Math.max(
			MINIMUM_TRACK_POSITION_PERCENT,
			Math.min(MAXIMUM_TRACK_POSITION_PERCENT, positionPercent),
		);
	}

	return null;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === "object" && value !== null;
}

function readFiniteNumber(value: unknown): number | null {
	const numericValue =
		typeof value === "number"
			? value
			: typeof value === "string" && value.trim() !== ""
				? Number(value)
				: Number.NaN;

	return Number.isFinite(numericValue) ? numericValue : null;
}
