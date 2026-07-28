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

    const samplingBaseline = audit.samplingBaseline
    const usableTimeline = audit.usableTimeline

    expect(samplingBaseline).not.toBeNull()
    expect(usableTimeline).not.toBeNull()

    if (samplingBaseline === null || usableTimeline === null) {
      throw new Error(
        'The official stint must produce a usable audited timeline',
      )
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
        if (transition.continuity === 'continuous') {
          return (
            transition.relation !== 'chronological' ||
            transition.timestampDeltaMs >
              samplingBaseline.maximumGapMs
          )
        }

        if (transition.continuity === 'gap') {
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
          (transition.continuity === 'continuous')
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
  })

  test('stops at Zod validation for an invalid payload', () => {
    expect(() =>
      runTelemetryAuditPipeline({}, DEFAULT_FRAME_AUDIT_CONFIG),
    ).toThrow(ZodError)
  })
})
