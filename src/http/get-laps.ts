import type {
  DetectedLap,
  LapEligibilityDecision,
  LapEligibilityReason,
  SamplingGapWithinLapLimitation,
} from '../analytics/lap-detect/lap-detect-types'
import type { AnalysisStore } from './analysis-store'
import type {
  LapEligibilityDecisionResponse,
  LapEligibilityReasonResponse,
  LapLimitationResponse,
  LapResponse,
  LapSamplingGapLimitationResponse,
  LapSamplingGapResponse,
  LapsResponse,
} from './contracts/laps'
import { getAnalysis } from './get-analysis'

const LAP_ELIGIBILITY_MESSAGES: Readonly<
  Record<LapEligibilityReason['code'], string>
> = {
  BOUNDARY_CONFIDENCE_BELOW_MINIMUM:
    'Lap boundary confidence is below the required minimum.',
  LAP_TIME_CONFIDENCE_BELOW_MINIMUM:
    'Lap-time confidence is below the required minimum.',
  POSITION_COVERAGE_BELOW_MINIMUM:
    'Track-position coverage is below the required minimum.',
  MOVEMENT_OBSERVATION_BELOW_MINIMUM:
    'Usable movement observation is below the required minimum.',
  MOVING_TIME_BELOW_MINIMUM:
    'The moving share of the observed lap is below the required minimum.',
  STEERING_COVERAGE_BELOW_MINIMUM:
    'Steering coverage is below the required minimum.',
  POSITION_HOLE_EXCEEDS_MAXIMUM:
    'The largest unsupported track-position interval exceeds the allowed maximum.',
  STATIONARY_INTERVAL_EXCEEDS_MAXIMUM:
    'The longest stationary interval exceeds the allowed maximum.',
  STEERING_HOLE_EXCEEDS_MAXIMUM:
    'The largest unsupported steering interval exceeds the allowed maximum.',
  NON_POSITIVE_LAP_TIME: 'The calculated lap time is not positive.',
  TIME_ELIGIBILITY_REQUIRED:
    'Reliable lap timing is required before racing eligibility can be evaluated.',
  REAL_RACING_ELIGIBILITY_REQUIRED:
    'Racing eligibility is required before corner eligibility can be evaluated.',
  SAMPLING_GAP_WITHIN_LAP:
    'A sampling gap limits position-aligned analysis of this lap.',
}

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

      return {
        lapNumber: lap.lapNumber,
        lapTimeMs: lap.lapTimeMs,
        eligibility: eligibility.realRacing.eligible
          ? 'racing'
          : 'non-racing',
        analysisEligibility: {
          lapTime: createEligibilityDecisionResponse(
            eligibility.timeEligible,
          ),
          racing: createEligibilityDecisionResponse(
            eligibility.realRacing,
          ),
          // Kept as an HTTP compatibility field: every racing lap enters corner
          // detection and contributes only where its steering data is supported.
          cornerDetection: createEligibilityDecisionResponse(
            eligibility.realRacing,
          ),
        },
        confidence: {
          boundary: lap.confidence.boundaryConfidence,
          lapTime: lap.confidence.lapTimeConfidence,
          overall: lap.confidence.overallConfidence,
        },
        limitations: createLapLimitationResponses(lap),
      }
    }),
  }
}

function createLapLimitationResponses(
  lap: DetectedLap,
): readonly LapLimitationResponse[] {
  const crossingLimitations = [
    ...lap.startCrossing.limitations,
    ...lap.endCrossing.limitations,
  ].map(({ code, severity, message }) => ({ code, severity, message }))
  const samplingGapLimitations = lap.limitations.map((limitation) =>
    createLapSamplingGapLimitationResponse(lap.lapNumber, limitation),
  )

  return [...crossingLimitations, ...samplingGapLimitations]
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
    ...limitation,
    message: createLapSamplingGapMessage(lapNumber, limitation),
  }
}

function createLapSamplingGapMessage(
  lapNumber: number,
  limitation: SamplingGapWithinLapLimitation,
): string {
  const fromPercent = (limitation.fromPosition * 100).toFixed(1)
  const toPercent = (limitation.toPosition * 100).toFixed(1)
  const durationMs = Math.round(limitation.gapDurationMs)

  return `Lap ${lapNumber} has a ${durationMs} ms telemetry gap from ${fromPercent}% to ${toPercent}% of the lap. Calculations requiring this section are unavailable.`
}

function createEligibilityDecisionResponse(
  decision: LapEligibilityDecision,
): LapEligibilityDecisionResponse {
  return {
    eligible: decision.eligible,
    reasons: decision.reasons.map(createEligibilityReasonResponse),
  }
}

function createEligibilityReasonResponse(
  reason: LapEligibilityReason,
): LapEligibilityReasonResponse {
  if ('requiredMinimum' in reason) {
    return {
      code: reason.code,
      message: LAP_ELIGIBILITY_MESSAGES[reason.code],
      observedValue: reason.observedValue,
      requiredValue: reason.requiredMinimum,
    }
  }

  if ('allowedMaximum' in reason) {
    return {
      code: reason.code,
      message: LAP_ELIGIBILITY_MESSAGES[reason.code],
      observedValue: reason.observedValue,
      requiredValue: reason.allowedMaximum,
    }
  }

  if (reason.code === 'NON_POSITIVE_LAP_TIME') {
    return {
      code: reason.code,
      message: LAP_ELIGIBILITY_MESSAGES[reason.code],
      observedValue: reason.lapTimeMs,
    }
  }

  return {
    code: reason.code,
    message: LAP_ELIGIBILITY_MESSAGES[reason.code],
  }
}
