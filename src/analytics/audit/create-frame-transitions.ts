import { FrameTransition } from "../frame-audit-types"
import { NormalizedTelemetryFrame } from "../telemetry-types"


export function createFrameTransitions(frames: readonly NormalizedTelemetryFrame[]) : FrameTransition[] {
    const transitions = []

    for (let i = 1; i < frames.length; i++) {
        const current = frames[i]
        const previous = frames[i - 1]
        const durationMs = current.timestampMs - previous.timestampMs
        const transition = {
            current,
            previous,
            timestampDeltaMs: durationMs
        }
        transitions.push(transition)
    }

    return transitions
}