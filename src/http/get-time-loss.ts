import type { DetectedLap } from '../analytics/lap-detect/lap-detect-types'
import type {
  RacingLapRegionTiming,
  TrackRegionBenchmark,
  TrackRegionTiming,
} from '../analytics/coach/track-region-timing-types'
import type { TrackRegion } from '../analytics/coach/track-region-types'
import type { AnalysisStore } from './analysis-store'
import type {
  LapTimeLossResponse,
  RegionTimeLossResponse,
  TimeLossLimitationResponse,
  TimeLossResponse,
} from './contracts/time-loss'
import { getAnalysis } from './get-analysis'

interface CreateLapTimeLossResponseInput {
  readonly lap: DetectedLap
  readonly fastestLapTimeMs: number
  readonly trackRegions: readonly TrackRegion[]
  readonly timingByRegionId: ReadonlyMap<
    TrackRegion['id'],
    RacingLapRegionTiming
  >
  readonly benchmarkByRegionId: ReadonlyMap<
    TrackRegion['id'],
    TrackRegionBenchmark
  >
}

export function getTimeLoss(
  query: unknown,
  analysisStore: AnalysisStore,
): TimeLossResponse {
  const { analysisId, analysis } = getAnalysis(query, analysisStore)
  const {
    racingLaps,
    trackRegions,
    trackRegionTimings,
    trackRegionBenchmarks,
  } = analysis.coachCallsResult
  const timingIndex = createTimingIndex(trackRegionTimings)
  const benchmarkByRegionId = new Map(
    trackRegionBenchmarks.map((benchmark) => [
      benchmark.region.id,
      benchmark,
    ]),
  )
  const fastestLap = findFastestLap(racingLaps)
  const idealLapDurationMs = calculateIdealLapDurationMs(
    trackRegions,
    benchmarkByRegionId,
  )

  return {
    analysisId,
    sessionId: analysis.normalizedTelemetry.sessionId,
    fastestLap: fastestLap
      ? {
          lapNumber: fastestLap.lapNumber,
          lapTimeMs: fastestLap.lapTimeMs,
        }
      : null,
    idealLap: idealLapDurationMs === null
      ? null
      : {
          durationMs: idealLapDurationMs,
          basis: 'fastest-observed-pass-per-region',
        },
    laps: racingLaps.map((lap) =>
      createLapTimeLossResponse({
        lap,
        fastestLapTimeMs: fastestLap?.lapTimeMs ?? lap.lapTimeMs,
        trackRegions,
        timingByRegionId: timingIndex.get(lap.lapNumber) ?? new Map(),
        benchmarkByRegionId,
      }),
    ),
  }
}

function createTimingIndex(
  trackRegionTimings: readonly TrackRegionTiming[],
): ReadonlyMap<
  number,
  ReadonlyMap<TrackRegion['id'], RacingLapRegionTiming>
> {
  const index = new Map<
    number,
    Map<TrackRegion['id'], RacingLapRegionTiming>
  >()

  for (const { racingLapTimings } of trackRegionTimings) {
    for (const timing of racingLapTimings) {
      const timingsByRegionId = index.get(timing.lapNumber) ?? new Map()
      timingsByRegionId.set(timing.trackRegionId, timing)
      index.set(timing.lapNumber, timingsByRegionId)
    }
  }

  return index
}

function createLapTimeLossResponse(
  input: CreateLapTimeLossResponseInput,
): LapTimeLossResponse {
  let cumulativeTimeLossMs = 0
  let isCumulativeTimeLossAvailable = true
  const regions = input.trackRegions.map((region): RegionTimeLossResponse => {
    const regionTimeLoss = createRegionTimeLossResponse(
      region,
      input.timingByRegionId.get(region.id),
      input.benchmarkByRegionId.get(region.id),
    )

    if (
      regionTimeLoss.timeLossToFastestObservedPassMs === null
      || !isCumulativeTimeLossAvailable
    ) {
      isCumulativeTimeLossAvailable = false
      return {
        ...regionTimeLoss,
        cumulativeTimeLossToIdealLapMs: null,
      }
    }

    cumulativeTimeLossMs +=
      regionTimeLoss.timeLossToFastestObservedPassMs
    return {
      ...regionTimeLoss,
      cumulativeTimeLossToIdealLapMs: cumulativeTimeLossMs,
    }
  })
  const isTimeLossToIdealLapAvailable = regions.every(
    (region) =>
      region.timeLossToFastestObservedPassMs !== null,
  )

  return {
    lapNumber: input.lap.lapNumber,
    lapTimeMs: input.lap.lapTimeMs,
    timeLossToFastestLapMs:
      input.lap.lapTimeMs - input.fastestLapTimeMs,
    timeLossToIdealLapMs: isTimeLossToIdealLapAvailable
      ? regions.reduce(
          (total, region) =>
            total
            + (region.timeLossToFastestObservedPassMs ?? 0),
          0,
        )
      : null,
    regions,
  }
}

function createRegionTimeLossResponse(
  region: TrackRegion,
  timing: RacingLapRegionTiming | undefined,
  benchmark: TrackRegionBenchmark | undefined,
): Omit<RegionTimeLossResponse, 'cumulativeTimeLossToIdealLapMs'> {
  const limitations: TimeLossLimitationResponse[] = []
  if (!timing) {
    limitations.push({
      code: 'REGION_TIMING_UNAVAILABLE',
      message: `Timing for ${region.id} is unavailable on this lap.`,
    })
  } else {
    limitations.push(
      ...timing.limitations.map((limitation) => ({
        code: limitation.code,
        message: `The ${limitation.boundary} boundary time for ${region.id} is unavailable.`,
      })),
    )
  }

  const fastestObservedTiming = benchmark?.fastestObservedTiming ?? null
  const fastestObservedDurationMs = fastestObservedTiming?.durationMs ?? null
  if (fastestObservedDurationMs === null) {
    limitations.push({
      code: 'FASTEST_OBSERVED_REGION_PASS_UNAVAILABLE',
      message: `No reliable fastest observed pass is available for ${region.id}.`,
    })
  }

  const regionDurationMs = timing?.durationMs ?? null
  const timeLossToFastestObservedPassMs =
    regionDurationMs !== null
    && timing?.limitations.length === 0
    && fastestObservedDurationMs !== null
      ? regionDurationMs - fastestObservedDurationMs
      : null

  return {
    regionId: region.id,
    regionDurationMs,
    fastestObservedPass:
      fastestObservedTiming && fastestObservedDurationMs !== null
        ? {
            lapNumber: fastestObservedTiming.lapNumber,
            durationMs: fastestObservedDurationMs,
          }
        : null,
    timeLossToFastestObservedPassMs,
    limitations,
  }
}

function findFastestLap(
  racingLaps: readonly DetectedLap[],
): DetectedLap | null {
  return [...racingLaps].sort(
    (first, second) =>
      first.lapTimeMs - second.lapTimeMs
      || first.lapNumber - second.lapNumber,
  )[0] ?? null
}

function calculateIdealLapDurationMs(
  trackRegions: readonly TrackRegion[],
  benchmarkByRegionId: ReadonlyMap<
    TrackRegion['id'],
    TrackRegionBenchmark
  >,
): number | null {
  let durationMs = 0

  for (const region of trackRegions) {
    const fastestObservedDurationMs = benchmarkByRegionId
      .get(region.id)
      ?.fastestObservedTiming
      ?.durationMs
    if (
      fastestObservedDurationMs === null
      || fastestObservedDurationMs === undefined
    ) {
      return null
    }

    durationMs += fastestObservedDurationMs
  }

  return trackRegions.length > 0 ? durationMs : null
}
