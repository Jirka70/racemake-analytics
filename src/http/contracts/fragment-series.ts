import type { AnalysisId, AnalysisResponseContext } from "./analysis";
import type { SeriesChannel, SeriesChannelDataResponse } from "./series";

export interface FragmentSeriesQuery {
	readonly analysisId: AnalysisId;
	readonly fragment: number;
	readonly channels?: readonly SeriesChannel[];
}

export interface FragmentSeriesSelectionResponse {
	readonly fragmentIndex: number;
	readonly channels: readonly SeriesChannel[];
}

export interface FragmentSeriesResponse extends AnalysisResponseContext {
	readonly selection: FragmentSeriesSelectionResponse;
	readonly fragment: {
		readonly startPosition: number;
		readonly endPosition: number;
	};
	readonly grid: {
		readonly normalizedTrackPositions: readonly number[];
	};
	readonly channels: SeriesChannelDataResponse;
}
