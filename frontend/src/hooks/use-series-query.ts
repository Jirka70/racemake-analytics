import { useQuery } from "@tanstack/react-query";
import type {
	AnalysisId,
	SeriesQuery,
	SeriesResponse,
} from "../../../src/http/contracts";
import { analysisQueryKeys } from "../api/analysis-query-keys";
import { fetchJson, shouldRetryApiRequest } from "../api/api-client";

export type SeriesSelection = Omit<SeriesQuery, "analysisId">;

export function createSeriesRequestPath(
	analysisId: AnalysisId,
	selection: SeriesSelection,
): string {
	if (selection.laps.length === 0) {
		throw new RangeError("A series request requires at least one lap");
	}
	if (selection.channels?.length === 0) {
		throw new RangeError("Selected series channels cannot be empty");
	}

	const query = new URLSearchParams({
		analysisId,
		laps: selection.laps.join(","),
	});

	if (selection.channels !== undefined) {
		query.set("channels", selection.channels.join(","));
	}
	if (selection.positionFrom !== undefined) {
		query.set("positionFrom", String(selection.positionFrom));
	}
	if (selection.positionTo !== undefined) {
		query.set("positionTo", String(selection.positionTo));
	}

	return `/series?${query}`;
}

export function useSeriesQuery(
	analysisId: AnalysisId | null,
	selection: SeriesSelection | null,
) {
	return useQuery({
		queryKey: analysisQueryKeys.series(analysisId, selection),
		queryFn: ({ signal }) => {
			if (analysisId === null || selection === null) {
				throw new TypeError(
					"Cannot fetch telemetry series without an analysisId and selection",
				);
			}

			return fetchJson<SeriesResponse>(
				createSeriesRequestPath(analysisId, selection),
				signal,
			);
		},
		enabled: analysisId !== null && selection !== null,
		staleTime: Number.POSITIVE_INFINITY,
		retry: shouldRetryApiRequest,
	});
}
