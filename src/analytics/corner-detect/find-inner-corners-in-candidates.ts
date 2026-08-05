import type { ConfirmedCornerCandidate } from './confirm-corner-candidates'
import { computeProfileResidualRequirement } from './compute-profile-residual-requirement'
import type { PeakValleyPeak, SteeringShapePeak, SteeringShapeValley } from './corner-detect-types'
import type { SteeringStrengthProfile } from './create-steering-strength-profile'
import type { TrackSteeringProfile } from './create-track-steering-profile'
import type { SmoothedTrackSteeringProfile } from './smooth-track-steering-profile'

export type WeakerPeakSide = 'left' | 'right' | 'equal'

export interface ValleyDepth {
    readonly peakValleyPeak: PeakValleyPeak
    readonly weakerPeakSide: WeakerPeakSide
    readonly weakerPeakStrengthDegrees: number
    readonly depthDegrees: number
    readonly depthLog: number
    readonly halfDepthStrengthDegrees: number
    readonly halfDepthLog: number
}

export interface ValleyWidth {
    readonly valleyDepth: ValleyDepth
    readonly startCellIndex: number
    readonly endCellIndexExclusive: number
    readonly cellIndexes: readonly number[]
    readonly cellCount: number
    readonly normalizedPositionSpan: number
    readonly minimumRecognizableCellCount: number
}

export interface ConfirmedCornerCandidateShape {
    readonly candidate: ConfirmedCornerCandidate
    readonly peaks: readonly SteeringShapePeak[]
    readonly valleys: readonly SteeringShapeValley[]
    readonly peakValleyPeaks: readonly PeakValleyPeak[]
    readonly valleyDepths: readonly ValleyDepth[]
    readonly profileResidualRequirementLog: number
    readonly deepValleyDepths: readonly ValleyDepth[]
    readonly valleyWidths: readonly ValleyWidth[]
    readonly profileValidatedValleys: readonly ValleyWidth[] // valleys, which are wide and deep enough
}

export function findInnerCornersInCandidates(candidates: readonly ConfirmedCornerCandidate[], profile: SteeringStrengthProfile, trackProfile: TrackSteeringProfile, smoothedProfile: SmoothedTrackSteeringProfile, noiseMultiplier: number): readonly ConfirmedCornerCandidateShape[] {
    return candidates.map((candidate) => findPeaksAndValleys(candidate, profile, trackProfile, smoothedProfile, noiseMultiplier))
}

function findPeaksAndValleys(candidate: ConfirmedCornerCandidate, profile: SteeringStrengthProfile, trackProfile: TrackSteeringProfile, smoothedProfile: SmoothedTrackSteeringProfile, noiseMultiplier: number): ConfirmedCornerCandidateShape {
    const peaks: SteeringShapePeak[] = []
    const valleys: SteeringShapeValley[] = []
    const peakValleyPeaks: PeakValleyPeak[] = []
    let previousPeak: SteeringShapePeak | null = null
    let pendingValley: SteeringShapeValley | null = null
    let findLocalMaximum = true
    let findLocalMinimum = false

    for (let index = 1; index < candidate.cellIndexes.length - 1; index++) {
        const previous = profile.cells[candidate.cellIndexes[index - 1]!]
        const current = profile.cells[candidate.cellIndexes[index]!]
        const next = profile.cells[candidate.cellIndexes[index + 1]!]
        if (!previous || !current || !next) continue
        if (previous.steeringStrengthDegrees === null || current.steeringStrengthDegrees === null || next.steeringStrengthDegrees === null) continue

        if (findLocalMaximum && isLocalMaximum(previous.steeringStrengthDegrees, current.steeringStrengthDegrees, next.steeringStrengthDegrees)) {
            const peak = { cellIndex: candidate.cellIndexes[index]!, cellCenter: current.cellCenter, steeringStrengthDegrees: current.steeringStrengthDegrees }
            peaks.push(peak)
            if (previousPeak && pendingValley) peakValleyPeaks.push({ leftPeak: previousPeak, valley: pendingValley, rightPeak: peak })
            previousPeak = peak
            pendingValley = null
            findLocalMaximum = false
            findLocalMinimum = true
        } else if (findLocalMinimum && isLocalMinimum(previous.steeringStrengthDegrees, current.steeringStrengthDegrees, next.steeringStrengthDegrees)) {
            pendingValley = { cellIndex: candidate.cellIndexes[index]!, cellCenter: current.cellCenter, steeringStrengthDegrees: current.steeringStrengthDegrees }
            valleys.push(pendingValley)
            findLocalMinimum = false
            findLocalMaximum = true
        }
    }
    const valleyDepths = computeValleyDepths(peakValleyPeaks)
    const profileResidualRequirementLog = computeProfileResidualRequirement(trackProfile, smoothedProfile, noiseMultiplier)
    const deepValleyDepths = valleyDepths.filter(({ depthLog }) => depthLog > profileResidualRequirementLog)
    const valleyWidths = computeValleyWidths(candidate, deepValleyDepths, profile, smoothedProfile.windowSize)
    const profileValidatedValleys = valleyWidths.filter(isValleyWideEnough)
    return { candidate, peaks, valleys, peakValleyPeaks, valleyDepths, profileResidualRequirementLog, deepValleyDepths, valleyWidths, profileValidatedValleys }
}

function computeValleyDepths(peakValleyPeaks: readonly PeakValleyPeak[]): readonly ValleyDepth[] {
    return peakValleyPeaks.map((peakValleyPeak) => {
        const { leftPeak, valley, rightPeak } = peakValleyPeak
        const weakerPeakStrengthDegrees = Math.min(leftPeak.steeringStrengthDegrees, rightPeak.steeringStrengthDegrees)
        const weakerPeakSide = findWeakerPeakSide(leftPeak, rightPeak)
        const depthDegrees = weakerPeakStrengthDegrees - valley.steeringStrengthDegrees
        const valleyLog = Math.log1p(valley.steeringStrengthDegrees)
        const weakerPeakLog = Math.log1p(weakerPeakStrengthDegrees)
        const depthLog = weakerPeakLog - valleyLog
        const halfDepthLog = valleyLog + depthLog / 2
        return { peakValleyPeak, weakerPeakSide, weakerPeakStrengthDegrees, depthDegrees, depthLog, halfDepthStrengthDegrees: Math.expm1(halfDepthLog), halfDepthLog }
    })
}

function findWeakerPeakSide(leftPeak: SteeringShapePeak, rightPeak: SteeringShapePeak): WeakerPeakSide {
    if (leftPeak.steeringStrengthDegrees < rightPeak.steeringStrengthDegrees) return 'left'
    if (rightPeak.steeringStrengthDegrees < leftPeak.steeringStrengthDegrees) return 'right'
    return 'equal'
}

function computeValleyWidths(candidate: ConfirmedCornerCandidate, valleyDepths: readonly ValleyDepth[], profile: SteeringStrengthProfile, minimumRecognizableCellCount: number): readonly ValleyWidth[] {
    const candidateCellPositions = new Map(candidate.cellIndexes.map((cellIndex, position) => [cellIndex, position]))
    return valleyDepths.map((valleyDepth) => computeValleyWidth(candidate, candidateCellPositions, valleyDepth, profile, minimumRecognizableCellCount))
}

function computeValleyWidth(candidate: ConfirmedCornerCandidate, candidateCellPositions: ReadonlyMap<number, number>, valleyDepth: ValleyDepth, profile: SteeringStrengthProfile, minimumRecognizableCellCount: number): ValleyWidth {
    const { leftPeak, valley, rightPeak } = valleyDepth.peakValleyPeak
    const leftPeakPosition = candidateCellPositions.get(leftPeak.cellIndex)
    const valleyPosition = candidateCellPositions.get(valley.cellIndex)
    const rightPeakPosition = candidateCellPositions.get(rightPeak.cellIndex)
    if (leftPeakPosition === undefined || valleyPosition === undefined || rightPeakPosition === undefined) throw new RangeError('Peak-valley-peak cells must belong to the candidate')
    if (leftPeakPosition >= valleyPosition || valleyPosition >= rightPeakPosition) throw new RangeError('Peak-valley-peak cells must follow candidate order')

    let startPosition = valleyPosition
    let endPosition = valleyPosition
    while (startPosition > leftPeakPosition && isAtOrBelowHalfDepth(candidate.cellIndexes[startPosition - 1]!, valleyDepth, profile)) startPosition--
    while (endPosition < rightPeakPosition && isAtOrBelowHalfDepth(candidate.cellIndexes[endPosition + 1]!, valleyDepth, profile)) endPosition++

    const cellIndexes = candidate.cellIndexes.slice(startPosition, endPosition + 1)
    return {
        valleyDepth,
        startCellIndex: cellIndexes[0]!,
        endCellIndexExclusive: (cellIndexes[cellIndexes.length - 1]! + 1) % profile.cells.length,
        cellIndexes,
        cellCount: cellIndexes.length,
        normalizedPositionSpan: cellIndexes.length / profile.cells.length,
        minimumRecognizableCellCount,
    }
}

export function isValleyWideEnough(valleyWidth: ValleyWidth): boolean {
    return valleyWidth.cellCount >= valleyWidth.minimumRecognizableCellCount
}

function isAtOrBelowHalfDepth(cellIndex: number, valleyDepth: ValleyDepth, profile: SteeringStrengthProfile): boolean {
    const strength = profile.cells[cellIndex]?.steeringStrengthDegrees
    return strength !== null && strength !== undefined && strength <= valleyDepth.halfDepthStrengthDegrees
}

function isLocalMaximum(previous: number, current: number, next: number): boolean {
    return previous < current && current > next
}

function isLocalMinimum(previous: number, current: number, next: number): boolean {
    return previous > current && current < next
}
