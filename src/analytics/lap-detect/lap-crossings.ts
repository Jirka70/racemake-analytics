import type { AuditedFrame, AuditedTimelineTransition, SamplingBaseline, UsableTimeline } from '../frame-audit-types'
import type {
    CrossingTimestampResolution,
    InternalLapCrossing,
    LapCounterEvidence,
    LapCrossing,
    LapCrossingConfidence,
    LapCrossingConfidenceWeights,
    LapDetectionConfig,
    LapLimitation,
    PositionCalibration,
} from './lap-detect-types'
import { median } from '../robust-statistics'
import { calculateForwardPositionDelta, looksLikeForwardPositionWrap, robustUpperLimit } from './position-support'
import { canUsePositionTransition } from './util/usable-channels'

interface CollectLocalPositionRatesArguments {
    readonly timeline: UsableTimeline
    readonly startTransitionIndex: number
    readonly direction: -1 | 1
    readonly anchorTimestampMs: number
    readonly maximumDurationMs: number
    readonly globalRateLimit: number
    readonly auditedFrameBySourceIndex: ReadonlyMap<number, AuditedFrame>
}

interface CreateLapCrossingArguments {
    readonly transition: AuditedTimelineTransition
    readonly sampling: SamplingBaseline
    readonly circularPositionDelta: number
    readonly positionRatePerSecond: number
    readonly localMedianPositionRate: number
    readonly localRateConsistency: number
    readonly localPositionRateLimit: number
    readonly maximumInterpolationSpan: number
    readonly localTransitionsBeforeCount: number
    readonly localTransitionsAfterCount: number
    readonly counterEvidence: LapCounterEvidence
    readonly confidenceWeights: LapCrossingConfidenceWeights
}

export function detectLapCrossings(timeline: UsableTimeline, sampling: SamplingBaseline, calibration: PositionCalibration, auditedFrameBySourceIndex: ReadonlyMap<number, AuditedFrame>, config: LapDetectionConfig): InternalLapCrossing[] {
    const crossings: InternalLapCrossing[] = []
    const localWindowDurationMs = sampling.medianDeltaMs * config.crossing.localWindowDurationMultiplier

    for (let transitionIndex = 0; transitionIndex < timeline.transitions.length; transitionIndex += 1) {
        const transition = timeline.transitions[transitionIndex]

        if (!looksLikeForwardPositionWrap(transition)) continue
        if (!canUsePositionTransition(transition, auditedFrameBySourceIndex)) continue

        const circularPositionDelta = calculateForwardPositionDelta(transition)
        const exactEndpointCrossing = transition.previous.normalizedTrackPosition === 1
            && transition.current.normalizedTrackPosition === 0
        const hasExactCrossingPosition = transition.previous.normalizedTrackPosition === 1
            || transition.current.normalizedTrackPosition === 0
        const interpolationIsSafe = exactEndpointCrossing
            || circularPositionDelta > 0 && circularPositionDelta <= calibration.maximumInterpolationSpan

        if (!interpolationIsSafe) continue

        const positionRatePerSecond = exactEndpointCrossing
            ? 0
            : circularPositionDelta / (transition.timestampDeltaMs / 1_000)
        if (positionRatePerSecond > calibration.globalPositionRateLimitPerSecond) continue

        const sharedLocalArguments = {
            timeline,
            maximumDurationMs: localWindowDurationMs,
            globalRateLimit: calibration.globalPositionRateLimitPerSecond,
            auditedFrameBySourceIndex,
        }

        const ratesBefore = collectLocalPositionRates({
            ...sharedLocalArguments,
            startTransitionIndex: transitionIndex - 1,
            direction: -1,
            anchorTimestampMs: transition.previous.timestampMs,
        })

        const ratesAfter = collectLocalPositionRates({
            ...sharedLocalArguments,
            startTransitionIndex: transitionIndex + 1,
            direction: 1,
            anchorTimestampMs: transition.current.timestampMs,
        })

        const hasEnoughRatesBefore = ratesBefore.length >= config.crossing.minimumLocalTransitions
        const hasEnoughRatesAfter = ratesAfter.length >= config.crossing.minimumLocalTransitions
        if (!hasEnoughRatesBefore || !hasEnoughRatesAfter) continue

        const localRates = [...ratesBefore, ...ratesAfter]
        const localMedianPositionRate = median(localRates)
        const localRateConsistency = hasExactCrossingPosition
            ? calculateRateConsistency(median(ratesBefore), median(ratesAfter))
            : calculateRateConsistency(positionRatePerSecond, localMedianPositionRate)
        const localPositionRateLimit = robustUpperLimit(
            localRates,
            config.calibration.positionRateMadMultiplier,
            config.calibration.positionRateIqrMultiplier,
        )

        if (positionRatePerSecond > localPositionRateLimit) continue

        const crossing = createLapCrossing({
            transition,
            sampling,
            circularPositionDelta,
            positionRatePerSecond,
            localMedianPositionRate,
            localRateConsistency,
            localPositionRateLimit,
            maximumInterpolationSpan: calibration.maximumInterpolationSpan,
            localTransitionsBeforeCount: ratesBefore.length,
            localTransitionsAfterCount: ratesAfter.length,
            counterEvidence: evaluateLapCounterEvidence(
                timeline,
                transitionIndex,
                config.crossing.counterUpdateToleranceFrames,
            ),
            confidenceWeights: config.crossing.confidenceWeights,
        })

        if (crossing.confidence.overall < config.crossing.minimumConfidence) continue

        crossings.push({
            transitionIndex,
            previousFrameIndex: transitionIndex,
            currentFrameIndex: transitionIndex + 1,
            crossing,
        })
    }

    return crossings
}

function collectLocalPositionRates(args: CollectLocalPositionRatesArguments): number[] {
    const rates: number[] = []

    for (
        let transitionIndex = args.startTransitionIndex;
        transitionIndex >= 0 && transitionIndex < args.timeline.transitions.length;
        transitionIndex += args.direction
    ) {
        const transition = args.timeline.transitions[transitionIndex]
        const transitionTimestampMs = args.direction === -1
            ? transition.current.timestampMs
            : transition.previous.timestampMs

        if (Math.abs(transitionTimestampMs - args.anchorTimestampMs) > args.maximumDurationMs) break
        if (!canUsePositionTransition(transition, args.auditedFrameBySourceIndex)) break

        const positionDelta = calculateForwardPositionDelta(transition)
        if (positionDelta < 0) break
        if (positionDelta === 0) continue

        const positionRate = positionDelta / (transition.timestampDeltaMs / 1_000)
        if (positionRate > args.globalRateLimit) break

        rates.push(positionRate)
    }

    return rates
}

function createLapCrossing(args: CreateLapCrossingArguments): LapCrossing {
    const previousPosition = args.transition.previous.normalizedTrackPosition
    const nextPosition = args.transition.current.normalizedTrackPosition
    const timestampResolution = resolveCrossingTimestamp(args.transition)
    const hasLapCounterIncreasedByOne = args.counterEvidence.agreement === 'exact'
    const limitations = createCrossingLimitations(args.counterEvidence)
    const confidence = calculateCrossingConfidence(args, timestampResolution)

    return {
        timestampMs: timestampResolution.timestampMs,
        timestampResolution,
        bracketDurationMs: args.transition.timestampDeltaMs,
        previousSourceIndex: args.transition.previous.sourceIndex,
        nextSourceIndex: args.transition.current.sourceIndex,
        hasLapCounterIncreasedByOne,
        counterEvidence: args.counterEvidence,
        confidence,
        evidence: {
            previousPosition,
            nextPosition,
            circularPositionDelta: args.circularPositionDelta,
            positionRatePerSecond: args.positionRatePerSecond,
            localMedianPositionRatePerSecond: args.localMedianPositionRate,
            localPositionRateLimitPerSecond: args.localPositionRateLimit,
            localTransitionsBefore: args.localTransitionsBeforeCount,
            localTransitionsAfter: args.localTransitionsAfterCount,
        },
        limitations,
    }
}

function resolveCrossingTimestamp(transition: AuditedTimelineTransition): CrossingTimestampResolution {
    const previousPosition = transition.previous.normalizedTrackPosition
    const nextPosition = transition.current.normalizedTrackPosition

    if (previousPosition === 1) {
        return {
            method: 'exact-previous-frame',
            timestampMs: transition.previous.timestampMs,
            sourceIndex: transition.previous.sourceIndex,
        }
    }

    if (nextPosition === 0) {
        return {
            method: 'exact-current-frame',
            timestampMs: transition.current.timestampMs,
            sourceIndex: transition.current.sourceIndex,
        }
    }

    const nextUnwrappedPosition = transition.current.normalizedTrackPosition + 1
    const interpolationRatio = (1 - previousPosition) / (nextUnwrappedPosition - previousPosition)
    const timestampMs = transition.previous.timestampMs + interpolationRatio * transition.timestampDeltaMs

    return {
        method: 'linear-interpolation',
        timestampMs,
        interpolationRatio,
        previousSourceIndex: transition.previous.sourceIndex,
        nextSourceIndex: transition.current.sourceIndex,
        bracketDurationMs: transition.timestampDeltaMs,
    }
}

function calculateCrossingConfidence(args: CreateLapCrossingArguments, timestampResolution: CrossingTimestampResolution): LapCrossingConfidence {
    const usesExactTimestamp = timestampResolution.method !== 'linear-interpolation'
    const temporalResolution = usesExactTimestamp
        ? 1
        : calculateTemporalResolution(args.transition.timestampDeltaMs, args.sampling)
    const positionResolution = usesExactTimestamp
        ? 1
        : calculatePositionResolution(args.circularPositionDelta, args.maximumInterpolationSpan)

    const boundary = clamp01(round(
        args.confidenceWeights.boundaryLocalRateConsistency * args.localRateConsistency
            + args.confidenceWeights.boundaryCounterAgreement * args.counterEvidence.score,
        3,
    ))
    const timestamp = usesExactTimestamp
        ? 1
        : clamp01(round(
            args.confidenceWeights.timestampTemporalResolution * temporalResolution
                + args.confidenceWeights.timestampPositionResolution * positionResolution
                + args.confidenceWeights.timestampLocalRateConsistency * args.localRateConsistency,
            3,
        ))

    return {
        overall: Math.min(boundary, timestamp),
        boundary,
        timestamp,
        localRateConsistency: args.localRateConsistency,
        temporalResolution,
        positionResolution,
        counterAgreement: args.counterEvidence.score,
    }
}

function calculateRateConsistency(positionRate: number, referencePositionRate: number): number {
    if (referencePositionRate <= 0) return 0

    const relativeDifference = Math.abs(positionRate - referencePositionRate) / referencePositionRate
    return clamp01(1 - relativeDifference)
}

function calculateTemporalResolution(bracketDurationMs: number, sampling: SamplingBaseline): number {
    if (bracketDurationMs <= sampling.medianDeltaMs) return 1
    if (sampling.maximumGapMs <= sampling.medianDeltaMs) return 0

    const excessDurationMs = bracketDurationMs - sampling.medianDeltaMs
    const supportedDurationRangeMs = sampling.maximumGapMs - sampling.medianDeltaMs
    return clamp01(1 - excessDurationMs / supportedDurationRangeMs)
}

function calculatePositionResolution(positionSpan: number, maximumInterpolationSpan: number): number {
    if (maximumInterpolationSpan <= 0) return 0
    return clamp01(1 - positionSpan / maximumInterpolationSpan)
}

function evaluateLapCounterEvidence(timeline: UsableTimeline, transitionIndex: number, toleranceFrames: number): LapCounterEvidence {
    const crossingTransition = timeline.transitions[transitionIndex]
    const counterBeforeCrossing = crossingTransition.previous.recordedLapNumber
    const directDelta = crossingTransition.current.recordedLapNumber - counterBeforeCrossing

    if (directDelta === 1) {
        return {
            agreement: 'exact',
            score: 1,
            updateOffsetFrames: 0,
            observedDelta: directDelta,
        }
    }

    if (directDelta !== 0) return createCounterMismatchEvidence(directDelta, 0)

    for (let offset = 1; offset <= toleranceFrames; offset += 1) {
        const laterTransition = timeline.transitions[transitionIndex + offset]

        if (laterTransition) {
            const laterDelta = laterTransition.current.recordedLapNumber - counterBeforeCrossing

            if (laterDelta === 1) {
                return {
                    agreement: 'nearby',
                    score: 0.8,
                    updateOffsetFrames: offset,
                    observedDelta: laterDelta,
                }
            }

            if (laterDelta !== 0) return createCounterMismatchEvidence(laterDelta, offset)
        }

        const earlierTransition = timeline.transitions[transitionIndex - offset]

        if (earlierTransition) {
            const earlierDelta = counterBeforeCrossing - earlierTransition.previous.recordedLapNumber

            if (earlierDelta === 1) {
                return {
                    agreement: 'nearby',
                    score: 0.8,
                    updateOffsetFrames: -offset,
                    observedDelta: earlierDelta,
                }
            }

            if (earlierDelta !== 0) return createCounterMismatchEvidence(earlierDelta, -offset)
        }
    }

    return {
        agreement: 'missing',
        score: 0.3,
        updateOffsetFrames: null,
        observedDelta: 0,
    }
}

function createCounterMismatchEvidence(observedDelta: number, updateOffsetFrames: number): LapCounterEvidence {
    return {
        agreement: 'mismatch',
        score: 0,
        updateOffsetFrames,
        observedDelta,
    }
}

function createCrossingLimitations(counterEvidence: LapCounterEvidence): LapLimitation[] {
    if (counterEvidence.agreement === 'exact' || counterEvidence.agreement === 'nearby') return []

    if (counterEvidence.agreement === 'missing') {
        return [{
            code: 'LAP_COUNTER_MISSING_CHANGE',
            severity: 'warning',
            impact: 'timing',
            message: 'Position crossed start/finish but the recorder lap counter did not increase in the tolerated frame window',
        }]
    }

    return [{
        code: 'LAP_COUNTER_MISMATCH',
        severity: 'warning',
        impact: 'timing',
        message: `Position crossed start/finish while the recorder lap counter changed by ${counterEvidence.observedDelta}`,
    }]
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value))
}

function round(value: number, decimalPlaces: number): number {
    const factor = 10 ** decimalPlaces
    return Math.round(value * factor) / factor
}
