import type {
  AuditedFrame,
  ContinuousTimelineSegment,
  UsableTimeline,
} from '../frame-audit-types'

export function createContinuousTimelineSegments(
  usableTimeline: UsableTimeline,
): ContinuousTimelineSegment[] {
  validateUsableTimeline(usableTimeline)

  const hasTimelineNoFrames =
    usableTimeline.frames.length === 0

  if (hasTimelineNoFrames) {
    return []
  }

  const continuousTimelineSegments:
    ContinuousTimelineSegment[] = []

  let currentSegmentFrames: AuditedFrame[] = [
    usableTimeline.frames[0],
  ]

  for (let transitionIndex = 0;
    transitionIndex < usableTimeline.transitions.length;
    transitionIndex += 1
  ) {
    const transition =
      usableTimeline.transitions[transitionIndex]

    const nextFrame =
      usableTimeline.frames[transitionIndex + 1]

    const isTransitionContinuous = transition.timeContinuity === 'continuous'

    if (isTransitionContinuous) {
      currentSegmentFrames.push(nextFrame)
      continue
    }

    continuousTimelineSegments.push(
      createContinuousTimelineSegment(
        continuousTimelineSegments.length,
        currentSegmentFrames,
      ),
    )

    currentSegmentFrames = [nextFrame]
  }

  continuousTimelineSegments.push(
    createContinuousTimelineSegment(
      continuousTimelineSegments.length,
      currentSegmentFrames,
    ),
  )

  return continuousTimelineSegments
}

function createContinuousTimelineSegment(
  segmentIndex: number,
  auditedFrames: readonly AuditedFrame[],
): ContinuousTimelineSegment {
  const firstFrame = auditedFrames[0].frame
  const lastFrame =
    auditedFrames[auditedFrames.length - 1].frame

  return {
    id: `timeline-segment-${segmentIndex + 1}`,
    frames: Object.freeze([...auditedFrames]),
    startSourceIndex: firstFrame.sourceIndex,
    endSourceIndex: lastFrame.sourceIndex,
    startTimestampMs: firstFrame.timestampMs,
    endTimestampMs: lastFrame.timestampMs,
    frameCount: auditedFrames.length,
  }
}

function validateUsableTimeline(
  usableTimeline: UsableTimeline,
): void {
  const expectedTransitionCount = Math.max(
    0,
    usableTimeline.frames.length - 1,
  )

  if (
    usableTimeline.transitions.length !==
    expectedTransitionCount
  ) {
    throw new RangeError(
      'Usable timeline must contain one transition between every retained frame pair',
    )
  }

  for (
    let transitionIndex = 0;
    transitionIndex < usableTimeline.transitions.length;
    transitionIndex += 1
  ) {
    const transition =
      usableTimeline.transitions[transitionIndex]

    const expectedPrevious =
      usableTimeline.frames[transitionIndex].frame

    const expectedCurrent =
      usableTimeline.frames[transitionIndex + 1].frame

    const connectsExpectedFrames =
      transition.previous === expectedPrevious &&
      transition.current === expectedCurrent

    if (!connectsExpectedFrames) {
      throw new RangeError(
        'Usable timeline transition does not connect its corresponding retained frame pair',
      )
    }
  }
}


