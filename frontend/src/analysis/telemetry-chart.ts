import type {
	AvailableIdealLapResponse,
	SeriesResponse,
	TyreCoreTemperatureSeriesResponse,
} from "../../../src/http/contracts";

export type TelemetryChartLapRole = "reviewed" | "second" | "ideal";
export type TelemetryChartMeasurement =
	| "time-delta"
	| "speed"
	| "pedal"
	| "steering"
	| "gear"
	| "rpm"
	| "tyre-temperature";
export type TelemetryChartLineStyle = "solid" | "dashed" | "dotted";

export interface TelemetryChartLine {
	readonly id: string;
	readonly name: string;
	readonly role: TelemetryChartLapRole;
	readonly measurement: TelemetryChartMeasurement;
	readonly points: readonly (readonly [number, number | null])[];
	readonly lineStyle?: TelemetryChartLineStyle;
	readonly opacity?: number;
}

type TelemetryChartLines = readonly TelemetryChartLine[];

export interface TelemetryChartModel {
	readonly timeDelta: TelemetryChartLine;
	readonly idealTimeDelta: TelemetryChartLine | null;
	readonly speed: TelemetryChartLines | null;
	readonly pedals: TelemetryChartLines | null;
	readonly steering: TelemetryChartLines | null;
	readonly gear: TelemetryChartLines | null;
	readonly rpm: TelemetryChartLines | null;
	readonly tyreTemperatures: readonly TelemetryChartLine[] | null;
	readonly maximumAbsoluteTimeDeltaSeconds: number;
	readonly maximumSpeedKmh: number;
	readonly maximumAbsoluteSteeringDegrees: number;
	readonly maximumRpm: number;
	readonly minimumTyreTemperatureC: number;
	readonly maximumTyreTemperatureC: number;
}

const TYRE_SERIES = [
	["frontLeft", "FL", "solid", 1],
	["frontRight", "FR", "dashed", 0.9],
	["rearLeft", "RL", "dotted", 0.8],
	["rearRight", "RR", "dashed", 0.65],
] as const satisfies readonly (readonly [
	keyof TyreCoreTemperatureSeriesResponse,
	string,
	TelemetryChartLineStyle,
	number,
])[];

export function createTelemetryChartModel(
	series: SeriesResponse,
	reviewedLapNumber: number,
	secondLapNumber: number,
	idealLap: AvailableIdealLapResponse | null = null,
): TelemetryChartModel | null {
	const reviewedLap = series.laps.find(
		(lap) => lap.lapNumber === reviewedLapNumber,
	);
	const secondLap = series.laps.find(
		(lap) => lap.lapNumber === secondLapNumber,
	);

	if (!reviewedLap || !secondLap) return null;

	const positions = series.grid.normalizedTrackPositions;
	const reviewedPrefix = `reviewed-lap-${reviewedLapNumber}`;
	const secondPrefix = `second-lap-${secondLapNumber}`;
	const reviewedChannels = reviewedLap.channels;
	const secondChannels = secondLap.channels;
	const alignedIdealLap = hasMatchingGrid(series, idealLap) ? idealLap : null;
	const idealElapsedMs = alignedIdealLap?.lapElapsedMs ?? null;
	const timeDeltaPoints = createTimeDeltaPoints(
		positions,
		reviewedLap.lapElapsedMs,
		secondLap.lapElapsedMs,
	);
	const idealTimeDeltaPoints = idealElapsedMs
		? createTimeDeltaPoints(positions, idealElapsedMs, secondLap.lapElapsedMs)
		: null;
	const speed = createLapLines(
		positions,
		reviewedChannels.speedKmh,
		secondChannels.speedKmh,
		{
			reviewedPrefix,
			secondPrefix,
			reviewedLapNumber,
			secondLapNumber,
			idSuffix: "speed",
			measurement: "speed",
		},
		createIdealLine(
			positions,
			alignedIdealLap?.channels.speedKmh,
			"speed",
			"speed",
		),
	);
	const steering = createLapLines(
		positions,
		reviewedChannels.steeringDegrees,
		secondChannels.steeringDegrees,
		{
			reviewedPrefix,
			secondPrefix,
			reviewedLapNumber,
			secondLapNumber,
			idSuffix: "steering",
			measurement: "steering",
		},
		createIdealLine(
			positions,
			alignedIdealLap?.channels.steeringDegrees,
			"steering",
			"steering",
		),
	);
	const gear = createLapLines(
		positions,
		reviewedChannels.gear,
		secondChannels.gear,
		{
			reviewedPrefix,
			secondPrefix,
			reviewedLapNumber,
			secondLapNumber,
			idSuffix: "gear",
			measurement: "gear",
		},
		createIdealLine(
			positions,
			alignedIdealLap?.channels.gear,
			"gear",
			"gear",
		),
	);
	const rpm = createLapLines(
		positions,
		reviewedChannels.engineRpm,
		secondChannels.engineRpm,
		{
			reviewedPrefix,
			secondPrefix,
			reviewedLapNumber,
			secondLapNumber,
			idSuffix: "rpm",
			measurement: "rpm",
		},
		createIdealLine(
			positions,
			alignedIdealLap?.channels.engineRpm,
			"rpm",
			"rpm",
		),
	);
	const pedals = createPedalLines(
		positions,
		reviewedChannels.throttleRatio,
		reviewedChannels.brakeRatio,
		secondChannels.throttleRatio,
		secondChannels.brakeRatio,
		{
			reviewedPrefix,
			secondPrefix,
			reviewedLapNumber,
			secondLapNumber,
		},
		createIdealPedalLine(positions, alignedIdealLap),
	);
	const tyreTemperatures = createTyreTemperatureLines(
		positions,
		reviewedChannels.tyreCoreTemperatureC,
		secondChannels.tyreCoreTemperatureC,
		{
			reviewedPrefix,
			secondPrefix,
			reviewedLapNumber,
			secondLapNumber,
		},
		createIdealTyreTemperatureLines(positions, alignedIdealLap),
	);
	const tyreTemperatureRange = findValueRange(
		tyreTemperatures?.flatMap((line) => line.points) ?? [],
	);

	return {
		timeDelta: {
			id: `${reviewedPrefix}-time-delta`,
			name: `Lap ${reviewedLapNumber} vs Lap ${secondLapNumber}`,
			role: "reviewed",
			measurement: "time-delta",
			points: timeDeltaPoints,
		},
		idealTimeDelta:
			idealTimeDeltaPoints === null
				? null
				: {
						id: "ideal-time-delta",
						name: "Ideal",
						role: "ideal",
						measurement: "time-delta",
						points: idealTimeDeltaPoints,
						lineStyle: "dotted",
						opacity: 0.8,
					},
		speed,
		pedals,
		steering,
		gear,
		rpm,
		tyreTemperatures,
		maximumAbsoluteTimeDeltaSeconds: roundRange(
			findMaximumAbsoluteValue([
				...timeDeltaPoints,
				...(idealTimeDeltaPoints ?? []),
			]),
			0.1,
		),
		maximumSpeedKmh: roundRange(
			findMaximumValue(speed?.flatMap((line) => line.points) ?? []),
			50,
		),
		maximumAbsoluteSteeringDegrees: roundRange(
			findMaximumAbsoluteValue(steering?.flatMap((line) => line.points) ?? []),
			50,
		),
		maximumRpm: roundRange(
			findMaximumValue(rpm?.flatMap((line) => line.points) ?? []),
			1_000,
		),
		minimumTyreTemperatureC:
			Math.floor((tyreTemperatureRange?.minimum ?? 0) / 5) * 5,
		maximumTyreTemperatureC:
			Math.ceil((tyreTemperatureRange?.maximum ?? 100) / 5) * 5,
	};
}

function createLapLines(
	positions: readonly number[],
	reviewedValues: readonly (number | null)[] | undefined,
	secondValues: readonly (number | null)[] | undefined,
	metadata: {
		readonly reviewedPrefix: string;
		readonly secondPrefix: string;
		readonly reviewedLapNumber: number;
		readonly secondLapNumber: number;
		readonly idSuffix: string;
		readonly measurement: TelemetryChartMeasurement;
	},
	idealLine: TelemetryChartLine | null,
): TelemetryChartLines | null {
	if (!reviewedValues || !secondValues) return null;

	return [
		createLine(
			`${metadata.reviewedPrefix}-${metadata.idSuffix}`,
			`Lap ${metadata.reviewedLapNumber}`,
			"reviewed",
			metadata.measurement,
			positions,
			reviewedValues,
		),
		createLine(
			`${metadata.secondPrefix}-${metadata.idSuffix}`,
			`Lap ${metadata.secondLapNumber}`,
			"second",
			metadata.measurement,
			positions,
			secondValues,
		),
		...(idealLine ? [idealLine] : []),
	];
}

function createPedalLines(
	positions: readonly number[],
	reviewedThrottleRatios: readonly (number | null)[] | undefined,
	reviewedBrakeRatios: readonly (number | null)[] | undefined,
	secondThrottleRatios: readonly (number | null)[] | undefined,
	secondBrakeRatios: readonly (number | null)[] | undefined,
	metadata: {
		readonly reviewedPrefix: string;
		readonly secondPrefix: string;
		readonly reviewedLapNumber: number;
		readonly secondLapNumber: number;
	},
	idealLine: TelemetryChartLine | null,
): TelemetryChartLines | null {
	if (
		!reviewedThrottleRatios ||
		!reviewedBrakeRatios ||
		!secondThrottleRatios ||
		!secondBrakeRatios
	) {
		return null;
	}

	return [
		createPedalLine(
			`${metadata.reviewedPrefix}-pedal`,
			`Lap ${metadata.reviewedLapNumber}`,
			"reviewed",
			positions,
			reviewedThrottleRatios,
			reviewedBrakeRatios,
		),
		createPedalLine(
			`${metadata.secondPrefix}-pedal`,
			`Lap ${metadata.secondLapNumber}`,
			"second",
			positions,
			secondThrottleRatios,
			secondBrakeRatios,
		),
		...(idealLine ? [idealLine] : []),
	];
}

function createTyreTemperatureLines(
	positions: readonly number[],
	reviewedTyres: TyreCoreTemperatureSeriesResponse | undefined,
	secondTyres: TyreCoreTemperatureSeriesResponse | undefined,
	metadata: {
		readonly reviewedPrefix: string;
		readonly secondPrefix: string;
		readonly reviewedLapNumber: number;
		readonly secondLapNumber: number;
	},
	idealLines: readonly TelemetryChartLine[],
): readonly TelemetryChartLine[] | null {
	if (!reviewedTyres || !secondTyres) return null;

	return [
		...TYRE_SERIES.flatMap(([tyreKey, tyreLabel, lineStyle, opacity]) => [
			{
				...createLine(
					`${metadata.reviewedPrefix}-tyre-temperature-${tyreKey}`,
					`Lap ${metadata.reviewedLapNumber} ${tyreLabel}`,
					"reviewed",
					"tyre-temperature",
					positions,
					reviewedTyres[tyreKey],
				),
				lineStyle,
				opacity,
			},
			{
				...createLine(
					`${metadata.secondPrefix}-tyre-temperature-${tyreKey}`,
					`Lap ${metadata.secondLapNumber} ${tyreLabel}`,
					"second",
					"tyre-temperature",
					positions,
					secondTyres[tyreKey],
				),
				lineStyle,
				opacity,
			},
		]),
		...idealLines,
	];
}

function createIdealLine(
	positions: readonly number[],
	values: readonly (number | null)[] | undefined,
	idSuffix: string,
	measurement: TelemetryChartMeasurement,
): TelemetryChartLine | null {
	if (!values?.some((value) => value !== null)) return null;

	return {
		...createLine(
			`ideal-${idSuffix}`,
			"Ideal",
			"ideal",
			measurement,
			positions,
			values,
		),
		lineStyle: "dotted",
		opacity: 0.8,
	};
}

function createIdealPedalLine(
	positions: readonly number[],
	idealLap: AvailableIdealLapResponse | null,
): TelemetryChartLine | null {
	const throttleRatios = idealLap?.channels.throttleRatio;
	const brakeRatios = idealLap?.channels.brakeRatio;
	if (!throttleRatios || !brakeRatios) return null;

	const values = positions.map((_, index) => {
		const throttleRatio = throttleRatios[index] ?? null;
		const brakeRatio = brakeRatios[index] ?? null;
		if (throttleRatio === null || brakeRatio === null) return null;

		return (brakeRatio > throttleRatio ? -brakeRatio : throttleRatio) * 100;
	});

	return createIdealLine(positions, values, "pedal", "pedal");
}

function createIdealTyreTemperatureLines(
	positions: readonly number[],
	idealLap: AvailableIdealLapResponse | null,
): readonly TelemetryChartLine[] {
	return TYRE_SERIES.flatMap(([tyreKey, tyreLabel], index) => {
		const line = createIdealLine(
			positions,
			idealLap?.channels.tyreCoreTemperatureC?.[tyreKey],
			`tyre-temperature-${tyreKey}`,
			"tyre-temperature",
		);
		if (line === null) return [];

		return [
			{
				...line,
				name: `Ideal ${tyreLabel}`,
				opacity: Math.max(0.45, 0.8 - index * 0.1),
			},
		];
	});
}

function hasMatchingGrid(
	series: SeriesResponse,
	idealLap: AvailableIdealLapResponse | null,
): idealLap is AvailableIdealLapResponse {
	if (idealLap === null) return false;

	const seriesPositions = series.grid.normalizedTrackPositions;
	const idealPositions = idealLap.grid.normalizedTrackPositions;
	return (
		seriesPositions.length === idealPositions.length &&
		seriesPositions.every((position, index) => position === idealPositions[index])
	);
}

function createPedalLine(
	id: string,
	name: string,
	role: TelemetryChartLapRole,
	positions: readonly number[],
	throttleRatios: readonly (number | null)[],
	brakeRatios: readonly (number | null)[],
): TelemetryChartLine {
	return {
		id,
		name,
		role,
		measurement: "pedal",
		points: positions.map((position, index) => {
			const throttleRatio = throttleRatios[index] ?? null;
			const brakeRatio = brakeRatios[index] ?? null;
			if (throttleRatio === null || brakeRatio === null) {
				return [position * 100, null] as const;
			}

			const dominantPedalRatio =
				brakeRatio > throttleRatio ? -brakeRatio : throttleRatio;
			return [position * 100, dominantPedalRatio * 100] as const;
		}),
	};
}

function createLine(
	id: string,
	name: string,
	role: TelemetryChartLapRole,
	measurement: TelemetryChartMeasurement,
	positions: readonly number[],
	values: readonly (number | null)[],
): TelemetryChartLine {
	return {
		id,
		name,
		role,
		measurement,
		points: positions.map((position, index) => {
			const value = values[index] ?? null;
			return [position * 100, value] as const;
		}),
	};
}

function createTimeDeltaPoints(
	positions: readonly number[],
	reviewedLapElapsedMs: readonly (number | null)[],
	secondLapElapsedMs: readonly (number | null)[],
): readonly (readonly [number, number | null])[] {
	const firstDifferenceMs = findFirstElapsedDifferenceMs(
		reviewedLapElapsedMs,
		secondLapElapsedMs,
	);

	return positions.map((position, index) => {
		const reviewedLapElapsedMsAtPosition = reviewedLapElapsedMs[index] ?? null;
		const secondLapElapsedMsAtPosition = secondLapElapsedMs[index] ?? null;
		const differenceSeconds =
			firstDifferenceMs === null ||
			reviewedLapElapsedMsAtPosition === null ||
			secondLapElapsedMsAtPosition === null
				? null
				: (reviewedLapElapsedMsAtPosition -
						secondLapElapsedMsAtPosition -
						firstDifferenceMs) /
					1000;

		return [position * 100, differenceSeconds] as const;
	});
}

function findFirstElapsedDifferenceMs(
	reviewedLapElapsedMs: readonly (number | null)[],
	secondLapElapsedMs: readonly (number | null)[],
): number | null {
	for (let index = 0; index < reviewedLapElapsedMs.length; index++) {
		const reviewed = reviewedLapElapsedMs[index] ?? null;
		const second = secondLapElapsedMs[index] ?? null;
		if (reviewed !== null && second !== null) return reviewed - second;
	}

	return null;
}

function findMaximumValue(
	points: readonly (readonly [number, number | null])[],
): number {
	return points.reduce(
		(maximum, [, value]) =>
			value === null ? maximum : Math.max(maximum, value),
		0,
	);
}

function findMaximumAbsoluteValue(
	points: readonly (readonly [number, number | null])[],
): number {
	return points.reduce(
		(maximum, [, value]) =>
			value === null ? maximum : Math.max(maximum, Math.abs(value)),
		0,
	);
}

function findValueRange(
	points: readonly (readonly [number, number | null])[],
): { readonly minimum: number; readonly maximum: number } | null {
	let minimum = Number.POSITIVE_INFINITY;
	let maximum = Number.NEGATIVE_INFINITY;

	for (const [, value] of points) {
		if (value === null) continue;
		minimum = Math.min(minimum, value);
		maximum = Math.max(maximum, value);
	}

	return Number.isFinite(minimum) && Number.isFinite(maximum)
		? { minimum, maximum }
		: null;
}

function roundRange(value: number, step: number): number {
	return Math.max(step, Math.ceil(value / step) * step);
}
