import type {
    CellAlignedRacingLap,
    CellAlignedRacingLapCell,
} from '../../cell-aligned-racing-telemetry-types'
import type {
    CoachingAnalysisRegionId,
    CoachingFindingMetric,
} from '../coaching-phenomenon-types'

type EventPositionMetric = Extract<
    CoachingFindingMetric,
    { readonly kind: 'event-position' }
>

type SpeedMetric = Extract<
    CoachingFindingMetric,
    { readonly kind: 'speed' }
>

export function createEventPositionMetric(
    lap: CellAlignedRacingLap,
    cellIndex: number,
    event: EventPositionMetric['event'],
    regionId: CoachingAnalysisRegionId,
    location: EventPositionMetric['location'],
): EventPositionMetric | null {
    const cell = lap.cells[cellIndex]
    if (!cell) return null

    return {
        kind: 'event-position',
        role: 'evidence',
        event,
        regionId,
        location,
        analyzedPass: {
            lapNumber: lap.lapNumber,
            normalizedTrackPosition: cell.from.normalizedTrackPosition,
        },
    }
}

export function createSpeedMetric(
    analyzedLap: CellAlignedRacingLap,
    fastestRegionPassLap: CellAlignedRacingLap,
    measurement: SpeedMetric['measurement'],
    cellIndexes: readonly number[],
): SpeedMetric | null {
    const analyzedSpeedKmh = calculateMinimumSpeedKmh(
        analyzedLap,
        cellIndexes,
    )
    const fastestRegionPassSpeedKmh = calculateMinimumSpeedKmh(
        fastestRegionPassLap,
        cellIndexes,
    )
    if (
        analyzedSpeedKmh === null
        || fastestRegionPassSpeedKmh === null
    ) {
        return null
    }

    return {
        kind: 'speed',
        role: 'related',
        measurement,
        analyzedPass: {
            lapNumber: analyzedLap.lapNumber,
            speedKmh: analyzedSpeedKmh,
        },
        fastestRegionPass: {
            lapNumber: fastestRegionPassLap.lapNumber,
            speedKmh: fastestRegionPassSpeedKmh,
        },
    }
}

function calculateMinimumSpeedKmh(
    lap: CellAlignedRacingLap,
    cellIndexes: readonly number[],
): number | null {
    if (cellIndexes.length === 0) return null

    let minimumSpeedKmh = Number.POSITIVE_INFINITY
    for (const cellIndex of cellIndexes) {
        const cell = lap.cells[cellIndex]
        if (!cell || !hasUsableSpeedData(cell)) return null
        minimumSpeedKmh = Math.min(minimumSpeedKmh, cell.center.speedKmh)
    }
    return minimumSpeedKmh
}

function hasUsableSpeedData(
    cell: CellAlignedRacingLapCell,
): cell is CellAlignedRacingLapCell & {
    readonly center: CellAlignedRacingLapCell['center'] & {
        readonly speedKmh: number
    }
} {
    return cell.center.speedKmh !== null
        && cell.quality.timelineContinuous
        && !cell.quality.discontinuousChannels.includes('speedKmh')
}
