import type { TrackRegionResponse } from "../../../../../src/http/contracts";
import {
	createVisibleTrackRegionSegments,
	type TelemetryViewport,
} from "../../../analysis/telemetry-viewport";

export interface TrackRegionBandProps {
	readonly status: "loading" | "ready" | "error";
	readonly regions: readonly TrackRegionResponse[];
	readonly viewport: TelemetryViewport;
	readonly selectedRegionId: TrackRegionResponse["id"] | null;
	readonly onSelectRegion: (regionId: TrackRegionResponse["id"]) => void;
}

export function TrackRegionBand({
	status,
	regions,
	viewport,
	selectedRegionId,
	onSelectRegion,
}: TrackRegionBandProps) {
	const segments = createVisibleTrackRegionSegments(regions, viewport);
	const regionsById = new Map(regions.map((region) => [region.id, region]));

	return (
		<section
			className="relative overflow-hidden rounded-[3px] border border-[#292d2a] bg-[#101311]"
			aria-label="Track regions"
		>
			<p className="absolute top-1/2 left-4 -translate-y-1/2 text-[10px] font-semibold tracking-[0.06em] text-neutral-400">
				REGIONS
			</p>
			<div className="absolute top-1/2 right-[18px] left-[102px] h-7 -translate-y-1/2 overflow-hidden rounded-[2px] border border-[#2f3430] bg-[#0d100e]">
				{status === "loading" && (
					<p className="flex h-full items-center justify-center text-[10px] text-neutral-600">
						Loading track regions…
					</p>
				)}
				{status === "error" && (
					<p className="flex h-full items-center justify-center text-[10px] text-neutral-500">
						Track regions unavailable
					</p>
				)}
				{status === "ready" &&
					segments.map((segment) => {
						const widthPercent = Math.max(
							0,
							segment.endPercent - segment.startPercent,
						);
						const isCorner = segment.type === "corner";
						const isSelected = segment.id === selectedRegionId;
						const sourceRegion = regionsById.get(segment.id);

						return (
							<button
								key={`${segment.id}-${segment.startPercent}-${segment.endPercent}`}
								type="button"
								className={`absolute inset-y-0 border-x transition-colors focus-visible:z-10 focus-visible:outline-1 focus-visible:outline-lime-400 ${
									isSelected
										? "z-[1] cursor-pointer border-lime-500 bg-lime-400/10 text-lime-300"
										: isCorner
											? "cursor-pointer border-[#3b403c] bg-[#171b18] text-neutral-200 hover:border-lime-500 hover:bg-[#1b211b] hover:text-lime-300"
											: "cursor-default border-transparent bg-transparent"
								}`}
								style={{
									left: `${segment.startPercent}%`,
									width: `${widthPercent}%`,
								}}
								disabled={!isCorner}
								onClick={() => onSelectRegion(segment.id)}
								aria-pressed={isCorner ? isSelected : undefined}
								aria-label={
									isCorner && sourceRegion
										? createRegionSelectionLabel(sourceRegion, isSelected)
										: undefined
								}
							>
								{segment.showsLabel && widthPercent >= 3 ? (
									<span className="text-[10px] font-semibold">
										{segment.id}
									</span>
								) : null}
							</button>
						);
					})}
			</div>
		</section>
	);
}

function createRegionSelectionLabel(
	region: TrackRegionResponse,
	isSelected: boolean,
): string {
	const startPercent = region.interval.startNormalizedTrackPosition * 100;
	const endPercent = region.interval.endNormalizedTrackPosition * 100;
	const range = region.interval.crossesStartFinishLine
		? `${startPercent.toFixed(1)} to 100 and 0 to ${endPercent.toFixed(1)}`
		: `${startPercent.toFixed(1)} to ${endPercent.toFixed(1)}`;

	return `${isSelected ? "Deselect" : "Select"} ${region.id}, ${range} percent of the lap`;
}
