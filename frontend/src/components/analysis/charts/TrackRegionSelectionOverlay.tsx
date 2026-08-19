import type { TrackRegionResponse } from "../../../../../src/http/contracts";
import {
	createVisibleTrackRegionSegments,
	type TelemetryViewport,
} from "../../../analysis/telemetry-viewport";

export interface TrackRegionSelectionOverlayProps {
	readonly region: TrackRegionResponse | null;
	readonly viewport: TelemetryViewport;
}

export interface VisibleTrackRegionSelectionSegment {
	readonly startPercent: number;
	readonly widthPercent: number;
}

export function TrackRegionSelectionOverlay({
	region,
	viewport,
}: TrackRegionSelectionOverlayProps) {
	if (region === null) return null;

	const visibleSegments = createVisibleTrackRegionSelectionSegments(
		region,
		viewport,
	);

	return (
		<div
			className="pointer-events-none absolute inset-0 z-[5] overflow-hidden"
			aria-hidden="true"
		>
			{visibleSegments.map((segment) => (
				<span
					key={`${segment.startPercent}-${segment.widthPercent}`}
					className="absolute inset-y-0 border-x border-violet-400/25 bg-violet-400/10"
					style={{
						left: `${segment.startPercent}%`,
						width: `${segment.widthPercent}%`,
					}}
				/>
			))}
		</div>
	);
}

export function createVisibleTrackRegionSelectionSegments(
	region: TrackRegionResponse,
	viewport: TelemetryViewport,
): readonly VisibleTrackRegionSelectionSegment[] {
	return createVisibleTrackRegionSegments([region], viewport).map(
		(segment) => ({
			startPercent: segment.startPercent,
			widthPercent: segment.endPercent - segment.startPercent,
		}),
	);
}
