import { useQuery } from '@tanstack/react-query'
import type {
  AnalysisId,
  LapsResponse,
} from '../../../src/http/contracts'
import {
  fetchJson,
  shouldRetryApiRequest,
} from '../api/api-client'
import { analysisQueryKeys } from '../api/analysis-query-keys'

export function useLapsQuery(
  analysisId: AnalysisId | null,
) {
  return useQuery({
    queryKey: analysisQueryKeys.laps(analysisId),
    queryFn: ({ signal }) => {
      if (analysisId === null) {
        throw new TypeError('Cannot fetch laps without an analysisId')
      }

      const query = new URLSearchParams({ analysisId })

      return fetchJson<LapsResponse>(
        `/laps?${query}`,
        signal,
      )
    },
    enabled: analysisId !== null,
    staleTime: Number.POSITIVE_INFINITY,
    retry: shouldRetryApiRequest,
  })
}
