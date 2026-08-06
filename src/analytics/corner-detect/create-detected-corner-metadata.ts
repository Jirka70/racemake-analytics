import type { SteeringStrengthProfile } from './create-steering-strength-profile'
import type { DetectedCornerSegment } from './create-detected-corners'

export interface CornerInterval {
    readonly startCellIndex: number
    readonly endCellIndexExclusive: number
    readonly cellIndexes: readonly number[]
    readonly startNormalizedPosition: number
    readonly endNormalizedPosition: number
}

export interface ApexProxy extends CornerInterval {
    readonly peakCellIndex: number
    readonly steeringStrengthThresholdDegrees: number
}

export interface DetectedCorner extends DetectedCornerSegment {
    readonly entry: CornerInterval | null
    readonly apexProxy: ApexProxy
    readonly exit: CornerInterval | null
}

export function calculateApexProxyThreshold(lowThresholdDegrees: number, peakStrengthDegrees: number): number {
    return lowThresholdDegrees + (peakStrengthDegrees - lowThresholdDegrees) / 2
}

export function createDetectedCornerMetadata(corners: readonly DetectedCornerSegment[], profile: SteeringStrengthProfile, lowThresholdDegrees: number): readonly DetectedCorner[] {
    return corners.map((corner) => createCornerMetadata(corner, profile, lowThresholdDegrees))
}

function createCornerMetadata(corner: DetectedCornerSegment, profile: SteeringStrengthProfile, lowThresholdDegrees: number): DetectedCorner {
    const apexProxy = createApexProxy(corner, profile, lowThresholdDegrees)
    const apexProxyStartPosition = corner.cellIndexes.indexOf(apexProxy.startCellIndex)
    const apexProxyEndPositionExclusive = apexProxyStartPosition + apexProxy.cellIndexes.length
    const entry = createCornerInterval(corner.cellIndexes.slice(0, apexProxyStartPosition), profile.cells.length)
    const exit = createCornerInterval(corner.cellIndexes.slice(apexProxyEndPositionExclusive), profile.cells.length)

    return {
        ...corner,
        entry,
        apexProxy,
        exit
    }
}

function createApexProxy(corner: DetectedCornerSegment, profile: SteeringStrengthProfile, lowThresholdDegrees: number): ApexProxy {
    const peakPosition = findPeakPosition(corner, profile)
    const peakCellIndex = corner.cellIndexes[peakPosition]!
    const peakStrengthDegrees = profile.cells[peakCellIndex]!.steeringStrengthDegrees!
    const steeringStrengthThresholdDegrees = calculateApexProxyThreshold(lowThresholdDegrees, peakStrengthDegrees)
    let startPosition = peakPosition
    let endPosition = peakPosition
    while (startPosition > 0 && isAtOrAboveThreshold(corner.cellIndexes[startPosition - 1]!, profile, steeringStrengthThresholdDegrees)) startPosition--
    while (endPosition < corner.cellIndexes.length - 1 && isAtOrAboveThreshold(corner.cellIndexes[endPosition + 1]!, profile, steeringStrengthThresholdDegrees)) endPosition++

    const interval = createCornerInterval(corner.cellIndexes.slice(startPosition, endPosition + 1), profile.cells.length)!
    return {
        ...interval,
        peakCellIndex,
        steeringStrengthThresholdDegrees,
    }
}

function createCornerInterval(cellIndexes: readonly number[], cellCount: number): CornerInterval | null {
    if (cellIndexes.length === 0) return null
    const startCellIndex = cellIndexes[0]!
    const endCellIndexExclusive = (cellIndexes[cellIndexes.length - 1]! + 1) % cellCount
    return {
        startCellIndex,
        endCellIndexExclusive,
        cellIndexes,
        startNormalizedPosition: startCellIndex / cellCount,
        endNormalizedPosition: endCellIndexExclusive / cellCount,
    }
}

function findPeakPosition(corner: DetectedCornerSegment, profile: SteeringStrengthProfile): number {
    let peakPosition = -1
    let peakStrengthDegrees = Number.NEGATIVE_INFINITY
    for (let position = 0; position < corner.cellIndexes.length; position++) {
        const cellIndex = corner.cellIndexes[position]!
        const profileCell = profile.cells[cellIndex]!
        const strengthDegrees = profileCell.steeringStrengthDegrees
        if (strengthDegrees === null || strengthDegrees < peakStrengthDegrees) continue
        peakPosition = position
        peakStrengthDegrees = strengthDegrees
    }
    if (peakPosition === -1) throw new RangeError('Detected corner must contain a supported steering-strength cell')
    return peakPosition
}

function isAtOrAboveThreshold(cellIndex: number, profile: SteeringStrengthProfile, thresholdDegrees: number): boolean {
    const profileSteeringAtCellIndex = profile.cells[cellIndex]
    const strengthDegrees = profileSteeringAtCellIndex?.steeringStrengthDegrees
    return strengthDegrees !== null 
        && strengthDegrees !== undefined 
        && strengthDegrees >= thresholdDegrees
}
