import type { TrackRegionResponse } from "../../../../../src/http/contracts";
import type { LapFragmentPresentation } from "../../../analysis/lap-fragment-presentation";
import { calculateTelemetryRegionScrollLeft } from "../../../analysis/telemetry-chart-scroll";
import type { TrackRegionBandProps } from "../charts/TrackRegionBand";

export function MobileTrackRegionBand({
	status,
	regions,
	selectedRegionId,
	onSelectRegion,
	fragment = null,
}: TrackRegionBandProps) {
	const corners = regions.filter((region) => region.type === "corner");

	if (status !== "ready" || corners.length === 0) {
		return (
			<section
				className="flex min-h-14 items-center justify-center rounded-[3px] border border-[#292d2a] bg-[#101311] px-3 text-xs text-neutral-500"
				aria-label="Track regions"
			>
				{status === "loading"
					? "Loading track regions…"
					: status === "error"
						? "Track regions unavailable"
						: "No racing lap available"}
			</section>
		);
	}

	return (
		<section
			className="overflow-x-auto rounded-[3px] border border-[#303431] bg-[#101311] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			aria-label="Track regions"
			onWheel={(event) => {
				const scroller = event.currentTarget;
				const maximumScrollLeft = Math.max(
					0,
					scroller.scrollWidth - scroller.clientWidth,
				);
				const nextScrollLeft = calculateTelemetryRegionScrollLeft({
					currentScrollLeft: scroller.scrollLeft,
					maximumScrollLeft,
					deltaX: event.deltaX,
					deltaY: event.deltaY,
				});
				if (nextScrollLeft === scroller.scrollLeft) return;

				event.preventDefault();
				scroller.scrollLeft = nextScrollLeft;
			}}
		>
			<div
				className="flex min-w-full"
				style={{ minWidth: `${corners.length * 76}px` }}
			>
				{corners.map((corner) => {
					const isSelected = corner.id === selectedRegionId;
					const isAvailable =
						fragment === null || isRegionRecorded(corner, fragment);

					return (
						<button
							key={corner.id}
							type="button"
							className={`flex min-h-[58px] min-w-[76px] flex-1 flex-col items-center justify-center border-r border-[#3a3f3b] px-2 text-center transition-colors last:border-r-0 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lime-400 ${
								!isAvailable
									? "cursor-not-allowed bg-[#0d100e] text-neutral-700"
									: isSelected
										? "border-x-violet-400 bg-violet-400/[0.06] text-violet-300 ring-1 ring-inset ring-violet-400"
										: "text-neutral-200 hover:bg-white/[0.03] hover:text-lime-300"
							}`}
							disabled={!isAvailable}
							aria-pressed={isSelected}
							onClick={() => onSelectRegion(corner.id)}
						>
							<span className="text-sm font-semibold">{corner.id}</span>
							<span className="mt-1 text-[10px] tabular-nums text-current opacity-70">
								{formatRegionRange(corner)}
							</span>
						</button>
					);
				})}
			</div>
		</section>
	);
}

function isRegionRecorded(
	region: TrackRegionResponse,
	fragment: LapFragmentPresentation,
): boolean {
	const interval = region.interval;
	const regionRanges = interval.crossesStartFinishLine
		? [
				{
					startPosition: interval.startNormalizedTrackPosition,
					endPosition: 1,
				},
				{
					startPosition: 0,
					endPosition: interval.endNormalizedTrackPosition,
				},
			]
		: [
				{
					startPosition: interval.startNormalizedTrackPosition,
					endPosition: interval.endNormalizedTrackPosition,
				},
			];

	return regionRanges.some((regionRange) =>
		fragment.capturedRanges.some(
			(capturedRange) =>
				Math.min(regionRange.endPosition, capturedRange.endPosition) >
				Math.max(regionRange.startPosition, capturedRange.startPosition),
		),
	);
}

function formatRegionRange(region: TrackRegionResponse): string {
	const start = Math.round(region.interval.startNormalizedTrackPosition * 100);
	const end = Math.round(region.interval.endNormalizedTrackPosition * 100);
	return region.interval.crossesStartFinishLine
		? `${start}–100 / 0–${end}%`
		: `${start}–${end}%`;
}
