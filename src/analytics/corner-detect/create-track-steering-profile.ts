import type { DetectedLap } from '../lap-detect/lap-detect-types'
import { median } from '../robust-statistics'
import type { CellAlignedLapSteering, CellAlignedSteering } from './create-cell-aligned-steering'

export interface TrackSteeringProfileCell {
    readonly cellCenter: number
    readonly signedMedianSteeringDegrees: number | null
    readonly unsignedMedianSteeringDegrees: number | null
    readonly lapSupportCount: number
    readonly lapSupportFraction: number
}

export interface TrackSteeringProfile {
    readonly selectedLaps: readonly DetectedLap[]
    readonly cells: readonly TrackSteeringProfileCell[]
}

export function createTrackSteeringProfile(alignedSteering: CellAlignedSteering, detectedLaps: readonly DetectedLap[]): TrackSteeringProfile {
    const selectedLapNumbers = new Set(alignedSteering.laps.map(({ lapNumber }) => lapNumber))
    const cells = alignedSteering.cellCenters.map((cellCenter, cellIndex) => createProfileCell(cellCenter, cellIndex, alignedSteering.laps))

    return { selectedLaps: detectedLaps.filter(({ lapNumber }) => selectedLapNumbers.has(lapNumber)), cells }
}

function createProfileCell(cellCenter: number, cellIndex: number, laps: readonly CellAlignedLapSteering[]): TrackSteeringProfileCell {
    const values = findSupportedSteeringValues(laps, cellIndex)
    return {
        cellCenter,
        signedMedianSteeringDegrees: values.length 
            ? median(values)
            : null,
        unsignedMedianSteeringDegrees: values.length
            ? median(values.map(Math.abs)) 
            : null,
        lapSupportCount: values.length,
        lapSupportFraction: laps.length 
            ? values.length / laps.length 
            : 0,
    }
}

function findSupportedSteeringValues(laps: readonly CellAlignedLapSteering[], cellIndex: number): number[] {
    return laps.flatMap((lap) => {
        const value = lap.steeringDegreesByCell[cellIndex] 
        return value !== null 
            ? [value] 
            : []
    })
}
