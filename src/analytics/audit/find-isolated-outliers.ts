import type { IsolatedChannelOutlier, IsolatedOutlierConfig, LocallyAuditedSignalChannel, SamplingBaseline, SignalResidualSample } from "../frame-audit-types";
import { median, scaledMedianAbsoluteDeviation } from "../robust-statistics";
import type { NormalizedTelemetryFrame } from "../telemetry-types";
import { readChannelValue } from "./util/read-channel-value";

const LOCALLY_AUDITED_SIGNAL_CHANNELS:
  readonly LocallyAuditedSignalChannel[] = [
    'normalizedTrackPosition',
    'speedKmh',
    'throttleRatio',
    'brakeRatio',
    'steeringDegrees',
    'engineRpm',
    'tyreCoreTemperatureC.frontLeft',
    'tyreCoreTemperatureC.frontRight',
    'tyreCoreTemperatureC.rearLeft',
    'tyreCoreTemperatureC.rearRight',
  ]

export const DEFAULT_ISOLATED_OUTLIER_CONFIG:
  IsolatedOutlierConfig = {
    minimumResidualSampleCount: 30,

    // Position, speed, RPM and tyres.
    signalMadMultiplier: 12,

    // Pedals and steering can legitimately change faster.
    driverInputMadMultiplier: 20,
  }

export function findChannelOutliers(frames: readonly NormalizedTelemetryFrame[], samplingBaseline: SamplingBaseline, 
    config: IsolatedOutlierConfig = DEFAULT_ISOLATED_OUTLIER_CONFIG) : IsolatedChannelOutlier[] {
    
    const timestampOutliers = findIsolatedTimestampOutliers(frames, samplingBaseline)
    const invalidTimestampSourceIndexes = new Set(
        timestampOutliers.map((outlier) => outlier.frame.sourceIndex)
    )

    const framesWithUsableTimestamp = frames.filter((frame) => !invalidTimestampSourceIndexes.has(frame.sourceIndex))
    const signalOutliers = findIsolatedChannelOutliers(framesWithUsableTimestamp, samplingBaseline, config)

    return [
        ...timestampOutliers,
        ...signalOutliers
    ].sort(compareOutliers)
}

function findIsolatedTimestampOutliers(frames: readonly NormalizedTelemetryFrame[], 
    samplingBaseline: SamplingBaseline) : IsolatedChannelOutlier[] {

    const outliers: IsolatedChannelOutlier[] = []

    for (let i = 1; i < frames.length - 1; i++) {
        const previous = frames[i - 1]
        const current = frames[i]
        const next = frames[i + 1]

        const potentialTimestampOutlier: IsolatedChannelOutlier | null = 
            maybeCreateTimestampOutlier(previous, current, next, samplingBaseline)
        
        if (potentialTimestampOutlier) {
            outliers.push(potentialTimestampOutlier)
        }


    }

    return outliers;
}

function findIsolatedChannelOutliers(frames: readonly NormalizedTelemetryFrame[], samplingBaseline: SamplingBaseline, config: IsolatedOutlierConfig)
    : IsolatedChannelOutlier[] {
    const outliers: IsolatedChannelOutlier[] = []

    for (const channel of LOCALLY_AUDITED_SIGNAL_CHANNELS) {
        const residualSamples = collectSignalResidualSamples(frames, channel, samplingBaseline.maximumGapMs)
        const residualThreshold = calculateResidualThreshold(residualSamples, channel, config)
        if (residualThreshold === null) continue

        const channelOutliers = createChannelOutliers(residualSamples, residualThreshold)
        outliers.push(...channelOutliers)
    }

    return outliers
}

function createChannelOutliers(residualSamples: SignalResidualSample[], residualThreshold: number) : IsolatedChannelOutlier[] {
    const channelOutliers: IsolatedChannelOutlier[] = []
    
    for (const sample of residualSamples) {
        if (sample.residual <= residualThreshold) {
            continue
        }

        if (!returnsImmediatelyToTrend(sample)) {
            continue
        }

        channelOutliers.push({
            frame: sample.frame,
            channel: sample.channel,
            usability: 'suspect',
            previousValue: sample.previousValue,
            observedValue: sample.observedValue,
            nextValue: sample.nextValue,
            predictedValue: sample.predictedValue,
            residual: sample.residual,
            threshold: residualThreshold,
        })
    }

    return channelOutliers
}

function returnsImmediatelyToTrend(sample: SignalResidualSample) {
    if (sample.channel !== "normalizedTrackPosition") {
        const incomingChange = sample.observedValue - sample.previousValue
        const outgoingChange = sample.nextValue - sample.observedValue

        return incomingChange * outgoingChange < 0
    }

    const previousValue = unwrapTrackPosition(sample.previousValue, sample.predictedValue)
    const observedValue = unwrapTrackPosition(sample.observedValue, sample.predictedValue)
    const nextValue = unwrapTrackPosition(sample.nextValue, sample.predictedValue)

    const incomingChange = observedValue - previousValue
    const outgoingChange = nextValue - observedValue

    return incomingChange * outgoingChange < 0
}

function calculateResidualThreshold(samples: SignalResidualSample[], 
    channel: LocallyAuditedSignalChannel, 
    config: IsolatedOutlierConfig) : number | null {

    const hasEnoughSamples = samples.length >= config.minimumResidualSampleCount
    if (!hasEnoughSamples) return null

    const residuals = samples.map((sample) => sample.residual)
    const medianResidual = median(residuals)
    const scaledMadResidual = scaledMedianAbsoluteDeviation(residuals)

    const madMultiplier = isDriverInputChannel(channel)
        ? config.driverInputMadMultiplier
        : config.signalMadMultiplier

    return (
        medianResidual +
        madMultiplier * scaledMadResidual
    )
}

function isDriverInputChannel(channel: LocallyAuditedSignalChannel) {
    return channel === "throttleRatio"
        || channel === "brakeRatio"
        || channel === "steeringDegrees"
}

function collectSignalResidualSamples(frames: readonly NormalizedTelemetryFrame[], channel: LocallyAuditedSignalChannel, maximumGapMs: number)
    : SignalResidualSample[] {
    const samples: SignalResidualSample[] = []

    for (let i = 1; i < frames.length - 1; i++) {
        const previous = frames[i - 1]
        const current = frames[i]
        const next = frames[i + 1]

        if (!hasUsableTimeAroundFrame(previous, current, next, maximumGapMs)) continue
        if (channel === "engineRpm" && hasGearChange(previous, current, next)) continue

        const sample = createSignalResidualSample(previous, current, next, channel)
        samples.push(sample)
    }

    return samples
}

function createSignalResidualSample(previousFrame: NormalizedTelemetryFrame, 
    currentFrame: NormalizedTelemetryFrame,
    nextFrame: NormalizedTelemetryFrame,
    channel: LocallyAuditedSignalChannel) {
    
    const previousValue = readChannelValue(previousFrame, channel)
    const observedValue = readChannelValue(currentFrame, channel)
    const nextValue = readChannelValue(nextFrame, channel)

    const totalDurationMs = nextFrame.timestampMs - previousFrame.timestampMs
    const elapsedDurationMs = currentFrame.timestampMs - previousFrame.timestampMs
    const progress = elapsedDurationMs / totalDurationMs

    const values = prepareValuesForInterpolation(previousValue, observedValue, nextValue, progress, channel)
    const residual = Math.abs(values.observed - values.predicted)

    const predictedValue = channel === "normalizedTrackPosition" ? wrapTrackPosition(values.predicted) : values.predicted

    return {
        frame: currentFrame,
        channel,
        previousValue,
        observedValue,
        nextValue,
        predictedValue,
        residual
    }
}

interface InterpolationValues {
    readonly observed: number
    readonly predicted: number
}

function prepareValuesForInterpolation(previous: number, observed: number, next: number, progress: number, channel: LocallyAuditedSignalChannel): InterpolationValues {
    if (channel !== "normalizedTrackPosition") {
        return {
            observed,
            predicted: previous + progress * (next - previous)
        }
    }

    const unwrappedNext = unwrapTrackPosition(next, previous)
    const predicted = previous + progress * (unwrappedNext - previous)

    return {
        observed: unwrapTrackPosition(observed, predicted),
        predicted
    }
}

function unwrapTrackPosition(position: number, reference: number) {
    const wrappedDelta = (position - reference) % 1

    if (wrappedDelta > 0.5) {
        return reference + wrappedDelta - 1
    }

    if (wrappedDelta < -0.5) {
        return reference + wrappedDelta + 1
    }

    return reference + wrappedDelta
}

function wrapTrackPosition(position: number): number {
    return ((position % 1) + 1) % 1
}

function hasGearChange(previousFrame: NormalizedTelemetryFrame, 
    currentFrame: NormalizedTelemetryFrame,
    nextFrame: NormalizedTelemetryFrame) {

    return previousFrame.gear !== currentFrame.gear 
        || currentFrame.gear !== nextFrame.gear
    
}

function hasUsableTimeAroundFrame(previousFrame: NormalizedTelemetryFrame, 
    currentFrame: NormalizedTelemetryFrame,
    nextFrame: NormalizedTelemetryFrame,
    maximumGapMs: number) {
    const incomingDeltaMs = currentFrame.timestampMs - previousFrame.timestampMs
    const outgoingDeltaMs = nextFrame.timestampMs - currentFrame.timestampMs

    return incomingDeltaMs > 0 
        && outgoingDeltaMs > 0
        && incomingDeltaMs <= maximumGapMs
        && outgoingDeltaMs <= maximumGapMs
}


function maybeCreateTimestampOutlier(previousFrame: NormalizedTelemetryFrame, 
    currentFrame: NormalizedTelemetryFrame, 
    nextFrame: NormalizedTelemetryFrame, 
    samplingBaseline: SamplingBaseline) 
    : IsolatedChannelOutlier | null {
    const incomingDeltaMs = currentFrame.timestampMs - previousFrame.timestampMs
    const outgoingDeltaMs = nextFrame.timestampMs - currentFrame.timestampMs
    const bridgeDeltaMs = nextFrame.timestampMs - previousFrame.timestampMs

    const hasTimestampRegression = incomingDeltaMs < 0  || outgoingDeltaMs < 0
    
    if (!hasTimestampRegression) return null

    const canSafelyBridge = bridgeDeltaMs > 0 && bridgeDeltaMs <= samplingBaseline.maximumGapMs

    if (!canSafelyBridge) return null

    return {
        frame: currentFrame,
        channel: 'timestampMs',
        usability: 'invalid',
        previousValue: previousFrame.timestampMs,
        observedValue: currentFrame.timestampMs,
        nextValue: nextFrame.timestampMs,
        threshold:
        samplingBaseline.maximumGapMs,
    }
}

function compareOutliers(
  left: IsolatedChannelOutlier,
  right: IsolatedChannelOutlier,
): number {
  const sourceIndexDifference =
    left.frame.sourceIndex -
    right.frame.sourceIndex

  if (sourceIndexDifference !== 0) {
    return sourceIndexDifference
  }

  return left.channel.localeCompare(right.channel)
}
