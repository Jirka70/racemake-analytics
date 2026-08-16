import { useQuery } from "@tanstack/react-query";
import type {
	AnalysisId,
	DiagnosticsResponse,
} from "../../../src/http/contracts";
import { analysisQueryKeys } from "../api/analysis-query-keys";
import { fetchJson, shouldRetryApiRequest } from "../api/api-client";

export function useDiagnosticsQuery(analysisId: AnalysisId | null) {
	return useQuery({
		queryKey: analysisQueryKeys.diagnostics(analysisId),
		queryFn: ({ signal }) => {
			if (analysisId === null) {
				throw new TypeError("Cannot fetch diagnostics without an analysisId");
			}

			const query = new URLSearchParams({ analysisId });

			return fetchJson<DiagnosticsResponse>(`/diagnostics?${query}`, signal);
		},
		enabled: analysisId !== null,
		staleTime: Number.POSITIVE_INFINITY,
		retry: shouldRetryApiRequest,
	});
}
