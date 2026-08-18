import type { WireTelemetryPayload } from "../src/analytics/telemetry-types";
import { telemetryPayloadSchema } from "../src/http/schemas/telemetry-payload";

const SOURCE_DATASET_PATH = `${import.meta.dir}/../data/stint.telemetry.json`;
const OUTPUT_DATASET_PATH = `${import.meta.dir}/../data/stint-single-racing-lap.telemetry.json`;

export const SINGLE_RACING_LAP_SESSION_ID =
	"51ad7fd1-5f7b-4ad6-a6a4-8c189f222271";

const COMPLETE_RECORDED_LAP_NUMBER = 1;
const CLOSING_FRAGMENT_LAP_NUMBER = 2;
const CLOSING_FRAGMENT_END_POSITION = 0.42;

export function createSingleRacingLapTelemetryPayload(
	source: WireTelemetryPayload,
): WireTelemetryPayload {
	const frames = source.frames.filter(
		(frame) =>
			frame.lap <= COMPLETE_RECORDED_LAP_NUMBER ||
			(frame.lap === CLOSING_FRAGMENT_LAP_NUMBER &&
				frame.pos <= CLOSING_FRAGMENT_END_POSITION),
	);

	if (
		!frames.some((frame) => frame.lap === COMPLETE_RECORDED_LAP_NUMBER) ||
		!frames.some((frame) => frame.lap === CLOSING_FRAGMENT_LAP_NUMBER)
	) {
		throw new RangeError(
			"The source stint does not contain the complete lap and closing fragment required by the single-racing-lap fixture.",
		);
	}

	return {
		...source,
		session_id: SINGLE_RACING_LAP_SESSION_ID,
		note: "Single-racing-lap fixture derived from the supplied stint: opening fragment, complete recorded lap 1, and the first 42% of recorded lap 2.",
		frame_count: frames.length,
		frames,
	};
}

async function generateSingleRacingLapDataset(): Promise<void> {
	const source: unknown = await Bun.file(SOURCE_DATASET_PATH).json();
	const validatedSource = telemetryPayloadSchema.parse(source);
	const payload = createSingleRacingLapTelemetryPayload(validatedSource);

	await Bun.write(OUTPUT_DATASET_PATH, `${JSON.stringify(payload, null, 2)}\n`);
	console.log(`Wrote ${payload.frame_count} frames to ${OUTPUT_DATASET_PATH}.`);
}

if (import.meta.main) {
	await generateSingleRacingLapDataset();
}
