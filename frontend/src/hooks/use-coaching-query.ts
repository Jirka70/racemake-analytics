import { useQuery } from "@tanstack/react-query";
import type { AnalysisId, CoachingResponse } from "../../../src/http/contracts";
import { analysisQueryKeys } from "../api/analysis-query-keys";
import { fetchJson, shouldRetryApiRequest } from "../api/api-client";

export function useCoachingQuery(analysisId: AnalysisId | null) {
	return useQuery({
		queryKey: analysisQueryKeys.coaching(analysisId),
		queryFn: ({ signal }) => {
			if (analysisId === null) {
				throw new TypeError("Cannot fetch coaching without an analysisId");
			}

			const query = new URLSearchParams({ analysisId });

			return fetchJson<CoachingResponse>(`/coaching?${query}`, signal);
		},
		enabled: analysisId !== null,
		staleTime: Number.POSITIVE_INFINITY,
		retry: shouldRetryApiRequest,
	});
}
