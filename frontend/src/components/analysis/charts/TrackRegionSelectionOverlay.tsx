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
			className="pointer-events-none absolute top-[16px] right-[12px] bottom-[36px] left-[58px] z-[5] overflow-hidden min-[1024px]:top-[18px] min-[1024px]:right-[18px] min-[1024px]:bottom-[38px] min-[1024px]:left-[102px]"
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
