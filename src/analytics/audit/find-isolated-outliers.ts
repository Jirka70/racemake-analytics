import type { DriverInputChannel, IsolatedChannelOutlier, IsolatedOutlierConfig, LocallyAuditedSignalChannel, SamplingBaseline, SignalResidualSample } from "../frame-audit-types";
import { interquartileRange, median, quantile, scaledMedianAbsoluteDeviation } from "../robust-statistics";
import type { NormalizedTelemetryFrame } from "../telemetry-types";
import { linearInterpolate } from "../util/linear-interpolation";
import { requireFiniteResult } from "../util/require-finite-result";
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

    // An isolated spike must return at a comparable rate to the one at which
    // it departed. This rejects the innocent neighbours of a spike and
    // persistent level changes.
    minimumReturnRateRatio: 0.25,
    fallbackIqrMultiplier: 3,
    minimumResidualBySignalChannel: {
        engineRpm: 1,
        'tyreCoreTemperatureC.frontLeft': 0.1,
        'tyreCoreTemperatureC.frontRight': 0.1,
        'tyreCoreTemperatureC.rearLeft': 0.1,
        'tyreCoreTemperatureC.rearRight': 0.1,
    },
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

        const channelOutliers = createChannelOutliers(
            residualSamples,
            residualThreshold,
            config.minimumReturnRateRatio,
        )
        outliers.push(...channelOutliers)
    }

    return outliers
}

function createChannelOutliers(
    residualSamples: SignalResidualSample[],
    residualThreshold: number,
    minimumReturnRateRatio: number,
) : IsolatedChannelOutlier[] {
    const channelOutliers: IsolatedChannelOutlier[] = []
    
    for (const sample of residualSamples) {
        if (sample.residual <= residualThreshold) {
            continue
        }

        if (!returnsImmediatelyToTrend(
            sample,
            minimumReturnRateRatio,
        )) {
            continue
        }

        channelOutliers.push({
            frame: sample.frame,
            channel: sample.channel,
            usability: isDriverInputChannel(sample.channel) ? 'suspect' : 'invalid',
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

function returnsImmediatelyToTrend(
    sample: SignalResidualSample,
    minimumReturnRateRatio: number,
) {
    const values = valuesForRateComparison(sample)
    const incomingRate = requireFiniteResult(
        (values.observed - values.previous) /
        sample.incomingDurationMs,
        'signal-rate',
    )
    const outgoingRate = requireFiniteResult(
        (values.next - values.observed) /
        sample.outgoingDurationMs,
        'signal-rate',
    )

    if (
        incomingRate === 0
        || outgoingRate === 0
        || Math.sign(incomingRate) === Math.sign(outgoingRate)
    ) {
        return false
    }

    const largerRate = Math.max(
        Math.abs(incomingRate),
        Math.abs(outgoingRate),
    )
    const smallerRate = Math.min(
        Math.abs(incomingRate),
        Math.abs(outgoingRate),
    )

    return smallerRate / largerRate >= minimumReturnRateRatio
}

interface RateComparisonValues {
    readonly previous: number
    readonly observed: number
    readonly next: number
}

function valuesForRateComparison(
    sample: SignalResidualSample,
): RateComparisonValues {
    if (sample.channel !== "normalizedTrackPosition") {
        return {
            previous: sample.previousValue,
            observed: sample.observedValue,
            next: sample.nextValue,
        }
    }

    return {
        previous: unwrapTrackPosition(
            sample.previousValue,
            sample.predictedValue,
        ),
        observed: unwrapTrackPosition(
            sample.observedValue,
            sample.predictedValue,
        ),
        next: unwrapTrackPosition(
            sample.nextValue,
            sample.predictedValue,
        ),
    }
}

function calculateResidualThreshold(samples: SignalResidualSample[], 
    channel: LocallyAuditedSignalChannel, 
    config: IsolatedOutlierConfig) : number | null {

    const hasEnoughSamples = samples.length >= config.minimumResidualSampleCount
    if (!hasEnoughSamples) return null

    const residuals = samples.map((sample) => sample.residual)
    const medianResidual = median(residuals)
    const scaledMadResidual = scaledMedianAbsoluteDeviation(residuals)

    if (scaledMadResidual > 0) {
        const madMultiplier = isDriverInputChannel(channel)
            ? config.driverInputMadMultiplier
            : config.signalMadMultiplier

        const madThreshold = requireFiniteResult(
            medianResidual + madMultiplier * scaledMadResidual,
            'robust-threshold',
        )
        return applyChannelResidualFloor(madThreshold, channel, config)
    }

    const iqrResiduals = interquartileRange(residuals)

    if (iqrResiduals > 0) {
        const upperQuartile = quantile(residuals, 0.75)
        const iqrThreshold = requireFiniteResult(
            upperQuartile + config.fallbackIqrMultiplier * iqrResiduals,
            'robust-threshold',
        )
        return applyChannelResidualFloor(iqrThreshold, channel, config)
    }

    if (isDriverInputChannel(channel)) return null

    const minimumResidual = config.minimumResidualBySignalChannel[channel]

    if (minimumResidual === undefined) {
        return null
    }

    return Math.max(medianResidual, minimumResidual)
}

function applyChannelResidualFloor(threshold: number, channel: LocallyAuditedSignalChannel,
    config: IsolatedOutlierConfig) : number {
    if (isDriverInputChannel(channel)) {
        return threshold
    }

    const minimumResidual = config.minimumResidualBySignalChannel[channel]
    if (minimumResidual === undefined) {
        return threshold
    }

    return Math.max(threshold, minimumResidual)
}

function isDriverInputChannel(channel: LocallyAuditedSignalChannel): channel is DriverInputChannel {
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
    channel: LocallyAuditedSignalChannel) : SignalResidualSample {
    
    const previousValue = readChannelValue(previousFrame, channel)
    const observedValue = readChannelValue(currentFrame, channel)
    const nextValue = readChannelValue(nextFrame, channel)

    const neighborTimeSpanMs = nextFrame.timestampMs - previousFrame.timestampMs
    const incomingDurationMs = currentFrame.timestampMs - previousFrame.timestampMs
    const outgoingDurationMs = nextFrame.timestampMs - currentFrame.timestampMs
    const interpolationFraction = incomingDurationMs / neighborTimeSpanMs

    const interpolationEndValue = channel === "normalizedTrackPosition" 
        ? unwrapTrackPosition(nextValue, previousValue) 
        : nextValue
    const predictedValueForComparison = linearInterpolate(previousValue, interpolationEndValue, interpolationFraction)
    const observedValueForComparison = channel === "normalizedTrackPosition" 
        ? unwrapTrackPosition(observedValue, predictedValueForComparison) 
        : observedValue
    const residual = requireFiniteResult(
        Math.abs(observedValueForComparison - predictedValueForComparison),
        'signal-residual',
    )
    const predictedValue = channel === "normalizedTrackPosition" 
        ? wrapTrackPosition(predictedValueForComparison) 
        : predictedValueForComparison

    return {
        frame: currentFrame,
        channel,
        previousValue,
        observedValue,
        nextValue,
        predictedValue,
        residual,
        incomingDurationMs,
        outgoingDurationMs,
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

    // here the frame has a time regression -- nothing we want
    // let's check, if we could mark current frame timestamp as "local outlier" and create transition between previous and next frame
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
