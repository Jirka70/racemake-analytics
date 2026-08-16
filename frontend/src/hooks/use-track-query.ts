import { useQuery } from "@tanstack/react-query";
import type { AnalysisId, TrackResponse } from "../../../src/http/contracts";
import { analysisQueryKeys } from "../api/analysis-query-keys";
import { fetchJson, shouldRetryApiRequest } from "../api/api-client";

export function useTrackQuery(analysisId: AnalysisId | null) {
	return useQuery({
		queryKey: analysisQueryKeys.track(analysisId),
		queryFn: ({ signal }) => {
			if (analysisId === null) {
				throw new TypeError("Cannot fetch the track without an analysisId");
			}

			const query = new URLSearchParams({ analysisId });

			return fetchJson<TrackResponse>(`/track?${query}`, signal);
		},
		enabled: analysisId !== null,
		staleTime: Number.POSITIVE_INFINITY,
		retry: shouldRetryApiRequest,
	});
}
