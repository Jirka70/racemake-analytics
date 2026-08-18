import type { CellAlignedLapSteering, CellAlignedSteering } from './create-cell-aligned-steering'
import type { SteeringStrengthProfile } from './create-steering-strength-profile'
import type { SteeringStrengthThresholdResult } from './derive-steering-strength-thresholds'
import { createCandidateCellMask, type CornerCandidate } from './find-corner-candidates'

export interface ConfirmedCornerCandidate extends CornerCandidate {
    readonly confidence: number
}

export interface CornerCandidateLapConfidenceData {
    readonly lapNumber: number
    readonly dataCoverage: number
    readonly steeringOverlap: number
}

export interface CornerCandidateConfidenceData {
    readonly candidate: CornerCandidate
    readonly racingLapCount: number
    readonly laps: readonly CornerCandidateLapConfidenceData[]
}

export function confirmCornerCandidates(
    candidates: readonly CornerCandidate[],
    cellAlignedSteering: CellAlignedSteering,
    thresholds: SteeringStrengthThresholdResult,
    minimumConfidence: number,
): readonly ConfirmedCornerCandidate[] {
    return collectCornerCandidateConfidenceData(candidates, cellAlignedSteering, thresholds).flatMap(({ candidate, laps }) => {
        const confidence = calculateCornerCandidateConfidence(laps)
        return confidence > minimumConfidence ? [{ ...candidate, confidence }] : []
    })
}

export function calculateCornerCandidateConfidence(laps: readonly CornerCandidateLapConfidenceData[]): number {
    const totalDataCoverage = laps.reduce((sum, { dataCoverage }) => sum + dataCoverage, 0)
    if (totalDataCoverage === 0) return 0

    // Missing cells abstain. Available cells vote in proportion to how much of
    // the candidate they cover, so a recorder gap is never a negative vote.
    return laps.reduce(
        (sum, { dataCoverage, steeringOverlap }) => sum + dataCoverage * steeringOverlap,
        0,
    ) / totalDataCoverage
}

export function collectCornerCandidateConfidenceData(candidates: readonly CornerCandidate[], cellAlignedSteering: CellAlignedSteering, thresholds: SteeringStrengthThresholdResult): readonly CornerCandidateConfidenceData[] {
    const lapMasks = cellAlignedSteering.laps.map((lap) => ({ lap, mask: createLapCandidateCellMask(lap, cellAlignedSteering.cellCenters, thresholds) }))
    return candidates.map((candidate) => ({
        candidate,
        racingLapCount: lapMasks.length,
        laps: lapMasks.map(({ lap, mask }) => collectLapConfidenceData(candidate, lap, mask)),
    }))
}

function createLapCandidateCellMask(lap: CellAlignedLapSteering, cellCenters: readonly number[], thresholds: SteeringStrengthThresholdResult): readonly boolean[] {
    const profile: SteeringStrengthProfile = {
        cells: cellCenters.map((cellCenter, cellIndex) => {
            const signedSteeringDegrees = lap.steeringDegreesByCell[cellIndex] ?? null
            return { cellCenter, signedSteeringDegrees, steeringStrengthDegrees: signedSteeringDegrees === null ? null : Math.abs(signedSteeringDegrees) }
        }),
    }
    return createCandidateCellMask(profile, thresholds)
}

function collectLapConfidenceData(candidate: CornerCandidate, lap: CellAlignedLapSteering, candidateCellMask: readonly boolean[]): CornerCandidateLapConfidenceData {
    let supportedCellCount = 0
    let turningCellCount = 0
    for (const cellIndex of candidate.cellIndexes) {
        if (!lap.cornerDetectionSupportedCellMask[cellIndex]) continue
        supportedCellCount++
        if (candidateCellMask[cellIndex]) turningCellCount++
    }
    return {
        lapNumber: lap.lapNumber,
        dataCoverage: candidate.cellIndexes.length === 0 ? 0 : supportedCellCount / candidate.cellIndexes.length,
        steeringOverlap: supportedCellCount === 0 ? 0 : turningCellCount / supportedCellCount,
    }
}
