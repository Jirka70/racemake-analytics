import type {
	TelemetryChartLapRole,
	TelemetryChartLine,
	TelemetryChartMeasurement,
} from "./telemetry-chart";
import type { TelemetryViewport } from "./telemetry-viewport";

export interface TelemetrySeriesClick {
	readonly seriesId: string;
	readonly positionPercent: number;
}

export interface TelemetrySeriesPixelHit {
	readonly seriesId: string;
	readonly positionPercent: number;
	readonly pixelX: number;
	readonly pixelY: number;
}

export interface TelemetrySeriesComparison {
	readonly lineId: string;
	readonly lineName: string;
	readonly role: TelemetryChartLapRole;
	readonly value: number | null;
}

export interface TelemetrySeriesSelection {
	readonly lineId: string;
	readonly lineName: string;
	readonly role: TelemetryChartLapRole;
	readonly measurement: TelemetryChartMeasurement;
	readonly positionPercent: number;
	readonly value: number;
	readonly comparison: TelemetrySeriesComparison | null;
	readonly difference: number | null;
	readonly telemetryStatus: "complete" | "partial";
}

export function readTelemetrySeriesClick(
	event: unknown,
): TelemetrySeriesClick | null {
	if (typeof event !== "object" || event === null) return null;

	const record = event as Readonly<Record<string, unknown>>;
	if (
		(record.componentType !== "series" &&
			record.componentType !== "markPoint") ||
		typeof record.seriesId !== "string"
	) {
		return null;
	}

	const point = readSeriesPoint(record.value ?? record.data);
	if (point === null) return null;

	return {
		seriesId: record.seriesId,
		positionPercent: point[0],
	};
}

export function createTelemetrySeriesSelection(
	lines: readonly TelemetryChartLine[],
	click: TelemetrySeriesClick,
	telemetryStatus: TelemetrySeriesSelection["telemetryStatus"],
): TelemetrySeriesSelection | null {
	const selectedLine = lines.find((line) => line.id === click.seriesId);
	if (!selectedLine) return null;

	const selectedPoint = findNearestPoint(
		selectedLine.points,
		click.positionPercent,
	);
	if (selectedPoint === null || selectedPoint[1] === null) return null;

	const comparisonLine = findComparisonLine(lines, selectedLine);
	const comparisonPoint = comparisonLine
		? findNearestPoint(comparisonLine.points, selectedPoint[0])
		: null;
	const comparisonValue = comparisonPoint?.[1] ?? null;

	return {
		lineId: selectedLine.id,
		lineName: selectedLine.name,
		role: selectedLine.role,
		measurement: selectedLine.measurement,
		positionPercent: selectedPoint[0],
		value: selectedPoint[1],
		comparison:
			comparisonLine === null
				? null
				: {
						lineId: comparisonLine.id,
						lineName: comparisonLine.name,
						role: comparisonLine.role,
						value: comparisonValue,
					},
		difference:
			comparisonValue === null ? null : selectedPoint[1] - comparisonValue,
		telemetryStatus,
	};
}

export function createTelemetryGuideSelectionClick(
	lines: readonly TelemetryChartLine[],
	viewport: TelemetryViewport,
): TelemetrySeriesClick | null {
	const demonstrationPosition =
		viewport.startPercent +
		(viewport.endPercent - viewport.startPercent) * 0.68;
	const preferredLines = [
		...lines.filter(
			(line) => line.role === "reviewed" && line.measurement === "speed",
		),
		...lines.filter(
			(line) => line.role === "reviewed" && line.measurement !== "speed",
		),
		...lines.filter((line) => line.role !== "reviewed"),
	];

	for (const line of preferredLines) {
		let nearestPoint: readonly [number, number | null] | null = null;
		let nearestDistance = Number.POSITIVE_INFINITY;

		for (const point of line.points) {
			if (
				point[1] === null ||
				point[0] < viewport.startPercent ||
				point[0] > viewport.endPercent
			) {
				continue;
			}

			const distance = Math.abs(point[0] - demonstrationPosition);
			if (distance >= nearestDistance) continue;
			nearestPoint = point;
			nearestDistance = distance;
		}

		if (nearestPoint !== null) {
			return {
				seriesId: line.id,
				positionPercent: nearestPoint[0],
			};
		}
	}

	return null;
}

export function findNearestTelemetrySeriesHit(
	hits: readonly TelemetrySeriesPixelHit[],
	pointerX: number,
	pointerY: number,
	maximumDistancePx: number,
): TelemetrySeriesClick | null {
	let nearestHit: TelemetrySeriesPixelHit | null = null;
	let nearestDistance = Math.max(0, maximumDistancePx);

	for (const hit of hits) {
		const distance = Math.hypot(hit.pixelX - pointerX, hit.pixelY - pointerY);
		if (distance > nearestDistance) continue;
		if (nearestHit !== null && distance === nearestDistance) continue;

		nearestHit = hit;
		nearestDistance = distance;
	}

	return nearestHit === null
		? null
		: {
				seriesId: nearestHit.seriesId,
				positionPercent: nearestHit.positionPercent,
			};
}

export function findTelemetrySeriesClickHit(
	hits: readonly TelemetrySeriesPixelHit[],
	pointerX: number,
	pointerY: number,
	maximumDistancePx: number,
	highlightedSeriesId: string | null,
): TelemetrySeriesClick | null {
	if (highlightedSeriesId === null) return null;

	const maximumDistance = Math.max(0, maximumDistancePx);
	const highlightedHit = hits.find(
		(hit) =>
			hit.seriesId === highlightedSeriesId &&
			Math.hypot(hit.pixelX - pointerX, hit.pixelY - pointerY) <=
				maximumDistance,
	);

	return highlightedHit === undefined
		? null
		: {
				seriesId: highlightedHit.seriesId,
				positionPercent: highlightedHit.positionPercent,
			};
}

export function findStableTelemetrySeriesHoverHit(
	hits: readonly TelemetrySeriesPixelHit[],
	pointerX: number,
	pointerY: number,
	maximumDistancePx: number,
	currentSeriesId: string | null,
	switchAdvantagePx: number,
): TelemetrySeriesClick | null {
	const maximumDistance = Math.max(0, maximumDistancePx);
	const switchAdvantage = Math.max(0, switchAdvantagePx);
	let nearestHit: TelemetrySeriesPixelHit | null = null;
	let nearestDistance = maximumDistance;
	let currentHit: TelemetrySeriesPixelHit | null = null;
	let currentDistance = Number.POSITIVE_INFINITY;

	for (const hit of hits) {
		const distance = Math.hypot(hit.pixelX - pointerX, hit.pixelY - pointerY);
		if (distance > maximumDistance) continue;

		if (hit.seriesId === currentSeriesId && distance < currentDistance) {
			currentHit = hit;
			currentDistance = distance;
		}
		if (distance > nearestDistance) continue;
		if (nearestHit !== null && distance === nearestDistance) continue;

		nearestHit = hit;
		nearestDistance = distance;
	}

	if (nearestHit === null) return null;

	const stableHit =
		currentHit !== null &&
		nearestHit.seriesId !== currentHit.seriesId &&
		nearestDistance + switchAdvantage >= currentDistance
			? currentHit
			: nearestHit;

	return {
		seriesId: stableHit.seriesId,
		positionPercent: stableHit.positionPercent,
	};
}

export function findNearestTelemetrySeriesPoint(
	points: readonly (readonly [number, number | null])[],
	positionPercent: number,
): readonly [number, number | null] | null {
	return findNearestPoint(points, positionPercent);
}

function findComparisonLine(
	lines: readonly TelemetryChartLine[],
	selectedLine: TelemetryChartLine,
): TelemetryChartLine | null {
	const rolePreference = getComparisonRolePreference(selectedLine.role);
	const variant = getLineVariant(selectedLine);

	for (const role of rolePreference) {
		const match = lines.find(
			(line) =>
				line.role === role &&
				line.measurement === selectedLine.measurement &&
				getLineVariant(line) === variant,
		);
		if (match) return match;
	}

	return null;
}

function getComparisonRolePreference(
	role: TelemetryChartLapRole,
): readonly TelemetryChartLapRole[] {
	if (role === "reviewed") return ["second", "ideal"];
	if (role === "second") return ["reviewed", "ideal"];
	return ["reviewed", "second"];
}

function getLineVariant(line: TelemetryChartLine): string {
	if (line.measurement !== "tyre-temperature") return line.measurement;

	const variantPrefix = "tyre-temperature-";
	const variantIndex = line.id.lastIndexOf(variantPrefix);
	return variantIndex === -1
		? line.measurement
		: line.id.slice(variantIndex + variantPrefix.length);
}

function findNearestPoint(
	points: readonly (readonly [number, number | null])[],
	positionPercent: number,
): readonly [number, number | null] | null {
	let nearestPoint: readonly [number, number | null] | null = null;
	let nearestDistance = Number.POSITIVE_INFINITY;

	for (const point of points) {
		const distance = Math.abs(point[0] - positionPercent);
		if (distance >= nearestDistance) continue;

		nearestPoint = point;
		nearestDistance = distance;
	}

	return nearestPoint;
}

function readSeriesPoint(
	value: unknown,
): readonly [number, number | null] | null {
	if (typeof value === "object" && value !== null && "coord" in value) {
		return readSeriesPoint(value.coord);
	}
	if (!Array.isArray(value) || value.length < 2) return null;

	const position = value[0];
	const measurement = value[1];
	if (typeof position !== "number" || !Number.isFinite(position)) return null;
	if (
		measurement !== null &&
		(typeof measurement !== "number" || !Number.isFinite(measurement))
	) {
		return null;
	}

	return [position, measurement];
}
