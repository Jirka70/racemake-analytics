import { ChannelDiscontinuity, FrameAuditConfig, IsolatedChannelOutlier, ProcessingIssue, SamplingBaseline, TimelineTransition, UsableTimeline } from "../frame-audit-types";

export function createProcessingIssues(timelineTransitions: readonly TimelineTransition[], samplingBaseline: SamplingBaseline | null, isolatedOutliers: readonly IsolatedChannelOutlier[], usableTimeline: UsableTimeline | null, channelDiscontinuities: readonly ChannelDiscontinuity[], config: FrameAuditConfig) : ProcessingIssue[] {
    const issues: ProcessingIssue[] = []
    const invalidTimestampSourceIndexes = new Set(isolatedOutliers.filter((outlier) => outlier.channel === 'timestampMs' && outlier.usability === 'invalid').map((outlier) => outlier.frame.sourceIndex))
    const chronologicalTransitionCount = timelineTransitions.filter((transition) => transition.relation === 'chronological').length

    if (chronologicalTransitionCount < config.sampling.minimumSampleCount) {
        issues.push({
            id: 'insufficient-baseline:sampling',
            code: 'INSUFFICIENT_BASELINE',
            action: 'stop-analysis',
            severity: 'error',
            scope: 'dataset',
            reason: 'insufficient-chronological-transitions',
            message: `Sampling baseline requires at least ${config.sampling.minimumSampleCount} chronological transitions, but only ${chronologicalTransitionCount} are available. Timeline cleaning and dependent analysis cannot continue safely.`,
            observed: { chronologicalTransitionCount },
            thresholds: { minimumChronologicalTransitionCount: config.sampling.minimumSampleCount },
        })
    }

    for (const transition of timelineTransitions) {
        const issue = createStructuralIssue(transition, invalidTimestampSourceIndexes)
        if (issue !== null) issues.push(issue)
    }

    if (usableTimeline !== null && samplingBaseline !== null) {
        for (const transition of usableTimeline.transitions) {
            if (transition.timeContinuity !== 'gap') continue

            issues.push({
                id: `sampling-gap:${transition.previous.sourceIndex}:${transition.current.sourceIndex}`,
                code: 'SAMPLING_GAP',
                action: 'split-timeline',
                severity: 'warning',
                scope: 'transition',
                reason: 'maximum-sampling-gap-exceeded',
                message: `The ${transition.timestampDeltaMs} ms interval from frame ${transition.previous.sourceIndex} to frame ${transition.current.sourceIndex} exceeds the data-derived maximum supported gap. Both frames are retained, but interpolation and derivatives across this transition are blocked.`,
                sourceIndex: transition.previous.sourceIndex,
                nextSourceIndex: transition.current.sourceIndex,
                timestampMs: transition.previous.timestampMs,
                recordedLapNumber: transition.previous.recordedLapNumber,
                observed: { previousTimestampMs: transition.previous.timestampMs, currentTimestampMs: transition.current.timestampMs, timestampDeltaMs: transition.timestampDeltaMs },
                thresholds: { maximumGapMs: samplingBaseline.maximumGapMs },
            })
        }
    }

    for (const outlier of isolatedOutliers) issues.push(createLocalOutlierIssue(outlier, config))
    for (const finding of channelDiscontinuities) issues.push(createSequenceDiscontinuityIssue(finding, usableTimeline, config))

    return issues
}

function createStructuralIssue(transition: TimelineTransition, invalidTimestampSourceIndexes: ReadonlySet<number>) : ProcessingIssue | null {
    if (transition.relation === 'exact-duplicate') {
        return {
            id: `duplicate-sample:${transition.current.sourceIndex}`,
            code: 'DUPLICATE_SAMPLE',
            action: 'exclude-frame',
            severity: 'warning',
            scope: 'frame',
            reason: 'exact-adjacent-duplicate',
            message: `Frame ${transition.current.sourceIndex} exactly duplicates adjacent frame ${transition.previous.sourceIndex} at ${transition.current.timestampMs} ms and is excluded from the usable timeline. The original normalized frame remains preserved as audit evidence.`,
            sourceIndex: transition.current.sourceIndex,
            timestampMs: transition.current.timestampMs,
            recordedLapNumber: transition.current.recordedLapNumber,
            observed: { duplicateOfSourceIndex: transition.previous.sourceIndex, timestampMs: transition.current.timestampMs },
        }
    }

    if (transition.relation === 'same-timestamp-conflict') {
        return {
            id: `time-order-violation:same-timestamp:${transition.previous.sourceIndex}:${transition.current.sourceIndex}`,
            code: 'TIME_ORDER_VIOLATION',
            action: 'exclude-frame',
            severity: 'error',
            scope: 'frame',
            reason: 'same-timestamp-conflict',
            message: `Frames ${transition.previous.sourceIndex} and ${transition.current.sourceIndex} share timestamp ${transition.current.timestampMs} ms but contain different telemetry. The later frame is excluded because their ordering cannot support interpolation or derivatives.`,
            sourceIndex: transition.current.sourceIndex,
            timestampMs: transition.current.timestampMs,
            recordedLapNumber: transition.current.recordedLapNumber,
            observed: { previousSourceIndex: transition.previous.sourceIndex, timestampMs: transition.current.timestampMs, timestampDeltaMs: transition.timestampDeltaMs },
        }
    }

    if (transition.relation !== 'timestamp-regression') return null
    if (invalidTimestampSourceIndexes.has(transition.previous.sourceIndex) || invalidTimestampSourceIndexes.has(transition.current.sourceIndex)) return null

    return {
        id: `time-order-violation:timestamp-regression:${transition.previous.sourceIndex}:${transition.current.sourceIndex}`,
        code: 'TIME_ORDER_VIOLATION',
        action: 'split-timeline',
        severity: 'error',
        scope: 'transition',
        reason: 'timestamp-regression',
        message: `Timestamp decreases by ${Math.abs(transition.timestampDeltaMs)} ms from frame ${transition.previous.sourceIndex} to frame ${transition.current.sourceIndex}. Both sides are preserved, but they belong to separate time-continuous segments.`,
        sourceIndex: transition.previous.sourceIndex,
        nextSourceIndex: transition.current.sourceIndex,
        timestampMs: transition.previous.timestampMs,
        recordedLapNumber: transition.previous.recordedLapNumber,
        observed: { previousTimestampMs: transition.previous.timestampMs, currentTimestampMs: transition.current.timestampMs, timestampDeltaMs: transition.timestampDeltaMs },
        thresholds: { minimumTimestampDeltaMs: 0 },
    }
}

function createLocalOutlierIssue(outlier: IsolatedChannelOutlier, config: FrameAuditConfig) : ProcessingIssue {
    const isTimestamp = outlier.channel === 'timestampMs'
    const isDriverInput = outlier.channel === 'throttleRatio' || outlier.channel === 'brakeRatio' || outlier.channel === 'steeringDegrees'
    const action = isTimestamp ? 'exclude-frame' : outlier.usability === 'invalid' ? 'exclude-channel-value' : 'retain'
    const observed: Record<string, number | string | boolean> = { previousValue: outlier.previousValue, observedValue: outlier.observedValue, nextValue: outlier.nextValue, usability: outlier.usability }
    const thresholds: Record<string, number> = isTimestamp ? {} : { minimumReturnRateRatio: config.isolatedOutlier.minimumReturnRateRatio }

    if (outlier.predictedValue !== undefined) observed.predictedValue = outlier.predictedValue
    if (outlier.residual !== undefined) observed.residual = outlier.residual
    if (outlier.threshold !== undefined) thresholds[isTimestamp ? 'maximumBridgeGapMs' : 'residualThreshold'] = outlier.threshold

    return {
        id: `local-outlier:${outlier.frame.sourceIndex}:${outlier.channel}`,
        code: 'LOCAL_OUTLIER',
        action,
        severity: outlier.usability === 'invalid' ? 'error' : 'warning',
        scope: isTimestamp ? 'frame' : 'channel',
        reason: isTimestamp ? 'isolated-timestamp-outlier' : isDriverInput ? 'isolated-driver-input-outlier' : 'isolated-sensor-outlier',
        message: createLocalOutlierMessage(outlier, action),
        sourceIndex: outlier.frame.sourceIndex,
        timestampMs: outlier.frame.timestampMs,
        recordedLapNumber: outlier.frame.recordedLapNumber,
        channels: [outlier.channel],
        observed,
        thresholds,
    }
}

function createLocalOutlierMessage(outlier: IsolatedChannelOutlier, action: ProcessingIssue['action']) : string {
    if (outlier.channel === 'timestampMs') return `Frame ${outlier.frame.sourceIndex} has an isolated timestamp ordering error and is excluded from the usable timeline because its neighboring frames can be bridged safely.`

    const decision = action === 'exclude-channel-value'
        ? `The ${outlier.channel} value is invalid for analysis, while the remaining channels in the frame are retained.`
        : `The ${outlier.channel} value remains available but is marked suspect because rapid driver input can be legitimate.`

    return `Frame ${outlier.frame.sourceIndex} contains an isolated ${outlier.channel} deviation: observed ${outlier.observedValue}, neighboring values ${outlier.previousValue} and ${outlier.nextValue}${outlier.predictedValue === undefined ? '' : `, predicted ${outlier.predictedValue}`}${outlier.residual === undefined ? '' : `, residual ${outlier.residual}`}${outlier.threshold === undefined ? '' : `, threshold ${outlier.threshold}`}. ${decision}`
}

function createSequenceDiscontinuityIssue(finding: ChannelDiscontinuity, usableTimeline: UsableTimeline | null, config: FrameAuditConfig) : ProcessingIssue {
    const transition = usableTimeline?.transitions.find((item) => item.previous.sourceIndex === finding.previousSourceIndex && item.current.sourceIndex === finding.currentSourceIndex)
    const observed: Record<string, number | string | boolean> = { channelCount: finding.channels.length }
    const thresholds: Record<string, number> = { minimumShiftToSpreadRatio: config.channelContinuity.minimumShiftToSpreadRatio, windowDurationMultiplier: config.channelContinuity.windowDurationMultiplier, minimumWindowSamples: config.channelContinuity.minimumWindowSamples }

    if (transition !== undefined) {
        observed.previousTimestampMs = transition.previous.timestampMs
        observed.currentTimestampMs = transition.current.timestampMs
        observed.timestampDeltaMs = transition.timestampDeltaMs
    }

    for (const evidence of finding.evidence) {
        observed[`${evidence.channel}.previousValue`] = evidence.previousValue
        observed[`${evidence.channel}.currentValue`] = evidence.currentValue
        observed[`${evidence.channel}.boundaryDelta`] = evidence.boundaryDelta
        observed[`${evidence.channel}.absoluteRatePerSecond`] = evidence.absoluteRatePerSecond
        observed[`${evidence.channel}.leftMedian`] = evidence.leftMedian
        observed[`${evidence.channel}.rightMedian`] = evidence.rightMedian
        observed[`${evidence.channel}.persistentShift`] = evidence.persistentShift
        observed[`${evidence.channel}.leftSpread`] = evidence.leftSpread
        observed[`${evidence.channel}.rightSpread`] = evidence.rightSpread
        thresholds[`${evidence.channel}.rateThresholdPerSecond`] = evidence.rateThresholdPerSecond
    }

    return {
        id: `sequence-discontinuity:${finding.previousSourceIndex}:${finding.currentSourceIndex}`,
        code: 'SEQUENCE_DISCONTINUITY',
        action: 'block-channel-transition',
        severity: 'error',
        scope: 'transition',
        reason: 'persistent-channel-level-shift',
        message: `Frames ${finding.previousSourceIndex} and ${finding.currentSourceIndex} form a persistent level-shift boundary in ${finding.channels.join(', ')}. Both stable sides are retained, but interpolation and derivatives for these channels are blocked only across this transition.`,
        sourceIndex: finding.previousSourceIndex,
        nextSourceIndex: finding.currentSourceIndex,
        timestampMs: transition?.previous.timestampMs,
        recordedLapNumber: transition?.previous.recordedLapNumber,
        channels: finding.channels,
        observed,
        thresholds,
    }
}
