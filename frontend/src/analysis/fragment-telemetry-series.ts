import type {
	FragmentSeriesResponse,
	SeriesResponse,
} from "../../../src/http/contracts";

export const FRAGMENT_TELEMETRY_VIRTUAL_LAP_NUMBER = -1;

export function adaptFragmentTelemetrySeries(
	response: FragmentSeriesResponse,
): SeriesResponse {
	const pointCount = response.grid.normalizedTrackPositions.length;

	return {
		analysisId: response.analysisId,
		sessionId: response.sessionId,
		selection: {
			lapNumbers: [FRAGMENT_TELEMETRY_VIRTUAL_LAP_NUMBER],
			channels: response.selection.channels,
			positionFrom: 0,
			positionTo: 1,
		},
		grid: response.grid,
		laps: [
			{
				lapNumber: FRAGMENT_TELEMETRY_VIRTUAL_LAP_NUMBER,
				lapTimeMs: 0,
				lapElapsedMs: Array.from({ length: pointCount }, () => null),
				channels: response.channels,
			},
		],
	};
}
