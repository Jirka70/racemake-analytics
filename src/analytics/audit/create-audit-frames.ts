import { AuditedFrame, IsolatedChannelOutlier, TelemetryChannel } from "../frame-audit-types";
import { NormalizedTelemetryFrame } from "../telemetry-types";

interface FrameChannelClassification {
  readonly suspectChannels: Set<TelemetryChannel>
  readonly invalidChannels: Set<TelemetryChannel>
}

export function createAuditedFrames(frames: NormalizedTelemetryFrame[], outliers: IsolatedChannelOutlier[]) : AuditedFrame[] {
    const classificationsBySourceIndex = classifyFrameChannels(outliers)

    return frames.map((frame) => {
        const classification = classificationsBySourceIndex.get(frame.sourceIndex)

        if (!classification) return createFrameWithoutIssues(frame)
         
        return {
            frame,
            suspectChannels: [...classification.suspectChannels].sort(),
            invalidChannels: [...classification.invalidChannels].sort()
        }
    })
}

function classifyFrameChannels(outliers: IsolatedChannelOutlier[]) : Map<number, FrameChannelClassification> {
    const classifications = new Map<number, FrameChannelClassification>()

    for (const outlier of outliers) {
        const sourceIndex = outlier.frame.sourceIndex
        let classification = classifications.get(sourceIndex)

        if (!classification) {
            classification = {
                suspectChannels: new Set(),
                invalidChannels: new Set()
            }
        }

        classifications.set(sourceIndex, classification)

        if (outlier.usability === "invalid") {
            classification.invalidChannels.add(outlier.channel)
            classification.suspectChannels.delete(outlier.channel)
            continue
        }

        if (!classification.invalidChannels.has(outlier.channel)) {
            classification.suspectChannels.add(outlier.channel)
        }
    }

    return classifications
}

function createFrameWithoutIssues(
    frame: NormalizedTelemetryFrame,
): AuditedFrame {
    return {
        frame,
        suspectChannels: [],
        invalidChannels: [],
    }
}