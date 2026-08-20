import type { WireTelemetryPayload } from "../src/analytics/telemetry-types";
import { telemetryPayloadSchema } from "../src/http/schemas/telemetry-payload";

const SOURCE_DATASET_PATH = `${import.meta.dir}/../data/stint.telemetry.json`;
const OUTPUT_DATASET_PATH = `${import.meta.dir}/../data/stint-single-racing-lap.telemetry.json`;

export const SINGLE_RACING_LAP_SESSION_ID =
	"51ad7fd1-5f7b-4ad6-a6a4-8c189f222271";

const CLOSING_FRAGMENT_END_POSITION = 0.42;
const COMPLETE_LAP_POSITION_TOLERANCE = 0.001;

export function createSingleRacingLapTelemetryPayload(
	source: WireTelemetryPayload,
): WireTelemetryPayload {
	const completeRecordedLapNumber = findFirstCompleteRecordedLapNumber(source);
	const closingFragmentLapNumber = findNextRecordedLapNumber(
		source,
		completeRecordedLapNumber,
	);
	const frames = source.frames.filter(
		(frame) =>
			frame.lap <= completeRecordedLapNumber ||
			(frame.lap === closingFragmentLapNumber &&
				frame.pos <= CLOSING_FRAGMENT_END_POSITION),
	);

	if (
		!frames.some((frame) => frame.lap === completeRecordedLapNumber) ||
		!frames.some((frame) => frame.lap === closingFragmentLapNumber)
	) {
		throw new RangeError(
			"The source stint does not contain the complete lap and closing fragment required by the single-racing-lap fixture.",
		);
	}

	return {
		...source,
		session_id: SINGLE_RACING_LAP_SESSION_ID,
		note: `Single-racing-lap fixture derived from the supplied stint: opening fragment, complete recorded lap ${completeRecordedLapNumber}, and the first 42% of recorded lap ${closingFragmentLapNumber}.`,
		frame_count: frames.length,
		frames,
	};
}

function findFirstCompleteRecordedLapNumber(
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

	const lapNumber = [...positionRangeByLap]
		.filter(
			([, range]) =>
				range.minimum <= COMPLETE_LAP_POSITION_TOLERANCE &&
				range.maximum >= 1 - COMPLETE_LAP_POSITION_TOLERANCE,
		)
		.map(([recordedLapNumber]) => recordedLapNumber)
		.sort((first, second) => first - second)[0];
	if (lapNumber === undefined) {
		throw new RangeError(
			"The source stint does not contain a complete recorded lap for the single-lap fixture.",
		);
	}

	return lapNumber;
}

function findNextRecordedLapNumber(
	source: WireTelemetryPayload,
	completeRecordedLapNumber: number,
): number {
	const nextLapNumber = [...new Set(source.frames.map((frame) => frame.lap))]
		.filter((lapNumber) => lapNumber > completeRecordedLapNumber)
		.sort((first, second) => first - second)[0];
	if (nextLapNumber === undefined) {
		throw new RangeError(
			"The source stint does not contain a closing recorded lap for the single-lap fixture.",
		);
	}

	return nextLapNumber;
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
