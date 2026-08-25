import type { WireTelemetryPayload } from "../src/analytics/telemetry-types";
import { telemetryPayloadSchema } from "../src/http/schemas/telemetry-payload";

const SOURCE_DATASET_PATH = `${import.meta.dir}/../data/stint.telemetry.json`;
const OUTPUT_DATASET_PATH = `${import.meta.dir}/../data/stint-start-finish-gap.telemetry.json`;

export const START_FINISH_GAP_SESSION_ID =
	"7c516820-8d25-4ef7-9a24-0a413979ab9a";

const GAP_HALF_WINDOW_MS = 2_400;

export function createStartFinishGapTelemetryPayload(
	source: WireTelemetryPayload,
): WireTelemetryPayload {
	const wrapIndexes = findConfirmedLapWrapIndexes(source);
	const targetWrapIndex = wrapIndexes[Math.floor(wrapIndexes.length / 2)];
	const beforeWrap =
		targetWrapIndex === undefined ? undefined : source.frames[targetWrapIndex - 1];
	const afterWrap =
		targetWrapIndex === undefined ? undefined : source.frames[targetWrapIndex];

	if (!beforeWrap || !afterWrap) {
		throw new RangeError(
			"The source stint does not contain an internal confirmed lap crossing.",
		);
	}

	const crossingTimestampMs = (beforeWrap.ts + afterWrap.ts) / 2;
	const gapStartTimestampMs = crossingTimestampMs - GAP_HALF_WINDOW_MS;
	const gapEndTimestampMs = crossingTimestampMs + GAP_HALF_WINDOW_MS;
	const frames = source.frames.filter(
		(frame) =>
			frame.ts <= gapStartTimestampMs || frame.ts >= gapEndTimestampMs,
	);
	const removedFrameCount = source.frames.length - frames.length;
	const frameBeforeGap = frames.findLast(
		(frame) => frame.ts <= gapStartTimestampMs,
	);
	const frameAfterGap = frames.find((frame) => frame.ts >= gapEndTimestampMs);

	if (
		removedFrameCount <= 0 ||
		!frameBeforeGap ||
		!frameAfterGap ||
		frameBeforeGap.pos <= 0.5 ||
		frameAfterGap.pos >= 0.5 ||
		frameBeforeGap.lap === frameAfterGap.lap
	) {
		throw new RangeError(
			"The generated sampling gap does not hide a confirmed start/finish crossing.",
		);
	}

	return {
		...source,
		session_id: START_FINISH_GAP_SESSION_ID,
		note: `Start/finish gap fixture derived from the supplied stint: ${removedFrameCount} consecutive samples around an internal confirmed lap crossing were removed. The recorder lap counter advances across the gap, so the interval remains reviewable but its apparent merged lap time must not be ranked.`,
		frame_count: frames.length,
		frames,
	};
}

function findConfirmedLapWrapIndexes(
	source: WireTelemetryPayload,
): readonly number[] {
	const indexes: number[] = [];

	for (let index = 1; index < source.frames.length; index += 1) {
		const previous = source.frames[index - 1];
		const current = source.frames[index];
		if (
			previous &&
			current &&
			previous.pos > 0.5 &&
			current.pos < 0.5 &&
			current.lap === previous.lap + 1
		) {
			indexes.push(index);
		}
	}

	return indexes;
}

async function generateStartFinishGapDataset(): Promise<void> {
	const source: unknown = await Bun.file(SOURCE_DATASET_PATH).json();
	const validatedSource = telemetryPayloadSchema.parse(source);
	const payload = createStartFinishGapTelemetryPayload(validatedSource);

	await Bun.write(OUTPUT_DATASET_PATH, `${JSON.stringify(payload, null, 2)}\n`);
	console.log(`Wrote ${payload.frame_count} frames to ${OUTPUT_DATASET_PATH}.`);
}

if (import.meta.main) {
	await generateStartFinishGapDataset();
}
