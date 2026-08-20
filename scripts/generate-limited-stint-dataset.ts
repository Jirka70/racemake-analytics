import type { WireTelemetryPayload } from "../src/analytics/telemetry-types";
import { telemetryPayloadSchema } from "../src/http/schemas/telemetry-payload";

const SOURCE_DATASET_PATH = `${import.meta.dir}/../data/stint.telemetry.json`;
const OUTPUT_DATASET_PATH = `${import.meta.dir}/../data/stint-limited.telemetry.json`;

export const LIMITED_STINT_SESSION_ID = "4bd69a76-8db8-4c5a-9b74-034153759a28";

const SYNTHETIC_GAP_POSITION_FROM = 0.4;
const SYNTHETIC_GAP_POSITION_TO = 0.44;
const COMPLETE_LAP_POSITION_TOLERANCE = 0.001;

export function createLimitedStintTelemetryPayload(
	source: WireTelemetryPayload,
): WireTelemetryPayload {
	const damagedRecordedLapNumber = findLastCompleteRecordedLapNumber(source);
	const frames = source.frames.filter(
		(frame) =>
			frame.lap !== damagedRecordedLapNumber ||
			frame.pos < SYNTHETIC_GAP_POSITION_FROM ||
			frame.pos > SYNTHETIC_GAP_POSITION_TO,
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
		note: `Telemetry-gap fixture derived from the supplied stint: a continuous telemetry window was removed from recorded lap ${damagedRecordedLapNumber}.`,
		frame_count: frames.length,
		frames,
	};
}

function findLastCompleteRecordedLapNumber(
	source: WireTelemetryPayload,
): number {
	const positionRangeByLap = new Map<
		number,
		{ minimum: number; maximum: number }
	>();

	for (const frame of source.frames) {
		const range = positionRangeByLap.get(frame.lap);
		positionRangeByLap.set(frame.lap, {
			minimum: Math.min(range?.minimum ?? frame.pos, frame.pos),
			maximum: Math.max(range?.maximum ?? frame.pos, frame.pos),
		});
	}

	const completeLapNumbers = [...positionRangeByLap]
		.filter(
			([, range]) =>
				range.minimum <= COMPLETE_LAP_POSITION_TOLERANCE &&
				range.maximum >= 1 - COMPLETE_LAP_POSITION_TOLERANCE,
		)
		.map(([lapNumber]) => lapNumber)
		.sort((first, second) => first - second);
	const lapNumber = completeLapNumbers.at(-1);
	if (lapNumber === undefined) {
		throw new RangeError(
			"The source stint does not contain a complete recorded lap for the telemetry-gap fixture.",
		);
	}

	return lapNumber;
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
