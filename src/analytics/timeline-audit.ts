import type {
  DuplicateFrameFinding,
  SamplingIntervalBaseline,
  TimestampOrderViolation,
} from './audit-telemetry'
import type {
  AuditedFrame,
  AuditedTransition,
  ContinuousSegment,
  ProcessingIssue,
  SamplingGap,
  TelemetryChannel,
} from './frame-audit-types'
import type { NormalizedTelemetryFrame } from './telemetry-types'

function containSameTelemetryValues(
  left: NormalizedTelemetryFrame,
  right: NormalizedTelemetryFrame,
): boolean {
  return (
    left.timestampMs === right.timestampMs &&
    left.recordedLapNumber === right.recordedLapNumber &&
    left.normalizedTrackPosition === right.normalizedTrackPosition &&
    left.speedKmh === right.speedKmh &&
    left.throttleRatio === right.throttleRatio &&
    left.brakeRatio === right.brakeRatio &&
    left.steeringDegrees === right.steeringDegrees &&
    left.gear === right.gear &&
    left.engineRpm === right.engineRpm &&
    left.tyreCoreTemperatureC.frontLeft ===
      right.tyreCoreTemperatureC.frontLeft &&
    left.tyreCoreTemperatureC.frontRight ===
      right.tyreCoreTemperatureC.frontRight &&
    left.tyreCoreTemperatureC.rearLeft ===
      right.tyreCoreTemperatureC.rearLeft &&
    left.tyreCoreTemperatureC.rearRight ===
      right.tyreCoreTemperatureC.rearRight
  )
}

/**
 * Finds consecutive frames with identical telemetry values. `sourceIndex` is
 * intentionally excluded because it identifies an occurrence, not its sample
 * contents. A duplicate run always refers back to its first retained frame.
 */
export function findDuplicateFrames(
  frames: readonly NormalizedTelemetryFrame[],
): readonly DuplicateFrameFinding[] {
  if (frames.length < 2) {
    return Object.freeze([])
  }

  const duplicateFrames: DuplicateFrameFinding[] = []
  let retainedFrame = frames[0]

  for (let index = 1; index < frames.length; index += 1) {
    const currentFrame = frames[index]

    if (containSameTelemetryValues(retainedFrame, currentFrame)) {
      duplicateFrames.push(
        Object.freeze({
          retainedSourceIndex: retainedFrame.sourceIndex,
          duplicateSourceIndex: currentFrame.sourceIndex,
          timestampMs: currentFrame.timestampMs,
        }),
      )
      continue
    }

    retainedFrame = currentFrame
  }

  return Object.freeze(duplicateFrames)
}

export function findTimestampOrderViolations(
  frames: readonly NormalizedTelemetryFrame[],
): readonly TimestampOrderViolation[] {
  const violations: TimestampOrderViolation[] = []

  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1]
    const current = frames[index]
    const durationMs = current.timestampMs - previous.timestampMs

    // Exact duplicate samples have their own, more precise issue category.
    if (
      durationMs === 0 &&
      containSameTelemetryValues(previous, current)
    ) {
      continue
    }

    if (durationMs <= 0) {
      violations.push(
        Object.freeze({
          fromSourceIndex: previous.sourceIndex,
          toSourceIndex: current.sourceIndex,
          previousTimestampMs: previous.timestampMs,
          currentTimestampMs: current.timestampMs,
          durationMs,
          kind:
            durationMs === 0
              ? 'duplicate-timestamp'
              : 'timestamp-regression',
        }),
      )
    }
  }

  return Object.freeze(violations)
}

export function findTimelineIntegrityIssues(
  duplicateFrames: readonly DuplicateFrameFinding[],
  timestampOrderViolations: readonly TimestampOrderViolation[],
  samplingGaps: readonly SamplingGap[],
  samplingBaseline: SamplingIntervalBaseline,
): readonly ProcessingIssue[] {
  const issues: ProcessingIssue[] = []

  for (const duplicate of duplicateFrames) {
    issues.push(
      Object.freeze({
        code: 'DUPLICATE_SAMPLE',
        reason: 'exact-consecutive-duplicate',
        severity: 'error',
        action: 'exclude-frame',
        scope: 'frame',
        sourceIndex: duplicate.duplicateSourceIndex,
        timestampMs: duplicate.timestampMs,
        observed: Object.freeze({
          retainedSourceIndex: duplicate.retainedSourceIndex,
        }),
        message: `Frame ${duplicate.duplicateSourceIndex} duplicates retained frame ${duplicate.retainedSourceIndex}.`,
      }),
    )
  }

  for (const violation of timestampOrderViolations) {
    const duplicateTimestamp =
      violation.kind === 'duplicate-timestamp'

    issues.push(
      Object.freeze({
        code: 'TIME_ORDER_VIOLATION',
        reason: violation.kind,
        severity: 'error',
        action: duplicateTimestamp
          ? 'exclude-frame'
          : 'split-segment',
        scope: duplicateTimestamp ? 'frame' : 'transition',
        sourceIndex: duplicateTimestamp
          ? violation.toSourceIndex
          : violation.fromSourceIndex,
        nextSourceIndex: duplicateTimestamp
          ? undefined
          : violation.toSourceIndex,
        timestampMs: violation.currentTimestampMs,
        observed: Object.freeze({
          previousTimestampMs: violation.previousTimestampMs,
          currentTimestampMs: violation.currentTimestampMs,
          durationMs: violation.durationMs,
        }),
        message: duplicateTimestamp
          ? `Frame ${violation.toSourceIndex} reuses timestamp ${violation.currentTimestampMs} with different telemetry values.`
          : `Timestamp regresses between frames ${violation.fromSourceIndex} and ${violation.toSourceIndex}.`,
      }),
    )
  }

  for (const gap of samplingGaps) {
    issues.push(
      Object.freeze({
        code: 'SAMPLING_GAP',
        reason: 'interval-exceeds-derived-maximum',
        severity: 'warning',
        action: 'retain',
        scope: 'transition',
        sourceIndex: gap.fromSourceIndex,
        nextSourceIndex: gap.toSourceIndex,
        timestampMs: gap.toTimestampMs,
        observed: Object.freeze({
          durationMs: gap.durationMs,
        }),
        thresholds:
          samplingBaseline.maximumGapMs === null
            ? undefined
            : Object.freeze({
                maximumGapMs: samplingBaseline.maximumGapMs,
              }),
        message: `Sampling interval between frames ${gap.fromSourceIndex} and ${gap.toSourceIndex} exceeds the dataset-derived maximum.`,
      }),
    )
  }

  if (samplingBaseline.maximumGapMs === null) {
    issues.push(
      Object.freeze({
        code: 'INSUFFICIENT_BASELINE',
        reason: 'sampling-baseline-too-small',
        severity: 'warning',
        action: 'retain',
        scope: 'dataset',
        observed: Object.freeze({
          positiveDeltaCount:
            samplingBaseline.positiveDeltaCount,
        }),
        message:
          'There are not enough positive timestamp intervals to derive a reliable sampling-gap threshold.',
      }),
    )
  }

  return Object.freeze(issues)
}

const INTERPOLATED_CHANNELS: readonly TelemetryChannel[] =
  Object.freeze([
    'normalizedTrackPosition',
    'speedKmh',
    'throttleRatio',
    'brakeRatio',
    'steeringDegrees',
    'gear',
    'engineRpm',
    'tyreCoreTemperatureC.frontLeft',
    'tyreCoreTemperatureC.frontRight',
    'tyreCoreTemperatureC.rearLeft',
    'tyreCoreTemperatureC.rearRight',
  ])

const DERIVED_VALUE_CHANNELS: readonly TelemetryChannel[] =
  Object.freeze(
    INTERPOLATED_CHANNELS.filter((channel) => channel !== 'gear'),
  )

export function classifyFramePairsAsContinuousGapOrDiscontinuous(
  frames: readonly NormalizedTelemetryFrame[],
  duplicateFrames: readonly DuplicateFrameFinding[],
  timestampOrderViolations: readonly TimestampOrderViolation[],
  samplingGaps: readonly SamplingGap[],
  issues: readonly ProcessingIssue[],
): readonly AuditedTransition[] {
  const duplicateIndexes = new Set(
    duplicateFrames.map((finding) => finding.duplicateSourceIndex),
  )
  const timeViolationPairs = new Set(
    timestampOrderViolations.map(
      (violation) =>
        `${violation.fromSourceIndex}:${violation.toSourceIndex}`,
    ),
  )
  const gapPairs = new Set(
    samplingGaps.map(
      (gap) => `${gap.fromSourceIndex}:${gap.toSourceIndex}`,
    ),
  )
  const transitions: AuditedTransition[] = []

  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1]
    const current = frames[index]
    const pairKey = `${previous.sourceIndex}:${current.sourceIndex}`
    const isDiscontinuous =
      duplicateIndexes.has(current.sourceIndex) ||
      timeViolationPairs.has(pairKey)
    const isGap = !isDiscontinuous && gapPairs.has(pairKey)
    const continuity = isDiscontinuous
      ? 'discontinuous'
      : isGap
        ? 'gap'
        : 'continuous'
    const transitionIssues = issues.filter(
      (issue) =>
        (issue.sourceIndex === previous.sourceIndex &&
          issue.nextSourceIndex === current.sourceIndex) ||
        (issue.code === 'DUPLICATE_SAMPLE' &&
          issue.sourceIndex === current.sourceIndex) ||
        (issue.code === 'TIME_ORDER_VIOLATION' &&
          issue.nextSourceIndex === undefined &&
          issue.sourceIndex === current.sourceIndex),
    )
    const blocksAllChannels = continuity !== 'continuous'

    transitions.push(
      Object.freeze({
        fromSourceIndex: previous.sourceIndex,
        toSourceIndex: current.sourceIndex,
        durationMs: current.timestampMs - previous.timestampMs,
        continuity,
        interpolationBlockedChannels: blocksAllChannels
          ? INTERPOLATED_CHANNELS
          : Object.freeze([]),
        derivativesBlockedChannels: blocksAllChannels
          ? DERIVED_VALUE_CHANNELS
          : Object.freeze([]),
        issues: Object.freeze(transitionIssues),
      }),
    )
  }

  return Object.freeze(transitions)
}

export function splitFramesAtContinuityBreaks(
  frames: readonly AuditedFrame[],
  transitions: readonly AuditedTransition[],
): readonly ContinuousSegment[] {
  const transitionByPair = new Map(
    transitions.map((transition) => [
      `${transition.fromSourceIndex}:${transition.toSourceIndex}`,
      transition,
    ]),
  )
  const segments: ContinuousSegment[] = []
  let segmentStart: AuditedFrame | null = null
  let segmentEnd: AuditedFrame | null = null
  let segmentFrameCount = 0

  const finishSegment = (): void => {
    if (segmentStart === null || segmentEnd === null) {
      return
    }

    segments.push(
      Object.freeze({
        id: `segment-${segments.length + 1}`,
        startSourceIndex: segmentStart.frame.sourceIndex,
        endSourceIndex: segmentEnd.frame.sourceIndex,
        startTimestampMs: segmentStart.frame.timestampMs,
        endTimestampMs: segmentEnd.frame.timestampMs,
        frameCount: segmentFrameCount,
      }),
    )
    segmentStart = null
    segmentEnd = null
    segmentFrameCount = 0
  }

  for (const auditedFrame of frames) {
    if (auditedFrame.disposition === 'rejected') {
      finishSegment()
      continue
    }

    if (segmentEnd !== null) {
      const pairKey = `${segmentEnd.frame.sourceIndex}:${auditedFrame.frame.sourceIndex}`
      const transition = transitionByPair.get(pairKey)

      if (transition?.continuity !== 'continuous') {
        finishSegment()
      }
    }

    segmentStart ??= auditedFrame
    segmentEnd = auditedFrame
    segmentFrameCount += 1
  }

  finishSegment()

  return Object.freeze(segments)
}
