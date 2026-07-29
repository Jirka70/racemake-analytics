import { describe, expect, test } from 'bun:test'
import { ZodError } from 'zod'
import { runTelemetryAuditPipeline } from '../../src/application/telemetry-audit-pipeline'
import { DEFAULT_FRAME_AUDIT_CONFIG } from '../../src/config/frame-audit-config'

const stintPath = `${import.meta.dir}/../../data/stint.telemetry.json`

describe('telemetry audit pipeline', () => {
  test('validates, normalizes, and audits the official stint in one pass', async () => {
    const unknownPayload: unknown = await Bun.file(stintPath).json()
    const result = runTelemetryAuditPipeline(
      unknownPayload,
      DEFAULT_FRAME_AUDIT_CONFIG,
    )

    const wireFrames = result.validatedWirePayload.frames
    const normalizedFrames = result.normalizedTelemetry.frames
    const audit = result.auditResult
    const lapDetection = result.lapDetectionResult

    expect(normalizedFrames).toHaveLength(wireFrames.length)
    expect(audit.frameTransitions).toHaveLength(
      normalizedFrames.length - 1,
    )
    expect(audit.timelineTransitions).toHaveLength(
      normalizedFrames.length - 1,
    )
    expect(audit.auditedFrames).toHaveLength(
      normalizedFrames.length,
    )

    expect(
      audit.auditedFrames.every(
        ({ frame }, index) =>
          frame === normalizedFrames[index],
      ),
    ).toBeTrue()

    const unclassifiedOutliers =
      audit.isolatedOutliers.filter((outlier) => {
        const auditedFrame = audit.auditedFrames.find(
          ({ frame }) =>
            frame.sourceIndex === outlier.frame.sourceIndex,
        )
        const classifiedChannels =
          outlier.usability === 'invalid'
            ? auditedFrame?.invalidChannels
            : auditedFrame?.suspectChannels

        return !classifiedChannels?.includes(outlier.channel)
      })

    expect(
      unclassifiedOutliers.map(
        ({ frame, channel }) =>
          `${frame.sourceIndex}:${channel}`,
      ),
    ).toEqual([])

    const nonInvalidSensorOutliers = audit.isolatedOutliers.filter((outlier) => outlier.channel !== 'timestampMs' && outlier.channel !== 'throttleRatio' && outlier.channel !== 'brakeRatio' && outlier.channel !== 'steeringDegrees' && outlier.usability !== 'invalid')

    expect(nonInvalidSensorOutliers).toEqual([])

    const samplingBaseline = audit.samplingBaseline
    const usableTimeline = audit.usableTimeline

    expect(samplingBaseline).not.toBeNull()
    expect(usableTimeline).not.toBeNull()

    if (samplingBaseline === null || usableTimeline === null) {
      throw new Error(
        'The official stint must produce a usable audited timeline',
      )
    }

    expect(new Set(audit.issues.map((issue) => issue.id)).size).toBe(audit.issues.length)
    expect(audit.issues.every((issue) => issue.message.length > 40 && issue.reason.length > 0)).toBeTrue()

    for (const outlier of audit.isolatedOutliers) {
      expect(audit.issues).toContainEqual(expect.objectContaining({
        id: `local-outlier:${outlier.frame.sourceIndex}:${outlier.channel}`,
        code: 'LOCAL_OUTLIER',
        action: outlier.channel === 'timestampMs' ? 'exclude-frame' : outlier.usability === 'invalid' ? 'exclude-channel-value' : 'retain',
        channels: [outlier.channel],
      }))
    }

    for (const finding of audit.channelDiscontinuities) {
      expect(audit.issues).toContainEqual(expect.objectContaining({
        id: `sequence-discontinuity:${finding.previousSourceIndex}:${finding.currentSourceIndex}`,
        code: 'SEQUENCE_DISCONTINUITY',
        action: 'block-channel-transition',
        channels: finding.channels,
      }))
    }

    expect(samplingBaseline.maximumGapMs)
      .toBeGreaterThanOrEqual(samplingBaseline.medianDeltaMs)

    const retainedSourceIndexes = new Set(
      usableTimeline.frames.map(
        ({ frame }) => frame.sourceIndex,
      ),
    )
    const excludedSourceIndexes = new Set(
      usableTimeline.excludedFrames.map(
        ({ frame }) => frame.sourceIndex,
      ),
    )

    expect(
      retainedSourceIndexes.size + excludedSourceIndexes.size,
    ).toBe(normalizedFrames.length)

    expect(
      [...excludedSourceIndexes].filter(
        (sourceIndex) =>
          retainedSourceIndexes.has(sourceIndex),
      ),
    ).toEqual([])

    expect(
      usableTimeline.frames.length,
    ).toBe(
      normalizedFrames.length -
        usableTimeline.excludedFrames.length,
    )

    const inconsistentTransitions =
      usableTimeline.transitions.filter((transition) => {
        if (transition.timeContinuity === 'continuous') {
          return (
            transition.relation !== 'chronological' ||
            transition.timestampDeltaMs >
              samplingBaseline.maximumGapMs
          )
        }

        if (transition.timeContinuity === 'gap') {
          return (
            transition.relation !== 'chronological' ||
            transition.timestampDeltaMs <=
              samplingBaseline.maximumGapMs
          )
        }

        return transition.relation === 'chronological'
      })

    expect(
      inconsistentTransitions.map(
        ({ previous, current }) =>
          `${previous.sourceIndex}:${current.sourceIndex}`,
      ),
    ).toEqual([])

    const unappliedChannelDiscontinuities = audit.channelDiscontinuities.filter((finding) => {
      const transition = usableTimeline.transitions.find((item) => item.previous.sourceIndex === finding.previousSourceIndex && item.current.sourceIndex === finding.currentSourceIndex)
      return !transition || finding.channels.some((channel) => !transition.discontinuousChannels.includes(channel))
    })

    expect(unappliedChannelDiscontinuities).toEqual([])

    for (const transition of usableTimeline.transitions.filter((item) => item.timeContinuity === 'gap')) {
      expect(audit.issues).toContainEqual(expect.objectContaining({
        id: `sampling-gap:${transition.previous.sourceIndex}:${transition.current.sourceIndex}`,
        code: 'SAMPLING_GAP',
        action: 'split-timeline',
        thresholds: { maximumGapMs: samplingBaseline.maximumGapMs },
      }))
    }

    const unblockedUnsafeFrameChannels = usableTimeline.transitions.filter((transition) => {
      const previous = usableTimeline.frames.find((item) => item.frame === transition.previous)
      const current = usableTimeline.frames.find((item) => item.frame === transition.current)
      if (!previous || !current) return true

      const unsafeChannels = [...previous.suspectChannels, ...previous.invalidChannels, ...current.suspectChannels, ...current.invalidChannels]
      return unsafeChannels.some((channel) => channel !== 'timestampMs' && channel !== 'recordedLapNumber' && channel !== 'gear' && !transition.discontinuousChannels.includes(channel))
    })

    expect(unblockedUnsafeFrameChannels).toEqual([])

    expect(
      audit.continuousTimelineSegments.length,
    ).toBeGreaterThan(0)

    const segmentIdBySourceIndex = new Map<number, string>()

    const inconsistentSegments =
      audit.continuousTimelineSegments.filter(
        (segment) =>
          segment.frames.length !== segment.frameCount ||
          segment.frames[0]?.frame.sourceIndex !==
            segment.startSourceIndex ||
          segment.frames.at(-1)?.frame.sourceIndex !==
            segment.endSourceIndex,
      )

    expect(
      inconsistentSegments.map(({ id }) => id),
    ).toEqual([])

    for (const segment of audit.continuousTimelineSegments) {
      for (const { frame } of segment.frames) {
        segmentIdBySourceIndex.set(frame.sourceIndex, segment.id)
      }
    }

    const incorrectlySegmentedTransitions =
      usableTimeline.transitions.filter((transition) => {
        const previousSegmentId = segmentIdBySourceIndex.get(
          transition.previous.sourceIndex,
        )
        const currentSegmentId = segmentIdBySourceIndex.get(
          transition.current.sourceIndex,
        )

        return (
          (previousSegmentId === currentSegmentId) !==
          (transition.timeContinuity === 'continuous')
        )
      })

    expect(
      incorrectlySegmentedTransitions.map(
        ({ previous, current }) =>
          `${previous.sourceIndex}:${current.sourceIndex}`,
      ),
    ).toEqual([])

    expect(
      audit.continuousTimelineSegments.reduce(
        (frameCount, segment) =>
          frameCount + segment.frameCount,
        0,
      ),
    ).toBe(usableTimeline.frames.length)
    expect(normalizedFrames[0]?.sourceIndex).toBe(0)
    expect(normalizedFrames[0]?.tyreCoreTemperatureC.frontLeft).toBe(
      (wireFrames[0]?.tyres.fl ?? Number.NaN) / 10,
    )

    expect(lapDetection.crossings.length).toBeGreaterThanOrEqual(2)
    expect(lapDetection.laps).toHaveLength(
      lapDetection.crossings.length - 1,
    )
    expect(lapDetection.includedRacingLaps.length).toBeGreaterThan(0)
    expect(
      lapDetection.includedRacingLaps.length +
        lapDetection.excludedLaps.length,
    ).toBe(lapDetection.laps.length)
    expect(
      lapDetection.laps.every(
        (lap) =>
          lap.lapTimeMs > 0 &&
          lap.startTimestampMs < lap.finishTimestampMs,
      ),
    ).toBeTrue()
    expect(
      lapDetection.laps.every((lap) =>
        [
          lap.confidence.overall,
          lap.confidence.timing,
          lap.confidence.cornerModel,
          lap.confidence.positionContinuity,
          lap.confidence.steeringContinuity,
          lap.confidence.counterAgreement,
          lap.confidence.counterConsistency,
          ...Object.values(lap.startCrossing.confidence),
          ...Object.values(lap.finishCrossing.confidence),
        ].every(
          (confidence) =>
            confidence >= 0 && confidence <= 1,
        ),
      ),
    ).toBeTrue()
    expect(
      lapDetection.fragments.every(
        (fragment) => fragment.frameCount > 0,
      ),
    ).toBeTrue()
  })

  test('produces the same lap result for repeated processing', async () => {
    const unknownPayload: unknown = await Bun.file(stintPath).json()
    const first = runTelemetryAuditPipeline(
      unknownPayload,
      DEFAULT_FRAME_AUDIT_CONFIG,
    )
    const second = runTelemetryAuditPipeline(
      unknownPayload,
      DEFAULT_FRAME_AUDIT_CONFIG,
    )

    expect(first.lapDetectionResult).toEqual(
      second.lapDetectionResult,
    )
  })

  test('stops at Zod validation for an invalid payload', () => {
    expect(() =>
      runTelemetryAuditPipeline({}, DEFAULT_FRAME_AUDIT_CONFIG),
    ).toThrow(ZodError)
  })
})
