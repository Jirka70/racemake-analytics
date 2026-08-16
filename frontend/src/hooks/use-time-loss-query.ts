import { useQuery } from '@tanstack/react-query'
import type {
  AnalysisId,
  TimeLossResponse,
} from '../../../src/http/contracts'
import {
  fetchJson,
  shouldRetryApiRequest,
} from '../api/api-client'
import { analysisQueryKeys } from '../api/analysis-query-keys'

export function useTimeLossQuery(
  analysisId: AnalysisId | null,
) {
  return useQuery({
    queryKey: analysisQueryKeys.timeLoss(analysisId),
    queryFn: ({ signal }) => {
      if (analysisId === null) {
        throw new TypeError(
          'Cannot fetch time loss without an analysisId',
        )
      }

      const query = new URLSearchParams({ analysisId })

      return fetchJson<TimeLossResponse>(
        `/time-loss?${query}`,
        signal,
      )
    },
    enabled: analysisId !== null,
    staleTime: Number.POSITIVE_INFINITY,
    retry: shouldRetryApiRequest,
  })
}
