import type { DetectedCorner } from '../corner-detect/create-detected-corner-metadata'
import type { CornerPhase, CornerPhaseRegion, CornerTrackRegion, CornerTrackRegionId, StraightTrackRegion, TrackRegion } from './track-region-types'

export function createTrackRegions(corners: readonly DetectedCorner[], cellCount: number): readonly TrackRegion[] {
    if (!Number.isInteger(cellCount) || cellCount <= 0) return []
    if (corners.length === 0) return [{ type: 'unsupported', id: 'U1', cellIndexes: createGridCellIndexes(cellCount) }]

    const cornerRegions = [...corners]
        .sort((first, second) => first.apexProxy.peakCellIndex - second.apexProxy.peakCellIndex || first.startCellIndex - second.startCellIndex)
        .map((corner, cornerIndex) => createCornerRegion(corner, `C${cornerIndex + 1}`))

    return cornerRegions.flatMap((corner, cornerIndex): TrackRegion[] => {
        const nextCorner = cornerRegions[(cornerIndex + 1) % cornerRegions.length]!
        const straight = createStraightRegion(corner, nextCorner, cellCount)
        return straight ? [corner, straight] : [corner]
    })
}

function createCornerRegion(corner: DetectedCorner, id: CornerTrackRegionId): CornerTrackRegion {
    return {
        type: 'corner',
        id,
        corner,
        cellIndexes: corner.cellIndexes,
        phases: createCornerPhaseRegions(corner, id),
    }
}

function createCornerPhaseRegions(corner: DetectedCorner, cornerId: CornerTrackRegionId): CornerPhaseRegion[] {
    const phases: CornerPhaseRegion[] = []
    if (corner.entry) phases.push(createCornerPhaseRegion(cornerId, 'entry', corner.entry.cellIndexes))
    phases.push(createCornerPhaseRegion(cornerId, 'apex-proxy', corner.apexProxy.cellIndexes))
    if (corner.exit) phases.push(createCornerPhaseRegion(cornerId, 'exit', corner.exit.cellIndexes))
    return phases
}

function createCornerPhaseRegion(cornerId: CornerTrackRegionId, phase: CornerPhase, cellIndexes: readonly number[]): CornerPhaseRegion {
    return { id: `${cornerId}-${phase}`, cornerId, phase, cellIndexes }
}

function createStraightRegion(previousCorner: CornerTrackRegion, nextCorner: CornerTrackRegion, cellCount: number): StraightTrackRegion | null {
    const cellIndexes = createCircularCellIndexes(previousCorner.corner.endCellIndexExclusive, nextCorner.corner.startCellIndex, cellCount)
    if (cellIndexes.length === 0) return null
    return {
        type: 'straight',
        id: createStraightRegionId(previousCorner.id, nextCorner.id),
        previousCornerId: previousCorner.id,
        nextCornerId: nextCorner.id,
        cellIndexes,
    }
}

function createStraightRegionId(previousCornerId: CornerTrackRegionId, nextCornerId: CornerTrackRegionId): `${CornerTrackRegionId}-${CornerTrackRegionId}` {
    return `${previousCornerId}-${nextCornerId}`
}

function createCircularCellIndexes(fromCellIndex: number, toCellIndexExclusive: number, cellCount: number): number[] {
    const cellIndexes: number[] = []
    let cellIndex = ((fromCellIndex % cellCount) + cellCount) % cellCount
    const endCellIndex = ((toCellIndexExclusive % cellCount) + cellCount) % cellCount
    while (cellIndex !== endCellIndex && cellIndexes.length < cellCount) {
        cellIndexes.push(cellIndex)
        cellIndex = (cellIndex + 1) % cellCount
    }
    return cellIndexes
}

function createGridCellIndexes(cellCount: number): number[] {
    return Array.from({ length: cellCount }, (_, cellIndex) => cellIndex)
}
