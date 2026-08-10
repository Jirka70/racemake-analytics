import type { RacingLapRegionTiming, TrackRegionBenchmark, TrackRegionTiming } from './track-region-timing-types'

type ValidRacingLapRegionTiming = RacingLapRegionTiming & { readonly durationMs: number }

export function createTrackRegionBenchmarks(regionTimings: readonly TrackRegionTiming[]): readonly TrackRegionBenchmark[] {
    return regionTimings.map(({ region, racingLapTimings }) => {
        if (region.type === 'unsupported') {
            return { region, fastestObservedTiming: null, slowestObservedTiming: null }
        }

        let fastestObservedTiming: ValidRacingLapRegionTiming | null = null
        let slowestObservedTiming: ValidRacingLapRegionTiming | null = null
        for (const timing of racingLapTimings) {
            if (!isValidRacingLapRegionTiming(timing)) continue
            if (!fastestObservedTiming || isFaster(timing, fastestObservedTiming)) fastestObservedTiming = timing
            if (!slowestObservedTiming || isSlower(timing, slowestObservedTiming)) slowestObservedTiming = timing
        }
        return { region, fastestObservedTiming, slowestObservedTiming }
    })
}

function isValidRacingLapRegionTiming(timing: RacingLapRegionTiming): timing is ValidRacingLapRegionTiming {
    return timing.durationMs !== null && timing.limitations.length === 0
}

function isFaster(candidate: ValidRacingLapRegionTiming, current: ValidRacingLapRegionTiming): boolean {
    return candidate.durationMs < current.durationMs
        || candidate.durationMs === current.durationMs && candidate.lapNumber < current.lapNumber
}

function isSlower(candidate: ValidRacingLapRegionTiming, current: ValidRacingLapRegionTiming): boolean {
    return candidate.durationMs > current.durationMs
        || candidate.durationMs === current.durationMs && candidate.lapNumber < current.lapNumber
}
