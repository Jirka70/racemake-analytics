import type { AuditedFrame, AuditedTimelineTransition, UsableTimeline } from '../frame-audit-types'
import { linearInterpolate } from '../util/linear-interpolation'
import { createLinearizedLapCoverage } from './create-lap-grid-coverage'
import type { DetectedLap, LapLinearizationIssue, LapLinearizationIssueCode, LinearizedLap, LinearLapGrid, PositionCalibration } from './lap-detect-types'
import { canUseChannelTransition, canUsePositionTransition } from './util/usable-channels'

interface LapInterpolationBracket {
    readonly transition: AuditedTimelineTransition
    readonly fromPosition: number
    readonly toPosition: number
    readonly targetPosition: number
}

interface InterpolatedLapPoint {
    readonly elapsedTimestampMs: number
    readonly steeringDegrees: number
}

interface LinearizedGridPointResult {
    readonly elapsedTimestampMs: number | null
    readonly steeringDegrees: number | null
    readonly issueCodes: readonly LapLinearizationIssueCode[]
}

export function linearizeLap(timeline: UsableTimeline, lap: DetectedLap, grid: LinearLapGrid, calibration: PositionCalibration, auditedFrameBySourceIndex: ReadonlyMap<number, AuditedFrame>): LinearizedLap {
    const elapsedTimestampsMs: Array<number | null> = []
    const steeringDegrees: Array<number | null> = []
    const issues: LapLinearizationIssue[] = []
    const findBracket = createLapInterpolationBracketFinder(timeline, lap)

    for (let gridIndex = 0; gridIndex < grid.positions.length; gridIndex++) {
        const normalizedTrackPosition = grid.positions[gridIndex]
        const result = linearizeGridPoint(findBracket(normalizedTrackPosition), lap, calibration, auditedFrameBySourceIndex)
        elapsedTimestampsMs.push(result.elapsedTimestampMs)
        steeringDegrees.push(result.steeringDegrees)
        for (const code of result.issueCodes) issues.push({ code, gridIndex, normalizedTrackPosition })
    }

    return { lapNumber: lap.lapNumber, elapsedTimestampsMs, steeringDegrees, coverage: createLinearizedLapCoverage(elapsedTimestampsMs, steeringDegrees, grid), issues }
}

function linearizeGridPoint(bracket: LapInterpolationBracket | null, lap: DetectedLap, calibration: PositionCalibration, auditedFrameBySourceIndex: ReadonlyMap<number, AuditedFrame>): LinearizedGridPointResult {
    if (bracket === null) return unsupportedGridPoint('NO_BRACKETING_TRANSITION')

    const positionIssue = findPositionInterpolationIssue(bracket, calibration, auditedFrameBySourceIndex)
    if (positionIssue !== null) return unsupportedGridPoint(positionIssue)

    const interpolated = linearizeLapPoint(bracket, lap)
    if (!canUseChannelTransition(bracket.transition, 'steeringDegrees', auditedFrameBySourceIndex)) {
        return { elapsedTimestampMs: interpolated.elapsedTimestampMs, steeringDegrees: null, issueCodes: ['INTERPOLATED', 'STEERING_TRANSITION_UNUSABLE'] }
    }

    return { ...interpolated, issueCodes: ['INTERPOLATED'] }
}

function linearizeLapPoint(bracket: LapInterpolationBracket, lap: DetectedLap): InterpolatedLapPoint {
    const fraction = (bracket.targetPosition - bracket.fromPosition) / (bracket.toPosition - bracket.fromPosition)
    const timestampMs = linearInterpolate(bracket.transition.previous.timestampMs, bracket.transition.current.timestampMs, fraction)
    const steeringDegrees = linearInterpolate(bracket.transition.previous.steeringDegrees, bracket.transition.current.steeringDegrees, fraction)

    return { elapsedTimestampMs: timestampMs - lap.startCrossing.timestampMs, steeringDegrees }
}

function findPositionInterpolationIssue(bracket: LapInterpolationBracket, calibration: PositionCalibration, auditedFrameBySourceIndex: ReadonlyMap<number, AuditedFrame>): LapLinearizationIssueCode | null {
    if (!canUsePositionTransition(bracket.transition, auditedFrameBySourceIndex)) return 'POSITION_TRANSITION_UNUSABLE'

    const positionSpan = bracket.toPosition - bracket.fromPosition
    if (!Number.isFinite(positionSpan) || positionSpan <= 0 || positionSpan > calibration.maximumSupportedPositionSpan) return 'POSITION_SPAN_EXCEEDED'

    const durationSeconds = bracket.transition.timestampDeltaMs / 1_000
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 'POSITION_TRANSITION_UNUSABLE'
    if (positionSpan / durationSeconds > calibration.globalPositionRateLimitPerSecond) return 'POSITION_RATE_EXCEEDED'

    return null
}

function createLapInterpolationBracketFinder(timeline: UsableTimeline, lap: DetectedLap): (targetPosition: number) => LapInterpolationBracket | null {
    let transitionIndex = lap.startCrossing.transitionIndex

    return (targetPosition) => {
        while (transitionIndex <= lap.endCrossing.transitionIndex) {
            const transition = timeline.transitions[transitionIndex]
            if (transition === undefined) {
                transitionIndex++
                continue
            }

            const isStartTransition = transitionIndex === lap.startCrossing.transitionIndex
            const isEndTransition = transitionIndex === lap.endCrossing.transitionIndex
            const coveredFromPosition = isStartTransition ? 0 : transition.previous.normalizedTrackPosition
            const coveredToPosition = isEndTransition ? 1 : transition.current.normalizedTrackPosition

            if (targetPosition < coveredFromPosition) return null
            if (targetPosition > coveredToPosition) {
                transitionIndex++
                continue
            }

            return {
                transition,
                fromPosition: transition.previous.normalizedTrackPosition,
                toPosition: transition.current.normalizedTrackPosition + (isStartTransition || isEndTransition ? 1 : 0),
                targetPosition: targetPosition + (isStartTransition ? 1 : 0),
            }
        }

        return null
    }
}

function unsupportedGridPoint(issueCode: LapLinearizationIssueCode): LinearizedGridPointResult {
    return { elapsedTimestampMs: null, steeringDegrees: null, issueCodes: [issueCode] }
}
