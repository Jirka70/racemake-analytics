import type {
  SamplingIntervalBaseline,
} from './audit-telemetry'
import type {
  SamplingAuditConfig,
  SamplingGap,
  SamplingGapAnalysis,
} from './frame-audit-types'
import {
  median,
  medianAbsoluteDeviation,
  scaledMedianAbsoluteDeviation,
} from './robust-statistics'
import type { NormalizedTelemetryFrame } from './telemetry-types'

/**
 * Policy values are dimensionless. The concrete millisecond threshold is
 * derived independently from every ingested dataset.
 */
export const DEFAULT_SAMPLING_AUDIT_CONFIG: SamplingAuditConfig =
  Object.freeze({
    // Five typical intervals tolerate ordinary jitter and a few delayed frames.
    gapMedianMultiplier: 5,

    // Ten robust scale units keep highly irregular, but normal, sampling valid.
    gapRobustScaleMultiplier: 10,

    // Smaller samples do not provide a defensible robust sampling baseline.
    minimumBaselineSamples: 30,
  })

export function computeSamplingIntervalBaseline(
  frames: readonly NormalizedTelemetryFrame[],
  config: SamplingAuditConfig,
): SamplingIntervalBaseline {
  const positiveDeltas = collectPositiveDeltas(frames)

  if (positiveDeltas.length < config.minimumBaselineSamples) {
    return Object.freeze({
      positiveDeltaCount: positiveDeltas.length,
      medianDeltaMs: null,
      madDeltaMs: null,
      robustScaleMs: null,
      maximumGapMs: null,
    })
  }

  const medianDeltaMs = median(positiveDeltas)
  const madDeltaMs = medianAbsoluteDeviation(positiveDeltas)
  const robustScaleMs =
    scaledMedianAbsoluteDeviation(positiveDeltas)
  const maximumGapMs = Math.max(
    config.gapMedianMultiplier * medianDeltaMs,
    medianDeltaMs +
      config.gapRobustScaleMultiplier * robustScaleMs,
  )

  return Object.freeze({
    positiveDeltaCount: positiveDeltas.length,
    medianDeltaMs,
    madDeltaMs,
    robustScaleMs,
    maximumGapMs,
  })
}

export function findGapsExceedingMaximumGap(
  frames: readonly NormalizedTelemetryFrame[],
  maximumGapMs: number | null,
): readonly SamplingGap[] {
  if (maximumGapMs === null) {
    return Object.freeze([])
  }

  const gaps: SamplingGap[] = []

  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1]
    const current = frames[index]
    const durationMs = current.timestampMs - previous.timestampMs

    if (durationMs > maximumGapMs) {
      gaps.push(
        Object.freeze({
          fromSourceIndex: previous.sourceIndex,
          toSourceIndex: current.sourceIndex,
          fromTimestampMs: previous.timestampMs,
          toTimestampMs: current.timestampMs,
          durationMs,
        }),
      )
    }
  }

  return Object.freeze(gaps)
}

function collectPositiveDeltas(
  frames: readonly NormalizedTelemetryFrame[],
): number[] {
  const positiveDeltas: number[] = []

  for (let index = 1; index < frames.length; index += 1) {
    const durationMs =
      frames[index].timestampMs - frames[index - 1].timestampMs

    if (durationMs > 0) {
      positiveDeltas.push(durationMs)
    }
  }

  return positiveDeltas
}

export function analyzeSamplingGaps(
  frames: readonly NormalizedTelemetryFrame[],
  config: SamplingAuditConfig = DEFAULT_SAMPLING_AUDIT_CONFIG,
): SamplingGapAnalysis {
  const baseline = computeSamplingIntervalBaseline(
    frames,
    config,
  )
  const gaps = findGapsExceedingMaximumGap(
    frames,
    baseline.maximumGapMs,
  )

  return Object.freeze({
    gaps,
    diagnostics: Object.freeze({
      positiveDeltaCount: baseline.positiveDeltaCount,
      medianDeltaMs: baseline.medianDeltaMs,
      madDeltaMs: baseline.madDeltaMs,
      scaledMadDeltaMs: baseline.robustScaleMs,
      maximumGapMs: baseline.maximumGapMs,
      gapMedianMultiplier: config.gapMedianMultiplier,
      gapRobustScaleMultiplier: config.gapRobustScaleMultiplier,
      detectedGapCount: gaps.length,
    }),
  })
}
