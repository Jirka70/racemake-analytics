import { describe, expect, test } from 'bun:test'
import { DEFAULT_FRAME_AUDIT_CONFIG } from '../../src/config/frame-audit-config'
import { createInMemoryAnalysisStore } from '../../src/http/analysis-store'
import { SERIES_CHANNELS } from '../../src/http/contracts/series'
import { getAnalysis } from '../../src/http/get-analysis'
import { getCoaching } from '../../src/http/get-coaching'
import { getDiagnostics } from '../../src/http/get-diagnostics'
import { getIdealLap } from '../../src/http/get-ideal-lap'
import { getSeries } from '../../src/http/get-series'
import { getTimeLoss } from '../../src/http/get-time-loss'
import { getTrack } from '../../src/http/get-track'
import { ingestTelemetryAnalysis } from '../../src/http/ingest-telemetry-analysis'

const stintPath = `${import.meta.dir}/../../data/stint.telemetry.json`

describe('analysis response functions', () => {
  test('build endpoint payloads from one cached analysis', async () => {
    const input: unknown = await Bun.file(stintPath).json()
    const analysisStore = createInMemoryAnalysisStore({
      maximumEntryCount: 5,
    })
    const ingest = ingestTelemetryAnalysis(input, {
      analysisStore,
      frameAuditConfig: DEFAULT_FRAME_AUDIT_CONFIG,
    })
    const query = { analysisId: ingest.analysisId }
    const { analysis } = getAnalysis(query, analysisStore)

    const track = getTrack(query, analysisStore)
    expect(track.analysisId).toBe(ingest.analysisId)
    expect(track.regions).toHaveLength(
      analysis.coachCallsResult.trackRegions.length,
    )
    expect(
      track.regions.every(
        ({ interval }) =>
          interval.startNormalizedTrackPosition >= 0
          && interval.startNormalizedTrackPosition <= 1
          && interval.endNormalizedTrackPosition >= 0
          && interval.endNormalizedTrackPosition <= 1,
      ),
    ).toBeTrue()

    const timeLoss = getTimeLoss(query, analysisStore)
    expect(timeLoss.laps).toHaveLength(
      analysis.coachCallsResult.racingLaps.length,
    )
    expect(timeLoss.fastestLap).not.toBeNull()
    expect(timeLoss.idealLap).not.toBeNull()
    expect(
      timeLoss.laps.every((lap) =>
        lap.regions.every(
          (region) =>
            region.timeLossToFastestObservedPassMs === null
            || region.timeLossToFastestObservedPassMs >= 0,
        ),
      ),
    ).toBeTrue()
    const fastestLapTimeLoss = timeLoss.laps.find(
      (lap) => lap.lapNumber === timeLoss.fastestLap?.lapNumber,
    )
    expect(fastestLapTimeLoss?.timeLossToFastestLapMs).toBe(0)
    expect(fastestLapTimeLoss?.timeLossToIdealLapMs).toBeGreaterThan(0)
    for (const lap of timeLoss.laps) {
      if (lap.timeLossToIdealLapMs === null) continue

      expect(
        lap.timeLossToIdealLapMs
        - (fastestLapTimeLoss?.timeLossToIdealLapMs ?? 0),
      ).toBeCloseTo(lap.timeLossToFastestLapMs, 6)
    }

    const coaching = getCoaching(query, analysisStore)
    expect(coaching.rankedPhenomena.map(({ rank }) => rank)).toEqual(
      coaching.rankedPhenomena.map((_, index) => index + 1),
    )
    expect(coaching.detectorFailures).toEqual(
      analysis.coachCallsResult.coachingPhenomena.detectorFailures,
    )
    expect(
      coaching.rankedPhenomena.every(
        ({ finding }) => finding.metrics.length > 0,
      ),
    ).toBeTrue()

    const alignedLaps =
      analysis.coachCallsResult.cellAlignedRacingTelemetry.laps
    const selectedLapNumbers = alignedLaps
      .slice(0, 2)
      .map((lap) => lap.lapNumber)
    const series = getSeries({
      ...query,
      laps: selectedLapNumbers.join(','),
      channels: SERIES_CHANNELS.join(','),
      positionFrom: '0.18',
      positionTo: '0.26',
    }, analysisStore)

    expect(series.selection).toEqual({
      lapNumbers: selectedLapNumbers,
      channels: SERIES_CHANNELS,
      positionFrom: 0.18,
      positionTo: 0.26,
    })
    expect(series.laps).toHaveLength(selectedLapNumbers.length)
    expect(
      series.grid.normalizedTrackPositions.every(
        (position) => position >= 0.18 && position <= 0.26,
      ),
    ).toBeTrue()
    expect(series.grid.normalizedTrackPositions.length).toBeGreaterThan(0)

    for (const lap of series.laps) {
      const pointCount = series.grid.normalizedTrackPositions.length
      expect(lap.lapElapsedMs).toHaveLength(pointCount)
      expect(lap.channels.speedKmh).toHaveLength(pointCount)
      expect(lap.channels.throttleRatio).toHaveLength(pointCount)
      expect(lap.channels.brakeRatio).toHaveLength(pointCount)
      expect(lap.channels.steeringDegrees).toHaveLength(pointCount)
      expect(lap.channels.gear).toHaveLength(pointCount)
      expect(lap.channels.engineRpm).toHaveLength(pointCount)
      expect(lap.channels.quality?.timelineContinuous).toHaveLength(
        pointCount,
      )
      expect(lap.channels.quality?.unavailableChannels).toHaveLength(
        pointCount,
      )
      expect(
        lap.channels.tyreCoreTemperatureC?.frontLeft,
      ).toHaveLength(pointCount)
      expect(
        lap.channels.tyreCoreTemperatureC?.frontRight,
      ).toHaveLength(pointCount)
      expect(
        lap.channels.tyreCoreTemperatureC?.rearLeft,
      ).toHaveLength(pointCount)
      expect(
        lap.channels.tyreCoreTemperatureC?.rearRight,
      ).toHaveLength(pointCount)
    }

    const defaultSeries = getSeries({
      ...query,
      laps: selectedLapNumbers.join(','),
    }, analysisStore)
    expect(defaultSeries.selection.channels).toEqual([
      'speedKmh',
      'throttleRatio',
      'brakeRatio',
      'steeringDegrees',
    ])
    expect(
      Object.keys(defaultSeries.laps[0]?.channels ?? {}),
    ).toEqual([
      'speedKmh',
      'throttleRatio',
      'brakeRatio',
      'steeringDegrees',
    ])

    const wrappingSeries = getSeries({
      ...query,
      laps: String(selectedLapNumbers[0]),
      channels: 'speedKmh',
      positionFrom: '0.95',
      positionTo: '0.05',
    }, analysisStore)
    const wrappingPositions =
      wrappingSeries.grid.normalizedTrackPositions
    expect(
      wrappingPositions.every(
        (position) => position >= 0.95 || position <= 0.05,
      ),
    ).toBeTrue()
    expect(
      wrappingPositions.some(
        (position, index) => {
          const previousPosition = wrappingPositions[index - 1]
          return previousPosition !== undefined
            && position < previousPosition
        },
      ),
    ).toBeTrue()

    const idealLap = getIdealLap(
      {
        ...query,
        channels: 'speedKmh,brakeRatio',
        positionFrom: '0.18',
        positionTo: '0.26',
      },
      analysisStore,
    )
    expect(idealLap.status).toBe('available')
    if (idealLap.status !== 'available') {
      throw new TypeError('Expected an available ideal lap')
    }

    expect(idealLap.durationMs).toBeCloseTo(
      timeLoss.idealLap?.durationMs ?? 0,
      6,
    )
    expect(idealLap.regionSources).toHaveLength(
      analysis.coachCallsResult.trackRegions.length,
    )
    expect(idealLap.selection).toEqual({
      channels: ['speedKmh', 'brakeRatio'],
      positionFrom: 0.18,
      positionTo: 0.26,
    })
    expect(
      idealLap.grid.normalizedTrackPositions.every(
        (position) => position >= 0.18 && position <= 0.26,
      ),
    ).toBeTrue()
    expect(idealLap.lapElapsedMs).toHaveLength(
      idealLap.grid.normalizedTrackPositions.length,
    )
    expect(idealLap.channels.speedKmh).toHaveLength(
      idealLap.grid.normalizedTrackPositions.length,
    )
    expect(idealLap.channels.brakeRatio).toHaveLength(
      idealLap.grid.normalizedTrackPositions.length,
    )
    expect(Object.keys(idealLap.channels)).toEqual(['speedKmh', 'brakeRatio'])
    const availableIdealElapsedMs = idealLap.lapElapsedMs.filter(
      (elapsedMs): elapsedMs is number => elapsedMs !== null,
    )
    expect(availableIdealElapsedMs.length).toBeGreaterThan(0)
    expect(
      availableIdealElapsedMs.every((elapsedMs, index) => {
        const previousElapsedMs = availableIdealElapsedMs[index - 1]
        return previousElapsedMs === undefined || elapsedMs > previousElapsedMs
      }),
    ).toBeTrue()

    const diagnostics = getDiagnostics(query, analysisStore)
    expect(diagnostics.frameAudit.receivedFrameCount).toBe(
      analysis.validatedWirePayload.frames.length,
    )
    expect(
      diagnostics.frameAudit.retainedTimelineFrameCount
      + diagnostics.frameAudit.excludedTimelineFrameCount,
    ).toBe(analysis.validatedWirePayload.frames.length)
    expect(diagnostics.frameAudit.issues).toHaveLength(
      analysis.auditResult.issues.length,
    )
  })
})
