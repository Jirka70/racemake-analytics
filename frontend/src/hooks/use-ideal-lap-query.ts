import { useQuery } from "@tanstack/react-query";
import type {
	AnalysisId,
	IdealLapQuery,
	IdealLapSeriesResponse,
} from "../../../src/http/contracts";
import { analysisQueryKeys } from "../api/analysis-query-keys";
import { fetchJson, shouldRetryApiRequest } from "../api/api-client";

export type IdealLapSelection = Omit<IdealLapQuery, "analysisId">;

export function createIdealLapRequestPath(
	analysisId: AnalysisId,
	selection: IdealLapSelection,
): string {
	if (selection.channels?.length === 0) {
		throw new RangeError("Selected ideal lap channels cannot be empty");
	}

	const query = new URLSearchParams({ analysisId });
	if (selection.channels !== undefined) {
		query.set("channels", selection.channels.join(","));
	}
	if (selection.positionFrom !== undefined) {
		query.set("positionFrom", String(selection.positionFrom));
	}
	if (selection.positionTo !== undefined) {
		query.set("positionTo", String(selection.positionTo));
	}

	return `/ideal-lap?${query}`;
}

export function useIdealLapQuery(
	analysisId: AnalysisId | null,
	selection: IdealLapSelection | null,
) {
	return useQuery({
		queryKey: analysisQueryKeys.idealLap(analysisId, selection),
		queryFn: ({ signal }) => {
			if (analysisId === null || selection === null) {
				throw new TypeError(
					"Cannot fetch the ideal lap without an analysisId and selection",
				);
			}

			return fetchJson<IdealLapSeriesResponse>(
				createIdealLapRequestPath(analysisId, selection),
				signal,
			);
		},
		enabled: analysisId !== null && selection !== null,
		staleTime: Number.POSITIVE_INFINITY,
		retry: shouldRetryApiRequest,
	});
}
