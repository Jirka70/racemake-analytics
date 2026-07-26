import type {
  LocalSignalSpike,
  SignalResidualBaseline,
} from './audit-telemetry'
import type {
  AuditedTransition,
  ChannelResidualDiagnostics,
  FrameAuditConfig,
  ProcessingIssue,
  TelemetryChannel,
} from './frame-audit-types'
import {
  interquartileRange,
  median,
  medianAbsoluteDeviation,
  quantile,
  scaledMedianAbsoluteDeviation,
} from './robust-statistics'
import type { NormalizedTelemetryFrame } from './telemetry-types'

type LocallyAuditedChannel =
  | 'normalizedTrackPosition'
  | 'speedKmh'
  | 'engineRpm'
  | 'tyreCoreTemperatureC.frontLeft'
  | 'tyreCoreTemperatureC.frontRight'
  | 'tyreCoreTemperatureC.rearLeft'
  | 'tyreCoreTemperatureC.rearRight'

interface ResidualSample {
  readonly sourceIndex: number
  readonly timestampMs: number
  readonly measuredValue: number
  readonly predictedValue: number
  readonly unwrappedMeasuredValue: number
  readonly unwrappedPreviousValue: number
  readonly unwrappedNextValue: number
  readonly residual: number
}

const LOCALLY_AUDITED_CHANNELS: readonly LocallyAuditedChannel[] =
  Object.freeze([
    'normalizedTrackPosition',
    'speedKmh',
    'engineRpm',
    'tyreCoreTemperatureC.frontLeft',
    'tyreCoreTemperatureC.frontRight',
    'tyreCoreTemperatureC.rearLeft',
    'tyreCoreTemperatureC.rearRight',
  ])

// For normally distributed data, IQR / 1.349 estimates one standard
// deviation. This is used only when MAD is exactly zero.
const NORMAL_DISTRIBUTION_IQR_WIDTH = 1.349

function readChannelValue(
  frame: NormalizedTelemetryFrame,
  channel: LocallyAuditedChannel,
): number {
  switch (channel) {
    case 'normalizedTrackPosition':
      return frame.normalizedTrackPosition
    case 'speedKmh':
      return frame.speedKmh
    case 'engineRpm':
      return frame.engineRpm
    case 'tyreCoreTemperatureC.frontLeft':
      return frame.tyreCoreTemperatureC.frontLeft
    case 'tyreCoreTemperatureC.frontRight':
      return frame.tyreCoreTemperatureC.frontRight
    case 'tyreCoreTemperatureC.rearLeft':
      return frame.tyreCoreTemperatureC.rearLeft
    case 'tyreCoreTemperatureC.rearRight':
      return frame.tyreCoreTemperatureC.rearRight
  }
}

function unwrapCircularValueNear(
  value: number,
  reference: number,
): number {
  let unwrapped = value

  while (unwrapped - reference > 0.5) {
    unwrapped -= 1
  }
  while (unwrapped - reference < -0.5) {
    unwrapped += 1
  }

  return unwrapped
}

function normalizeCircularPosition(value: number): number {
  return ((value % 1) + 1) % 1
}

function findContinuousPairs(
  transitions: readonly AuditedTransition[],
): ReadonlySet<string> {
  return new Set(
    transitions
      .filter((transition) => transition.continuity === 'continuous')
      .map(
        (transition) =>
          `${transition.fromSourceIndex}:${transition.toSourceIndex}`,
      ),
  )
}

function collectChannelResiduals(
  frames: readonly NormalizedTelemetryFrame[],
  continuousPairs: ReadonlySet<string>,
  channel: LocallyAuditedChannel,
): readonly ResidualSample[] {
  const samples: ResidualSample[] = []

  for (let index = 1; index < frames.length - 1; index += 1) {
    const previous = frames[index - 1]
    const current = frames[index]
    const next = frames[index + 1]
    const previousPair =
      `${previous.sourceIndex}:${current.sourceIndex}`
    const nextPair = `${current.sourceIndex}:${next.sourceIndex}`

    if (!continuousPairs.has(previousPair) || !continuousPairs.has(nextPair)) {
      continue
    }

    // An RPM discontinuity is expected during a gear change. Without this
    // context, ordinary shifts would be mislabeled as sensor spikes.
    if (channel === 'engineRpm' && (previous.gear !== current.gear || current.gear !== next.gear)) {
      continue
    }

    const surroundingDurationMs =
      next.timestampMs - previous.timestampMs

    if (surroundingDurationMs <= 0) {
      continue
    }

    const ratio = (current.timestampMs - previous.timestampMs) / surroundingDurationMs
    let previousValue = readChannelValue(previous, channel)
    let measuredValue = readChannelValue(current, channel)
    let nextValue = readChannelValue(next, channel)

    if (channel === 'normalizedTrackPosition') {
      measuredValue = unwrapCircularValueNear(
        measuredValue,
        previousValue,
      )
      nextValue = unwrapCircularValueNear(nextValue, measuredValue)
    }

    const predictedValue =
      previousValue + ratio * (nextValue - previousValue)
    const residual = Math.abs(measuredValue - predictedValue)

    samples.push(
      Object.freeze({
        sourceIndex: current.sourceIndex,
        timestampMs: current.timestampMs,
        measuredValue:
          channel === 'normalizedTrackPosition'
            ? current.normalizedTrackPosition
            : measuredValue,
        predictedValue:
          channel === 'normalizedTrackPosition'
            ? normalizeCircularPosition(predictedValue)
            : predictedValue,
        unwrappedMeasuredValue: measuredValue,
        unwrappedPreviousValue: previousValue,
        unwrappedNextValue: nextValue,
        residual,
      }),
    )
  }

  return Object.freeze(samples)
}

function deriveResidualBaseline(
  channel: LocallyAuditedChannel,
  residuals: readonly number[],
  config: FrameAuditConfig['localOutlier'],
): SignalResidualBaseline {
  const minimumBaselineSamples = Math.max(
    5,
    2 * config.minimumWindowSamples + 1,
  )

  if (residuals.length < minimumBaselineSamples) {
    const diagnostics: ChannelResidualDiagnostics = Object.freeze({
      channel,
      method: 'insufficient-baseline',
      preliminarySampleCount: residuals.length,
      finalSampleCount: residuals.length,
      residualMedian: null,
      residualMad: null,
      scaledResidualMad: null,
      residualIqr: null,
      fallbackQuantile: config.fallbackQuantile,
      spikeMadMultiplier: config.spikeMadMultiplier,
      spikeThreshold: null,
    })

    return Object.freeze({
      channel,
      medianResidual: null,
      madResidual: null,
      robustScale: null,
      spikeThreshold: null,
      diagnostics,
    })
  }

  const preliminaryMedian = median(residuals)
  const preliminaryScale =
    scaledMedianAbsoluteDeviation(residuals)
  const preliminaryThreshold =
    preliminaryMedian +
    config.spikeMadMultiplier * preliminaryScale
  const recalibratedResiduals =
    preliminaryScale > 0
      ? residuals.filter(
          (residual) => residual <= preliminaryThreshold,
        )
      : [...residuals]
  const finalResiduals =
    recalibratedResiduals.length >= minimumBaselineSamples
      ? recalibratedResiduals
      : [...residuals]
  const residualMedian = median(finalResiduals)
  const residualMad = medianAbsoluteDeviation(finalResiduals)
  const scaledResidualMad =
    scaledMedianAbsoluteDeviation(finalResiduals)
  const residualIqr = interquartileRange(finalResiduals)

  let method: ChannelResidualDiagnostics['method']
  let robustScale: number | null
  let spikeThreshold: number | null

  if (scaledResidualMad > 0) {
    method = 'scaled-mad'
    robustScale = scaledResidualMad
    spikeThreshold =
      residualMedian + config.spikeMadMultiplier * robustScale
  } else if (residualIqr > 0) {
    method = 'scaled-iqr'
    robustScale = residualIqr / NORMAL_DISTRIBUTION_IQR_WIDTH
    spikeThreshold =
      residualMedian + config.spikeMadMultiplier * robustScale
  } else {
    const fallbackThreshold = quantile(
      finalResiduals,
      config.fallbackQuantile,
    )
    const maximumResidual = Math.max(...finalResiduals)

    if (maximumResidual > residualMedian) {
      method = 'quantile-fallback'
      robustScale = null
      spikeThreshold = fallbackThreshold
    } else {
      method = 'insufficient-baseline'
      robustScale = null
      spikeThreshold = null
    }
  }

  const diagnostics: ChannelResidualDiagnostics = Object.freeze({
    channel,
    method,
    preliminarySampleCount: residuals.length,
    finalSampleCount: finalResiduals.length,
    residualMedian,
    residualMad,
    scaledResidualMad,
    residualIqr,
    fallbackQuantile: config.fallbackQuantile,
    spikeMadMultiplier: config.spikeMadMultiplier,
    spikeThreshold,
  })

  return Object.freeze({
    channel,
    medianResidual: residualMedian,
    madResidual: residualMad,
    robustScale,
    spikeThreshold,
    diagnostics,
  })
}

export function computeSignalResidualBaselines(
  frames: readonly NormalizedTelemetryFrame[],
  transitions: readonly AuditedTransition[],
  config: FrameAuditConfig['localOutlier'],
): readonly SignalResidualBaseline[] {
  const continuousPairs = findContinuousPairs(transitions)

  return Object.freeze(
    LOCALLY_AUDITED_CHANNELS.map((channel) => {
      const residuals = collectChannelResiduals(
        frames,
        continuousPairs,
        channel,
      ).map((sample) => sample.residual)

      return deriveResidualBaseline(channel, residuals, config)
    }),
  )
}

function countSamplesWithinWindow(
  frames: readonly NormalizedTelemetryFrame[],
  currentIndex: number,
  direction: -1 | 1,
  maximumDurationMs: number,
  continuousPairs: ReadonlySet<string>,
): number {
  const current = frames[currentIndex]
  let count = 0
  let index = currentIndex + direction

  while (index >= 0 && index < frames.length) {
    const candidate = frames[index]
    const durationMs = Math.abs(
      candidate.timestampMs - current.timestampMs,
    )

    if (durationMs > maximumDurationMs) {
      break
    }

    const from =
      direction === -1 ? candidate : frames[index - 1]
    const to =
      direction === -1 ? frames[index + 1] : candidate

    if (
      !continuousPairs.has(
        `${from.sourceIndex}:${to.sourceIndex}`,
      )
    ) {
      break
    }

    count += 1
    index += direction
  }

  return count
}

function determineTypicalContinuousDelta(
  transitions: readonly AuditedTransition[],
): number | null {
  const positiveDeltas = transitions
    .filter(
      (transition) =>
        transition.continuity === 'continuous' &&
        transition.durationMs > 0,
    )
    .map((transition) => transition.durationMs)

  return positiveDeltas.length === 0
    ? null
    : median(positiveDeltas)
}

export function findIsolatedSignalSpikes(
  frames: readonly NormalizedTelemetryFrame[],
  transitions: readonly AuditedTransition[],
  baselines: readonly SignalResidualBaseline[],
  config: FrameAuditConfig['localOutlier'],
): readonly LocalSignalSpike[] {
  const typicalDeltaMs =
    determineTypicalContinuousDelta(transitions)

  if (typicalDeltaMs === null) {
    return Object.freeze([])
  }

  const continuousPairs = findContinuousPairs(transitions)
  const maximumWindowDurationMs =
    typicalDeltaMs * config.persistenceWindowDeltaMultiplier
  const frameIndexBySourceIndex = new Map(
    frames.map((frame, index) => [frame.sourceIndex, index]),
  )
  const spikes: LocalSignalSpike[] = []

  for (const baseline of baselines) {
    if (
      baseline.spikeThreshold === null ||
      !LOCALLY_AUDITED_CHANNELS.includes(
        baseline.channel as LocallyAuditedChannel,
      )
    ) {
      continue
    }

    const channel = baseline.channel as LocallyAuditedChannel
    const residualSamples = collectChannelResiduals(
      frames,
      continuousPairs,
      channel,
    )
    const residualBySourceIndex = new Map(
      residualSamples.map((sample) => [
        sample.sourceIndex,
        sample.residual,
      ]),
    )

    for (const sample of residualSamples) {
      if (sample.residual <= baseline.spikeThreshold) {
        continue
      }

      const frameIndex = frameIndexBySourceIndex.get(
        sample.sourceIndex,
      )

      if (frameIndex === undefined) {
        continue
      }

      const previousResidual =
        frameIndex > 0
          ? (residualBySourceIndex.get(
              frames[frameIndex - 1].sourceIndex,
            ) ?? Number.NEGATIVE_INFINITY)
          : Number.NEGATIVE_INFINITY
      const nextResidual =
        frameIndex < frames.length - 1
          ? (residualBySourceIndex.get(
              frames[frameIndex + 1].sourceIndex,
            ) ?? Number.NEGATIVE_INFINITY)
          : Number.NEGATIVE_INFINITY
      const isResidualPeak =
        sample.residual >= previousResidual &&
        sample.residual >= nextResidual &&
        (sample.residual > previousResidual ||
          sample.residual > nextResidual)

      if (!isResidualPeak) {
        continue
      }

      const leftSupport = countSamplesWithinWindow(
        frames,
        frameIndex,
        -1,
        maximumWindowDurationMs,
        continuousPairs,
      )
      const rightSupport = countSamplesWithinWindow(
        frames,
        frameIndex,
        1,
        maximumWindowDurationMs,
        continuousPairs,
      )
      const incomingChange =
        sample.unwrappedMeasuredValue -
        sample.unwrappedPreviousValue
      const outgoingChange =
        sample.unwrappedNextValue -
        sample.unwrappedMeasuredValue
      const returnsTowardPreviousTrend =
        incomingChange * outgoingChange < 0

      if (
        leftSupport < config.minimumWindowSamples ||
        rightSupport < config.minimumWindowSamples ||
        !returnsTowardPreviousTrend
      ) {
        continue
      }

      spikes.push(
        Object.freeze({
          sourceIndex: sample.sourceIndex,
          timestampMs: sample.timestampMs,
          channel,
          measuredValue: sample.measuredValue,
          predictedValue: sample.predictedValue,
          residual: sample.residual,
          threshold: baseline.spikeThreshold,
        }),
      )
    }
  }

  return Object.freeze(spikes)
}

export function findLocalOutlierIssues(
  spikes: readonly LocalSignalSpike[],
): readonly ProcessingIssue[] {
  return Object.freeze(
    spikes.map((spike) =>
      Object.freeze({
        code: 'LOCAL_OUTLIER',
        reason: 'isolated-signal-spike',
        severity: 'error',
        action: 'exclude-channel-value',
        scope: 'channel',
        sourceIndex: spike.sourceIndex,
        timestampMs: spike.timestampMs,
        channels: Object.freeze([spike.channel]),
        observed: Object.freeze({
          measuredValue: spike.measuredValue,
          predictedValue: spike.predictedValue,
          residual: spike.residual,
        }),
        thresholds: Object.freeze({
          spikeThreshold: spike.threshold,
        }),
        message: `${spike.channel} at frame ${spike.sourceIndex} is an isolated local spike and is excluded independently of the other channels.`,
      }),
    ),
  )
}

export function blockOutlierChannelsNearAffectedFrames(
  transitions: readonly AuditedTransition[],
  spikes: readonly LocalSignalSpike[],
): readonly AuditedTransition[] {
  const channelsBySourceIndex = new Map<
    number,
    Set<TelemetryChannel>
  >()

  for (const spike of spikes) {
    const channels =
      channelsBySourceIndex.get(spike.sourceIndex) ?? new Set()
    channels.add(spike.channel)
    channelsBySourceIndex.set(spike.sourceIndex, channels)
  }

  return Object.freeze(
    transitions.map((transition) => {
      const affectedChannels = new Set([
        ...(channelsBySourceIndex.get(
          transition.fromSourceIndex,
        ) ?? []),
        ...(channelsBySourceIndex.get(transition.toSourceIndex) ??
          []),
      ])

      if (affectedChannels.size === 0) {
        return transition
      }

      return Object.freeze({
        ...transition,
        interpolationBlockedChannels: Object.freeze([
          ...new Set([
            ...transition.interpolationBlockedChannels,
            ...affectedChannels,
          ]),
        ]),
        derivativesBlockedChannels: Object.freeze([
          ...new Set([
            ...transition.derivativesBlockedChannels,
            ...affectedChannels,
          ]),
        ]),
      })
    }),
  )
}
