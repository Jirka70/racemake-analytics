import type { AuditedFrame, LocallyAuditedSignalChannel } from '../frame-audit-types'
import { median } from '../robust-statistics'
import type { CoverageResult, LapCandidate, LapDetectionConfig, LinearGrid, PositionCalibration } from './lap-detect-types'
import { isPositionFrameUsable, POSITION_CHANNEL } from './position-support'
import { canUseChannelTransition, canUsePositionTransition, isChannelUsable } from './util/usable-channels'

export function deriveLinearGrid(lapCandidates: readonly LapCandidate[], calibration: PositionCalibration, config: LapDetectionConfig): LinearGrid {
    const usablePositionSampleCountsPerLap = lapCandidates
        .map((candidate) => candidate.frames.filter(isPositionFrameUsable).length)
        .filter((sampleCount) => sampleCount > 0)

    const referenceUsablePositionSampleCountPerLap = usablePositionSampleCountsPerLap.length > 0
        ? median(usablePositionSampleCountsPerLap)
        : config.linearGrid.minimumCellCount

    const sampleCountBasedCellCount = Math.round(referenceUsablePositionSampleCountPerLap)
    const positionSpacingBasedCellCount = Math.round(1 / calibration.medianPositionStep)
    const estimatedCellCount = Math.min(sampleCountBasedCellCount, positionSpacingBasedCellCount)
    const cellCount = clamp(
        estimatedCellCount,
        config.linearGrid.minimumCellCount,
        config.linearGrid.maximumCellCount,
    )

    const relativeRequiredPositionSampleCount = Math.ceil(
        referenceUsablePositionSampleCountPerLap * config.linearGrid.minimumRelativePositionSampleRatio,
    )

    return {
        cellCount,
        normalizedPositionCellWidth: 1 / cellCount,
        referenceUsablePositionSampleCountPerLap,
        requiredUsablePositionSampleCountPerLap: Math.max(
            config.linearGrid.minimumUsablePositionSampleCount,
            relativeRequiredPositionSampleCount,
        ),
    }
}

interface CalculateChannelCoverageArguments {
    readonly candidate: LapCandidate
    readonly linearGridCellCount: number
    readonly channel: LocallyAuditedSignalChannel
    readonly maximumInterpolationSpan: number
    readonly auditedFrameBySourceIndex: ReadonlyMap<number, AuditedFrame>
}

export function calculateChannelCoverage(args: CalculateChannelCoverageArguments): CoverageResult {
    const supportedCellMask = Array.from({ length: args.linearGridCellCount }, () => false)

    markDirectlySupportedPositions(supportedCellMask, args.candidate, args.channel)
    markSafelyInterpolatedPositions(supportedCellMask, args)

    return {
        coverage: supportedCellMask.filter(Boolean).length / supportedCellMask.length,
        maximumUnsupportedSpan: calculateMaximumCircularUnsupportedSpan(supportedCellMask),
        supportedCellMask,
    }
}

function markDirectlySupportedPositions(supportedCellMask: boolean[], candidate: LapCandidate, channel: LocallyAuditedSignalChannel): void {
    for (const auditedFrame of candidate.frames) {
        if (!isChannelUsable(auditedFrame, POSITION_CHANNEL)) continue
        if (!isChannelUsable(auditedFrame, channel)) continue

        markLinearGridPosition(supportedCellMask, auditedFrame.frame.normalizedTrackPosition)
    }
}

function markSafelyInterpolatedPositions(supportedCellMask: boolean[], args: CalculateChannelCoverageArguments): void {
    for (const transition of args.candidate.transitions) {
        if (!canUsePositionTransition(transition, args.auditedFrameBySourceIndex)) continue
        if (!canUseChannelTransition(transition, args.channel, args.auditedFrameBySourceIndex)) continue

        const startPosition = transition.previous.normalizedTrackPosition
        const rawPositionDelta = transition.current.normalizedTrackPosition - startPosition

        let endPosition: number
        if (rawPositionDelta < -0.5) endPosition = 1
        else if (rawPositionDelta >= 0) endPosition = transition.current.normalizedTrackPosition
        else continue

        const interpolationSpan = endPosition - startPosition
        if (interpolationSpan < 0 || interpolationSpan > args.maximumInterpolationSpan) continue

        markLinearGridInterval(supportedCellMask, startPosition, endPosition)
    }
}

function markLinearGridPosition(supportedCellMask: boolean[], position: number): void {
    const cellIndex = clamp(
        Math.floor(position * supportedCellMask.length),
        0,
        supportedCellMask.length - 1,
    )

    supportedCellMask[cellIndex] = true
}

function markLinearGridInterval(supportedCellMask: boolean[], startPosition: number, endPosition: number): void {
    const startCellIndex = clamp(
        Math.floor(startPosition * supportedCellMask.length),
        0,
        supportedCellMask.length - 1,
    )
    const endCellIndexExclusive = clamp(
        Math.ceil(endPosition * supportedCellMask.length),
        0,
        supportedCellMask.length,
    )

    for (let cellIndex = startCellIndex; cellIndex < endCellIndexExclusive; cellIndex += 1) {
        supportedCellMask[cellIndex] = true
    }
}

function calculateMaximumCircularUnsupportedSpan(supportedCellMask: readonly boolean[]): number {
    const firstSupportedCellIndex = supportedCellMask.indexOf(true)
    if (firstSupportedCellIndex === -1) return 1

    let maximumUnsupportedRun = 0
    let currentUnsupportedRun = 0

    for (let offset = 1; offset <= supportedCellMask.length; offset += 1) {
        const cellIndex = (firstSupportedCellIndex + offset) % supportedCellMask.length

        if (supportedCellMask[cellIndex]) {
            maximumUnsupportedRun = Math.max(maximumUnsupportedRun, currentUnsupportedRun)
            currentUnsupportedRun = 0
        } else {
            currentUnsupportedRun += 1
        }
    }

    return maximumUnsupportedRun / supportedCellMask.length
}

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value))
}
