import type { AuditedFrame, AuditedTimelineTransition, UsableTimeline } from '../frame-audit-types'
import { interquartileRange, median, quantile, scaledMedianAbsoluteDeviation } from '../robust-statistics'
import type { LapDetectionConfig, PositionCalibration } from './lap-detect-types'
import { canUsePositionTransition, isChannelUsable, POSITION_CHANNEL } from './util/usable-channels'

export { POSITION_CHANNEL }
export const STEERING_CHANNEL = 'steeringDegrees'
export const SPEED_CHANNEL = 'speedKmh'

interface PositionMovementSample {
    readonly positionStep: number
    readonly positionRatePerSecond: number
}

export function derivePositionCalibration(timeline: UsableTimeline, auditedFrameBySourceIndex: ReadonlyMap<number, AuditedFrame>, config: LapDetectionConfig): PositionCalibration | null {
    const movementSamples: PositionMovementSample[] = []

    for (const transition of timeline.transitions) {
        if (!canUsePositionTransition(transition, auditedFrameBySourceIndex)) continue

        const positionStep = calculateForwardPositionDelta(transition)
        if (positionStep <= 0) continue

        const durationSeconds = transition.timestampDeltaMs / 1_000
        movementSamples.push({
            positionStep,
            positionRatePerSecond: positionStep / durationSeconds,
        })
    }

    if (movementSamples.length < config.calibration.minimumSamples) return null

    const preliminaryRateLimit = robustUpperLimit(
        movementSamples.map(({ positionRatePerSecond }) => positionRatePerSecond),
        config.calibration.positionRateMadMultiplier,
        config.calibration.positionRateIqrMultiplier,
    )

    const filteredSamples = movementSamples.filter(
        ({ positionRatePerSecond }) => positionRatePerSecond <= preliminaryRateLimit,
    )

    if (filteredSamples.length < config.calibration.minimumSamples) return null

    const calibrationSamples = filteredSamples

    const positionSteps = calibrationSamples.map(({ positionStep }) => positionStep)
    const positionRates = calibrationSamples.map(({ positionRatePerSecond }) => positionRatePerSecond)
    const medianPositionStep = median(positionSteps)
    const dataDerivedInterpolationSpan = medianPositionStep * config.interpolation.positionGapMedianMultiplier

    return {
        medianPositionStep,
        maximumInterpolationSpan: Math.min(
            dataDerivedInterpolationSpan,
            config.interpolation.maximumAbsolutePositionSpan,
        ),
        medianPositionRatePerSecond: median(positionRates),
        globalPositionRateLimitPerSecond: robustUpperLimit(
            positionRates,
            config.calibration.positionRateMadMultiplier,
            config.calibration.positionRateIqrMultiplier,
        ),
    }
}

export function isPositionFrameUsable(auditedFrame: AuditedFrame): boolean {
    return isChannelUsable(auditedFrame, POSITION_CHANNEL)
}

export function calculateForwardPositionDelta(transition: AuditedTimelineTransition): number {
    const rawDelta = transition.current.normalizedTrackPosition - transition.previous.normalizedTrackPosition
    return rawDelta < -0.5 ? rawDelta + 1 : rawDelta
}

export function looksLikeForwardPositionWrap(transition: AuditedTimelineTransition): boolean {
    const rawDelta = transition.current.normalizedTrackPosition - transition.previous.normalizedTrackPosition
    return rawDelta < -0.5
}

export function robustUpperLimit(values: readonly number[], madMultiplier: number, iqrMultiplier: number): number {
    const center = median(values)
    const scaledMad = scaledMedianAbsoluteDeviation(values)

    if (scaledMad > 0) return center + madMultiplier * scaledMad

    const iqr = interquartileRange(values)
    if (iqr > 0) return quantile(values, 0.75) + iqrMultiplier * iqr

    return quantile(values, 0.99)
}
