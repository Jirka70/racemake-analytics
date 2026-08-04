import type { SteeringStrengthProfile } from './create-steering-strength-profile'
import type { SteeringStrengthThresholdResult } from './derive-steering-strength-thresholds'

export interface CornerCandidate {
    readonly startCellIndex: number
    readonly endCellIndexExclusive: number
    readonly cellIndexes: readonly number[]
}

export function findCornerCandidates(profile: SteeringStrengthProfile, thresholds: SteeringStrengthThresholdResult): readonly CornerCandidate[] {
    return createCornerCandidates(createCandidateCellMask(profile, thresholds))
}

export function createCandidateCellMask(profile: SteeringStrengthProfile, thresholds: SteeringStrengthThresholdResult): boolean[] {
    const candidateCellMask = profile.cells.map(() => false)
    if (thresholds.status === 'unavailable' || profile.cells.length === 0) return candidateCellMask

    const outsideCellIndex = findOutsideCellIndex(profile, thresholds.lowThresholdDegrees)
    if (outsideCellIndex === -1) {
        const wholeTrackIsCandidate = profile.cells.some(({ steeringStrengthDegrees }) => steeringStrengthDegrees !== null && steeringStrengthDegrees >= thresholds.highThresholdDegrees)
        return candidateCellMask.map(() => wholeTrackIsCandidate)
    }

    let isCornerCandidate = false
    for (let offset = 1; offset <= profile.cells.length; offset++) {
        const cellIndex = (outsideCellIndex + offset) % profile.cells.length
        const strength = profile.cells[cellIndex]?.steeringStrengthDegrees
        if (strength === null || strength === undefined || strength < thresholds.lowThresholdDegrees) isCornerCandidate = false
        else if (strength >= thresholds.highThresholdDegrees) isCornerCandidate = true
        candidateCellMask[cellIndex] = isCornerCandidate
    }
    return candidateCellMask
}

function createCornerCandidates(candidateCellMask: readonly boolean[]): CornerCandidate[] {
    if (candidateCellMask.length === 0) return []

    const outsideCellIndex = candidateCellMask.findIndex((isCandidate) => !isCandidate)
    if (outsideCellIndex === -1) return [createCornerCandidate(candidateCellMask.map((_, cellIndex) => cellIndex), candidateCellMask.length)]

    const cornerCandidates: CornerCandidate[] = []
    let cellIndexes: number[] = []
    for (let offset = 1; offset <= candidateCellMask.length; offset++) {
        const cellIndex = (outsideCellIndex + offset) % candidateCellMask.length
        if (candidateCellMask[cellIndex]) cellIndexes.push(cellIndex)
        else if (cellIndexes.length > 0) {
            cornerCandidates.push(createCornerCandidate(cellIndexes, candidateCellMask.length))
            cellIndexes = []
        }
    }
    return cornerCandidates
}

function createCornerCandidate(cellIndexes: readonly number[], cellCount: number): CornerCandidate {
    return {
        startCellIndex: cellIndexes[0]!,
        endCellIndexExclusive: (cellIndexes[cellIndexes.length - 1]! + 1) % cellCount,
        cellIndexes,
    }
}

function findOutsideCellIndex(profile: SteeringStrengthProfile, lowThresholdDegrees: number): number {
    return profile.cells
        .findIndex(({ steeringStrengthDegrees }) => steeringStrengthDegrees === null 
            || steeringStrengthDegrees < lowThresholdDegrees)
}
