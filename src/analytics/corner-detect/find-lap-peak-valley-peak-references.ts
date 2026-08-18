import type { PeakValleyPeak } from './corner-detect-types'
import type { CellAlignedLapSteering, CellAlignedSteering } from './create-cell-aligned-steering'

const MINIMUM_RACING_LAP_VALLEY_CONFIDENCE = 0.5
const MINIMUM_REPEATABLE_VALLEY_LAP_COUNT = 2

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
    readonly evaluatedLapNumbers: readonly number[]
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
    readonly votingLapCount: number
    readonly confirmed: boolean
}

export function findLapPeakValleyPeakReferencesInRacingLaps(peakValleyPeak: PeakValleyPeak, racingLapsSteering: readonly CellAlignedLapSteering[], findingAreaSize: number): readonly LapPeakValleyPeakReference[] {
    const halfAreaSize = Math.floor(findingAreaSize / 2)
    return racingLapsSteering.map((lapSteering) => ({
        lapNumber: lapSteering.lapNumber,
        leftPeakCellIndex: findLocalMaximum(lapSteering, 
            peakValleyPeak.leftPeak.cellIndex - halfAreaSize, 
            peakValleyPeak.leftPeak.cellIndex + halfAreaSize),
        valleyCellIndex: findLocalMinimum(lapSteering, 
            peakValleyPeak.valley.cellIndex - halfAreaSize, 
            peakValleyPeak.valley.cellIndex + halfAreaSize),
        rightPeakCellIndex: findLocalMaximum(lapSteering, 
            peakValleyPeak.rightPeak.cellIndex - halfAreaSize, 
            peakValleyPeak.rightPeak.cellIndex + halfAreaSize),
    }))
}

export function createPeakValleyPeaksInRacingLaps(peakValleyPeak: PeakValleyPeak, cellAlignedSteering: CellAlignedSteering, windowSize: number): readonly RacingLapPeakValleyPeak[] {
    const lapByNumber = new Map(cellAlignedSteering.laps.map((lap) => [lap.lapNumber, lap]))
    const lapPeakValleyPeaks = findLapPeakValleyPeakReferencesInRacingLaps(peakValleyPeak, cellAlignedSteering.laps, windowSize)
    return lapPeakValleyPeaks.map((lapPeakValleyPeak) => ({
        lapNumber: lapPeakValleyPeak.lapNumber,
        peakValleyPeak: createPeakValleyPeak(lapPeakValleyPeak, 
            lapByNumber.get(lapPeakValleyPeak.lapNumber), 
            cellAlignedSteering.cellCenters),
    }))
}

export function computeValleysInRacingLaps(racingLapPeakValleyPeaks: readonly RacingLapPeakValleyPeak[],
    cellAlignedSteering: CellAlignedSteering): readonly RacingLapValley[] {
    const lapByNumber = new Map(cellAlignedSteering.laps.map((lap) => [lap.lapNumber, lap]))
    return racingLapPeakValleyPeaks.map(({ lapNumber, peakValleyPeak }) => computeRacingLapValley(lapNumber, peakValleyPeak, lapByNumber.get(lapNumber), cellAlignedSteering.cellCenters.length))
}

export function confirmValleysAcrossRacingLaps(peakValleyPeak: PeakValleyPeak, racingLapValleys: readonly RacingLapValley[], profileResidualRequirementLog: number): ConfirmedPeakValleyPeak {
    const evaluatedLapNumbers = racingLapValleys.flatMap(({ lapNumber, peakValleyPeak, depthLog }) =>
        peakValleyPeak !== null && depthLog !== null ? [lapNumber] : [])
    const lapSupport = racingLapValleys
        .flatMap((racingLapValley) => 
            createLapSupportIfValleyIsDeepEnough(racingLapValley, profileResidualRequirementLog))

    return { peakValleyPeak, evaluatedLapNumbers, lapSupport }
}

export function calculateValleyVotes(confirmedPeakValleyPeak: ConfirmedPeakValleyPeak, referenceValleyCellIndexes: readonly number[], cellAlignedSteering: CellAlignedSteering): ValleyVoteResult {
    const lapSupportByLapNumber = new Map(confirmedPeakValleyPeak.lapSupport.map((lapSupport) => [lapSupport.lapNumber, lapSupport]))
    const evaluatedLapNumbers = new Set(confirmedPeakValleyPeak.evaluatedLapNumbers)
    const lapVotes = cellAlignedSteering.laps
        .filter(({ lapNumber }) => evaluatedLapNumbers.has(lapNumber))
        .map((lap) => calculateRacingLapValleyVote(lap, lapSupportByLapNumber.get(lap.lapNumber), referenceValleyCellIndexes))
    const voteCount = lapVotes.filter(({ isVoteFor }) => isVoteFor).length
    const votingLapCount = lapVotes.length
    return {
        ...confirmedPeakValleyPeak,
        lapVotes,
        voteCount,
        racingLapCount: cellAlignedSteering.laps.length,
        votingLapCount,
        confirmed: votingLapCount >= MINIMUM_REPEATABLE_VALLEY_LAP_COUNT && voteCount > votingLapCount / 2,
    }
}

function createLapSupportIfValleyIsDeepEnough(racingLapValley: RacingLapValley, profileResidualRequirementLog: number): PeakValleyPeakLapSupport[] {
    const { lapNumber, peakValleyPeak, depthLog, valleyCellMask } = racingLapValley
    if (!peakValleyPeak 
        || depthLog === null 
        || depthLog <= profileResidualRequirementLog) return []

    return [{ lapNumber, peakValleyPeak, valleyCellMask }]
}

function calculateRacingLapValleyVote(lap: CellAlignedLapSteering, 
    lapSupport: PeakValleyPeakLapSupport | undefined, 
    medianProfileValleyCellIndexes: readonly number[]): RacingLapValleyVote {
    if (!lapSupport || medianProfileValleyCellIndexes.length === 0) {
        return { lapNumber: lap.lapNumber, confidence: 0, isVoteFor: false }
    }
    let supportedCellCount = 0
    let overlappingValleyCellCount = 0
    for (const cellIndex of medianProfileValleyCellIndexes) {
        if (!lap.cornerDetectionSupportedCellMask[cellIndex]) continue
        supportedCellCount++
        if (lapSupport.valleyCellMask[cellIndex]) overlappingValleyCellCount++
    }
    const dataCoverage = supportedCellCount / medianProfileValleyCellIndexes.length
    const valleyOverlap = supportedCellCount === 0 
        ? 0 
        : overlappingValleyCellCount / supportedCellCount
    const confidence = dataCoverage * valleyOverlap
    return { lapNumber: lap.lapNumber, confidence, isVoteFor: confidence > MINIMUM_RACING_LAP_VALLEY_CONFIDENCE }
}

function computeRacingLapValley(lapNumber: number, lapPeakValleyPeak: PeakValleyPeak | null, lap: CellAlignedLapSteering | undefined, cellCount: number): RacingLapValley {
    const emptyValley = { lapNumber, peakValleyPeak: null, depthLog: null, halfDepthStrengthDegrees: null, valleyWidthCellCount: 0, valleyCellMask: Array.from({ length: cellCount }, () => false) }
    if (!lapPeakValleyPeak || !lap) return emptyValley

    const weakerPeakStrengthDegrees = Math.min(lapPeakValleyPeak.leftPeak.steeringStrengthDegrees,
        lapPeakValleyPeak.rightPeak.steeringStrengthDegrees)
    const valleySteeringStrengthLog = Math.log1p(lapPeakValleyPeak.valley.steeringStrengthDegrees)
    const depthLog = Math.log1p(weakerPeakStrengthDegrees) - valleySteeringStrengthLog
    const halfDepthStrengthDegrees = Math.expm1(valleySteeringStrengthLog + depthLog / 2)
    const valleyCellMask = createValleyCellMask(lap, lapPeakValleyPeak, halfDepthStrengthDegrees)
    return { lapNumber, 
        peakValleyPeak: lapPeakValleyPeak, 
        depthLog, 
        halfDepthStrengthDegrees, 
        valleyWidthCellCount: valleyCellMask.filter(Boolean).length, 
        valleyCellMask }
}

function createValleyCellMask(lap: CellAlignedLapSteering, peakValleyPeak: PeakValleyPeak, halfDepthStrengthDegrees: number): boolean[] {
    const valleyCellMask = lap.steeringDegreesByCell.map(() => false)
    const valleyCellIndex = peakValleyPeak.valley.cellIndex
    if (!isAtOrBelowHalfDepth(lap, valleyCellIndex, halfDepthStrengthDegrees)) return valleyCellMask
    valleyCellMask[valleyCellIndex] = true
    const leftDirection = -1
    const rightDirection = 1
    markValleyCellsBelowHalfDepthAsTrue(lap, 
        valleyCellMask, valleyCellIndex, 
        peakValleyPeak.leftPeak.cellIndex, leftDirection, 
        halfDepthStrengthDegrees)
    markValleyCellsBelowHalfDepthAsTrue(lap, 
        valleyCellMask, valleyCellIndex, 
        peakValleyPeak.rightPeak.cellIndex, rightDirection, 
        halfDepthStrengthDegrees)
    return valleyCellMask
}

function markValleyCellsBelowHalfDepthAsTrue(lap: CellAlignedLapSteering, 
    valleyCellMask: boolean[], 
    valleyCellIndex: number, 
    boundaryCellIndex: number, 
    direction: -1 | 1, 
    halfDepthStrengthDegrees: number): void {

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
    return steeringDegrees !== null 
        && steeringDegrees !== undefined 
        && Math.abs(steeringDegrees) <= halfDepthStrengthDegrees
}

function createPeakValleyPeak(reference: LapPeakValleyPeakReference, lap: CellAlignedLapSteering | undefined, cellCenters: readonly number[]): PeakValleyPeak | null {
    const { leftPeakCellIndex, valleyCellIndex, rightPeakCellIndex } = reference
    if (!lap || leftPeakCellIndex === null 
        || valleyCellIndex === null 
        || rightPeakCellIndex === null) return null
    const leftPeak = createSteeringShapeCell(leftPeakCellIndex, lap, cellCenters)
    const valley = createSteeringShapeCell(valleyCellIndex, lap, cellCenters)
    const rightPeak = createSteeringShapeCell(rightPeakCellIndex, lap, cellCenters)
    return leftPeak && valley && rightPeak 
        ? { leftPeak, valley, rightPeak } 
        : null
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
    const lapSteeringGrid = lapSteeringProfile.steeringDegreesByCell
    const numberOfCells = lapSteeringGrid.length
    for (let unwrappedCellIndex = from; unwrappedCellIndex <= to; unwrappedCellIndex++) {
        const cellIndex = (unwrappedCellIndex + numberOfCells) % numberOfCells // (+ numberOfCells) getting rid of negative indices
        const steeringDegrees = lapSteeringGrid[cellIndex]
        if (steeringDegrees === null || steeringDegrees === undefined) continue
        const strength = Math.abs(steeringDegrees)
        if (!localMinimum || strength <= localMinimum.strength) {
            localMinimum = { cellIndex, strength }
        }
    }

    if (localMinimum) return localMinimum.cellIndex
    else return null
}

function findLocalMaximum(lapSteeringProfile: CellAlignedLapSteering, from: number, to: number): number | null {
    let localMaximum: { cellIndex: number, strength: number } | null = null
    const lapSteeringGrid = lapSteeringProfile.steeringDegreesByCell
    const numberOfCells = lapSteeringGrid.length
    for (let unwrappedCellIndex = from; unwrappedCellIndex <= to; unwrappedCellIndex++) {
        const cellIndex = (unwrappedCellIndex + numberOfCells) % numberOfCells // (+ numberOfCells) getting rid of negative indices
        const steeringDegrees = lapSteeringGrid[cellIndex]
        if (steeringDegrees === null || steeringDegrees === undefined) continue
        const strength = Math.abs(steeringDegrees)
        if (!localMaximum || strength >= localMaximum.strength) {
            localMaximum = { cellIndex, strength }
        }
    }

    if (localMaximum) return localMaximum.cellIndex
    else return null
}
