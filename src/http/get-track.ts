import type { LinearLapGrid } from '../analytics/lap-detect/lap-detect-types'
import type {
  CornerPhaseRegion,
  CornerTrackRegion,
  StraightTrackRegion,
  TrackRegion,
  UnsupportedTrackRegion,
} from '../analytics/coach/track-region-types'
import type { AnalysisStore } from './analysis-store'
import type {
  CornerPhaseResponse,
  CornerRegionResponse,
  StraightRegionResponse,
  TrackPositionIntervalResponse,
  TrackRegionResponse,
  TrackResponse,
  UnsupportedRegionResponse,
} from './contracts/track'
import { getAnalysis } from './get-analysis'

export function getTrack(
  query: unknown,
  analysisStore: AnalysisStore,
): TrackResponse {
  const { analysisId, analysis } = getAnalysis(query, analysisStore)
  const grid = analysis.lapDetectionResult.linearGrid

  return {
    analysisId,
    sessionId: analysis.normalizedTelemetry.sessionId,
    regions: grid
      ? analysis.coachCallsResult.trackRegions.map((region) =>
          createTrackRegionResponse(region, grid),
        )
      : [],
  }
}

function createTrackRegionResponse(
  region: TrackRegion,
  grid: LinearLapGrid,
): TrackRegionResponse {
  switch (region.type) {
    case 'corner':
      return createCornerRegionResponse(region, grid)
    case 'straight':
      return createStraightRegionResponse(region, grid)
    case 'unsupported':
      return createUnsupportedRegionResponse(region, grid)
  }
}

function createCornerRegionResponse(
  region: CornerTrackRegion,
  grid: LinearLapGrid,
): CornerRegionResponse {
  return {
    type: region.type,
    id: region.id,
    interval: createTrackPositionInterval(region.cellIndexes, grid),
    phases: region.phases.map((phase) =>
      createCornerPhaseResponse(region, phase, grid),
    ),
  }
}

function createCornerPhaseResponse(
  corner: CornerTrackRegion,
  phase: CornerPhaseRegion,
  grid: LinearLapGrid,
): CornerPhaseResponse {
  return {
    id: phase.id,
    phase: phase.phase,
    interval: createTrackPositionInterval(phase.cellIndexes, grid),
    ...(phase.phase === 'apex-proxy'
      ? {
          peakNormalizedTrackPosition: findCellCenterPosition(
            corner.corner.apexProxy.peakCellIndex,
            grid,
          ),
        }
      : {}),
  }
}

function createStraightRegionResponse(
  region: StraightTrackRegion,
  grid: LinearLapGrid,
): StraightRegionResponse {
  return {
    type: region.type,
    id: region.id,
    previousCornerId: region.previousCornerId,
    nextCornerId: region.nextCornerId,
    interval: createTrackPositionInterval(region.cellIndexes, grid),
  }
}

function createUnsupportedRegionResponse(
  region: UnsupportedTrackRegion,
  grid: LinearLapGrid,
): UnsupportedRegionResponse {
  return {
    type: region.type,
    id: region.id,
    interval: createTrackPositionInterval(region.cellIndexes, grid),
  }
}

function createTrackPositionInterval(
  cellIndexes: readonly number[],
  grid: LinearLapGrid,
): TrackPositionIntervalResponse {
  const firstCellIndex = cellIndexes[0]
  const lastCellIndex = cellIndexes.at(-1)
  if (firstCellIndex === undefined || lastCellIndex === undefined) {
    throw new RangeError('Track region must contain at least one cell')
  }

  const startNormalizedTrackPosition = grid.positions[firstCellIndex]
  const endNormalizedTrackPosition = grid.positions[lastCellIndex + 1]
  if (
    startNormalizedTrackPosition === undefined
    || endNormalizedTrackPosition === undefined
  ) {
    throw new RangeError('Track region cell index is outside the lap grid')
  }

  return {
    startNormalizedTrackPosition,
    endNormalizedTrackPosition,
    crossesStartFinishLine:
      cellIndexes.length === grid.cellCount || hasCellIndexWrap(cellIndexes),
  }
}

function findCellCenterPosition(
  cellIndex: number,
  grid: LinearLapGrid,
): number {
  const fromPosition = grid.positions[cellIndex]
  const toPosition = grid.positions[cellIndex + 1]
  if (fromPosition === undefined || toPosition === undefined) {
    throw new RangeError('Track region cell index is outside the lap grid')
  }

  return (fromPosition + toPosition) / 2
}

function hasCellIndexWrap(cellIndexes: readonly number[]): boolean {
  return cellIndexes.some(
    (cellIndex, index) =>
      index > 0 && cellIndex < cellIndexes[index - 1]!,
  )
}
