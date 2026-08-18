import { useQuery } from "@tanstack/react-query";
import type {
	AnalysisId,
	FragmentSeriesQuery,
	FragmentSeriesResponse,
} from "../../../src/http/contracts";
import { analysisQueryKeys } from "../api/analysis-query-keys";
import { fetchJson, shouldRetryApiRequest } from "../api/api-client";

export type FragmentSeriesSelection = Omit<FragmentSeriesQuery, "analysisId">;

export function createFragmentSeriesRequestPath(
	analysisId: AnalysisId,
	selection: FragmentSeriesSelection,
): string {
	if (!Number.isInteger(selection.fragment) || selection.fragment < 0) {
		throw new RangeError("A fragment series request requires a valid index");
	}
	if (selection.channels?.length === 0) {
		throw new RangeError("Selected fragment channels cannot be empty");
	}

	const query = new URLSearchParams({
		analysisId,
		fragment: String(selection.fragment),
	});
	if (selection.channels !== undefined) {
		query.set("channels", selection.channels.join(","));
	}

	return `/fragment-series?${query}`;
}

export function useFragmentSeriesQuery(
	analysisId: AnalysisId | null,
	selection: FragmentSeriesSelection | null,
) {
	return useQuery({
		queryKey: analysisQueryKeys.fragmentSeries(analysisId, selection),
		queryFn: ({ signal }) => {
			if (analysisId === null || selection === null) {
				throw new TypeError(
					"Cannot fetch fragment telemetry without an analysisId and selection",
				);
			}

			return fetchJson<FragmentSeriesResponse>(
				createFragmentSeriesRequestPath(analysisId, selection),
				signal,
			);
		},
		enabled: analysisId !== null && selection !== null,
		staleTime: Number.POSITIVE_INFINITY,
		retry: shouldRetryApiRequest,
	});
}
