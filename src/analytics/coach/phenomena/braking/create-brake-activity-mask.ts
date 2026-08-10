import type { CellAlignedRacingLapCell, CellAlignedRacingLap } from '../../cell-aligned-racing-telemetry-types'

export function createBrakeActivityMask(lap: CellAlignedRacingLap, highThresholdRatio: number, lowThresholdRatio: number): readonly boolean[] {
    if (lowThresholdRatio > highThresholdRatio) throw new RangeError('Low brake threshold must not exceed high brake threshold')

    const brakeActivityMask = lap.cells.map(() => false)
    const outsideRunCellIndex = lap.cells.findIndex((cell) => isOutsideBrakeActivityRun(cell, lowThresholdRatio))
    if (outsideRunCellIndex === -1) {
        const wholeLapIsBraking = lap.cells.some((cell) => isAboveHighThreshold(cell, highThresholdRatio))
        return brakeActivityMask.map(() => wholeLapIsBraking)
    }

    let runCellIndexes: number[] = []
    let runContainsHighThreshold = false
    for (let offset = 1; offset <= lap.cells.length; offset++) {
        const cellIndex = (outsideRunCellIndex + offset) % lap.cells.length
        const brakeRatio = findUsableBrakeRatio(lap.cells[cellIndex]!)
        if (brakeRatio === null || brakeRatio < lowThresholdRatio) {
            runCellIndexes = []
            runContainsHighThreshold = false
            continue
        }

        runCellIndexes.push(cellIndex)
        if (!runContainsHighThreshold && brakeRatio > highThresholdRatio) {
            runContainsHighThreshold = true
            for (const runCellIndex of runCellIndexes) brakeActivityMask[runCellIndex] = true
        }
        if (runContainsHighThreshold) brakeActivityMask[cellIndex] = true
    }
    return brakeActivityMask
}

function findUsableBrakeRatio(cell: CellAlignedRacingLapCell): number | null {
    if (cell.center.brakeRatio === null || !cell.quality.timelineContinuous) return null
    if (cell.quality.discontinuousChannels.includes('brakeRatio')) return null
    return cell.center.brakeRatio
}

function isOutsideBrakeActivityRun(cell: CellAlignedRacingLapCell, lowThresholdRatio: number): boolean {
    const brakeRatio = findUsableBrakeRatio(cell)
    return brakeRatio === null || brakeRatio < lowThresholdRatio
}

function isAboveHighThreshold(cell: CellAlignedRacingLapCell, highThresholdRatio: number): boolean {
    const brakeRatio = findUsableBrakeRatio(cell)
    return brakeRatio !== null && brakeRatio > highThresholdRatio
}
