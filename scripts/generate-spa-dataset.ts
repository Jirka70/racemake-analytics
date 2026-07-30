import type {
	WireTelemetryFrame,
	WireTelemetryPayload,
} from "../src/analytics/telemetry-types";

const DEFAULT_SEED = 0x5a7a_2026;
const TRACK_LENGTH_METERS = 7_004;
const PROFILE_RESOLUTION = 20_000;
const START_TIMESTAMP_MS = 43;

interface SpeedControlPoint {
	readonly position: number;
	readonly speedKmh: number;
}

interface TurnModel {
	readonly number: number;
	readonly name: string;
	readonly centerPosition: number;
	readonly width: number;
	readonly direction: "left" | "right";
	readonly steeringAmplitudeDeg: number;
}

interface LapProfile {
	readonly lapNumber: number;
	readonly cumulativeTimeMs: readonly number[];
	readonly lapTimeMs: number;
}

interface MovingSegment {
	readonly lapNumber: number;
	readonly startPosition: number;
	readonly endPosition: number;
	readonly sessionStartTimeMs: number;
	readonly sessionEndTimeMs: number;
	readonly profile: LapProfile;
}

interface MutableTyreTemperatures {
	frontLeft: number;
	frontRight: number;
	rearLeft: number;
	rearRight: number;
}

const SPEED_CONTROL_POINTS: readonly SpeedControlPoint[] = Object.freeze([
	{ position: 0, speedKmh: 155 },
	{ position: 0.018, speedKmh: 72 },
	{ position: 0.05, speedKmh: 145 },
	{ position: 0.095, speedKmh: 230 },
	{ position: 0.13, speedKmh: 220 },
	{ position: 0.18, speedKmh: 255 },
	{ position: 0.28, speedKmh: 278 },
	{ position: 0.315, speedKmh: 138 },
	{ position: 0.337, speedKmh: 125 },
	{ position: 0.357, speedKmh: 155 },
	{ position: 0.385, speedKmh: 200 },
	{ position: 0.405, speedKmh: 105 },
	{ position: 0.445, speedKmh: 165 },
	{ position: 0.48, speedKmh: 220 },
	{ position: 0.525, speedKmh: 185 },
	{ position: 0.56, speedKmh: 200 },
	{ position: 0.61, speedKmh: 245 },
	{ position: 0.645, speedKmh: 145 },
	{ position: 0.668, speedKmh: 150 },
	{ position: 0.705, speedKmh: 155 },
	{ position: 0.74, speedKmh: 185 },
	{ position: 0.79, speedKmh: 230 },
	{ position: 0.86, speedKmh: 272 },
	{ position: 0.89, speedKmh: 255 },
	{ position: 0.94, speedKmh: 275 },
	{ position: 0.974, speedKmh: 95 },
	{ position: 0.99, speedKmh: 88 },
	{ position: 1, speedKmh: 155 },
]);

/**
 * The turn positions are intentionally approximate. They create a recognizable
 * Spa-like signal while keeping the fixture independent of a surveyed racing
 * line or copied real telemetry.
 */
export const SPA_TURN_MODEL: readonly TurnModel[] = Object.freeze([
	{
		number: 1,
		name: "La Source",
		centerPosition: 0.018,
		width: 0.011,
		direction: "right",
		steeringAmplitudeDeg: 25,
	},
	{
		number: 2,
		name: "Eau Rouge",
		centerPosition: 0.098,
		width: 0.008,
		direction: "left",
		steeringAmplitudeDeg: 7,
	},
	{
		number: 3,
		name: "Raidillon right",
		centerPosition: 0.113,
		width: 0.008,
		direction: "right",
		steeringAmplitudeDeg: 8,
	},
	{
		number: 4,
		name: "Raidillon left",
		centerPosition: 0.132,
		width: 0.01,
		direction: "left",
		steeringAmplitudeDeg: 5,
	},
	{
		number: 5,
		name: "Les Combes right",
		centerPosition: 0.315,
		width: 0.009,
		direction: "right",
		steeringAmplitudeDeg: 14,
	},
	{
		number: 6,
		name: "Les Combes left",
		centerPosition: 0.337,
		width: 0.008,
		direction: "left",
		steeringAmplitudeDeg: 15,
	},
	{
		number: 7,
		name: "Malmedy",
		centerPosition: 0.357,
		width: 0.009,
		direction: "right",
		steeringAmplitudeDeg: 11,
	},
	{
		number: 8,
		name: "Bruxelles",
		centerPosition: 0.405,
		width: 0.014,
		direction: "right",
		steeringAmplitudeDeg: 23,
	},
	{
		number: 9,
		name: "No Name",
		centerPosition: 0.445,
		width: 0.011,
		direction: "left",
		steeringAmplitudeDeg: 12,
	},
	{
		number: 10,
		name: "Pouhon first",
		centerPosition: 0.515,
		width: 0.017,
		direction: "left",
		steeringAmplitudeDeg: 12,
	},
	{
		number: 11,
		name: "Pouhon second",
		centerPosition: 0.545,
		width: 0.017,
		direction: "left",
		steeringAmplitudeDeg: 11,
	},
	{
		number: 12,
		name: "Fagnes right",
		centerPosition: 0.645,
		width: 0.011,
		direction: "right",
		steeringAmplitudeDeg: 15,
	},
	{
		number: 13,
		name: "Fagnes left",
		centerPosition: 0.668,
		width: 0.01,
		direction: "left",
		steeringAmplitudeDeg: 15,
	},
	{
		number: 14,
		name: "Campus",
		centerPosition: 0.705,
		width: 0.012,
		direction: "right",
		steeringAmplitudeDeg: 15,
	},
	{
		number: 15,
		name: "Stavelot",
		centerPosition: 0.74,
		width: 0.013,
		direction: "right",
		steeringAmplitudeDeg: 12,
	},
	{
		number: 16,
		name: "Paul Frere",
		centerPosition: 0.785,
		width: 0.014,
		direction: "right",
		steeringAmplitudeDeg: 7,
	},
	{
		number: 17,
		name: "Blanchimont",
		centerPosition: 0.885,
		width: 0.016,
		direction: "left",
		steeringAmplitudeDeg: 6,
	},
	{
		number: 18,
		name: "Bus Stop right",
		centerPosition: 0.974,
		width: 0.009,
		direction: "right",
		steeringAmplitudeDeg: 19,
	},
	{
		number: 19,
		name: "Bus Stop left",
		centerPosition: 0.99,
		width: 0.008,
		direction: "left",
		steeringAmplitudeDeg: 21,
	},
]);

class DeterministicRandom {
	private state: number;

	constructor(seed: number) {
		this.state = seed >>> 0;
	}

	next(): number {
		let value = this.state;
		value ^= value << 13;
		value ^= value >>> 17;
		value ^= value << 5;
		this.state = value >>> 0;
		return this.state / 0x1_0000_0000;
	}

	centered(amplitude: number): number {
		return (this.next() * 2 - 1) * amplitude;
	}
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, decimalPlaces: number): number {
	const scale = 10 ** decimalPlaces;
	const rounded = Math.round(value * scale) / scale;
	return Object.is(rounded, -0) ? 0 : rounded;
}

function gaussian(value: number, width: number): number {
	return Math.exp(-0.5 * (value / width) ** 2);
}

function circularDifference(position: number, center: number): number {
	const rawDifference = position - center;
	if (rawDifference > 0.5) return rawDifference - 1;
	if (rawDifference < -0.5) return rawDifference + 1;
	return rawDifference;
}

function baseSpeedKmh(position: number): number {
	for (let index = 0; index < SPEED_CONTROL_POINTS.length - 1; index += 1) {
		const start = SPEED_CONTROL_POINTS[index];
		const end = SPEED_CONTROL_POINTS[index + 1];
		if (
			!start ||
			!end ||
			position < start.position ||
			position > end.position
		) {
			continue;
		}

		const fraction =
			(position - start.position) / (end.position - start.position);
		const easedFraction = (1 - Math.cos(Math.PI * fraction)) / 2;
		return start.speedKmh + (end.speedKmh - start.speedKmh) * easedFraction;
	}

	return SPEED_CONTROL_POINTS.at(-1)?.speedKmh ?? 155;
}

function speedForLapKmh(position: number, lapNumber: number): number {
	const lapScale =
		lapNumber === 1
			? 0.992
			: lapNumber === 2
				? 1.01
				: lapNumber === 3
					? 0.999
					: lapNumber === 4
						? 1.002
						: lapNumber === 5
							? 0.97
							: 0.985;

	let localPenaltyKmh = 0;

	if (lapNumber === 1) {
		localPenaltyKmh += 8 * gaussian(circularDifference(position, 0.525), 0.028);
	}

	if (lapNumber === 3) {
		localPenaltyKmh +=
			31 * gaussian(circularDifference(position, 0.414), 0.027);
		localPenaltyKmh +=
			18 * gaussian(circularDifference(position, 0.666), 0.022);
	}

	if (lapNumber === 4) {
		localPenaltyKmh += 7 * gaussian(circularDifference(position, 0.978), 0.018);
	}

	return clamp(baseSpeedKmh(position) * lapScale - localPenaltyKmh, 58, 290);
}

function steeringDegrees(position: number, lapNumber: number): number {
	const gain =
		lapNumber === 1
			? 1.02
			: lapNumber === 2
				? 0.97
				: lapNumber === 3
					? 1.04
					: 1;
	const positionShift = (lapNumber - 2) * 0.00025;
	let steering = 0.16;

	for (const turn of SPA_TURN_MODEL) {
		const direction = turn.direction === "left" ? -1 : 1;
		const distance = circularDifference(
			position,
			turn.centerPosition + positionShift,
		);
		steering +=
			direction *
			turn.steeringAmplitudeDeg *
			gain *
			gaussian(distance, turn.width);
	}

	steering +=
		0.16 * Math.sin(2 * Math.PI * (position * 131 + lapNumber * 0.19));

	return steering;
}

function createLapProfile(lapNumber: number): LapProfile {
	const cumulativeTimeMs = new Array<number>(PROFILE_RESOLUTION + 1).fill(0);

	for (let index = 1; index <= PROFILE_RESOLUTION; index += 1) {
		const startPosition = (index - 1) / PROFILE_RESOLUTION;
		const endPosition = index / PROFILE_RESOLUTION;
		const averageSpeedMetersPerSecond =
			(speedForLapKmh(startPosition, lapNumber) +
				speedForLapKmh(endPosition, lapNumber)) /
			2 /
			3.6;
		const distanceMeters = TRACK_LENGTH_METERS / PROFILE_RESOLUTION;
		const previousTime = cumulativeTimeMs[index - 1] ?? 0;
		cumulativeTimeMs[index] =
			previousTime + (distanceMeters / averageSpeedMetersPerSecond) * 1_000;
	}

	return {
		lapNumber,
		cumulativeTimeMs,
		lapTimeMs: cumulativeTimeMs.at(-1) ?? 0,
	};
}

function timeAtPositionMs(profile: LapProfile, position: number): number {
	const scaledPosition = clamp(position, 0, 1) * PROFILE_RESOLUTION;
	const lowerIndex = Math.floor(scaledPosition);
	const upperIndex = Math.min(PROFILE_RESOLUTION, lowerIndex + 1);
	const fraction = scaledPosition - lowerIndex;
	const lowerTime = profile.cumulativeTimeMs[lowerIndex] ?? 0;
	const upperTime = profile.cumulativeTimeMs[upperIndex] ?? lowerTime;
	return lowerTime + (upperTime - lowerTime) * fraction;
}

function positionAtTimeMs(profile: LapProfile, elapsedMs: number): number {
	let low = 0;
	let high = PROFILE_RESOLUTION;

	while (low < high) {
		const middle = Math.floor((low + high) / 2);
		const middleTime = profile.cumulativeTimeMs[middle] ?? 0;
		if (middleTime < elapsedMs) {
			low = middle + 1;
		} else {
			high = middle;
		}
	}

	const upperIndex = Math.min(PROFILE_RESOLUTION, low);
	const lowerIndex = Math.max(0, upperIndex - 1);
	const lowerTime = profile.cumulativeTimeMs[lowerIndex] ?? 0;
	const upperTime = profile.cumulativeTimeMs[upperIndex] ?? lowerTime;
	const fraction =
		upperTime === lowerTime
			? 0
			: (elapsedMs - lowerTime) / (upperTime - lowerTime);

	return clamp((lowerIndex + fraction) / PROFILE_RESOLUTION, 0, 1);
}

function createMovingSegments(): readonly MovingSegment[] {
	const ranges = [
		{ lapNumber: 0, startPosition: 0.36, endPosition: 1 },
		{ lapNumber: 1, startPosition: 0, endPosition: 1 },
		{ lapNumber: 2, startPosition: 0, endPosition: 1 },
		{ lapNumber: 3, startPosition: 0, endPosition: 1 },
		{ lapNumber: 4, startPosition: 0, endPosition: 1 },
		{ lapNumber: 5, startPosition: 0, endPosition: 0.28 },
	] as const;

	const segments: MovingSegment[] = [];
	let sessionTimeMs = 0;

	for (const range of ranges) {
		const profile = createLapProfile(range.lapNumber);
		const durationMs =
			timeAtPositionMs(profile, range.endPosition) -
			timeAtPositionMs(profile, range.startPosition);
		const segment: MovingSegment = {
			...range,
			sessionStartTimeMs: sessionTimeMs,
			sessionEndTimeMs: sessionTimeMs + durationMs,
			profile,
		};
		segments.push(segment);
		sessionTimeMs = segment.sessionEndTimeMs;
	}

	return segments;
}

function locateSegment(
	segments: readonly MovingSegment[],
	sessionElapsedMs: number,
): MovingSegment | null {
	return (
		segments.find(
			(segment, index) =>
				sessionElapsedMs >= segment.sessionStartTimeMs &&
				(sessionElapsedMs < segment.sessionEndTimeMs ||
					(index === segments.length - 1 &&
						sessionElapsedMs <= segment.sessionEndTimeMs)),
		) ?? null
	);
}

function deriveDriverInputs(
	position: number,
	lapNumber: number,
): { readonly throttle: number; readonly brake: number } {
	const epsilon = 0.0002;
	const previousPosition = (position - epsilon + 1) % 1;
	const nextPosition = (position + epsilon) % 1;
	const speedMetersPerSecond = speedForLapKmh(position, lapNumber) / 3.6;
	const speedGradientPerMeter =
		(speedForLapKmh(nextPosition, lapNumber) -
			speedForLapKmh(previousPosition, lapNumber)) /
		3.6 /
		(2 * epsilon * TRACK_LENGTH_METERS);
	const accelerationMetersPerSecondSquared =
		speedMetersPerSecond * speedGradientPerMeter;

	if (accelerationMetersPerSecondSquared < -2.2) {
		return {
			throttle: 0,
			brake: clamp((-accelerationMetersPerSecondSquared - 1.2) / 9, 0.05, 1),
		};
	}

	if (accelerationMetersPerSecondSquared < -0.35) {
		return {
			throttle: clamp(
				0.18 + (accelerationMetersPerSecondSquared + 0.35) * 0.04,
				0.04,
				0.18,
			),
			brake: 0,
		};
	}

	if (accelerationMetersPerSecondSquared < 0.3) {
		return { throttle: 0.58, brake: 0 };
	}

	return {
		throttle: clamp(0.56 + accelerationMetersPerSecondSquared / 4.8, 0.56, 1),
		brake: 0,
	};
}

function gearForSpeed(speedKmh: number): number {
	if (speedKmh < 82) return 2;
	if (speedKmh < 118) return 3;
	if (speedKmh < 154) return 4;
	if (speedKmh < 194) return 5;
	if (speedKmh < 232) return 6;
	if (speedKmh < 264) return 7;
	return 8;
}

function engineRpmForSpeed(
	speedKmh: number,
	gear: number,
	noise: number,
): number {
	const gearSpeedBands: Readonly<Record<number, readonly [number, number]>> = {
		2: [55, 88],
		3: [78, 124],
		4: [110, 162],
		5: [145, 202],
		6: [184, 241],
		7: [224, 272],
		8: [255, 296],
	};
	const band = gearSpeedBands[gear] ?? [0, 300];
	const fraction = clamp((speedKmh - band[0]) / (band[1] - band[0]), 0, 1);
	return Math.round(4_300 + fraction * 3_600 + noise);
}

function updateTyreTemperatures(
	state: MutableTyreTemperatures,
	sessionElapsedMs: number,
	steering: number,
	deltaMs: number,
): void {
	const warmup = 65 + 24 * (1 - Math.exp(-sessionElapsedMs / 155_000));
	const outsideLeftLoad = steering > 0 ? Math.min(2.4, steering * 0.08) : 0;
	const outsideRightLoad =
		steering < 0 ? Math.min(2.4, Math.abs(steering) * 0.08) : 0;
	const targets = {
		frontLeft: warmup + 2.4 + outsideLeftLoad,
		frontRight: warmup + 1.8 + outsideRightLoad,
		rearLeft: warmup + 0.8 + outsideLeftLoad * 0.7,
		rearRight: warmup + 0.3 + outsideRightLoad * 0.7,
	};
	const response = clamp(deltaMs / 24_000, 0, 0.04);

	state.frontLeft += (targets.frontLeft - state.frontLeft) * response;
	state.frontRight += (targets.frontRight - state.frontRight) * response;
	state.rearLeft += (targets.rearLeft - state.rearLeft) * response;
	state.rearRight += (targets.rearRight - state.rearRight) * response;
}

function createFrame(
	segment: MovingSegment,
	sessionElapsedMs: number,
	timestampMs: number,
	previousSampleDeltaMs: number,
	tyreTemperatures: MutableTyreTemperatures,
	random: DeterministicRandom,
): WireTelemetryFrame {
	const elapsedWithinSegmentMs = sessionElapsedMs - segment.sessionStartTimeMs;
	const profileTimeMs =
		timeAtPositionMs(segment.profile, segment.startPosition) +
		elapsedWithinSegmentMs;
	const position = positionAtTimeMs(segment.profile, profileTimeMs);
	const idealSpeedKmh = speedForLapKmh(position, segment.lapNumber);
	const measuredSpeedKmh = clamp(idealSpeedKmh + random.centered(0.45), 0, 300);
	const idealSteering = steeringDegrees(position, segment.lapNumber);
	const measuredSteering = idealSteering + random.centered(0.11);
	const driverInputs = deriveDriverInputs(position, segment.lapNumber);
	const gear = gearForSpeed(measuredSpeedKmh);

	updateTyreTemperatures(
		tyreTemperatures,
		sessionElapsedMs,
		measuredSteering,
		previousSampleDeltaMs,
	);

	return {
		ts: timestampMs,
		lap: segment.lapNumber,
		pos: round(position === 1 ? 0.999999 : position, 6),
		spd: round(measuredSpeedKmh, 1),
		thr: round(clamp(driverInputs.throttle + random.centered(0.008), 0, 1), 3),
		brk: round(
			clamp(
				driverInputs.brake +
					(driverInputs.brake > 0 ? random.centered(0.006) : 0),
				0,
				1,
			),
			3,
		),
		str: round(measuredSteering, 2),
		gear,
		rpm: engineRpmForSpeed(measuredSpeedKmh, gear, random.centered(45)),
		tyres: {
			fl: Math.round((tyreTemperatures.frontLeft + random.centered(0.22)) * 10),
			fr: Math.round(
				(tyreTemperatures.frontRight + random.centered(0.22)) * 10,
			),
			rl: Math.round((tyreTemperatures.rearLeft + random.centered(0.22)) * 10),
			rr: Math.round((tyreTemperatures.rearRight + random.centered(0.22)) * 10),
		},
	};
}

function nextSamplingDeltaMs(random: DeterministicRandom): number {
	const selector = random.next();
	if (selector < 0.015) return 31 + Math.floor(random.next() * 7);
	if (selector > 0.985) return 78 + Math.floor(random.next() * 13);
	return 47 + Math.floor(random.next() * 18);
}

function injectKnownAuditCases(
	cleanFrames: readonly WireTelemetryFrame[],
): readonly WireTelemetryFrame[] {
	const frames = cleanFrames.map((frame) => ({
		...frame,
		tyres: { ...frame.tyres },
	}));

	const speedSpikeIndex = frames.findIndex(
		(frame) => frame.lap === 3 && frame.pos >= 0.812,
	);
	if (speedSpikeIndex >= 0) {
		const original = frames[speedSpikeIndex];
		if (original) {
			frames[speedSpikeIndex] = { ...original, spd: 3_187.4 };
		}
	}

	const duplicateIndex = frames.findIndex(
		(frame) => frame.lap === 2 && frame.pos >= 0.572,
	);
	if (duplicateIndex >= 0) {
		const original = frames[duplicateIndex];
		if (original) {
			frames.splice(duplicateIndex + 1, 0, {
				...original,
				tyres: { ...original.tyres },
			});
		}
	}

	return frames;
}

export function generateSpaTelemetryPayload(
	seed = DEFAULT_SEED,
): WireTelemetryPayload {
	const random = new DeterministicRandom(seed);
	const segments = createMovingSegments();
	const totalMovingTimeMs = segments.at(-1)?.sessionEndTimeMs ?? 0;
	const cleanFrames: WireTelemetryFrame[] = [];
	const tyreTemperatures: MutableTyreTemperatures = {
		frontLeft: 65.4,
		frontRight: 64.9,
		rearLeft: 64.2,
		rearRight: 63.8,
	};
	let sessionElapsedMs = 0;
	let timestampMs = START_TIMESTAMP_MS;
	let previousSampleDeltaMs = 55;
	let samplingGapInjected = false;

	while (sessionElapsedMs <= totalMovingTimeMs) {
		const segment = locateSegment(segments, sessionElapsedMs);
		if (!segment) break;

		const frame = createFrame(
			segment,
			sessionElapsedMs,
			timestampMs,
			previousSampleDeltaMs,
			tyreTemperatures,
			random,
		);
		cleanFrames.push(frame);

		let deltaMs = nextSamplingDeltaMs(random);
		if (!samplingGapInjected && frame.lap === 4 && frame.pos >= 0.585) {
			deltaMs = 487;
			samplingGapInjected = true;
		}

		sessionElapsedMs += deltaMs;
		timestampMs += deltaMs;
		previousSampleDeltaMs = deltaMs;
	}

	const frames = injectKnownAuditCases(cleanFrames);

	return {
		schema: "racemake.telemetry.stint.v1",
		recorder: {
			name: "racemake-synthetic-generator",
			version: "1.0.0",
		},
		session_id: "a7032026-0729-4a11-8ace-5aa700040019",
		note: "Synthetic Spa-Francorchamps-like GT telemetry; not recorded track data. Includes irregular sampling, partial boundary laps, one exact duplicate, one speed spike, and one sampling gap.",
		frame_count: frames.length,
		frames,
	};
}

async function main(): Promise<void> {
	const outputPath =
		Bun.argv[2] ?? `${import.meta.dir}/../data/spa-synthetic.telemetry.json`;
	const seedArgument = Bun.argv[3];
	const parsedSeed =
		seedArgument === undefined ? DEFAULT_SEED : Number(seedArgument);

	if (!Number.isSafeInteger(parsedSeed)) {
		throw new Error(`Seed must be a safe integer, received "${seedArgument}"`);
	}

	const payload = generateSpaTelemetryPayload(parsedSeed);
	await Bun.write(outputPath, `${JSON.stringify(payload, null, 2)}\n`);

	const firstTimestamp = payload.frames[0]?.ts ?? 0;
	const lastTimestamp = payload.frames.at(-1)?.ts ?? firstTimestamp;
	console.log(
		[
			`Wrote ${payload.frame_count} frames to ${outputPath}`,
			`Session duration: ${round((lastTimestamp - firstTimestamp) / 1_000, 3)} s`,
			`Complete modeled laps: 4`,
			`Seed: ${parsedSeed}`,
		].join("\n"),
	);
}

if (import.meta.main) {
	await main();
}
