import type { AuditedFrame, AuditedTimelineTransition, LocallyAuditedSignalChannel, UsableTimeline } from '../frame-audit-types'
import { indexAuditedFrames } from '../lap-detect/index-audited-frames'
import type { DetectedLap, LinearizedLap, LinearLapGrid, LapDetectionResult, PositionCalibration } from '../lap-detect/lap-detect-types'
import { isChannelUsable } from '../lap-detect/util/usable-channels'
import { linearInterpolate } from '../util/linear-interpolation'
import { calculateForwardPositionDelta } from '../util/normalized-position'
import type { CellAlignedRacingLap, CellAlignedRacingLapCell, CellAlignedRacingTelemetry, CellBoundary, CellCenterTelemetry, CellTelemetryQuality } from './cell-aligned-racing-telemetry-types'

export interface NearestFrames {
    readonly transition: AuditedTimelineTransition
    readonly left: AuditedFrame
    readonly right: AuditedFrame
}

export function createCellAlignedRacingTelemetry(timeline: UsableTimeline | null, lapDetection: LapDetectionResult, racingLaps: readonly DetectedLap[]): CellAlignedRacingTelemetry {
    const grid = lapDetection.linearGrid
    if (!grid) return { laps: [] }

    const linearizedLapByNumber = new Map(lapDetection.linearizedLaps.map((lap) => [lap.lapNumber, lap]))
    const auditedFrameBySourceIndex = timeline ? indexAuditedFrames(timeline) : new Map<number, AuditedFrame>()
    const laps = racingLaps.map((lap) => createCellAlignedRacingLap(
        lap,
        linearizedLapByNumber.get(lap.lapNumber),
        grid,
        lapDetection.positionCalibration,
        timeline?.transitions.slice(lap.startCrossing.transitionIndex, lap.endCrossing.transitionIndex + 1) ?? [],
        auditedFrameBySourceIndex,
    ))
    return { laps }
}

function createCellAlignedRacingLap(lap: DetectedLap, linearizedLap: LinearizedLap | undefined, grid: LinearLapGrid, calibration: PositionCalibration | null, transitions: readonly AuditedTimelineTransition[], auditedFrameBySourceIndex: ReadonlyMap<number, AuditedFrame>): CellAlignedRacingLap {
    const cells = Array.from({ length: grid.cellCount }, (_, cellIndex) => createCell(cellIndex, lap, linearizedLap, grid, calibration, transitions, auditedFrameBySourceIndex))
    return { lapNumber: lap.lapNumber, lapTimeMs: lap.lapTimeMs, cells }
}

function createCell(cellIndex: number, lap: DetectedLap, linearizedLap: LinearizedLap | undefined, grid: LinearLapGrid, calibration: PositionCalibration | null, transitions: readonly AuditedTimelineTransition[], auditedFrameBySourceIndex: ReadonlyMap<number, AuditedFrame>): CellAlignedRacingLapCell {
    const fromPosition = grid.positions[cellIndex]
    const toPosition = grid.positions[cellIndex + 1]
    const centerPosition = (fromPosition + toPosition) / 2
    const nearestFrames = findLeftAndRightNearestFrames(transitions, centerPosition, auditedFrameBySourceIndex)
    const cellTransitions = findTransitionsOverlappingGridCell(transitions, fromPosition, toPosition)
    return {
        cellIndex,
        from: createBoundary(fromPosition, linearizedLap?.elapsedTimestampsMs[cellIndex]),
        center: interpolateCellCenter(centerPosition, lap, nearestFrames, calibration),
        to: createBoundary(toPosition, linearizedLap?.elapsedTimestampsMs[cellIndex + 1]),
        quality: createCellTelemetryQuality(cellTransitions),
    }
}

function createCellTelemetryQuality(transitions: readonly AuditedTimelineTransition[]): CellTelemetryQuality {
    const discontinuousChannels = new Set(transitions.flatMap(({ discontinuousChannels }) => discontinuousChannels))
    return {
        timelineContinuous: transitions.length > 0 && transitions.every(({ timeContinuity }) => timeContinuity === 'continuous'),
        discontinuousChannels: [...discontinuousChannels].sort(),
    }
}

function createBoundary(normalizedTrackPosition: number, lapElapsedMs: number | null | undefined): CellBoundary {
    return { normalizedTrackPosition, lapElapsedMs: lapElapsedMs ?? null }
}

function createEmptyCenter(normalizedTrackPosition: number): CellCenterTelemetry {
    return {
        normalizedTrackPosition,
        lapElapsedMs: null,
        speedKmh: null,
        brakeRatio: null,
        throttleRatio: null,
        steeringDegrees: null,
        gear: null,
        engineRpm: null,
        tyreCoreTemperatureC: null,
    }
}

function interpolateCellCenter(normalizedTrackPosition: number, lap: DetectedLap, nearestFrames: NearestFrames | null, calibration: PositionCalibration | null): CellCenterTelemetry {
    if (!nearestFrames || !calibration) return createEmptyCenter(normalizedTrackPosition)

    const fraction = calculateInterpolationFraction(normalizedTrackPosition, nearestFrames, calibration)
    if (fraction === null) return createEmptyCenter(normalizedTrackPosition)

    const left = nearestFrames.left.frame
    const right = nearestFrames.right.frame
    const timestampMs = linearInterpolate(left.timestampMs, right.timestampMs, fraction)
    return {
        normalizedTrackPosition,
        lapElapsedMs: timestampMs - lap.startCrossing.timestampMs,
        speedKmh: interpolateContinuousChannel(nearestFrames, 'speedKmh', left.speedKmh, right.speedKmh, fraction),
        brakeRatio: interpolateContinuousChannel(nearestFrames, 'brakeRatio', left.brakeRatio, right.brakeRatio, fraction),
        throttleRatio: interpolateContinuousChannel(nearestFrames, 'throttleRatio', left.throttleRatio, right.throttleRatio, fraction),
        steeringDegrees: interpolateContinuousChannel(nearestFrames, 'steeringDegrees', left.steeringDegrees, right.steeringDegrees, fraction),
        gear: findNearestGear(nearestFrames, fraction),
        engineRpm: interpolateContinuousChannel(nearestFrames, 'engineRpm', left.engineRpm, right.engineRpm, fraction),
        tyreCoreTemperatureC: interpolateTyreTemperatures(nearestFrames, fraction),
    }
}

function calculateInterpolationFraction(targetPosition: number, nearestFrames: NearestFrames, calibration: PositionCalibration): number | null {
    if (!canInterpolateChannel(nearestFrames, 'normalizedTrackPosition')) return null

    const leftPosition = nearestFrames.left.frame.normalizedTrackPosition
    const positionSpan = calculateForwardPositionDelta(leftPosition, nearestFrames.right.frame.normalizedTrackPosition)
    if (positionSpan <= 0 || positionSpan > calibration.maximumSupportedPositionSpan) return null

    const durationSeconds = nearestFrames.transition.timestampDeltaMs / 1_000
    if (durationSeconds <= 0 || positionSpan / durationSeconds > calibration.globalPositionRateLimitPerSecond) return null

    const targetPositionDelta = calculateForwardPositionDelta(leftPosition, targetPosition)
    if (targetPositionDelta < 0 || targetPositionDelta > positionSpan) return null
    return targetPositionDelta / positionSpan
}

function interpolateContinuousChannel(nearestFrames: NearestFrames, channel: LocallyAuditedSignalChannel, leftValue: number, rightValue: number, fraction: number): number | null {
    if (!canInterpolateChannel(nearestFrames, channel)) return null
    return linearInterpolate(leftValue, rightValue, fraction)
}

function canInterpolateChannel(nearestFrames: NearestFrames, channel: LocallyAuditedSignalChannel): boolean {
    return nearestFrames.transition.timeContinuity === 'continuous'
        && !nearestFrames.transition.discontinuousChannels.includes(channel)
        && isChannelUsable(nearestFrames.left, channel)
        && isChannelUsable(nearestFrames.right, channel)
}

function findNearestGear(nearestFrames: NearestFrames, fraction: number): number | null {
    const nearestFrame = fraction < 0.5 ? nearestFrames.left : nearestFrames.right
    if (nearestFrame.invalidChannels.includes('gear') || nearestFrame.suspectChannels.includes('gear')) return null
    return nearestFrame.frame.gear
}

function interpolateTyreTemperatures(nearestFrames: NearestFrames, fraction: number): CellCenterTelemetry['tyreCoreTemperatureC'] {
    const left = nearestFrames.left.frame.tyreCoreTemperatureC
    const right = nearestFrames.right.frame.tyreCoreTemperatureC
    const frontLeft = interpolateContinuousChannel(nearestFrames, 'tyreCoreTemperatureC.frontLeft', left.frontLeft, right.frontLeft, fraction)
    const frontRight = interpolateContinuousChannel(nearestFrames, 'tyreCoreTemperatureC.frontRight', left.frontRight, right.frontRight, fraction)
    const rearLeft = interpolateContinuousChannel(nearestFrames, 'tyreCoreTemperatureC.rearLeft', left.rearLeft, right.rearLeft, fraction)
    const rearRight = interpolateContinuousChannel(nearestFrames, 'tyreCoreTemperatureC.rearRight', left.rearRight, right.rearRight, fraction)
    if (frontLeft === null || frontRight === null || rearLeft === null || rearRight === null) return null
    return { frontLeft, frontRight, rearLeft, rearRight }
}

export function findLeftAndRightNearestFrames(transitions: readonly AuditedTimelineTransition[], targetPosition: number, auditedFrameBySourceIndex: ReadonlyMap<number, AuditedFrame>): NearestFrames | null {
    let lowerIndex = 0
    let upperIndex = transitions.length
    while (lowerIndex < upperIndex) {
        const middleIndex = Math.floor((lowerIndex + upperIndex) / 2)
        const targetRangeEndPosition = middleIndex === transitions.length - 1
            ? 1
            : transitions[middleIndex].current.normalizedTrackPosition
        if (targetRangeEndPosition < targetPosition) lowerIndex = middleIndex + 1
        else upperIndex = middleIndex
    }

    const transition = transitions[lowerIndex]
    if (!transition) return null
    const targetRangeStartPosition = lowerIndex === 0 
        ? 0 
        : transition.previous.normalizedTrackPosition
    const targetRangeEndPosition = lowerIndex === transitions.length - 1 
        ? 1 
        : transition.current.normalizedTrackPosition
    if (targetPosition < targetRangeStartPosition || targetPosition > targetRangeEndPosition) return null

    const left = auditedFrameBySourceIndex.get(transition.previous.sourceIndex)
    const right = auditedFrameBySourceIndex.get(transition.current.sourceIndex)
    return left && right ? { transition, left, right } : null
}

export function findTransitionsOverlappingGridCell(transitions: readonly AuditedTimelineTransition[], cellFromPosition: number, cellToPosition: number): readonly AuditedTimelineTransition[] {
    let lowerIndex = 0
    let upperIndex = transitions.length
    while (lowerIndex < upperIndex) {
        const middleIndex = Math.floor((lowerIndex + upperIndex) / 2)
        const { toPosition } = findLapTransitionPositionRange(transitions, middleIndex)
        if (toPosition <= cellFromPosition) lowerIndex = middleIndex + 1
        else upperIndex = middleIndex
    }

    const overlappingTransitions: AuditedTimelineTransition[] = []
    for (let transitionIndex = lowerIndex; transitionIndex < transitions.length; transitionIndex++) {
        const { fromPosition, toPosition } = findLapTransitionPositionRange(transitions, transitionIndex)
        if (fromPosition >= cellToPosition) break
        if (toPosition > cellFromPosition) overlappingTransitions.push(transitions[transitionIndex])
    }
    return overlappingTransitions
}

function findLapTransitionPositionRange(transitions: readonly AuditedTimelineTransition[], transitionIndex: number): { fromPosition: number, toPosition: number } {
    const transition = transitions[transitionIndex]
    return {
        fromPosition: transitionIndex === 0 ? 0 : transition.previous.normalizedTrackPosition,
        toPosition: transitionIndex === transitions.length - 1 ? 1 : transition.current.normalizedTrackPosition,
    }
}
