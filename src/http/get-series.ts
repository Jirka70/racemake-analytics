import type {
	CellAlignedRacingLap,
	CellAlignedRacingLapCell,
} from "../analytics/coach/cell-aligned-racing-telemetry-types";
import type { AnalysisStore } from "./analysis-store";
import { ApiRequestError } from "./api-request-error";
import type {
	LapSeriesResponse,
	SeriesChannel,
	SeriesChannelDataResponse,
	SeriesQuery,
	SeriesResponse,
	TyreCoreTemperatureSeriesResponse,
} from "./contracts/series";
import { getAnalysisById, parseAnalysisQuery } from "./get-analysis";
import { seriesQuerySchema } from "./schemas/series-query";

const DEFAULT_SERIES_CHANNELS: readonly SeriesChannel[] = [
	"speedKmh",
	"throttleRatio",
	"brakeRatio",
	"steeringDegrees",
];

export function getSeries(
	query: unknown,
	analysisStore: AnalysisStore,
): SeriesResponse {
	const seriesQuery = parseAnalysisQuery(query, seriesQuerySchema);
	const { analysisId, analysis } = getAnalysisById(
		seriesQuery.analysisId,
		analysisStore,
	);
	const alignedLaps = analysis.coachCallsResult.cellAlignedRacingTelemetry.laps;
	const normalizedTrackPositions = alignedLaps[0]
		? alignedLaps[0].cells.map((cell) => cell.center.normalizedTrackPosition)
		: analysis.cornerDetectionResult.cellAlignedSteering.cellCenters;
	const selectedLaps = selectLaps(alignedLaps, seriesQuery);
	const selectedChannels = seriesQuery.channels ?? DEFAULT_SERIES_CHANNELS;
	const positionFrom = seriesQuery.positionFrom ?? 0;
	const positionTo = seriesQuery.positionTo ?? 1;
	const selectedCellIndexes = selectPositionIndexes(
		normalizedTrackPositions,
		positionFrom,
		positionTo,
	);

	return {
		analysisId,
		sessionId: analysis.normalizedTelemetry.sessionId,
		selection: {
			lapNumbers: selectedLaps.map((lap) => lap.lapNumber),
			channels: selectedChannels,
			positionFrom,
			positionTo,
		},
		grid: {
			normalizedTrackPositions: selectValues(
				normalizedTrackPositions,
				selectedCellIndexes,
			),
		},
		laps: selectedLaps.map((lap) =>
			createLapSeriesResponse(lap, selectedCellIndexes, selectedChannels),
		),
	};
}

function selectLaps(
	alignedLaps: readonly CellAlignedRacingLap[],
	query: SeriesQuery,
): readonly CellAlignedRacingLap[] {
	const lapsByNumber = new Map(alignedLaps.map((lap) => [lap.lapNumber, lap]));

	return query.laps.map((lapNumber) => {
		const lap = lapsByNumber.get(lapNumber);
		if (!lap) {
			throw new ApiRequestError("INVALID_QUERY", [
				{
					path: "laps",
					message: `Lap ${lapNumber} is not available as a racing lap in this analysis`,
				},
			]);
		}

		return lap;
	});
}

function selectPositionIndexes(
	positions: readonly number[],
	positionFrom: number,
	positionTo: number,
): readonly number[] {
	if (positionFrom <= positionTo) {
		return positions.flatMap((position, index) =>
			position >= positionFrom && position <= positionTo ? [index] : [],
		);
	}

	const beforeFinish = positions.flatMap((position, index) =>
		position >= positionFrom ? [index] : [],
	);
	const afterStart = positions.flatMap((position, index) =>
		position <= positionTo ? [index] : [],
	);

	return [...beforeFinish, ...afterStart];
}

function createLapSeriesResponse(
	lap: CellAlignedRacingLap,
	selectedCellIndexes: readonly number[],
	selectedChannels: readonly SeriesChannel[],
): LapSeriesResponse {
	const cells = selectValues(lap.cells, selectedCellIndexes);

	return {
		lapNumber: lap.lapNumber,
		lapTimeMs: lap.lapTimeMs,
		lapElapsedMs: cells.map((cell) => cell.center.lapElapsedMs),
		channels: createSeriesChannelDataResponse(cells, selectedChannels),
	};
}

export function createSeriesChannelDataResponse(
	cells: readonly CellAlignedRacingLapCell[],
	selectedChannels: readonly SeriesChannel[],
): SeriesChannelDataResponse {
	const channels = new Set(selectedChannels);

	return {
		...(channels.has("speedKmh")
			? { speedKmh: cells.map((cell) => cell.center.speedKmh) }
			: {}),
		...(channels.has("throttleRatio")
			? {
					throttleRatio: cells.map((cell) => cell.center.throttleRatio),
				}
			: {}),
		...(channels.has("brakeRatio")
			? { brakeRatio: cells.map((cell) => cell.center.brakeRatio) }
			: {}),
		...(channels.has("steeringDegrees")
			? {
					steeringDegrees: cells.map((cell) => cell.center.steeringDegrees),
				}
			: {}),
		...(channels.has("gear")
			? { gear: cells.map((cell) => cell.center.gear) }
			: {}),
		...(channels.has("engineRpm")
			? { engineRpm: cells.map((cell) => cell.center.engineRpm) }
			: {}),
		...(channels.has("tyreCoreTemperatureC")
			? { tyreCoreTemperatureC: createTyreTemperatureSeries(cells) }
			: {}),
		...(channels.has("quality")
			? {
					quality: {
						timelineContinuous: cells.map(
							(cell) => cell.quality.timelineContinuous,
						),
						unavailableChannels: cells.map(
							(cell) => cell.quality.discontinuousChannels,
						),
					},
				}
			: {}),
	};
}

function selectValues<Value>(
	values: readonly Value[],
	selectedIndexes: readonly number[],
): readonly Value[] {
	return selectedIndexes.map((index) => {
		const value = values[index];
		if (value === undefined) {
			throw new RangeError(
				`Selected series index ${index} is outside the available values`,
			);
		}

		return value;
	});
}

function createTyreTemperatureSeries(
	cells: readonly CellAlignedRacingLapCell[],
): TyreCoreTemperatureSeriesResponse {
	return {
		frontLeft: cells.map(
			(cell) => cell.center.tyreCoreTemperatureC?.frontLeft ?? null,
		),
		frontRight: cells.map(
			(cell) => cell.center.tyreCoreTemperatureC?.frontRight ?? null,
		),
		rearLeft: cells.map(
			(cell) => cell.center.tyreCoreTemperatureC?.rearLeft ?? null,
		),
		rearRight: cells.map(
			(cell) => cell.center.tyreCoreTemperatureC?.rearRight ?? null,
		),
	};
}
