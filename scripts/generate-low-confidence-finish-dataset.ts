import { auditTelemetry } from "../src/analytics/audit-telemetry";
import { normalizeTelemetryPayload } from "../src/analytics/normalize-telemetry";
import type { WireTelemetryPayload } from "../src/analytics/telemetry-types";
import { DEFAULT_FRAME_AUDIT_CONFIG } from "../src/config/frame-audit-config";
import { telemetryPayloadSchema } from "../src/http/schemas/telemetry-payload";

const SOURCE_DATASET_PATH = `${import.meta.dir}/../data/stint.telemetry.json`;
const OUTPUT_DATASET_PATH = `${import.meta.dir}/../data/stint-low-confidence-finish.telemetry.json`;

export const LOW_CONFIDENCE_FINISH_SESSION_ID =
	"d15f0ddc-26fd-4a27-b52e-8d566d786f9f";

const PRE_CROSSING_POSITION_LIMIT = 0.987;
const POST_CROSSING_POSITION = 0.011;
const CROSSING_INTERVAL_MS = 250;

export function createLowConfidenceFinishTelemetryPayload(
	source: WireTelemetryPayload,
): WireTelemetryPayload {
	const crossingFrameIndex = findLastRecordedLapWrapIndex(source);
	const crossingFrame = source.frames[crossingFrameIndex];
	const previousFrame = source.frames[crossingFrameIndex - 1];
	if (!crossingFrame || !previousFrame) {
		throw new RangeError(
			"The source stint does not contain the frames required by the low-confidence finish fixture.",
		);
	}

	const preCrossingFrameIndex = findPreCrossingFrameIndex(
		source,
		crossingFrameIndex,
		previousFrame.lap,
	);
	const preCrossingFrame = source.frames[preCrossingFrameIndex];
	if (!preCrossingFrame) {
		throw new RangeError(
			"The source stint does not contain a suitable pre-crossing frame for the low-confidence finish fixture.",
		);
	}

	const samplingBaseline = auditTelemetry(
		normalizeTelemetryPayload(source),
		DEFAULT_FRAME_AUDIT_CONFIG,
	).samplingBaseline;
	if (samplingBaseline === null) {
		throw new RangeError(
			"The source stint does not contain enough chronological samples to derive its sampling baseline.",
		);
	}
	if (CROSSING_INTERVAL_MS > samplingBaseline.maximumGapMs) {
		throw new RangeError(
			"The synthetic crossing interval exceeds the source stint's maximum continuous sampling gap.",
		);
	}

	const postCrossingContextIndex = source.frames.findIndex(
		(frame, index) =>
			index > crossingFrameIndex &&
			frame.ts - crossingFrame.ts > samplingBaseline.maximumGapMs,
	);
	if (postCrossingContextIndex < 0) {
		throw new RangeError(
			"The source stint does not contain a post-crossing frame outside the local sampling window.",
		);
	}

	const targetCrossingTimestamp = preCrossingFrame.ts + CROSSING_INTERVAL_MS;
	const postCrossingTimestampShift =
		targetCrossingTimestamp - crossingFrame.ts;
	const previousRecordedLapNumber = previousFrame.lap;
	const crossingRecordedLapNumber = crossingFrame.lap;
	const frames = source.frames.flatMap((frame, index) => {
		const insideRemovedPreCrossingWindow =
			index > preCrossingFrameIndex && index < crossingFrameIndex;
		const insideRemovedPostCrossingWindow =
			index > crossingFrameIndex && index < postCrossingContextIndex;
		if (
			insideRemovedPreCrossingWindow ||
			insideRemovedPostCrossingWindow
		) {
			return [];
		}

		if (index < crossingFrameIndex) return [frame];

		return [
			{
				...frame,
				ts: frame.ts + postCrossingTimestampShift,
				lap:
					frame.lap === crossingRecordedLapNumber
						? previousRecordedLapNumber
						: frame.lap,
				pos: index === crossingFrameIndex ? POST_CROSSING_POSITION : frame.pos,
			},
		];
	});

	const removedFrameCount = source.frames.length - frames.length;
	if (removedFrameCount <= 0) {
		throw new RangeError(
			"The low-confidence finish fixture did not remove any source frames.",
		);
	}

	return {
		...source,
		session_id: LOW_CONFIDENCE_FINISH_SESSION_ID,
		note: `Low-confidence finish fixture derived from the supplied stint: ${removedFrameCount} samples around the final recorded lap crossing were removed, the crossing position was observed late, and the recorder lap counter did not advance.`,
		frame_count: frames.length,
		frames,
	};
}

function findLastRecordedLapWrapIndex(source: WireTelemetryPayload): number {
	for (let index = source.frames.length - 1; index > 0; index -= 1) {
		const previous = source.frames[index - 1];
		const current = source.frames[index];
		if (
			previous &&
			current &&
			previous.pos > 0.5 &&
			current.pos < 0.5 &&
			current.lap === previous.lap + 1
		) {
			return index;
		}
	}

	throw new RangeError(
		"The source stint does not contain a confirmed recorded lap wrap.",
	);
}

function findPreCrossingFrameIndex(
	source: WireTelemetryPayload,
	crossingFrameIndex: number,
	recordedLapNumber: number,
): number {
	for (let index = crossingFrameIndex - 1; index >= 0; index -= 1) {
		const frame = source.frames[index];
		if (!frame || frame.lap !== recordedLapNumber) break;
		if (frame.pos <= PRE_CROSSING_POSITION_LIMIT) return index;
	}

	return -1;
}

async function generateLowConfidenceFinishDataset(): Promise<void> {
	const source: unknown = await Bun.file(SOURCE_DATASET_PATH).json();
	const validatedSource = telemetryPayloadSchema.parse(source);
	const payload = createLowConfidenceFinishTelemetryPayload(validatedSource);

	await Bun.write(OUTPUT_DATASET_PATH, `${JSON.stringify(payload, null, 2)}\n`);
	console.log(`Wrote ${payload.frame_count} frames to ${OUTPUT_DATASET_PATH}.`);
}

if (import.meta.main) {
	await generateLowConfidenceFinishDataset();
}
