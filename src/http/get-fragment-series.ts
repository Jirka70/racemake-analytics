import { createCellAlignedTelemetryFragment } from "../analytics/coach/create-cell-aligned-racing-telemetry";
import type { AnalysisStore } from "./analysis-store";
import { ApiRequestError } from "./api-request-error";
import type { FragmentSeriesResponse } from "./contracts/fragment-series";
import type { SeriesChannel } from "./contracts/series";
import { getAnalysisById, parseAnalysisQuery } from "./get-analysis";
import { createSeriesChannelDataResponse } from "./get-series";
import { fragmentSeriesQuerySchema } from "./schemas/fragment-series-query";

const DEFAULT_FRAGMENT_SERIES_CHANNELS: readonly SeriesChannel[] = [
	"speedKmh",
	"throttleRatio",
	"brakeRatio",
	"steeringDegrees",
];

export function getFragmentSeries(
	query: unknown,
	analysisStore: AnalysisStore,
): FragmentSeriesResponse {
	const fragmentQuery = parseAnalysisQuery(query, fragmentSeriesQuerySchema);
	const { analysisId, analysis } = getAnalysisById(
		fragmentQuery.analysisId,
		analysisStore,
	);
	const fragment = createCellAlignedTelemetryFragment(
		analysis.auditResult.usableTimeline,
		analysis.lapDetectionResult,
		fragmentQuery.fragment,
	);

	if (!fragment) {
		throw new ApiRequestError("INVALID_QUERY", [
			{
				path: "fragment",
				message: `Fragment ${fragmentQuery.fragment} is not available in this analysis`,
			},
		]);
	}

	const selectedChannels =
		fragmentQuery.channels ?? DEFAULT_FRAGMENT_SERIES_CHANNELS;

	return {
		analysisId,
		sessionId: analysis.normalizedTelemetry.sessionId,
		selection: {
			fragmentIndex: fragment.fragmentIndex,
			channels: selectedChannels,
		},
		fragment: {
			startPosition: fragment.startPosition,
			endPosition: fragment.endPosition,
		},
		grid: {
			normalizedTrackPositions: fragment.cells.map(
				(cell) => cell.center.normalizedTrackPosition,
			),
		},
		channels: createSeriesChannelDataResponse(fragment.cells, selectedChannels),
	};
}
