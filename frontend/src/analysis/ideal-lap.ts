import type {
	LapSeriesResponse,
	SeriesResponse,
	TimeLossResponse,
	TrackRegionResponse,
} from "../../../src/http/contracts";

export interface IdealLapRegionSource {
	readonly region: TrackRegionResponse;
	readonly sourceLapNumber: number;
	readonly durationMs: number;
}

export interface IdealLapDefinition {
	readonly durationMs: number;
	readonly regions: readonly IdealLapRegionSource[];
}

export function createIdealLapDefinition(
	timeLoss: TimeLossResponse | null,
	trackRegions: readonly TrackRegionResponse[],
): IdealLapDefinition | null {
	if (!timeLoss?.idealLap) return null;
	if (trackRegions.length === 0) return null;

	const regionTimings = timeLoss.laps.find((lap) =>
		trackRegions.every((region) =>
			lap.regions.some(
				(timing) =>
					timing.regionId === region.id && timing.fastestObservedPass !== null,
			),
		),
	)?.regions;
	if (!regionTimings) return null;

	const regions = trackRegions.flatMap((region) => {
		const timing = regionTimings.find((item) => item.regionId === region.id);
		const fastestPass = timing?.fastestObservedPass;
		if (!fastestPass || fastestPass.durationMs <= 0) return [];

		return [
			{
				region,
				sourceLapNumber: fastestPass.lapNumber,
				durationMs: fastestPass.durationMs,
			},
		];
	});

	return regions.length === trackRegions.length
		? { durationMs: timeLoss.idealLap.durationMs, regions }
		: null;
}

export function getIdealLapSourceLapNumbers(
	idealLap: IdealLapDefinition | null,
): readonly number[] {
	return idealLap === null
		? []
		: [...new Set(idealLap.regions.map((region) => region.sourceLapNumber))];
}

export function createTelemetrySeriesLapNumbers(
	reviewedLapNumber: number,
	secondLapNumber: number,
	idealLap: IdealLapDefinition | null,
): readonly number[] {
	return [
		...new Set([
			reviewedLapNumber,
			secondLapNumber,
			...getIdealLapSourceLapNumbers(idealLap),
		]),
	];
}

export function findIdealLapRegionSourceAtPosition(
	idealLap: IdealLapDefinition,
	normalizedTrackPosition: number,
): IdealLapRegionSource | null {
	if (
		!Number.isFinite(normalizedTrackPosition) ||
		normalizedTrackPosition < 0 ||
		normalizedTrackPosition > 1
	) {
		return null;
	}

	return (
		idealLap.regions.find(({ region }) => {
			const { interval } = region;
			const start = interval.startNormalizedTrackPosition;
			const end = interval.endNormalizedTrackPosition;

			return interval.crossesStartFinishLine
				? normalizedTrackPosition >= start || normalizedTrackPosition < end
				: normalizedTrackPosition >= start && normalizedTrackPosition < end;
		}) ?? null
	);
}

export function createIdealLapValues(
	series: SeriesResponse,
	idealLap: IdealLapDefinition,
	readValue: (lap: LapSeriesResponse, index: number) => number | null,
): readonly (number | null)[] {
	const lapsByNumber = new Map(series.laps.map((lap) => [lap.lapNumber, lap]));

	return series.grid.normalizedTrackPositions.map((position, index) => {
		const source = findIdealLapRegionSourceAtPosition(idealLap, position);
		const sourceLap = source
			? lapsByNumber.get(source.sourceLapNumber)
			: undefined;

		return sourceLap ? readValue(sourceLap, index) : null;
	});
}

export function createIdealLapElapsedMs(
	series: SeriesResponse,
	idealLap: IdealLapDefinition,
): readonly (number | null)[] | null {
	const segments = createIdealLapSegments(series, idealLap);
	if (segments === null) return null;

	return series.grid.normalizedTrackPositions.map((position, index) => {
		const segment = segments.find(
			(item) =>
				position >= item.startPosition &&
				(position < item.endPosition ||
					(item.endPosition === 1 && position === 1)),
		);
		if (!segment) return null;

		const sourceElapsedMs = segment.sourceLap.lapElapsedMs[index] ?? null;
		if (sourceElapsedMs === null) return null;

		const sourceDurationMs =
			segment.sourceEndElapsedMs - segment.sourceStartElapsedMs;
		if (sourceDurationMs <= 0) return null;

		const progress = clamp(
			(sourceElapsedMs - segment.sourceStartElapsedMs) / sourceDurationMs,
			0,
			1,
		);

		return segment.idealStartElapsedMs + progress * segment.idealDurationMs;
	});
}

interface IdealLapSegment {
	readonly startPosition: number;
	readonly endPosition: number;
	readonly sourceLap: LapSeriesResponse;
	readonly sourceStartElapsedMs: number;
	readonly sourceEndElapsedMs: number;
	readonly idealStartElapsedMs: number;
	readonly idealDurationMs: number;
}

interface UnpositionedIdealLapSegment
	extends Omit<IdealLapSegment, "idealStartElapsedMs" | "idealDurationMs"> {
	readonly requestedIdealDurationMs: number;
}

function createIdealLapSegments(
	series: SeriesResponse,
	idealLap: IdealLapDefinition,
): readonly IdealLapSegment[] | null {
	const lapsByNumber = new Map(series.laps.map((lap) => [lap.lapNumber, lap]));
	const segments: UnpositionedIdealLapSegment[] = [];

	for (const source of idealLap.regions) {
		const sourceLap = lapsByNumber.get(source.sourceLapNumber);
		if (!sourceLap) return null;

		const { interval } = source.region;
		if (!interval.crossesStartFinishLine) {
			const segment = createUnpositionedSegment(
				series,
				sourceLap,
				interval.startNormalizedTrackPosition,
				interval.endNormalizedTrackPosition,
				source.durationMs,
			);
			if (segment === null) return null;
			segments.push(segment);
			continue;
		}

		const head = createUnpositionedSegment(
			series,
			sourceLap,
			0,
			interval.endNormalizedTrackPosition,
			0,
		);
		const tail = createUnpositionedSegment(
			series,
			sourceLap,
			interval.startNormalizedTrackPosition,
			1,
			0,
		);
		if (head === null || tail === null) return null;

		const headSourceDurationMs =
			head.sourceEndElapsedMs - head.sourceStartElapsedMs;
		const tailSourceDurationMs =
			tail.sourceEndElapsedMs - tail.sourceStartElapsedMs;
		const totalSourceDurationMs = headSourceDurationMs + tailSourceDurationMs;
		if (totalSourceDurationMs <= 0) return null;

		const headIdealDurationMs =
			source.durationMs * (headSourceDurationMs / totalSourceDurationMs);
		segments.push(
			{ ...head, requestedIdealDurationMs: headIdealDurationMs },
			{
				...tail,
				requestedIdealDurationMs: source.durationMs - headIdealDurationMs,
			},
		);
	}

	segments.sort((first, second) => first.startPosition - second.startPosition);
	const requestedDurationMs = segments.reduce(
		(total, segment) => total + segment.requestedIdealDurationMs,
		0,
	);
	if (requestedDurationMs <= 0) return null;

	const durationScale = idealLap.durationMs / requestedDurationMs;
	let idealStartElapsedMs = 0;

	return segments.map((segment) => {
		const idealDurationMs = segment.requestedIdealDurationMs * durationScale;
		const positionedSegment: IdealLapSegment = {
			startPosition: segment.startPosition,
			endPosition: segment.endPosition,
			sourceLap: segment.sourceLap,
			sourceStartElapsedMs: segment.sourceStartElapsedMs,
			sourceEndElapsedMs: segment.sourceEndElapsedMs,
			idealStartElapsedMs,
			idealDurationMs,
		};
		idealStartElapsedMs += idealDurationMs;
		return positionedSegment;
	});
}

function createUnpositionedSegment(
	series: SeriesResponse,
	sourceLap: LapSeriesResponse,
	startPosition: number,
	endPosition: number,
	requestedIdealDurationMs: number,
): UnpositionedIdealLapSegment | null {
	const sourceStartElapsedMs = interpolateElapsedMsAtPosition(
		series.grid.normalizedTrackPositions,
		sourceLap,
		startPosition,
	);
	const sourceEndElapsedMs = interpolateElapsedMsAtPosition(
		series.grid.normalizedTrackPositions,
		sourceLap,
		endPosition,
	);
	if (sourceStartElapsedMs === null || sourceEndElapsedMs === null) return null;

	return {
		startPosition,
		endPosition,
		sourceLap,
		sourceStartElapsedMs,
		sourceEndElapsedMs,
		requestedIdealDurationMs,
	};
}

function interpolateElapsedMsAtPosition(
	positions: readonly number[],
	lap: LapSeriesResponse,
	position: number,
): number | null {
	if (position === 0) return 0;
	if (position === 1) return lap.lapTimeMs;

	const upperIndex = positions.findIndex((candidate) => candidate >= position);
	if (upperIndex < 0) return null;
	if (positions[upperIndex] === position) {
		return lap.lapElapsedMs[upperIndex] ?? null;
	}

	const lowerIndex = upperIndex - 1;
	if (lowerIndex < 0) return null;
	const lowerPosition = positions[lowerIndex];
	const upperPosition = positions[upperIndex];
	const lowerElapsedMs = lap.lapElapsedMs[lowerIndex] ?? null;
	const upperElapsedMs = lap.lapElapsedMs[upperIndex] ?? null;
	if (
		lowerPosition === undefined ||
		upperPosition === undefined ||
		lowerElapsedMs === null ||
		upperElapsedMs === null ||
		upperPosition <= lowerPosition
	) {
		return null;
	}

	const ratio = (position - lowerPosition) / (upperPosition - lowerPosition);
	return lowerElapsedMs + ratio * (upperElapsedMs - lowerElapsedMs);
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}
