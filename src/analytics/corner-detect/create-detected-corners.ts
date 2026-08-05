import type { ConfirmedCornerCandidate } from './confirm-corner-candidates'
import type { CellAlignedSteering } from './create-cell-aligned-steering'
import type { CornerCandidate } from './find-corner-candidates'
import type { ConfirmedCornerCandidateShape, ValleyWidth } from './find-inner-corners-in-candidates'
import { calculateValleyVotes, computeValleysInRacingLaps, confirmValleysAcrossRacingLaps, createPeakValleyPeaksInRacingLaps, type ValleyVoteResult } from './find-lap-peak-valley-peak-references'

export interface ConfirmedInnerValley extends ValleyVoteResult {
    readonly candidate: ConfirmedCornerCandidate
    readonly valleyWidth: ValleyWidth
}

export interface DetectedCorner extends CornerCandidate {}

export interface DetectedCornersResult {
    readonly confirmedInnerValleys: readonly ConfirmedInnerValley[]
    readonly corners: readonly DetectedCorner[]
}

export function createDetectedCorners(candidateShapes: readonly ConfirmedCornerCandidateShape[], cellAlignedSteering: CellAlignedSteering, windowSize: number): DetectedCornersResult {
    const confirmedInnerValleys: ConfirmedInnerValley[] = []
    const corners: DetectedCorner[] = []
    for (const candidateShape of candidateShapes) {
        const candidateValleys = confirmInnerValleys(candidateShape, cellAlignedSteering, windowSize)
        confirmedInnerValleys.push(...candidateValleys)
        corners.push(...splitCandidateAtValleys(candidateShape.candidate, candidateValleys, cellAlignedSteering.cellCenters.length))
    }
    return { confirmedInnerValleys, corners }
}

function confirmInnerValleys(candidateShape: ConfirmedCornerCandidateShape, cellAlignedSteering: CellAlignedSteering, windowSize: number): ConfirmedInnerValley[] {
    return candidateShape.profileValidatedValleys.flatMap((valleyWidth): ConfirmedInnerValley[] => {
        const peakValleyPeak = valleyWidth.valleyDepth.peakValleyPeak
        const racingLapPeakValleyPeaks = createPeakValleyPeaksInRacingLaps(peakValleyPeak, cellAlignedSteering, windowSize)
        const racingLapValleys = computeValleysInRacingLaps(racingLapPeakValleyPeaks, cellAlignedSteering)
        const confirmedPeakValleyPeak = confirmValleysAcrossRacingLaps(peakValleyPeak, racingLapValleys, candidateShape.profileResidualRequirementLog)
        const voteResult = calculateValleyVotes(confirmedPeakValleyPeak, valleyWidth.cellIndexes, cellAlignedSteering)
        return voteResult.confirmed ? [{ ...voteResult, candidate: candidateShape.candidate, valleyWidth }] : []
    })
}

function splitCandidateAtValleys(candidate: ConfirmedCornerCandidate, valleys: readonly ConfirmedInnerValley[], cellCount: number): DetectedCorner[] {
    const splitPositions = valleys
        .map(({ valleyWidth }) => candidate.cellIndexes.indexOf(valleyWidth.valleyDepth.peakValleyPeak.valley.cellIndex))
        .filter((position) => position > 0 && position < candidate.cellIndexes.length)
        .sort((first, second) => first - second)
    const corners: DetectedCorner[] = []
    let startPosition = 0
    for (const splitPosition of new Set(splitPositions)) {
        corners.push(createDetectedCorner(candidate.cellIndexes.slice(startPosition, splitPosition), cellCount))
        startPosition = splitPosition
    }
    corners.push(createDetectedCorner(candidate.cellIndexes.slice(startPosition), cellCount))
    return corners
}

function createDetectedCorner(cellIndexes: readonly number[], cellCount: number): DetectedCorner {
    return {
        startCellIndex: cellIndexes[0]!,
        endCellIndexExclusive: (cellIndexes[cellIndexes.length - 1]! + 1) % cellCount,
        cellIndexes,
    }
}
