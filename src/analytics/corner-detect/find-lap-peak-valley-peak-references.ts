import type { PeakValleyPeak } from './corner-detect-types'
import type { CellAlignedLapSteering, CellAlignedSteering } from './create-cell-aligned-steering'

const MINIMUM_RACING_LAP_VALLEY_CONFIDENCE = 0.5

export interface LapPeakValleyPeakReference {
    readonly lapNumber: number
    readonly leftPeakCellIndex: number | null
    readonly valleyCellIndex: number | null
    readonly rightPeakCellIndex: number | null
}

export interface RacingLapPeakValleyPeak {
    readonly lapNumber: number
    readonly peakValleyPeak: PeakValleyPeak | null
}

export interface RacingLapValley {
    readonly lapNumber: number
    readonly peakValleyPeak: PeakValleyPeak | null
    readonly depthLog: number | null
    readonly halfDepthStrengthDegrees: number | null
    readonly valleyWidthCellCount: number
    readonly valleyCellMask: readonly boolean[]
}

export interface PeakValleyPeakLapSupport {
    readonly lapNumber: number
    readonly peakValleyPeak: PeakValleyPeak
    readonly valleyCellMask: readonly boolean[]
}

export interface ConfirmedPeakValleyPeak {
    readonly peakValleyPeak: PeakValleyPeak
    readonly lapSupport: readonly PeakValleyPeakLapSupport[]
}

export interface RacingLapValleyVote {
    readonly lapNumber: number
    readonly confidence: number
    readonly isVoteFor: boolean
}

export interface ValleyVoteResult extends ConfirmedPeakValleyPeak {
    readonly lapVotes: readonly RacingLapValleyVote[]
    readonly voteCount: number
    readonly racingLapCount: number
    readonly confirmed: boolean
}

export function findLapPeakValleyPeakReferencesInRacingLaps(peakValleyPeak: PeakValleyPeak, racingLapsSteering: readonly CellAlignedLapSteering[], windowSize: number): readonly LapPeakValleyPeakReference[] {
    const halfWindowSize = Math.floor(windowSize / 2)
    return racingLapsSteering.map((lapSteering) => ({
        lapNumber: lapSteering.lapNumber,
        leftPeakCellIndex: findLocalMaximum(lapSteering, 
            peakValleyPeak.leftPeak.cellIndex - halfWindowSize, 
            peakValleyPeak.leftPeak.cellIndex + halfWindowSize),
        valleyCellIndex: findLocalMinimum(lapSteering, 
            peakValleyPeak.valley.cellIndex - halfWindowSize, 
            peakValleyPeak.valley.cellIndex + halfWindowSize),
        rightPeakCellIndex: findLocalMaximum(lapSteering, 
            peakValleyPeak.rightPeak.cellIndex - halfWindowSize, 
            peakValleyPeak.rightPeak.cellIndex + halfWindowSize),
    }))
}

export function createPeakValleyPeaksInRacingLaps(peakValleyPeak: PeakValleyPeak, cellAlignedSteering: CellAlignedSteering, windowSize: number): readonly RacingLapPeakValleyPeak[] {
    const lapByNumber = new Map(cellAlignedSteering.laps.map((lap) => [lap.lapNumber, lap]))
    return findLapPeakValleyPeakReferencesInRacingLaps(peakValleyPeak, cellAlignedSteering.laps, windowSize).map((reference) => ({
        lapNumber: reference.lapNumber,
        peakValleyPeak: createPeakValleyPeak(reference, lapByNumber.get(reference.lapNumber), cellAlignedSteering.cellCenters),
    }))
}

export function computeValleysInRacingLaps(racingLapPeakValleyPeaks: readonly RacingLapPeakValleyPeak[], cellAlignedSteering: CellAlignedSteering): readonly RacingLapValley[] {
    const lapByNumber = new Map(cellAlignedSteering.laps.map((lap) => [lap.lapNumber, lap]))
    return racingLapPeakValleyPeaks.map(({ lapNumber, peakValleyPeak }) => computeRacingLapValley(lapNumber, peakValleyPeak, lapByNumber.get(lapNumber), cellAlignedSteering.cellCenters.length))
}

export function confirmValleysAcrossRacingLaps(peakValleyPeak: PeakValleyPeak, racingLapValleys: readonly RacingLapValley[], profileResidualRequirementLog: number): ConfirmedPeakValleyPeak {
    const lapSupport = racingLapValleys.flatMap(({ lapNumber, peakValleyPeak: racingLapPeakValleyPeak, depthLog, valleyCellMask }): PeakValleyPeakLapSupport[] => {
        if (!racingLapPeakValleyPeak || depthLog === null || depthLog <= profileResidualRequirementLog) return []
        return [{ lapNumber, peakValleyPeak: racingLapPeakValleyPeak, valleyCellMask }]
    })
    return { peakValleyPeak, lapSupport }
}

export function calculateValleyVotes(confirmedPeakValleyPeak: ConfirmedPeakValleyPeak, referenceValleyCellIndexes: readonly number[], cellAlignedSteering: CellAlignedSteering): ValleyVoteResult {
    const lapSupportByLapNumber = new Map(confirmedPeakValleyPeak.lapSupport.map((lapSupport) => [lapSupport.lapNumber, lapSupport]))
    const lapVotes = cellAlignedSteering.laps.map((lap) => calculateRacingLapValleyVote(lap, lapSupportByLapNumber.get(lap.lapNumber), referenceValleyCellIndexes))
    const voteCount = lapVotes.filter(({ isVoteFor }) => isVoteFor).length
    return { ...confirmedPeakValleyPeak, lapVotes, voteCount, racingLapCount: lapVotes.length, confirmed: voteCount > lapVotes.length / 2 }
}

function calculateRacingLapValleyVote(lap: CellAlignedLapSteering, lapSupport: PeakValleyPeakLapSupport | undefined, referenceValleyCellIndexes: readonly number[]): RacingLapValleyVote {
    if (!lapSupport || referenceValleyCellIndexes.length === 0) return { lapNumber: lap.lapNumber, confidence: 0, isVoteFor: false }
    let supportedCellCount = 0
    let overlappingValleyCellCount = 0
    for (const cellIndex of referenceValleyCellIndexes) {
        if (!lap.cornerDetectionSupportedCellMask[cellIndex]) continue
        supportedCellCount++
        if (lapSupport.valleyCellMask[cellIndex]) overlappingValleyCellCount++
    }
    const dataCoverage = supportedCellCount / referenceValleyCellIndexes.length
    const valleyOverlap = supportedCellCount === 0 ? 0 : overlappingValleyCellCount / supportedCellCount
    const confidence = dataCoverage * valleyOverlap
    return { lapNumber: lap.lapNumber, confidence, isVoteFor: confidence > MINIMUM_RACING_LAP_VALLEY_CONFIDENCE }
}

function computeRacingLapValley(lapNumber: number, peakValleyPeak: PeakValleyPeak | null, lap: CellAlignedLapSteering | undefined, cellCount: number): RacingLapValley {
    const emptyValley = { lapNumber, peakValleyPeak: null, depthLog: null, halfDepthStrengthDegrees: null, valleyWidthCellCount: 0, valleyCellMask: Array.from({ length: cellCount }, () => false) }
    if (!peakValleyPeak || !lap) return emptyValley

    const weakerPeakStrengthDegrees = Math.min(peakValleyPeak.leftPeak.steeringStrengthDegrees, peakValleyPeak.rightPeak.steeringStrengthDegrees)
    const valleyLog = Math.log1p(peakValleyPeak.valley.steeringStrengthDegrees)
    const depthLog = Math.log1p(weakerPeakStrengthDegrees) - valleyLog
    const halfDepthStrengthDegrees = Math.expm1(valleyLog + depthLog / 2)
    const valleyCellMask = createValleyCellMask(lap, peakValleyPeak, halfDepthStrengthDegrees)
    return { lapNumber, peakValleyPeak, depthLog, halfDepthStrengthDegrees, valleyWidthCellCount: valleyCellMask.filter(Boolean).length, valleyCellMask }
}

function createValleyCellMask(lap: CellAlignedLapSteering, peakValleyPeak: PeakValleyPeak, halfDepthStrengthDegrees: number): boolean[] {
    const valleyCellMask = lap.steeringDegreesByCell.map(() => false)
    const valleyCellIndex = peakValleyPeak.valley.cellIndex
    if (!isAtOrBelowHalfDepth(lap, valleyCellIndex, halfDepthStrengthDegrees)) return valleyCellMask
    valleyCellMask[valleyCellIndex] = true
    markValleyCells(lap, valleyCellMask, valleyCellIndex, peakValleyPeak.leftPeak.cellIndex, -1, halfDepthStrengthDegrees)
    markValleyCells(lap, valleyCellMask, valleyCellIndex, peakValleyPeak.rightPeak.cellIndex, 1, halfDepthStrengthDegrees)
    return valleyCellMask
}

function markValleyCells(lap: CellAlignedLapSteering, valleyCellMask: boolean[], valleyCellIndex: number, boundaryCellIndex: number, direction: -1 | 1, halfDepthStrengthDegrees: number): void {
    const cellCount = lap.steeringDegreesByCell.length
    for (let offset = 1; offset <= cellCount; offset++) {
        const cellIndex = (valleyCellIndex + direction * offset + cellCount) % cellCount
        if (!isAtOrBelowHalfDepth(lap, cellIndex, halfDepthStrengthDegrees)) return
        valleyCellMask[cellIndex] = true
        if (cellIndex === boundaryCellIndex) return
    }
}

function isAtOrBelowHalfDepth(lap: CellAlignedLapSteering, cellIndex: number, halfDepthStrengthDegrees: number): boolean {
    const steeringDegrees = lap.steeringDegreesByCell[cellIndex]
    return steeringDegrees !== null && steeringDegrees !== undefined && Math.abs(steeringDegrees) <= halfDepthStrengthDegrees
}

function createPeakValleyPeak(reference: LapPeakValleyPeakReference, lap: CellAlignedLapSteering | undefined, cellCenters: readonly number[]): PeakValleyPeak | null {
    const { leftPeakCellIndex, valleyCellIndex, rightPeakCellIndex } = reference
    if (!lap || leftPeakCellIndex === null || valleyCellIndex === null || rightPeakCellIndex === null) return null
    const leftPeak = createSteeringShapeCell(leftPeakCellIndex, lap, cellCenters)
    const valley = createSteeringShapeCell(valleyCellIndex, lap, cellCenters)
    const rightPeak = createSteeringShapeCell(rightPeakCellIndex, lap, cellCenters)
    return leftPeak && valley && rightPeak ? { leftPeak, valley, rightPeak } : null
}

function createSteeringShapeCell(cellIndex: number, lap: CellAlignedLapSteering, cellCenters: readonly number[]) {
    const steeringDegrees = lap.steeringDegreesByCell[cellIndex]
    const cellCenter = cellCenters[cellIndex]
    return steeringDegrees === null || steeringDegrees === undefined || cellCenter === undefined
        ? null
        : { cellIndex, cellCenter, steeringStrengthDegrees: Math.abs(steeringDegrees) }
}

function findLocalMinimum(lapSteeringProfile: CellAlignedLapSteering, from: number, to: number): number | null {
    let localMinimum: { cellIndex: number, strength: number } | null = null
    for (let unwrappedCellIndex = from; unwrappedCellIndex <= to; unwrappedCellIndex++) {
        const cellIndex = (unwrappedCellIndex + lapSteeringProfile.steeringDegreesByCell.length) % lapSteeringProfile.steeringDegreesByCell.length
        const steeringDegrees = lapSteeringProfile.steeringDegreesByCell[cellIndex]
        if (steeringDegrees === null || steeringDegrees === undefined) continue
        const strength = Math.abs(steeringDegrees)
        if (!localMinimum || strength <= localMinimum.strength) localMinimum = { cellIndex, strength }
    }
    return localMinimum?.cellIndex ?? null
}

function findLocalMaximum(lapSteeringProfile: CellAlignedLapSteering, from: number, to: number): number | null {
    let localMaximum: { cellIndex: number, strength: number } | null = null
    const numberOfCells = lapSteeringProfile.steeringDegreesByCell.length
    for (let unwrappedCellIndex = from; unwrappedCellIndex <= to; unwrappedCellIndex++) {
        const cellIndex = (unwrappedCellIndex + numberOfCells) % numberOfCells
        const steeringDegrees = lapSteeringProfile.steeringDegreesByCell[cellIndex]
        if (steeringDegrees === null || steeringDegrees === undefined) continue
        const strength = Math.abs(steeringDegrees)
        if (!localMaximum || strength >= localMaximum.strength) localMaximum = { cellIndex, strength }
    }
    return localMaximum?.cellIndex ?? null  
}
