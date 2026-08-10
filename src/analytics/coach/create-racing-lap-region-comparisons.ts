import type { RacingLapRegionComparison, RacingLapRegionComparisonIndex, RacingLapRegionTiming, TrackRegionBenchmark, TrackRegionTiming } from './track-region-timing-types'
import type { TrackRegion } from './track-region-types'

type ValidRacingLapRegionTiming = RacingLapRegionTiming & { readonly durationMs: number }

export function createRacingLapRegionComparisonIndex(trackRegionTimings: readonly TrackRegionTiming[], trackRegionBenchmarks: readonly TrackRegionBenchmark[]): RacingLapRegionComparisonIndex {
    const benchmarkByTrackRegionId = new Map(trackRegionBenchmarks.map((benchmark) => [benchmark.region.id, benchmark]))
    const byLapNumber = new Map<number, Map<TrackRegion['id'], RacingLapRegionComparison>>()

    for (const { region, racingLapTimings } of trackRegionTimings) {
        const benchmark = benchmarkByTrackRegionId.get(region.id)
        if (!benchmark || !isValidTiming(benchmark.fastestObservedTiming) || !isValidTiming(benchmark.slowestObservedTiming)) continue

        for (const comparedTiming of racingLapTimings) {
            if (!isValidTiming(comparedTiming)) continue
            const comparisonsByTrackRegionId = byLapNumber.get(comparedTiming.lapNumber) ?? new Map()
            comparisonsByTrackRegionId.set(region.id, createComparison(comparedTiming, benchmark.fastestObservedTiming, benchmark.slowestObservedTiming))
            byLapNumber.set(comparedTiming.lapNumber, comparisonsByTrackRegionId)
        }
    }
    return { byLapNumber }
}

export function findRacingLapRegionComparison(index: RacingLapRegionComparisonIndex, lapNumber: number, trackRegionId: TrackRegion['id']): RacingLapRegionComparison | null {
    return index.byLapNumber.get(lapNumber)?.get(trackRegionId) ?? null
}

function createComparison(comparedTiming: ValidRacingLapRegionTiming, fastestObservedTiming: ValidRacingLapRegionTiming, slowestObservedTiming: ValidRacingLapRegionTiming): RacingLapRegionComparison {
    return {
        trackRegionId: comparedTiming.trackRegionId,
        comparedLapNumber: comparedTiming.lapNumber,
        comparedLapRegionDurationMs: comparedTiming.durationMs,
        fastestObserved: createObservedPassComparison(comparedTiming, fastestObservedTiming),
        slowestObserved: createObservedPassComparison(comparedTiming, slowestObservedTiming),
    }
}

function createObservedPassComparison(comparedTiming: ValidRacingLapRegionTiming, observedTiming: ValidRacingLapRegionTiming) {
    return {
        lapNumber: observedTiming.lapNumber,
        regionDurationMs: observedTiming.durationMs,
        comparedLapMinusObservedPassMs: comparedTiming.durationMs - observedTiming.durationMs,
    }
}

function isValidTiming(timing: RacingLapRegionTiming | null): timing is ValidRacingLapRegionTiming {
    return timing !== null && timing.durationMs !== null && timing.limitations.length === 0
}
