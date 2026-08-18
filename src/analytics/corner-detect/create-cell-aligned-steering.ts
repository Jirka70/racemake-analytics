import type { AuditedFrame, AuditedTimelineTransition, TelemetryAuditResult } from '../frame-audit-types'
import { indexAuditedFrames } from '../lap-detect/index-audited-frames'
import type { LapDetectionResult, LinearLapGrid, PositionCalibration } from '../lap-detect/lap-detect-types'
import { canUseChannelTransition, canUsePositionTransition } from '../lap-detect/util/usable-channels'
import { linearInterpolate } from '../util/linear-interpolation'
import { calculateForwardPositionDelta } from '../util/normalized-position'

interface NearestFrames {
    readonly left: AuditedFrame
    readonly right: AuditedFrame
}

export interface CellAlignedLapSteering {
    readonly lapNumber: number
    readonly contribution: 'whole-track' | 'supported-cells'
    readonly steeringDegreesByCell: readonly (number | null)[]
    readonly cornerDetectionSupportedCellMask: readonly boolean[]
}

export interface CellAlignedSteering {
    readonly cellCenters: readonly number[]
    readonly laps: readonly CellAlignedLapSteering[]
}

export function createCellAlignedSteering(audit: TelemetryAuditResult, lapDetection: LapDetectionResult): CellAlignedSteering {
    const timeline = audit.usableTimeline
    const grid = lapDetection.linearGrid
    const calibration = lapDetection.positionCalibration
    if (!timeline || !grid || !calibration) return { cellCenters: [], laps: [] }

    const cellCenters = findGridCellCenters(grid)
    const auditedFrameBySourceIndex = indexAuditedFrames(timeline)
    const eligibilityByLapNumber = new Map(lapDetection.lapEligibilityResults.map(({ lapNumber, eligibility }) => [lapNumber, eligibility]))
    const laps = lapDetection.laps.flatMap((lap): CellAlignedLapSteering[] => {
        const eligibility = eligibilityByLapNumber.get(lap.lapNumber)
        if (!eligibility?.realRacing.eligible) return []

        const transitions = timeline.transitions.slice(lap.startCrossing.transitionIndex, lap.endCrossing.transitionIndex + 1)
        const steeringDegreesByCell = cellCenters.map((cellCenter) => {
            const nearestFrames = findLeftAndRightNearestFrames(transitions, cellCenter, calibration, auditedFrameBySourceIndex)
            return nearestFrames ? interpolateSteering(cellCenter, nearestFrames) : null
        })
        const cornerDetectionSupportedCellMask = steeringDegreesByCell.map((value) => value !== null)

        return [{
            lapNumber: lap.lapNumber,
            contribution: cornerDetectionSupportedCellMask.every(Boolean) ? 'whole-track' : 'supported-cells',
            steeringDegreesByCell,
            cornerDetectionSupportedCellMask,
        }]
    })

    return { cellCenters, laps }
}

export function findGridCellCenters(grid: LinearLapGrid): number[] {
    return Array.from({ length: grid.cellCount }, (_, cellIndex) => (cellIndex + 0.5) / grid.cellCount)
}

function findLeftAndRightNearestFrames(transitions: readonly AuditedTimelineTransition[], targetPosition: number, calibration: PositionCalibration, auditedFrameBySourceIndex: ReadonlyMap<number, AuditedFrame>): NearestFrames | null {
    let lowerIndex = 0
    let upperIndex = transitions.length
    while (lowerIndex < upperIndex) {
        const middleIndex = Math.floor((lowerIndex + upperIndex) / 2)
        const coveredToPosition = middleIndex === transitions.length - 1 
            ? 1 
            : transitions[middleIndex].current.normalizedTrackPosition
        if (coveredToPosition < targetPosition) lowerIndex = middleIndex + 1
        else upperIndex = middleIndex
    }

    const transition = transitions[lowerIndex]
    if (!transition) return null
    const coveredFromPosition = lowerIndex === 0 
        ? 0 
        : transition.previous.normalizedTrackPosition
    const coveredToPosition = lowerIndex === transitions.length - 1 
        ? 1 
        : transition.current.normalizedTrackPosition
    if (targetPosition < coveredFromPosition || targetPosition > coveredToPosition) return null
    if (!canUsePositionTransition(transition, auditedFrameBySourceIndex) 
        || !canUseChannelTransition(transition, 'steeringDegrees', auditedFrameBySourceIndex)) return null

    const positionDelta = calculateForwardPositionDelta(transition.previous.normalizedTrackPosition, transition.current.normalizedTrackPosition)
    const durationSeconds = transition.timestampDeltaMs / 1_000
    if (positionDelta <= 0 
        || positionDelta > calibration.maximumSupportedPositionSpan 
        || durationSeconds <= 0 
        || positionDelta / durationSeconds > calibration.globalPositionRateLimitPerSecond) return null

    const left = auditedFrameBySourceIndex.get(transition.previous.sourceIndex)
    const right = auditedFrameBySourceIndex.get(transition.current.sourceIndex)
    return left && right ? { left, right } : null
}

function interpolateSteering(targetPosition: number, nearestFrames: NearestFrames): number {
    const left = nearestFrames.left.frame
    const right = nearestFrames.right.frame
    const fromPosition = left.normalizedTrackPosition
    const toPosition = right.normalizedTrackPosition < fromPosition ? right.normalizedTrackPosition + 1 : right.normalizedTrackPosition
    const unwrappedTargetPosition = targetPosition < fromPosition ? targetPosition + 1 : targetPosition
    const ratio = (unwrappedTargetPosition - fromPosition) / (toPosition - fromPosition)
    return linearInterpolate(left.steeringDegrees, right.steeringDegrees, ratio)
}
