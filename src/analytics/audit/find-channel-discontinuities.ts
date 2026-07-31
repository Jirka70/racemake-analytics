import { AuditedFrame, AuditedTimelineTransition, ChannelContinuityConfig, ChannelDiscontinuity, ChannelDiscontinuityEvidence, DerivableTelemetryChannel, LocallyAuditedSignalChannel, PersistenceAuditedChannel, SamplingBaseline, TelemetryChannel, UsableTimeline } from "../frame-audit-types";
import { interquartileRange, median, quantile, scaledMedianAbsoluteDeviation } from "../robust-statistics";
import { readChannelValue } from "./util/read-channel-value";

const PERSISTENCE_AUDITED_CHANNELS: readonly PersistenceAuditedChannel[] = [
    'speedKmh',
    'engineRpm',
    'tyreCoreTemperatureC.frontLeft',
    'tyreCoreTemperatureC.frontRight',
    'tyreCoreTemperatureC.rearLeft',
    'tyreCoreTemperatureC.rearRight',
]

const LOCALLY_AUDITED_SIGNAL_CHANNELS: readonly LocallyAuditedSignalChannel[] = [
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

const LOCALLY_AUDITED_SIGNAL_CHANNEL_SET: ReadonlySet<TelemetryChannel> = new Set(LOCALLY_AUDITED_SIGNAL_CHANNELS)

type ChannelGroup = 'motion' | 'powertrain' | 'thermal'

interface PersistentShiftEvidence {
    readonly previousValue: number
    readonly currentValue: number
    readonly boundaryDelta: number
    readonly leftMedian: number
    readonly rightMedian: number
    readonly persistentShift: number
    readonly leftSpread: number
    readonly rightSpread: number
}

export function findChannelDiscontinuities(timeline: UsableTimeline, samplingBaseline: SamplingBaseline, config: ChannelContinuityConfig) : ChannelDiscontinuity[] {
    const rateThresholds = calculateRateThresholds(timeline, config)
    const findings: ChannelDiscontinuity[] = []

    for (let transitionIndex = 0; transitionIndex < timeline.transitions.length; transitionIndex++) {
        const transition = timeline.transitions[transitionIndex]
        if (transition.timeContinuity !== 'continuous') continue

        const candidateEvidence: ChannelDiscontinuityEvidence[] = []

        for (const channel of PERSISTENCE_AUDITED_CHANNELS) {
            const rateThreshold = rateThresholds.get(channel)
            if (rateThreshold === undefined) continue // has not enough samples e.g.
            if (channel === 'engineRpm' && transition.previous.gear !== transition.current.gear) continue
            const absoluteRatePerSecond = calculateAbsoluteRate(transition, channel)
            if (absoluteRatePerSecond <= rateThreshold) continue
            const persistentShiftEvidence = createPersistentShiftEvidence(timeline, transitionIndex, channel, samplingBaseline, config)
            if (persistentShiftEvidence === null) continue

            candidateEvidence.push({ channel, absoluteRatePerSecond, rateThresholdPerSecond: rateThreshold, ...persistentShiftEvidence })
        }

        const confirmedEvidence = confirmCandidateEvidence(candidateEvidence)
        if (confirmedEvidence.length === 0) continue

        findings.push({
            previousSourceIndex: transition.previous.sourceIndex,
            currentSourceIndex: transition.current.sourceIndex,
            channels: confirmedEvidence.map((item) => item.channel),
            evidence: confirmedEvidence,
        })
    }

    return findings
}

export function attachChannelDiscontinuities(timeline: UsableTimeline, findings: readonly ChannelDiscontinuity[]) : UsableTimeline {
    const framesBySourceIndex = new Map(timeline.frames.map((frame) => [frame.frame.sourceIndex, frame]))
    const findingsByTransition = new Map(findings.map((finding) => [transitionKey(finding.previousSourceIndex, finding.currentSourceIndex), finding]))

    const transitions = timeline.transitions.map((transition) => {
        const previous = framesBySourceIndex.get(transition.previous.sourceIndex)
        const current = framesBySourceIndex.get(transition.current.sourceIndex)

        if (!previous || !current) throw new Error('Timeline transition is not connected to audited frames')

        const finding = findingsByTransition.get(transitionKey(transition.previous.sourceIndex, transition.current.sourceIndex))

        return {
            ...transition,
            discontinuousChannels: collectDiscontinuousChannels(previous, current, finding?.channels ?? []),
        }
    })

    return {
        ...timeline,
        transitions,
    }
}

export function canCalculateDerivative(transition: AuditedTimelineTransition, channel: DerivableTelemetryChannel) : boolean {
    return transition.timeContinuity === 'continuous' && !transition.discontinuousChannels.includes(channel)
}

export function canInterpolateAcrossTransition(transition: AuditedTimelineTransition, channel: LocallyAuditedSignalChannel) : boolean {
    return transition.timeContinuity === 'continuous' && !transition.discontinuousChannels.includes(channel)
}

function calculateRateThresholds(timeline: UsableTimeline, config: ChannelContinuityConfig) : Map<PersistenceAuditedChannel, number> {
    const thresholds = new Map<PersistenceAuditedChannel, number>()

    for (const channel of PERSISTENCE_AUDITED_CHANNELS) {
        const rates = collectUsableRates(timeline, channel)
        if (rates.length < config.minimumRateSampleCount) continue

        thresholds.set(channel, calculateRateThreshold(rates, config))
    }

    return thresholds
}

function collectUsableRates(timeline: UsableTimeline, channel: PersistenceAuditedChannel) : number[] {
    const framesBySourceIndex = new Map(timeline.frames.map((frame) => [frame.frame.sourceIndex, frame]))
    const rates: number[] = []

    for (const transition of timeline.transitions) {
        if (transition.timeContinuity !== 'continuous') continue

        const previous = framesBySourceIndex.get(transition.previous.sourceIndex)
        const current = framesBySourceIndex.get(transition.current.sourceIndex)

        if (!previous || !current) continue
        if (!isChannelUsable(previous, channel) || !isChannelUsable(current, channel)) continue
        if (channel === 'engineRpm' && transition.previous.gear !== transition.current.gear) continue

        rates.push(calculateAbsoluteRate(transition, channel))
    }

    return rates
}

function calculateRateThreshold(rates: readonly number[], config: ChannelContinuityConfig) : number {
    const medianRate = median(rates)
    const scaledMadRate = scaledMedianAbsoluteDeviation(rates)

    if (scaledMadRate > 0) return medianRate + config.rateMadMultiplier * scaledMadRate

    const rateIqr = interquartileRange(rates)
    if (rateIqr > 0) return quantile(rates, 0.75) + config.rateIqrMultiplier * rateIqr

    return medianRate
}

function calculateAbsoluteRate(transition: AuditedTimelineTransition, channel: PersistenceAuditedChannel) : number {
    const previousValue = readChannelValue(transition.previous, channel)
    const currentValue = readChannelValue(transition.current, channel)
    const durationSeconds = transition.timestampDeltaMs / 1_000

    return Math.abs(currentValue - previousValue) / durationSeconds
}

function createPersistentShiftEvidence(timeline: UsableTimeline, transitionIndex: number, channel: PersistenceAuditedChannel,
    samplingBaseline: SamplingBaseline, config: ChannelContinuityConfig) : PersistentShiftEvidence | null {
    const windowDurationMs = samplingBaseline.medianDeltaMs * config.windowDurationMultiplier
    const previousFrameIndex = transitionIndex
    const currentFrameIndex = transitionIndex + 1
    const leftWindow = collectWindow(timeline, previousFrameIndex, -1, windowDurationMs)
    const rightWindow = collectWindow(timeline, currentFrameIndex, 1, windowDurationMs)
    const leftValues = readWindowValues(leftWindow, channel, config.minimumWindowSamples)
    const rightValues = readWindowValues(rightWindow, channel, config.minimumWindowSamples)

    if (leftValues === null || rightValues === null) return null

    const leftMedian = median(leftValues)
    const rightMedian = median(rightValues)
    const persistentShift = rightMedian - leftMedian
    if (persistentShift === 0) return null // no shift

    const previousValue = readChannelValue(timeline.frames[previousFrameIndex].frame, channel)
    const currentValue = readChannelValue(timeline.frames[currentFrameIndex].frame, channel)
    const boundaryDelta = currentValue - previousValue

    if (Math.sign(boundaryDelta) !== Math.sign(persistentShift)) return null
    const minimumBoundaryShare = config.minimumBoundaryShareOfPersistentShift
    const minimumBoundaryDelta = Math.abs(persistentShift) * minimumBoundaryShare
    if (Math.abs(boundaryDelta) < minimumBoundaryDelta) return null

    const leftSpread = calculateWindowSpread(leftValues)
    const rightSpread = calculateWindowSpread(rightValues)
    const largestWindowSpread = Math.max(leftSpread, rightSpread)
    if (Math.abs(persistentShift) <= largestWindowSpread * config.minimumShiftToSpreadRatio) return null

    return { previousValue, currentValue, boundaryDelta, leftMedian, rightMedian, persistentShift, leftSpread, rightSpread }
}

function collectWindow(timeline: UsableTimeline, startIndex: number, direction: -1 | 1, maximumWindowDurationMs: number) : AuditedFrame[] {
    const window: AuditedFrame[] = []
    const windowStartFrame = timeline.frames[startIndex].frame
    const startTimestampMs = windowStartFrame.timestampMs

    for (let index = startIndex; index >= 0 && index < timeline.frames.length; index += direction) {
        const crossedTransition = findTransition(timeline, index, direction)
        const isCrossedTransitionContinuous = crossedTransition.timeContinuity === "continuous"
        if (index !== startIndex && isCrossedTransitionContinuous) break

        const frame = timeline.frames[index]
        const timestampChangeFromWindowStart = Math.abs(frame.frame.timestampMs - startTimestampMs)
        if (timestampChangeFromWindowStart > maximumWindowDurationMs) break

        window.push(frame)
    }

    if (direction === -1) window.reverse()

    return window
}

function findTransition(timeline: UsableTimeline, frameIndex: number, direction: -1 | 1) : AuditedTimelineTransition {
    const transitionIndex = direction === -1 
        ? frameIndex 
        : frameIndex - 1
    const transition = timeline.transitions[transitionIndex]
    if (!transition) throw new Error('Timeline is missing a transition between adjacent frames')

    return transition
}

function readWindowValues(frames: readonly AuditedFrame[], channel: PersistenceAuditedChannel, minimumWindowSamples: number) : number[] | null {
    if (frames.length < minimumWindowSamples) return null
    if (frames.some((frame) => !isChannelUsable(frame, channel))) return null

    return frames.map((frame) => readChannelValue(frame.frame, channel))
}

function calculateWindowSpread(values: readonly number[]) : number {
    return Math.max(scaledMedianAbsoluteDeviation(values), interquartileRange(values))
}

function isChannelUsable(frame: AuditedFrame, channel: PersistenceAuditedChannel) : boolean {
    return !frame.suspectChannels.includes(channel) && !frame.invalidChannels.includes(channel)
}

function confirmCandidateEvidence(candidates: readonly ChannelDiscontinuityEvidence[]) : ChannelDiscontinuityEvidence[] {
    const groups = new Set(candidates.map((item) => channelGroup(item.channel)))
    const hasCrossGroupEvidence = groups.size >= 2

    return candidates
        // tyre temperature changes slower -- we want to be able to record any bigger shift in this channel
        .filter((item) => isTyreTemperatureChannel(item.channel) || hasCrossGroupEvidence)
        .sort((left, right) => left.channel.localeCompare(right.channel))
}

function channelGroup(channel: PersistenceAuditedChannel) : ChannelGroup {
    if (channel === 'speedKmh') return 'motion'
    if (channel === 'engineRpm') return 'powertrain'

    return 'thermal'
}

function isTyreTemperatureChannel(channel: PersistenceAuditedChannel) : boolean {
    return channel.startsWith('tyreCoreTemperatureC.')
}

function collectDiscontinuousChannels(previous: AuditedFrame, current: AuditedFrame, persistentChannels: readonly PersistenceAuditedChannel[]) : LocallyAuditedSignalChannel[] {
    const channels = new Set<LocallyAuditedSignalChannel>(persistentChannels)

    addUnsafeFrameChannels(channels, previous)
    addUnsafeFrameChannels(channels, current)

    return [...channels].sort()
}

function addUnsafeFrameChannels(target: Set<LocallyAuditedSignalChannel>, frame: AuditedFrame) : void {
    for (const channel of [...frame.suspectChannels, ...frame.invalidChannels]) {
        if (isLocallyAuditedSignalChannel(channel)) target.add(channel)
    }
}

function isLocallyAuditedSignalChannel(channel: TelemetryChannel) : channel is LocallyAuditedSignalChannel {
    return LOCALLY_AUDITED_SIGNAL_CHANNEL_SET.has(channel)
}

function transitionKey(previousSourceIndex: number, currentSourceIndex: number) : string {
    return `${previousSourceIndex}:${currentSourceIndex}`
}
