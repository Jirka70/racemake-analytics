import type {
  CellAlignedRacingLap,
  CellAlignedRacingLapCell,
} from '../analytics/coach/cell-aligned-racing-telemetry-types'
import type { TrackRegion } from '../analytics/coach/track-region-types'
import type { LinearLapGrid } from '../analytics/lap-detect/lap-detect-types'
import type { AnalysisStore } from './analysis-store'
import type {
  IdealLapLimitationResponse,
  IdealLapRegionSourceResponse,
  IdealLapSeriesResponse,
} from './contracts/ideal-lap'
import type {
  SeriesChannel,
  SeriesChannelDataResponse,
  TyreCoreTemperatureSeriesResponse,
} from './contracts/series'
import { getAnalysisById, parseAnalysisQuery } from './get-analysis'
import { idealLapQuerySchema } from './schemas/ideal-lap-query'

const DEFAULT_IDEAL_LAP_CHANNELS: readonly SeriesChannel[] = [
  'speedKmh',
  'throttleRatio',
  'brakeRatio',
  'steeringDegrees',
]

interface IdealLapRegionSource {
  readonly region: TrackRegion
  readonly lap: CellAlignedRacingLap
  readonly durationMs: number
}

interface IdealLapTimeline {
  readonly lapElapsedMs: readonly (number | null)[]
  readonly durationMs: number
}

interface UnpositionedIdealLapSegment {
  readonly cellIndexes: readonly number[]
  readonly sourceLap: CellAlignedRacingLap
  readonly sourceStartElapsedMs: number
  readonly sourceEndElapsedMs: number
  readonly requestedDurationMs: number
}

export function getIdealLap(
  query: unknown,
  analysisStore: AnalysisStore,
): IdealLapSeriesResponse {
  const idealLapQuery = parseAnalysisQuery(query, idealLapQuerySchema)
  const { analysisId, analysis } = getAnalysisById(
    idealLapQuery.analysisId,
    analysisStore,
  )
  const responseContext = {
    analysisId,
    sessionId: analysis.normalizedTelemetry.sessionId,
  }
  const grid = analysis.lapDetectionResult.linearGrid
  if (!grid) {
    return createUnavailableResponse(responseContext, [
      {
        code: 'TRACK_GRID_UNAVAILABLE',
        message: 'The ideal lap cannot be built without a reliable track grid.',
      },
    ])
  }

  const { cellAlignedRacingTelemetry, trackRegions, trackRegionBenchmarks } =
    analysis.coachCallsResult
  const lapsByNumber = new Map(
    cellAlignedRacingTelemetry.laps.map((lap) => [lap.lapNumber, lap]),
  )
  const benchmarkByRegionId = new Map(
    trackRegionBenchmarks.map((benchmark) => [benchmark.region.id, benchmark]),
  )
  const sourceLimitations: IdealLapLimitationResponse[] = []
  const regionSources: IdealLapRegionSource[] = []

  for (const region of trackRegions) {
    const fastestObservedTiming = benchmarkByRegionId.get(
      region.id,
    )?.fastestObservedTiming
    if (!fastestObservedTiming || fastestObservedTiming.durationMs === null) {
      sourceLimitations.push({
        code: 'FASTEST_OBSERVED_REGION_PASS_UNAVAILABLE',
        message: `No reliable quickest observed pass is available for ${region.id}.`,
        regionId: region.id,
      })
      continue
    }

    const sourceLap = lapsByNumber.get(fastestObservedTiming.lapNumber)
    if (!sourceLap) {
      sourceLimitations.push({
        code: 'IDEAL_LAP_SOURCE_UNAVAILABLE',
        message: `The source telemetry for the quickest ${region.id} pass is unavailable.`,
        regionId: region.id,
      })
      continue
    }

    regionSources.push({
      region,
      lap: sourceLap,
      durationMs: fastestObservedTiming.durationMs,
    })
  }

  if (sourceLimitations.length > 0) {
    return createUnavailableResponse(responseContext, sourceLimitations)
  }

  const idealCells = createIdealLapCells(regionSources, grid.cellCount)
  if (!idealCells) {
    return createUnavailableResponse(responseContext, [
      {
        code: 'IDEAL_LAP_TRACK_COVERAGE_INCOMPLETE',
        message:
          'The quickest region passes do not cover the complete lap exactly once.',
      },
    ])
  }

  const expectedDurationMs = regionSources.reduce(
    (total, source) => total + source.durationMs,
    0,
  )
  const timeline = createIdealLapTimeline(
    regionSources,
    grid.cellCount,
    expectedDurationMs,
  )
  if (!timeline) {
    return createUnavailableResponse(responseContext, [
      {
        code: 'IDEAL_LAP_TIMELINE_UNAVAILABLE',
        message:
          'A continuous time axis cannot be built from the quickest region passes.',
      },
    ])
  }

  const selectedChannels: readonly SeriesChannel[] =
    idealLapQuery.channels ?? DEFAULT_IDEAL_LAP_CHANNELS
  const positionFrom = idealLapQuery.positionFrom ?? 0
  const positionTo = idealLapQuery.positionTo ?? 1
  const normalizedTrackPositions = idealCells.map(
    (cell) => cell.center.normalizedTrackPosition,
  )
  const selectedCellIndexes = selectPositionIndexes(
    normalizedTrackPositions,
    positionFrom,
    positionTo,
  )

  return {
    ...responseContext,
    status: 'available',
    durationMs: expectedDurationMs,
    basis: 'fastest-observed-pass-per-region',
    selection: {
      channels: selectedChannels,
      positionFrom,
      positionTo,
    },
    grid: {
      normalizedTrackPositions: selectValues(
        normalizedTrackPositions,
        selectedCellIndexes,
      ),
    },
    lapElapsedMs: selectValues(timeline.lapElapsedMs, selectedCellIndexes),
    channels: createChannelDataResponse(
      selectValues(idealCells, selectedCellIndexes),
      selectedChannels,
    ),
    regionSources: regionSources.map((source) =>
      createRegionSourceResponse(source, grid),
    ),
  }
}

function createIdealLapCells(
  regionSources: readonly IdealLapRegionSource[],
  cellCount: number,
): readonly CellAlignedRacingLapCell[] | null {
  const idealCells: Array<CellAlignedRacingLapCell | undefined> = Array.from({
    length: cellCount,
  })

  for (const source of regionSources) {
    for (const cellIndex of source.region.cellIndexes) {
      if (
        !Number.isInteger(cellIndex) ||
        cellIndex < 0 ||
        cellIndex >= cellCount ||
        idealCells[cellIndex] !== undefined
      ) {
        return null
      }

      const sourceCell = source.lap.cells[cellIndex]
      if (!sourceCell) return null
      idealCells[cellIndex] = sourceCell
    }
  }

  return idealCells.every(
    (cell): cell is CellAlignedRacingLapCell => cell !== undefined,
  )
    ? idealCells
    : null
}

function createIdealLapTimeline(
  regionSources: readonly IdealLapRegionSource[],
  cellCount: number,
  expectedDurationMs: number,
): IdealLapTimeline | null {
  if (expectedDurationMs <= 0) return null

  const segments: UnpositionedIdealLapSegment[] = []
  for (const source of regionSources) {
    const runs = splitContinuousCellIndexRuns(source.region.cellIndexes)
    const sourceRuns = runs.map((cellIndexes) =>
      createSourceRun(cellIndexes, source.lap),
    )
    if (sourceRuns.some((run) => run === null)) return null

    const validRuns = sourceRuns.filter(
      (run): run is Omit<UnpositionedIdealLapSegment, 'requestedDurationMs'> =>
        run !== null,
    )
    const sourceDurationMs = validRuns.reduce(
      (total, run) => total + run.sourceEndElapsedMs - run.sourceStartElapsedMs,
      0,
    )
    if (sourceDurationMs <= 0) return null

    for (const run of validRuns) {
      const runDurationMs = run.sourceEndElapsedMs - run.sourceStartElapsedMs
      segments.push({
        ...run,
        requestedDurationMs:
          source.durationMs * (runDurationMs / sourceDurationMs),
      })
    }
  }

  segments.sort(
    (first, second) =>
      (first.cellIndexes[0] ?? -1) - (second.cellIndexes[0] ?? -1),
  )
  const requestedDurationMs = segments.reduce(
    (total, segment) => total + segment.requestedDurationMs,
    0,
  )
  if (requestedDurationMs <= 0) return null

  const durationScale = expectedDurationMs / requestedDurationMs
  const lapElapsedMs: Array<number | null> = Array.from(
    { length: cellCount },
    () => null,
  )
  let idealStartElapsedMs = 0

  for (const segment of segments) {
    const sourceDurationMs =
      segment.sourceEndElapsedMs - segment.sourceStartElapsedMs
    const idealDurationMs = segment.requestedDurationMs * durationScale

    for (const cellIndex of segment.cellIndexes) {
      const sourceElapsedMs =
        segment.sourceLap.cells[cellIndex]?.center.lapElapsedMs ?? null
      if (sourceElapsedMs === null) continue

      const progress = clamp(
        (sourceElapsedMs - segment.sourceStartElapsedMs) / sourceDurationMs,
        0,
        1,
      )
      lapElapsedMs[cellIndex] = idealStartElapsedMs + progress * idealDurationMs
    }

    idealStartElapsedMs += idealDurationMs
  }

  return {
    lapElapsedMs,
    durationMs: expectedDurationMs,
  }
}

function splitContinuousCellIndexRuns(
  cellIndexes: readonly number[],
): readonly (readonly number[])[] {
  const runs: number[][] = []

  for (const cellIndex of cellIndexes) {
    const currentRun = runs.at(-1)
    const previousCellIndex = currentRun?.at(-1)
    if (
      !currentRun ||
      previousCellIndex === undefined ||
      cellIndex < previousCellIndex
    ) {
      runs.push([cellIndex])
      continue
    }

    currentRun.push(cellIndex)
  }

  return runs
}

function createSourceRun(
  cellIndexes: readonly number[],
  sourceLap: CellAlignedRacingLap,
): Omit<UnpositionedIdealLapSegment, 'requestedDurationMs'> | null {
  const firstCellIndex = cellIndexes[0]
  const lastCellIndex = cellIndexes.at(-1)
  if (firstCellIndex === undefined || lastCellIndex === undefined) return null

  const sourceStartElapsedMs =
    sourceLap.cells[firstCellIndex]?.from.lapElapsedMs ?? null
  const sourceEndElapsedMs =
    sourceLap.cells[lastCellIndex]?.to.lapElapsedMs ?? null
  if (
    sourceStartElapsedMs === null ||
    sourceEndElapsedMs === null ||
    sourceEndElapsedMs <= sourceStartElapsedMs
  ) {
    return null
  }

  return {
    cellIndexes,
    sourceLap,
    sourceStartElapsedMs,
    sourceEndElapsedMs,
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function createRegionSourceResponse(
  source: IdealLapRegionSource,
  grid: LinearLapGrid,
): IdealLapRegionSourceResponse {
  return {
    regionId: source.region.id,
    sourceLapNumber: source.lap.lapNumber,
    sourceDurationMs: source.durationMs,
    interval: createTrackPositionInterval(source.region.cellIndexes, grid),
  }
}

function createTrackPositionInterval(
  cellIndexes: readonly number[],
  grid: LinearLapGrid,
): IdealLapRegionSourceResponse['interval'] {
  const firstCellIndex = cellIndexes[0]
  const lastCellIndex = cellIndexes.at(-1)
  if (firstCellIndex === undefined || lastCellIndex === undefined) {
    throw new RangeError('Track region must contain at least one cell')
  }

  const startNormalizedTrackPosition = grid.positions[firstCellIndex]
  const endNormalizedTrackPosition = grid.positions[lastCellIndex + 1]
  if (
    startNormalizedTrackPosition === undefined ||
    endNormalizedTrackPosition === undefined
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

function hasCellIndexWrap(cellIndexes: readonly number[]): boolean {
  return cellIndexes.some((cellIndex, index) => {
    const previousCellIndex = cellIndexes[index - 1]
    return previousCellIndex !== undefined && cellIndex < previousCellIndex
  })
}

function selectPositionIndexes(
  positions: readonly number[],
  positionFrom: number,
  positionTo: number,
): readonly number[] {
  if (positionFrom <= positionTo) {
    return positions.flatMap((position, index) =>
      position >= positionFrom && position <= positionTo ? [index] : [],
    )
  }

  const beforeFinish = positions.flatMap((position, index) =>
    position >= positionFrom ? [index] : [],
  )
  const afterStart = positions.flatMap((position, index) =>
    position <= positionTo ? [index] : [],
  )

  return [...beforeFinish, ...afterStart]
}

function createChannelDataResponse(
  cells: readonly CellAlignedRacingLapCell[],
  selectedChannels: readonly SeriesChannel[],
): SeriesChannelDataResponse {
  const channels = new Set(selectedChannels)

  return {
    ...(channels.has('speedKmh')
      ? { speedKmh: cells.map((cell) => cell.center.speedKmh) }
      : {}),
    ...(channels.has('throttleRatio')
      ? { throttleRatio: cells.map((cell) => cell.center.throttleRatio) }
      : {}),
    ...(channels.has('brakeRatio')
      ? { brakeRatio: cells.map((cell) => cell.center.brakeRatio) }
      : {}),
    ...(channels.has('steeringDegrees')
      ? { steeringDegrees: cells.map((cell) => cell.center.steeringDegrees) }
      : {}),
    ...(channels.has('gear')
      ? { gear: cells.map((cell) => cell.center.gear) }
      : {}),
    ...(channels.has('engineRpm')
      ? { engineRpm: cells.map((cell) => cell.center.engineRpm) }
      : {}),
    ...(channels.has('tyreCoreTemperatureC')
      ? { tyreCoreTemperatureC: createTyreTemperatureSeries(cells) }
      : {}),
    ...(channels.has('quality')
      ? {
          quality: {
            timelineContinuous: cells.map(
              (cell) => cell.quality.timelineContinuous,
            ),
            unavailableChannels: cells.map(
              (cell) => cell.quality.discontinuousChannels,
            ),
          },
        }
      : {}),
  }
}

function createTyreTemperatureSeries(
  cells: readonly CellAlignedRacingLapCell[],
): TyreCoreTemperatureSeriesResponse {
  return {
    frontLeft: cells.map(
      (cell) => cell.center.tyreCoreTemperatureC?.frontLeft ?? null,
    ),
    frontRight: cells.map(
      (cell) => cell.center.tyreCoreTemperatureC?.frontRight ?? null,
    ),
    rearLeft: cells.map(
      (cell) => cell.center.tyreCoreTemperatureC?.rearLeft ?? null,
    ),
    rearRight: cells.map(
      (cell) => cell.center.tyreCoreTemperatureC?.rearRight ?? null,
    ),
  }
}

function selectValues<Value>(
  values: readonly Value[],
  selectedIndexes: readonly number[],
): readonly Value[] {
  return selectedIndexes.map((index) => {
    const value = values[index]
    if (value === undefined) {
      throw new RangeError(
        `Selected ideal lap index ${index} is outside the available values`,
      )
    }

    return value
  })
}

function createUnavailableResponse(
  context: {
    readonly analysisId: IdealLapSeriesResponse['analysisId']
    readonly sessionId: string
  },
  limitations: readonly IdealLapLimitationResponse[],
): IdealLapSeriesResponse {
  return {
    ...context,
    status: 'unavailable',
    limitations,
  }
}
