import type { CellAlignedRacingLap, CellAlignedRacingTelemetry } from './cell-aligned-racing-telemetry-types'
import type { RacingLapRegionTiming, TrackRegionTiming, TrackRegionTimingLimitation } from './track-region-timing-types'
import type { TrackRegion } from './track-region-types'

export function createTrackRegionTimings(regions: readonly TrackRegion[], telemetry: CellAlignedRacingTelemetry): readonly TrackRegionTiming[] {
    return regions.map((region) => ({
        region,
        racingLapTimings: telemetry.laps.map((lap) => createRacingLapRegionTiming(region, lap)),
    }))
}

function createRacingLapRegionTiming(region: TrackRegion, lap: CellAlignedRacingLap): RacingLapRegionTiming {
    const startCellIndex = region.cellIndexes[0]!
    const endCellIndex = region.cellIndexes[region.cellIndexes.length - 1]!
    const startCell = lap.cells[startCellIndex]
    const endCell = lap.cells[endCellIndex]
    const startLapElapsedMs = startCell?.from.lapElapsedMs ?? null
    const endLapElapsedMs = endCell?.to.lapElapsedMs ?? null
    const limitations = createBoundaryTimeLimitations(startCellIndex, endCellIndex, startLapElapsedMs, endLapElapsedMs)

    if (startLapElapsedMs === null || endLapElapsedMs === null) {
        return { lapNumber: lap.lapNumber, trackRegionId: region.id, durationMs: null, limitations }
    }

    const hasTrackRegionCrossedTheFinishLine = hasCrossedFinishLine(region.cellIndexes)
    const durationMs = hasTrackRegionCrossedTheFinishLine
        ? lap.lapTimeMs - startLapElapsedMs + endLapElapsedMs
        : endLapElapsedMs - startLapElapsedMs

    return { lapNumber: lap.lapNumber,
        trackRegionId: region.id, 
        durationMs, 
        limitations }
}

function createBoundaryTimeLimitations(startCellIndex: number, endCellIndex: number, startLapElapsedMs: number | null, endLapElapsedMs: number | null): TrackRegionTimingLimitation[] {
    const limitations: TrackRegionTimingLimitation[] = []
    if (startLapElapsedMs === null) {
        limitations.push({ code: 'MISSING_REGION_BOUNDARY_TIME', boundary: 'start', cellIndex: startCellIndex })   
    }

    if (endLapElapsedMs === null) {
        limitations.push({ code: 'MISSING_REGION_BOUNDARY_TIME', boundary: 'end', cellIndex: endCellIndex })
    } 

    return limitations
}

function hasCrossedFinishLine(cellIndexes: readonly number[]): boolean {
    for (let position = 1; position < cellIndexes.length; position++) {
        const previousCellIndex = cellIndexes[position - 1]!
        const currentCellIndex = cellIndexes[position]!
        if (currentCellIndex < previousCellIndex) return true
    }

    return false
}
