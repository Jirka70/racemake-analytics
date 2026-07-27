import type {
  SamplingBaseline,
  SamplingConfig,
  TimelineTransition,
} from '../frame-audit-types'
import {
  median,
  medianAbsoluteDeviation,
  scaledMedianAbsoluteDeviation,
} from '../robust-statistics'

export function computeSamplingBaseline(
  timelineTransitions: readonly TimelineTransition[],
  samplingConfig: SamplingConfig,
): SamplingBaseline | null {
  const chronologicalDeltas = timelineTransitions
    .filter(isTimelineTransitionChronological)
    .map((transition) => transition.timestampDeltaMs)

  const hasEnoughChronologicalSamples = chronologicalDeltas.length >= samplingConfig.minimumSampleCount

  if (!hasEnoughChronologicalSamples) {
    return null
  }

  const medianDeltaMs = median(chronologicalDeltas)
  const madDeltaMs = medianAbsoluteDeviation(chronologicalDeltas)
  const scaledMadDeltaMs = scaledMedianAbsoluteDeviation(chronologicalDeltas)

  const medianGapLimitMs = samplingConfig.gapMedianMultiplier * medianDeltaMs
  const robustGapLimitMs = medianDeltaMs + samplingConfig.gapMadMultiplier * scaledMadDeltaMs

  return {
    sampleCount: chronologicalDeltas.length,
    medianDeltaMs,
    madDeltaMs,
    scaledMadDeltaMs,
    maximumGapMs: Math.max(
      medianGapLimitMs,
      robustGapLimitMs,
    ),
  }
}

function isTimelineTransitionChronological(
  timelineTransition: TimelineTransition,
): boolean {
  return timelineTransition.relation === 'chronological'
}
