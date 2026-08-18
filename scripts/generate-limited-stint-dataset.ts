import type { WireTelemetryPayload } from "../src/analytics/telemetry-types";
import { telemetryPayloadSchema } from "../src/http/schemas/telemetry-payload";

const SOURCE_DATASET_PATH = `${import.meta.dir}/../data/stint.telemetry.json`;
const OUTPUT_DATASET_PATH = `${import.meta.dir}/../data/stint-limited.telemetry.json`;

export const LIMITED_STINT_SESSION_ID = "4bd69a76-8db8-4c5a-9b74-034153759a28";

const DAMAGED_RECORDED_LAP_NUMBER = 4;
const MISSING_POSITION_FROM = 0.4;
const MISSING_POSITION_TO = 0.44;

export function createLimitedStintTelemetryPayload(
	source: WireTelemetryPayload,
): WireTelemetryPayload {
	const frames = source.frames.filter(
		(frame) =>
			frame.lap !== DAMAGED_RECORDED_LAP_NUMBER ||
			frame.pos < MISSING_POSITION_FROM ||
			frame.pos > MISSING_POSITION_TO,
	);
	const removedFrameCount = source.frames.length - frames.length;
	if (removedFrameCount === 0) {
		throw new RangeError(
			"The source stint does not contain the telemetry window required by the telemetry-gap fixture.",
		);
	}

	return {
		...source,
		session_id: LIMITED_STINT_SESSION_ID,
		note: "Telemetry-gap fixture derived from the supplied stint: a continuous telemetry window was removed from recorded lap 4.",
		frame_count: frames.length,
		frames,
	};
}

async function generateLimitedStintDataset(): Promise<void> {
	const source: unknown = await Bun.file(SOURCE_DATASET_PATH).json();
	const validatedSource = telemetryPayloadSchema.parse(source);
	const payload = createLimitedStintTelemetryPayload(validatedSource);

	await Bun.write(OUTPUT_DATASET_PATH, `${JSON.stringify(payload, null, 2)}\n`);
	console.log(`Wrote ${payload.frame_count} frames to ${OUTPUT_DATASET_PATH}.`);
}

if (import.meta.main) {
	await generateLimitedStintDataset();
}
