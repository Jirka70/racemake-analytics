import type {
  LocalSignalSpike,
  SignalResidualBaseline,
} from './audit-telemetry'
import type {
  AuditedTransition,
  ChannelResidualDiagnostics,
  FrameAuditConfig,
  ProcessingIssue,
  ResidualBaselineMethod,
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
  readonly continuousPreviousValue: number
  readonly continuousMeasuredValue: number
  readonly continuousNextValue: number
  readonly residual: number
}

interface ChannelValuesForResidual {
  readonly previousValue: number
  readonly measuredValue: number
  readonly nextValue: number
}

interface ResidualDistribution {
  readonly median: number
  readonly mad: number
  readonly scaledMad: number
  readonly iqr: number
}

interface ResidualThreshold {
  readonly method: ResidualBaselineMethod
  readonly robustScale: number | null
  readonly spikeThreshold: number | null
}

const LOCALLY_AUDITED_CHANNELS: readonly LocallyAuditedChannel[] = Object.freeze([
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

function convertToContinuousTrackPosition(
  trackPosition: number,
  previousTrackPosition: number,
): number {
  const positionChange = trackPosition - previousTrackPosition
  const hasCrossedFinishLineForward = positionChange < -0.5
  const hasCrossedFinishLineBackward = positionChange > 0.5

  if (hasCrossedFinishLineForward) return trackPosition + 1
  if (hasCrossedFinishLineBackward) return trackPosition - 1

  return trackPosition
}

function convertToPositionWithinLap(continuousTrackPosition: number): number {
  if (continuousTrackPosition >= 1) return continuousTrackPosition - 1
  if (continuousTrackPosition < 0) return continuousTrackPosition + 1

  return continuousTrackPosition
}

function createTransitionKey(fromSourceIndex: number, toSourceIndex: number): string {
  return `${fromSourceIndex}:${toSourceIndex}`
}

function collectContinuousTransitionKeys(
  transitions: readonly AuditedTransition[],
): ReadonlySet<string> {
  const continuousTransitionKeys = new Set<string>()

  for (const transition of transitions) {
    if (transition.continuity !== 'continuous') continue

    continuousTransitionKeys.add(
      createTransitionKey(transition.fromSourceIndex, transition.toSourceIndex),
    )
  }

  return continuousTransitionKeys
}

function hasContinuousTransitionsAroundFrame(
  previous: NormalizedTelemetryFrame,
  current: NormalizedTelemetryFrame,
  next: NormalizedTelemetryFrame,
  continuousTransitionKeys: ReadonlySet<string>,
): boolean {
  const previousTransitionKey = createTransitionKey(previous.sourceIndex, current.sourceIndex)
  const nextTransitionKey = createTransitionKey(current.sourceIndex, next.sourceIndex)
  const hasContinuousPreviousTransition = continuousTransitionKeys.has(previousTransitionKey)
  const hasContinuousNextTransition = continuousTransitionKeys.has(nextTransitionKey)

  return hasContinuousPreviousTransition && hasContinuousNextTransition
}

function hasGearChangeAroundFrame(
  previous: NormalizedTelemetryFrame,
  current: NormalizedTelemetryFrame,
  next: NormalizedTelemetryFrame,
): boolean {
  return previous.gear !== current.gear || current.gear !== next.gear
}

function readChannelValuesForResidual(
  previous: NormalizedTelemetryFrame,
  current: NormalizedTelemetryFrame,
  next: NormalizedTelemetryFrame,
  channel: LocallyAuditedChannel,
): ChannelValuesForResidual {
  const previousValue = readChannelValue(previous, channel)
  const measuredValue = readChannelValue(current, channel)
  const nextValue = readChannelValue(next, channel)

  if (channel !== 'normalizedTrackPosition') {
    return { previousValue, measuredValue, nextValue }
  }

  const continuousMeasuredValue = convertToContinuousTrackPosition(
    measuredValue,
    previousValue,
  )
  const continuousNextValue = convertToContinuousTrackPosition(
    nextValue,
    continuousMeasuredValue,
  )

  return {
    previousValue,
    measuredValue: continuousMeasuredValue,
    nextValue: continuousNextValue,
  }
}

function calculateResidualSample(
  previous: NormalizedTelemetryFrame,
  current: NormalizedTelemetryFrame,
  next: NormalizedTelemetryFrame,
  channel: LocallyAuditedChannel,
): ResidualSample | null {
  const surroundingDurationMs = next.timestampMs - previous.timestampMs
  if (surroundingDurationMs <= 0) return null

  const elapsedDurationMs = current.timestampMs - previous.timestampMs
  const currentFrameProgress = elapsedDurationMs / surroundingDurationMs
  const channelValues = readChannelValuesForResidual(previous, current, next, channel)
  const predictedContinuousValue = channelValues.previousValue + currentFrameProgress * (channelValues.nextValue - channelValues.previousValue)
  const residual = Math.abs(channelValues.measuredValue - predictedContinuousValue)
  const isTrackPositionChannel = channel === 'normalizedTrackPosition'

  return Object.freeze({
    sourceIndex: current.sourceIndex,
    timestampMs: current.timestampMs,
    measuredValue: isTrackPositionChannel 
      ? current.normalizedTrackPosition 
      : channelValues.measuredValue,
    predictedValue: isTrackPositionChannel
      ? convertToPositionWithinLap(predictedContinuousValue)
      : predictedContinuousValue,
    continuousPreviousValue: channelValues.previousValue,
    continuousMeasuredValue: channelValues.measuredValue,
    continuousNextValue: channelValues.nextValue,
    residual,
  })
}

function collectChannelResiduals(
  frames: readonly NormalizedTelemetryFrame[],
  continuousTransitionKeys: ReadonlySet<string>,
  channel: LocallyAuditedChannel,
): readonly ResidualSample[] {
  const residualSamples: ResidualSample[] = []

  for (let index = 1; index < frames.length - 1; index += 1) {
    const previous = frames[index - 1]
    const current = frames[index]
    const next = frames[index + 1]
    const hasContinuousSurroundingTransitions = hasContinuousTransitionsAroundFrame(
      previous,
      current,
      next,
      continuousTransitionKeys,
    )

    if (!hasContinuousSurroundingTransitions) continue

    const rpmChangeIsCausedByGearShift =
      channel === 'engineRpm' && hasGearChangeAroundFrame(previous, current, next)

    if (rpmChangeIsCausedByGearShift) continue

    const residualSample = calculateResidualSample(previous, current, next, channel)
    if (residualSample === null) continue

    residualSamples.push(residualSample)
  }

  return Object.freeze(residualSamples)
}

function calculateMinimumResidualSampleCount(
  config: FrameAuditConfig['localOutlier'],
): number {
  return Math.max(5, 2 * config.minimumWindowSamples + 1)
}

function createInsufficientResidualBaseline(
  channel: LocallyAuditedChannel,
  sampleCount: number,
  config: FrameAuditConfig['localOutlier'],
): SignalResidualBaseline {
  const diagnostics: ChannelResidualDiagnostics = Object.freeze({
    channel,
    method: 'insufficient-baseline',
    preliminarySampleCount: sampleCount,
    finalSampleCount: sampleCount,
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

function removeExtremeResidualsFromBaseline(
  residuals: readonly number[],
  minimumSampleCount: number,
  config: FrameAuditConfig['localOutlier'],
): readonly number[] {
  const preliminaryMedian = median(residuals)
  const preliminaryScale = scaledMedianAbsoluteDeviation(residuals)
  if (preliminaryScale === 0) return residuals

  const preliminaryThreshold =
    preliminaryMedian + config.spikeMadMultiplier * preliminaryScale
  const residualsWithinThreshold = residuals.filter(
    (residual) => residual <= preliminaryThreshold,
  )

  if (residualsWithinThreshold.length < minimumSampleCount) return residuals

  return residualsWithinThreshold
}

function calculateResidualDistribution(
  residuals: readonly number[],
): ResidualDistribution {
  return {
    median: median(residuals),
    mad: medianAbsoluteDeviation(residuals),
    scaledMad: scaledMedianAbsoluteDeviation(residuals),
    iqr: interquartileRange(residuals),
  }
}

function calculateResidualThreshold(
  residuals: readonly number[],
  distribution: ResidualDistribution,
  config: FrameAuditConfig['localOutlier'],
): ResidualThreshold {
  if (distribution.scaledMad > 0) {
    return {
      method: 'scaled-mad',
      robustScale: distribution.scaledMad,
      spikeThreshold:
        distribution.median + config.spikeMadMultiplier * distribution.scaledMad,
    }
  }

  if (distribution.iqr > 0) {
    const robustScale = distribution.iqr / NORMAL_DISTRIBUTION_IQR_WIDTH

    return {
      method: 'scaled-iqr',
      robustScale,
      spikeThreshold: distribution.median + config.spikeMadMultiplier * robustScale,
    }
  }

  const fallbackThreshold = quantile(residuals, config.fallbackQuantile)
  const maximumResidual = Math.max(...residuals)
  const hasUsefulFallbackThreshold = maximumResidual > distribution.median

  if (hasUsefulFallbackThreshold) {
    return {
      method: 'quantile-fallback',
      robustScale: null,
      spikeThreshold: fallbackThreshold,
    }
  }

  return {
    method: 'insufficient-baseline',
    robustScale: null,
    spikeThreshold: null,
  }
}

function deriveResidualBaseline(
  channel: LocallyAuditedChannel,
  residuals: readonly number[],
  config: FrameAuditConfig['localOutlier'],
): SignalResidualBaseline {
  const minimumSampleCount = calculateMinimumResidualSampleCount(config)

  if (residuals.length < minimumSampleCount) {
    return createInsufficientResidualBaseline(channel, residuals.length, config)
  }

  const baselineResiduals = removeExtremeResidualsFromBaseline(
    residuals,
    minimumSampleCount,
    config,
  )
  const distribution = calculateResidualDistribution(baselineResiduals)
  const threshold = calculateResidualThreshold(baselineResiduals, distribution, config)
  const diagnostics: ChannelResidualDiagnostics = Object.freeze({
    channel,
    method: threshold.method,
    preliminarySampleCount: residuals.length,
    finalSampleCount: baselineResiduals.length,
    residualMedian: distribution.median,
    residualMad: distribution.mad,
    scaledResidualMad: distribution.scaledMad,
    residualIqr: distribution.iqr,
    fallbackQuantile: config.fallbackQuantile,
    spikeMadMultiplier: config.spikeMadMultiplier,
    spikeThreshold: threshold.spikeThreshold,
  })

  return Object.freeze({
    channel,
    medianResidual: distribution.median,
    madResidual: distribution.mad,
    robustScale: threshold.robustScale,
    spikeThreshold: threshold.spikeThreshold,
    diagnostics,
  })
}

export function computeSignalResidualBaselines(
  frames: readonly NormalizedTelemetryFrame[],
  transitions: readonly AuditedTransition[],
  config: FrameAuditConfig['localOutlier'],
): readonly SignalResidualBaseline[] {
  const continuousTransitionKeys = collectContinuousTransitionKeys(transitions)
  const baselines: SignalResidualBaseline[] = []

  for (const channel of LOCALLY_AUDITED_CHANNELS) {
    const residualSamples = collectChannelResiduals(
      frames,
      continuousTransitionKeys,
      channel,
    )
    const residuals = residualSamples.map((sample) => sample.residual)
    const baseline = deriveResidualBaseline(channel, residuals, config)

    baselines.push(baseline)
  }

  return Object.freeze(baselines)
}

function countContinuousSamplesBeforeFrame(
  frames: readonly NormalizedTelemetryFrame[],
  currentIndex: number,
  maximumDurationMs: number,
  continuousTransitionKeys: ReadonlySet<string>,
): number {
  const current = frames[currentIndex]
  let sampleCount = 0

  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const candidate = frames[index]
    const durationMs = current.timestampMs - candidate.timestampMs
    if (durationMs > maximumDurationMs) break

    const nextFrame = frames[index + 1]
    const transitionKey = createTransitionKey(candidate.sourceIndex, nextFrame.sourceIndex)
    if (!continuousTransitionKeys.has(transitionKey)) break

    sampleCount += 1
  }

  return sampleCount
}

function countContinuousSamplesAfterFrame(
  frames: readonly NormalizedTelemetryFrame[],
  currentIndex: number,
  maximumDurationMs: number,
  continuousTransitionKeys: ReadonlySet<string>,
): number {
  const current = frames[currentIndex]
  let sampleCount = 0

  for (let index = currentIndex + 1; index < frames.length; index += 1) {
    const candidate = frames[index]
    const durationMs = candidate.timestampMs - current.timestampMs
    if (durationMs > maximumDurationMs) break

    const previousFrame = frames[index - 1]
    const transitionKey = createTransitionKey(previousFrame.sourceIndex, candidate.sourceIndex)
    if (!continuousTransitionKeys.has(transitionKey)) break

    sampleCount += 1
  }

  return sampleCount
}

function calculateTypicalContinuousIntervalMs(
  transitions: readonly AuditedTransition[],
): number | null {
  const positiveContinuousIntervals: number[] = []

  for (const transition of transitions) {
    const isPositiveContinuousInterval =
      transition.continuity === 'continuous' && transition.durationMs > 0

    if (isPositiveContinuousInterval) {
      positiveContinuousIntervals.push(transition.durationMs)
    }
  }

  if (positiveContinuousIntervals.length === 0) return null

  return median(positiveContinuousIntervals)
}

function isLocallyAuditedChannel(channel: TelemetryChannel): channel is LocallyAuditedChannel {
  return LOCALLY_AUDITED_CHANNELS.includes(channel as LocallyAuditedChannel)
}

function mapFrameIndexesBySourceIndex(
  frames: readonly NormalizedTelemetryFrame[],
): ReadonlyMap<number, number> {
  const frameIndexes = new Map<number, number>()

  for (let index = 0; index < frames.length; index += 1) {
    frameIndexes.set(frames[index].sourceIndex, index)
  }

  return frameIndexes
}

function mapResidualsBySourceIndex(
  residualSamples: readonly ResidualSample[],
): ReadonlyMap<number, number> {
  const residuals = new Map<number, number>()

  for (const sample of residualSamples) {
    residuals.set(sample.sourceIndex, sample.residual)
  }

  return residuals
}

function isHighestResidualNearFrame(
  sample: ResidualSample,
  frameIndex: number,
  frames: readonly NormalizedTelemetryFrame[],
  residualsBySourceIndex: ReadonlyMap<number, number>,
): boolean {
  const previousSourceIndex = frames[frameIndex - 1]?.sourceIndex
  const nextSourceIndex = frames[frameIndex + 1]?.sourceIndex
  const previousResidual =
    previousSourceIndex === undefined
      ? Number.NEGATIVE_INFINITY
      : (residualsBySourceIndex.get(previousSourceIndex) ?? Number.NEGATIVE_INFINITY)
  const nextResidual =
    nextSourceIndex === undefined
      ? Number.NEGATIVE_INFINITY
      : (residualsBySourceIndex.get(nextSourceIndex) ?? Number.NEGATIVE_INFINITY)
  const isAtLeastAsHighAsNeighbours =
    sample.residual >= previousResidual && sample.residual >= nextResidual
  const isHigherThanAtLeastOneNeighbour =
    sample.residual > previousResidual || sample.residual > nextResidual

  return isAtLeastAsHighAsNeighbours && isHigherThanAtLeastOneNeighbour
}

function returnsToSurroundingSignalTrend(sample: ResidualSample): boolean {
  const incomingChange = sample.continuousMeasuredValue - sample.continuousPreviousValue
  const outgoingChange = sample.continuousNextValue - sample.continuousMeasuredValue

  return incomingChange * outgoingChange < 0
}

function hasRequiredSurroundingSampleCount(
  frames: readonly NormalizedTelemetryFrame[],
  frameIndex: number,
  maximumWindowDurationMs: number,
  minimumWindowSamples: number,
  continuousTransitionKeys: ReadonlySet<string>,
): boolean {
  const samplesBefore = countContinuousSamplesBeforeFrame(
    frames,
    frameIndex,
    maximumWindowDurationMs,
    continuousTransitionKeys,
  )
  const samplesAfter = countContinuousSamplesAfterFrame(
    frames,
    frameIndex,
    maximumWindowDurationMs,
    continuousTransitionKeys,
  )

  return samplesBefore >= minimumWindowSamples && samplesAfter >= minimumWindowSamples
}

function createLocalSignalSpike(
  sample: ResidualSample,
  channel: LocallyAuditedChannel,
  threshold: number,
): LocalSignalSpike {
  return Object.freeze({
    sourceIndex: sample.sourceIndex,
    timestampMs: sample.timestampMs,
    channel,
    measuredValue: sample.measuredValue,
    predictedValue: sample.predictedValue,
    residual: sample.residual,
    threshold,
  })
}

export function findIsolatedSignalSpikes(
  frames: readonly NormalizedTelemetryFrame[],
  transitions: readonly AuditedTransition[],
  baselines: readonly SignalResidualBaseline[],
  config: FrameAuditConfig['localOutlier'],
): readonly LocalSignalSpike[] {
  const typicalContinuousIntervalMs = calculateTypicalContinuousIntervalMs(transitions)
  if (typicalContinuousIntervalMs === null) return Object.freeze([])

  const maximumWindowDurationMs =
    typicalContinuousIntervalMs * config.persistenceWindowDeltaMultiplier
  const continuousTransitionKeys = collectContinuousTransitionKeys(transitions)
  const frameIndexesBySourceIndex = mapFrameIndexesBySourceIndex(frames)
  const spikes: LocalSignalSpike[] = []

  for (const baseline of baselines) {
    if (baseline.spikeThreshold === null) continue
    if (!isLocallyAuditedChannel(baseline.channel)) continue

    const channel = baseline.channel
    const residualSamples = collectChannelResiduals(
      frames,
      continuousTransitionKeys,
      channel,
    )
    const residualsBySourceIndex = mapResidualsBySourceIndex(residualSamples)

    for (const sample of residualSamples) {
      const exceedsSpikeThreshold = sample.residual > baseline.spikeThreshold
      if (!exceedsSpikeThreshold) continue

      const frameIndex = frameIndexesBySourceIndex.get(sample.sourceIndex)
      if (frameIndex === undefined) continue

      const isHighestSurroundingResidual = isHighestResidualNearFrame(
        sample,
        frameIndex,
        frames,
        residualsBySourceIndex,
      )
      if (!isHighestSurroundingResidual) continue

      const hasRequiredSamples = hasRequiredSurroundingSampleCount(
        frames,
        frameIndex,
        maximumWindowDurationMs,
        config.minimumWindowSamples,
        continuousTransitionKeys,
      )
      if (!hasRequiredSamples) continue

      const returnsToSignalTrend = returnsToSurroundingSignalTrend(sample)
      if (!returnsToSignalTrend) continue

      spikes.push(createLocalSignalSpike(sample, channel, baseline.spikeThreshold))
    }
  }

  return Object.freeze(spikes)
}

function createLocalOutlierIssue(spike: LocalSignalSpike): ProcessingIssue {
  return Object.freeze({
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
  })
}

export function findLocalOutlierIssues(
  spikes: readonly LocalSignalSpike[],
): readonly ProcessingIssue[] {
  const issues: ProcessingIssue[] = []

  for (const spike of spikes) {
    issues.push(createLocalOutlierIssue(spike))
  }

  return Object.freeze(issues)
}

function groupSpikeChannelsBySourceIndex(
  spikes: readonly LocalSignalSpike[],
): ReadonlyMap<number, ReadonlySet<TelemetryChannel>> {
  const channelsBySourceIndex = new Map<number, Set<TelemetryChannel>>()

  for (const spike of spikes) {
    const channels = channelsBySourceIndex.get(spike.sourceIndex) ?? new Set()
    channels.add(spike.channel)
    channelsBySourceIndex.set(spike.sourceIndex, channels)
  }

  return channelsBySourceIndex
}

function collectOutlierChannelsNearTransition(
  transition: AuditedTransition,
  channelsBySourceIndex: ReadonlyMap<number, ReadonlySet<TelemetryChannel>>,
): readonly TelemetryChannel[] {
  const affectedChannels = new Set<TelemetryChannel>()
  const channelsAtPreviousFrame = channelsBySourceIndex.get(transition.fromSourceIndex) ?? []
  const channelsAtNextFrame = channelsBySourceIndex.get(transition.toSourceIndex) ?? []

  for (const channel of channelsAtPreviousFrame) affectedChannels.add(channel)
  for (const channel of channelsAtNextFrame) affectedChannels.add(channel)

  return [...affectedChannels]
}

function mergeUniqueChannels(
  existingChannels: readonly TelemetryChannel[],
  additionalChannels: readonly TelemetryChannel[],
): readonly TelemetryChannel[] {
  return Object.freeze([...new Set([...existingChannels, ...additionalChannels])])
}

function blockChannelsOnTransition(
  transition: AuditedTransition,
  affectedChannels: readonly TelemetryChannel[],
): AuditedTransition {
  return Object.freeze({
    ...transition,
    interpolationBlockedChannels: mergeUniqueChannels(
      transition.interpolationBlockedChannels,
      affectedChannels,
    ),
    derivativesBlockedChannels: mergeUniqueChannels(
      transition.derivativesBlockedChannels,
      affectedChannels,
    ),
  })
}

export function blockOutlierChannelsNearAffectedFrames(
  transitions: readonly AuditedTransition[],
  spikes: readonly LocalSignalSpike[],
): readonly AuditedTransition[] {
  const channelsBySourceIndex = groupSpikeChannelsBySourceIndex(spikes)
  const auditedTransitions: AuditedTransition[] = []

  for (const transition of transitions) {
    const affectedChannels = collectOutlierChannelsNearTransition(
      transition,
      channelsBySourceIndex,
    )

    if (affectedChannels.length === 0) {
      auditedTransitions.push(transition)
      continue
    }

    auditedTransitions.push(blockChannelsOnTransition(transition, affectedChannels))
  }

  return Object.freeze(auditedTransitions)
}
