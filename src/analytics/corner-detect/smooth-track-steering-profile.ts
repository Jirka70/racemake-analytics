import {
	createSavitzkyGolayWindowSmoother,
	type SavitzkyGolayOptions,
} from "../savitzky-golay";
import type {
	TrackSteeringProfile,
	TrackSteeringProfileCell,
} from "./create-track-steering-profile";

export interface TrackSteeringSmoothingOptions extends SavitzkyGolayOptions {
	readonly minimumLapSupport: number;
}

export interface SmoothedTrackSteeringProfileCell {
	readonly cellCenter: number;
	readonly smoothedSignedSteeringDegrees: number | null;
}

export interface SmoothedTrackSteeringProfile
	extends TrackSteeringSmoothingOptions {
	readonly cells: readonly SmoothedTrackSteeringProfileCell[];
}

export function smoothTrackSteeringProfile(
	profile: TrackSteeringProfile,
	options: TrackSteeringSmoothingOptions,
): SmoothedTrackSteeringProfile {
	if (
		!Number.isInteger(options.minimumLapSupport) ||
		options.minimumLapSupport < 0
	)
		throw new RangeError("Minimum lap support must be a non-negative integer");

	const halfWindowSize = Math.floor(options.windowSize / 2);
	const smoothWindow = createSavitzkyGolayWindowSmoother(options);
	const cells = profile.cells.map(
		(cell, cellIndex): SmoothedTrackSteeringProfileCell => {
			const windowValues = findWindowValues(
				profile.cells,
				cellIndex,
				halfWindowSize,
				options.minimumLapSupport,
			);
			return {
				cellCenter: cell.cellCenter,
				smoothedSignedSteeringDegrees: windowValues
					? smoothWindow(windowValues)
					: null,
			};
		},
	);

	return { ...options, cells };
}

function findWindowValues(
	cells: readonly TrackSteeringProfileCell[],
	cellIndex: number,
	halfWindowSize: number,
	minimumLapSupport: number,
): number[] | null {
	if (cells.length < halfWindowSize * 2 + 1) return null;

	const values: number[] = [];
	for (let offset = -halfWindowSize; offset <= halfWindowSize; offset++) {
		const windowIndex = (cellIndex + offset + cells.length) % cells.length;
		const windowCell = cells[windowIndex];
		if (
			windowCell.signedMedianSteeringDegrees === null ||
			windowCell.lapSupportCount < minimumLapSupport
		)
			return null;
		values.push(windowCell.signedMedianSteeringDegrees);
	}
	return values;
}
