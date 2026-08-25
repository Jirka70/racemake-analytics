import type {
  DetectedLap,
  DetectedLapEligibility,
  DetectedLapGridCoverage,
  LapCrossing,
  SamplingGapWithinLapLimitation,
} from '../analytics/lap-detect/lap-detect-types'
import { DEFAULT_LAP_DETECTION_CONFIG } from '../analytics/lap-detect/config/lap-detection-config'
import type { AnalysisStore } from './analysis-store'
import type {
  LapBoundaryLimitationResponse,
  LapLimitationResponse,
  LapQualityResponse,
  LapResponse,
  LapSamplingGapLimitationResponse,
  LapSamplingGapResponse,
  LapTimeLimitationResponse,
  LapUsageResponse,
  LapsResponse,
} from './contracts/laps'
import { getAnalysis } from './get-analysis'

const MINIMUM_BOUNDARY_CONFIDENCE =
  DEFAULT_LAP_DETECTION_CONFIG.eligibility.time.minimumBoundaryConfidence
const MINIMUM_LAP_TIME_CONFIDENCE =
  DEFAULT_LAP_DETECTION_CONFIG.eligibility.time.minimumLapTimeConfidence

export function getLaps(
  query: unknown,
  analysisStore: AnalysisStore,
): LapsResponse {
  const { analysisId, analysis } = getAnalysis(query, analysisStore)

  const eligibilityByLapNumber = new Map(
    analysis.lapDetectionResult.lapEligibilityResults.map((result) => [
      result.lapNumber,
      result.eligibility,
    ]),
  )
  const coverageByLapNumber = new Map(
    analysis.lapDetectionResult.lapGridCoverages.map((result) => [
      result.lapNumber,
      result.coverage,
    ]),
  )
  const samplingGaps = analysis.lapDetectionResult.laps.flatMap((lap) =>
    lap.limitations.map((limitation) =>
      createLapSamplingGapResponse(lap.lapNumber, limitation),
    ),
  )

  return {
    analysisId,
    sessionId: analysis.normalizedTelemetry.sessionId,
    samplingGaps,
    fragments: analysis.lapDetectionResult.lapFragments.map(
      ({ startPosition, endPosition }) => ({
        startPosition,
        endPosition,
      }),
    ),
    laps: analysis.lapDetectionResult.laps.map((lap): LapResponse => {
      const eligibility = eligibilityByLapNumber.get(lap.lapNumber)
      if (!eligibility) {
        throw new TypeError(
          `Lap ${lap.lapNumber} is missing its eligibility result.`,
        )
      }
      const coverage = coverageByLapNumber.get(lap.lapNumber)
      if (!coverage) {
        throw new TypeError(
          `Lap ${lap.lapNumber} is missing its coverage result.`,
        )
      }

      const limitations = createLapLimitationResponses(lap, eligibility)
      const quality = createLapQualityResponse(limitations)

      return {
        lapNumber: lap.lapNumber,
        timing: {
          status: eligibility.timeEligible.eligible
            ? 'verified'
            : 'unverified',
          lapTimeMs: lap.lapTimeMs,
        },
        quality,
        usage: createLapUsageResponse(eligibility, quality),
        coverage: createLapCoverageResponse(coverage),
        confidence: {
          startCrossing: createCrossingConfidenceResponse(lap.startCrossing),
          finishCrossing: createCrossingConfidenceResponse(lap.endCrossing),
          lap: {
            boundary: lap.confidence.boundaryConfidence,
            lapTime: lap.confidence.lapTimeConfidence,
            overall: lap.confidence.overallConfidence,
          },
        },
      }
    }),
  }
}

function createLapLimitationResponses(
  lap: DetectedLap,
  eligibility: DetectedLapEligibility,
): readonly LapLimitationResponse[] {
  const crossingLimitations = createLapBoundaryLimitationResponses(
    lap,
    eligibility,
  )
  const lapTimeLimitation = createLapTimeLimitationResponse(lap, eligibility)
  const samplingGapLimitations = lap.limitations.map((limitation) =>
    createLapSamplingGapLimitationResponse(lap.lapNumber, limitation),
  )

  return [
    ...crossingLimitations,
    ...(lapTimeLimitation ? [lapTimeLimitation] : []),
    ...samplingGapLimitations,
  ]
}

function createLapBoundaryLimitationResponses(
  lap: DetectedLap,
  eligibility: DetectedLapEligibility,
): readonly LapBoundaryLimitationResponse[] {
  const hasBoundaryEligibilityFailure =
    eligibility.timeEligible.reasons.some(
      ({ code }) => code === 'BOUNDARY_CONFIDENCE_BELOW_MINIMUM',
    )
  const limitedCrossings: Array<{
    boundary: 'start' | 'finish'
    crossing: LapCrossing
  }> = [
    ...(lap.startCrossing.limitations.length > 0
      ? [{ boundary: 'start' as const, crossing: lap.startCrossing }]
      : []),
    ...(lap.endCrossing.limitations.length > 0
      ? [{ boundary: 'finish' as const, crossing: lap.endCrossing }]
      : []),
  ]

  if (limitedCrossings.length === 0 && hasBoundaryEligibilityFailure) {
    limitedCrossings.push(
      lap.startCrossing.confidence.boundaryConfidence
        <= lap.endCrossing.confidence.boundaryConfidence
        ? { boundary: 'start', crossing: lap.startCrossing }
        : { boundary: 'finish', crossing: lap.endCrossing },
    )
  }

  return limitedCrossings.map(({ boundary, crossing }) =>
    createLapBoundaryLimitationResponse(lap, boundary, crossing),
  )
}

function createLapBoundaryLimitationResponse(
  lap: DetectedLap,
  boundary: 'start' | 'finish',
  crossing: LapCrossing,
): LapBoundaryLimitationResponse {
  const localContext = crossing.limitations.find(
    (limitation) =>
      limitation.code === 'LOCAL_POSITION_RATE_CONTEXT_UNAVAILABLE',
  )

  return {
    code:
      boundary === 'start'
        ? 'START_BOUNDARY_UNCERTAIN'
        : 'FINISH_BOUNDARY_UNCERTAIN',
    severity: 'warning',
    message:
      boundary === 'start'
        ? 'Start crossing was not captured clearly.'
        : 'Finish crossing was not captured clearly.',
    boundary,
    crossingBoundaryConfidence: crossing.confidence.boundaryConfidence,
    lapBoundaryConfidence: lap.confidence.boundaryConfidence,
    requiredLapBoundaryConfidence: MINIMUM_BOUNDARY_CONFIDENCE,
    evidence: {
      fromPosition: crossing.positionInterpolation.fromPosition,
      toPosition: crossing.positionInterpolation.toPosition,
      transitionDurationMs: crossing.transition.timestampDeltaMs,
      lapCounterEvidence: crossing.lapCounterEvidence.status,
      usablePositionRateSamplesBefore:
        localContext?.usablePositionRateSamplesBefore ?? null,
      usablePositionRateSamplesAfter:
        localContext?.usablePositionRateSamplesAfter ?? null,
      reasonCodes: crossing.limitations.map(({ code }) => code),
    },
  }
}

function createLapTimeLimitationResponse(
  lap: DetectedLap,
  eligibility: DetectedLapEligibility,
): LapTimeLimitationResponse | null {
  const hasUnavailableLapTime = eligibility.timeEligible.reasons.some(
    ({ code }) => code === 'NON_POSITIVE_LAP_TIME',
  )
  const hasUncertainLapTime = eligibility.timeEligible.reasons.some(
    ({ code }) => code === 'LAP_TIME_CONFIDENCE_BELOW_MINIMUM',
  )
  if (!hasUnavailableLapTime && !hasUncertainLapTime) return null

  return {
    code: hasUnavailableLapTime
      ? 'LAP_TIME_UNAVAILABLE'
      : 'LAP_TIME_UNCERTAIN',
    severity: hasUnavailableLapTime ? 'error' : 'warning',
    message: hasUnavailableLapTime
      ? 'Lap time could not be calculated.'
      : 'Lap time could not be calculated precisely.',
    observedLapTimeConfidence: lap.confidence.lapTimeConfidence,
    requiredLapTimeConfidence: MINIMUM_LAP_TIME_CONFIDENCE,
  }
}

function createLapQualityResponse(
  limitations: readonly LapLimitationResponse[],
): LapQualityResponse {
  if (limitations.length === 0) {
    return {
      status: 'verified',
      label: 'Verified',
      summary: null,
      limitations: [],
    }
  }

  const [firstLimitation, ...remainingLimitations] = limitations
  if (!firstLimitation) {
    throw new TypeError('A limited lap must have at least one limitation.')
  }
  const nonEmptyLimitations: readonly [
    LapLimitationResponse,
    ...LapLimitationResponse[],
  ] = [firstLimitation, ...remainingLimitations]
  const primaryLimitation =
    nonEmptyLimitations.find(
      ({ code }) => code === 'FINISH_BOUNDARY_UNCERTAIN',
    )
    ?? nonEmptyLimitations.find(
      ({ code }) => code === 'START_BOUNDARY_UNCERTAIN',
    )
    ?? nonEmptyLimitations.find(({ code }) => code.startsWith('LAP_TIME_'))
    ?? firstLimitation

  return {
    status: 'limited',
    label: 'Limited data',
    summary: primaryLimitation.message,
    limitations: nonEmptyLimitations,
  }
}

function createLapUsageResponse(
  eligibility: DetectedLapEligibility,
  quality: LapQualityResponse,
): LapUsageResponse {
  const isRacingLap = eligibility.realRacing.eligible

  return {
    telemetryReview:
      quality.status === 'verified' ? 'full' : 'recorded-sections-only',
    lapTimeComparison: eligibility.timeEligible.eligible
      ? 'verified-only'
      : 'excluded',
    lapRanking: isRacingLap ? 'ranked' : 'excluded',
    coaching: !isRacingLap
      ? 'none'
      : quality.status === 'verified'
        ? 'full'
        : 'supported-regions-only',
  }
}

function createLapCoverageResponse(coverage: DetectedLapGridCoverage) {
  return {
    capturedRatio: coverage.position.coverageRatio,
    startPosition: 0 as const,
    endPosition: 1 as const,
  }
}

function createCrossingConfidenceResponse(crossing: LapCrossing) {
  return {
    boundary: crossing.confidence.boundaryConfidence,
    timestamp: crossing.confidence.timestampConfidence,
    overall: crossing.confidence.overallConfidence,
  }
}

function createLapSamplingGapResponse(
  lapNumber: number,
  limitation: SamplingGapWithinLapLimitation,
): LapSamplingGapResponse {
  return {
    lapNumber,
    ...createLapSamplingGapLimitationResponse(lapNumber, limitation),
  }
}

function createLapSamplingGapLimitationResponse(
  lapNumber: number,
  limitation: SamplingGapWithinLapLimitation,
): LapSamplingGapLimitationResponse {
  return {
    code: limitation.code,
    severity: limitation.severity,
    message: createLapSamplingGapMessage(lapNumber, limitation),
    gapStartTimestampMs: limitation.gapStartTimestampMs,
    gapEndTimestampMs: limitation.gapEndTimestampMs,
    gapDurationMs: limitation.gapDurationMs,
    fromPosition: limitation.fromPosition,
    toPosition: limitation.toPosition,
  }
}

function createLapSamplingGapMessage(
  lapNumber: number,
  limitation: SamplingGapWithinLapLimitation,
): string {
  const fromPercent = (limitation.fromPosition * 100).toFixed(1)
  const toPercent = (limitation.toPosition * 100).toFixed(1)
  const durationMs = Math.round(limitation.gapDurationMs)

  if (limitation.mayContainLapBoundary) {
    return 'Recording stopped around start/finish. This duration may contain more than one lap.'
  }

  return `Lap ${lapNumber} has a ${durationMs} ms telemetry gap from ${fromPercent}% to ${toPercent}% of the lap. Calculations requiring this section are unavailable.`
}
