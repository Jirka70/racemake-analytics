import type { AuditedFrame, AuditedTimelineTransition, SamplingBaseline, UsableTimeline } from '../frame-audit-types'
import { median } from '../robust-statistics'
import { linearInterpolate } from '../util/linear-interpolation'
import { calculateForwardPositionDelta } from '../util/normalized-position'
import { findLapCrossingCandidates } from './lap-crossing-candidates'
import type { LapCrossing, LapCrossingCandidate, LapCrossingConfidence, LapCrossingLimitation, LapCrossingPositionInterpolation, LapDetectionConfig, PositionCalibration } from './lap-detect-types'
import { canUsePositionTransition } from './util/usable-channels'

const LAP_END_POSITION = 1

export function findLapCrossings(timeline: UsableTimeline, sampling: SamplingBaseline, calibration: PositionCalibration, auditedFrameBySourceIndex: ReadonlyMap<number, AuditedFrame>, config: LapDetectionConfig): LapCrossing[] {
    const candidates = findLapCrossingCandidates(timeline, auditedFrameBySourceIndex, config.crossing.lapCounterSearchRadiusFrames)
    return candidates.map((candidate) => createLapCrossing(candidate, timeline, sampling, calibration, auditedFrameBySourceIndex, config))
}

function createLapCrossing(candidate: LapCrossingCandidate, timeline: UsableTimeline, sampling: SamplingBaseline, calibration: PositionCalibration, auditedFrameBySourceIndex: ReadonlyMap<number, AuditedFrame>, config: LapDetectionConfig): LapCrossing {
    const positionInterpolation = createPositionInterpolation(candidate.transition, calibration)
    const previousFrame =  candidate.transition.previous
    const timestampMs = linearInterpolate(previousFrame.timestampMs, candidate.transition.current.timestampMs, positionInterpolation.crossingFraction)
    const localRatesBefore = collectLocalPositionRates(timeline, candidate.transitionIndex, -1, sampling, auditedFrameBySourceIndex, config)
    const localRatesAfter = collectLocalPositionRates(timeline, candidate.transitionIndex, 1, sampling, auditedFrameBySourceIndex, config)
    const confidence = calculateLapCrossingConfidence(candidate, positionInterpolation, localRatesBefore, localRatesAfter, sampling, config)
    const limitations = createLapCrossingLimitations(candidate, positionInterpolation, localRatesBefore, localRatesAfter, calibration)

    return {
        transitionIndex: candidate.transitionIndex,
        transition: candidate.transition,
        timestampMs,
        lapCounterEvidence: candidate.lapCounterEvidence,
        positionInterpolation,
        confidence,
        limitations,
    }
}

function createLapCrossingLimitations(candidate: LapCrossingCandidate, interpolation: LapCrossingPositionInterpolation, localRatesBefore: readonly number[], localRatesAfter: readonly number[], calibration: PositionCalibration): LapCrossingLimitation[] {
    const limitations: LapCrossingLimitation[] = []

    if (interpolation.positionSpan > interpolation.maximumSupportedPositionSpan) {
        limitations.push({
            code: 'POSITION_INTERPOLATION_SPAN_EXCEEDED',
            severity: 'warning',
            message: 'Lap-crossing timestamp was interpolated across a position span larger than the dataset-supported limit',
            fromPosition: interpolation.fromPosition,
            toPosition: interpolation.toPosition,
            observedPositionSpan: interpolation.positionSpan,
            maximumSupportedPositionSpan: interpolation.maximumSupportedPositionSpan,
        })
    }

    if (interpolation.positionSpan > interpolation.maximumPlausiblePositionSpan) {
        limitations.push({
            code: 'POSITION_RATE_LIMIT_EXCEEDED',
            severity: 'warning',
            message: 'Position movement across the lap boundary exceeded the dataset-wide position-rate limit',
            fromPosition: interpolation.fromPosition,
            toPosition: interpolation.toPosition,
            transitionDurationMs: candidate.transition.timestampDeltaMs,
            observedPositionRatePerSecond: interpolation.positionSpan / (candidate.transition.timestampDeltaMs / 1_000),
            globalPositionRateLimitPerSecond: calibration.globalPositionRateLimitPerSecond,
        })
    }

    if (candidate.lapCounterEvidence.status === 'missing') {
        limitations.push({
            code: 'LAP_COUNTER_CONFIRMATION_MISSING',
            severity: 'warning',
            message: 'No lap-counter increment confirmed the position crossing in the inspected continuous window',
        })
    }

    if (candidate.lapCounterEvidence.status === 'mismatch') {
        limitations.push({
            code: 'LAP_COUNTER_MISMATCH',
            severity: 'warning',
            message: 'The recorded lap counter changed inconsistently with a single lap-boundary crossing',
        })
    }

    if (localRatesBefore.length === 0 || localRatesAfter.length === 0) {
        limitations.push({
            code: 'LOCAL_POSITION_RATE_CONTEXT_UNAVAILABLE',
            severity: 'warning',
            message: 'Usable position-rate context was unavailable on at least one side of the lap crossing',
            usablePositionRateSamplesBefore: localRatesBefore.length,
            usablePositionRateSamplesAfter: localRatesAfter.length,
        })
    }

    return limitations
}

function calculateLapCrossingConfidence(candidate: LapCrossingCandidate,
    interpolation: LapCrossingPositionInterpolation, localRatesBefore: readonly number[], localRatesAfter: readonly number[], sampling: SamplingBaseline, config: LapDetectionConfig): LapCrossingConfidence {
    const confidenceConfig = config.crossing.confidence
    const hasExactCrossingPosition = interpolation.fromPosition === LAP_END_POSITION || interpolation.toPosition === 0
    const components = {
        interpolationSpanSupport: hasExactCrossingPosition
            ? 1
            : calculateExponentialConfidence(interpolation.positionSpan, interpolation.maximumSupportedPositionSpan, confidenceConfig.interpolationSpanConfidenceAtSupportedLimit),
        temporalResolution: hasExactCrossingPosition
            ? 1
            : calculateExponentialConfidence(candidate.transition.timestampDeltaMs, sampling.medianDeltaMs, confidenceConfig.temporalConfidenceAtMedianInterval),
        localRateConsistency: calculateLocalRateConsistency(candidate.transition, interpolation, localRatesBefore, localRatesAfter, confidenceConfig.localRateReferenceRelativeDifference, confidenceConfig.localRateConfidenceAtReferenceDifference),
        localRateSupport: calculateLocalRateSupport(localRatesBefore, localRatesAfter, confidenceConfig.localRateFullSupportSamplesPerSide),
        globalRatePlausibility: calculateExponentialConfidence(interpolation.positionSpan, interpolation.maximumPlausiblePositionSpan, confidenceConfig.globalRateConfidenceAtPlausibleLimit),
        lapCounterAgreement: confidenceConfig.lapCounterAgreementScores[candidate.lapCounterEvidence.status],
    }
    const boundaryWeights = confidenceConfig.aggregationWeights.boundary
    const timestampWeights = confidenceConfig.aggregationWeights.timestamp

    // Local consistency influences an aggregate only in proportion to the amount of evidence available on both sides.
    const boundaryConfidence = calculateWeightedConfidence([
        { score: components.localRateConsistency, weight: boundaryWeights.localRateConsistency * components.localRateSupport },
        { score: components.localRateSupport, weight: boundaryWeights.localRateSupport },
        { score: components.globalRatePlausibility, weight: boundaryWeights.globalRatePlausibility },
        { score: components.lapCounterAgreement, weight: boundaryWeights.lapCounterAgreement },
    ])
    const timestampConfidence = calculateWeightedConfidence([
        { score: components.interpolationSpanSupport, weight: timestampWeights.interpolationSpanSupport },
        { score: components.temporalResolution, weight: timestampWeights.temporalResolution },
        { score: components.localRateConsistency, weight: timestampWeights.localRateConsistency * components.localRateSupport },
    ])
    const overallConfidence = Math.sqrt(boundaryConfidence * timestampConfidence)

    return { components, boundaryConfidence, timestampConfidence, overallConfidence }
}

interface WeightedConfidenceComponent {
    readonly score: number
    readonly weight: number
}

function calculateWeightedConfidence(components: readonly WeightedConfidenceComponent[]): number {
    const totalWeight = components.reduce((sum, component) => sum + component.weight, 0)
    if (totalWeight <= 0) return 0

    return components.reduce((sum, component) => sum + component.score * component.weight, 0) / totalWeight
}

function collectLocalPositionRates(timeline: UsableTimeline, candidateTransitionIndex: number, direction: -1 | 1, sampling: SamplingBaseline, auditedFrameBySourceIndex: ReadonlyMap<number, AuditedFrame>, config: LapDetectionConfig): number[] {
    const candidateTransition = timeline.transitions[candidateTransitionIndex]
    if (!candidateTransition) return []

    const rates: number[] = []
    const anchorTimestampMs = direction === -1 
        ? candidateTransition.previous.timestampMs 
        : candidateTransition.current.timestampMs
    const maximumWindowDurationMs = sampling.medianDeltaMs * config.crossing.confidence.localRateWindowDurationMedianMultiplier

    for (let distance = 1; ; distance++) {
        const transition = timeline.transitions[candidateTransitionIndex + direction * distance]
        if (!transition || !canUsePositionTransition(transition, auditedFrameBySourceIndex)) break

        const distanceFromCrossingMs = direction === -1
            ? anchorTimestampMs - transition.current.timestampMs
            : transition.previous.timestampMs - anchorTimestampMs
        if (distanceFromCrossingMs > maximumWindowDurationMs) break

        const positionDelta = calculateForwardPositionDelta(transition.previous.normalizedTrackPosition, transition.current.normalizedTrackPosition)
        if (positionDelta <= 0 || transition.timestampDeltaMs <= 0) continue
        rates.push(positionDelta / (transition.timestampDeltaMs / 1_000))
    }

    return rates
}

function calculateLocalRateConsistency(transition: AuditedTimelineTransition, interpolation: LapCrossingPositionInterpolation, ratesBefore: readonly number[], ratesAfter: readonly number[], referenceRelativeDifference: number, confidenceAtReferenceDifference: number): number {
    if (ratesBefore.length === 0 || ratesAfter.length === 0) return 0

    const hasExactCrossingPosition = interpolation.fromPosition === LAP_END_POSITION || interpolation.toPosition === 0
    const observedRate = hasExactCrossingPosition ? median(ratesBefore) : interpolation.positionSpan / (transition.timestampDeltaMs / 1_000)
    const referenceRate = hasExactCrossingPosition ? median(ratesAfter) : median([...ratesBefore, ...ratesAfter])
    const relativeDifference = Math.abs(observedRate - referenceRate) / Math.max(observedRate, referenceRate)

    return calculateExponentialConfidence(relativeDifference, referenceRelativeDifference, confidenceAtReferenceDifference)
}

function calculateLocalRateSupport(ratesBefore: readonly number[], ratesAfter: readonly number[], fullSupportSamplesPerSide: number): number {
    if (fullSupportSamplesPerSide <= 0) return 1
    const supportBefore = Math.min(1, ratesBefore.length / fullSupportSamplesPerSide)
    const supportAfter = Math.min(1, ratesAfter.length / fullSupportSamplesPerSide)
    return Math.min(supportBefore, supportAfter)
}

function calculateExponentialConfidence(observedValue: number, referenceValue: number, confidenceAtReference: number): number {
    if (observedValue <= 0) return 1
    if (referenceValue <= 0) return 0

    // Each additional reference-sized span applies the configured confidence decay once again.
    return confidenceAtReference ** (observedValue / referenceValue)
}

function createPositionInterpolation(transition: AuditedTimelineTransition, calibration: PositionCalibration): LapCrossingPositionInterpolation {
    const fromPosition = transition.previous.normalizedTrackPosition
    const toPosition = transition.current.normalizedTrackPosition
    const unwrappedToPosition = toPosition + LAP_END_POSITION
    const positionSpan = unwrappedToPosition - fromPosition
    // is interval small enough for safe interpolation?
    const maximumSupportedPositionSpan = calibration.maximumSupportedPositionSpan

    // Convert the global position-rate limit into a span limit for this transition's actual duration.
    const maximumPlausiblePositionSpan = calibration.globalPositionRateLimitPerSecond * transition.timestampDeltaMs / 1_000
    const crossingFraction = calculateCrossingFraction(fromPosition, toPosition, positionSpan)

    return { fromPosition, toPosition, unwrappedToPosition, positionSpan, maximumSupportedPositionSpan, maximumPlausiblePositionSpan, crossingFraction }
}

function calculateCrossingFraction(fromPosition: number, toPosition: number, positionSpan: number): number {
    if (fromPosition === LAP_END_POSITION) return 0
    if (toPosition === 0) return 1
    return (LAP_END_POSITION - fromPosition) / positionSpan
}
