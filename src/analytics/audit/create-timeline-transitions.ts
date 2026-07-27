import { FrameTransition, FrameTransitionRelation, TimelineTransition } from "../frame-audit-types";
import { NormalizedTelemetryFrame } from "../telemetry-types";

export function createTimelineTransitions(frameTransitions: FrameTransition[]) : TimelineTransition[] {
    const timelineTransitions: TimelineTransition[] = []
    
    for (const frameTransition of frameTransitions) {
        const relation: FrameTransitionRelation = createFrameTransitionRelation(frameTransition)
        const timelineTransition: TimelineTransition = {
            ...frameTransition,
            relation
        }
        
        timelineTransitions.push(timelineTransition)
    }

    return timelineTransitions
} 

function createFrameTransitionRelation(transition: FrameTransition): FrameTransitionRelation {
    if (transition.timestampDeltaMs < 0) {
        return 'timestamp-regression'
    }

    if (transition.timestampDeltaMs > 0) {
        return 'chronological'
    }

    if (hasFrameSameValues(transition.previous, transition.current)) {
        return 'exact-duplicate'
    }

    return 'same-timestamp-conflict'
}

function hasFrameSameValues(first: NormalizedTelemetryFrame, second: NormalizedTelemetryFrame): boolean {
    const firstValues = telemetryValues(first)
    const secondValues = telemetryValues(second)
    
    return firstValues.every(
      (value, index) => value === secondValues[index],
    )
  }

function telemetryValues(frame: NormalizedTelemetryFrame): readonly number[] {
    return [
      frame.timestampMs,
      frame.recordedLapNumber,
      frame.normalizedTrackPosition,
      frame.speedKmh,
      frame.throttleRatio,
      frame.brakeRatio,
      frame.steeringDegrees,
      frame.gear,
      frame.engineRpm,
      frame.tyreCoreTemperatureC.frontLeft,
      frame.tyreCoreTemperatureC.frontRight,
      frame.tyreCoreTemperatureC.rearLeft,
      frame.tyreCoreTemperatureC.rearRight,
    ]
  }
