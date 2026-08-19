import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TrackRegionResponse } from "../../../../../src/http/contracts";
import type { LapFragmentPresentation } from "../../../analysis/lap-fragment-presentation";
import {
	calculateTelemetryRegionScrollLeft,
	getTelemetryRegionScrollAffordances,
} from "../../../analysis/telemetry-chart-scroll";
import type { TrackRegionBandProps } from "../charts/TrackRegionBand";

export function MobileTrackRegionBand({
	status,
	regions,
	selectedRegionId,
	onSelectRegion,
	fragment = null,
}: TrackRegionBandProps) {
	const scrollerRef = useRef<HTMLDivElement>(null);
	const [canScrollBackward, setCanScrollBackward] = useState(false);
	const [canScrollForward, setCanScrollForward] = useState(false);
	const corners = regions.filter((region) => region.type === "corner");
	const cornerCount = corners.length;
	const updateScrollAffordances = useCallback((): void => {
		const scroller = scrollerRef.current;
		if (scroller === null) return;

		const affordances = getTelemetryRegionScrollAffordances({
			scrollLeft: scroller.scrollLeft,
			scrollWidth: scroller.scrollWidth,
			clientWidth: scroller.clientWidth,
		});
		setCanScrollBackward(affordances.canScrollBackward);
		setCanScrollForward(affordances.canScrollForward);
	}, []);

	useEffect(() => {
		if (status !== "ready" || cornerCount === 0) return;
		const scroller = scrollerRef.current;
		if (scroller === null) return;

		const resizeObserver = new ResizeObserver(updateScrollAffordances);
		const mutationObserver = new MutationObserver(updateScrollAffordances);
		resizeObserver.observe(scroller);
		mutationObserver.observe(scroller, { childList: true, subtree: true });
		scroller.addEventListener("scroll", updateScrollAffordances, {
			passive: true,
		});
		updateScrollAffordances();

		return () => {
			resizeObserver.disconnect();
			mutationObserver.disconnect();
			scroller.removeEventListener("scroll", updateScrollAffordances);
		};
	}, [status, cornerCount, updateScrollAffordances]);

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
			className="relative overflow-hidden rounded-[3px] border border-[#303431] bg-[#101311]"
			aria-label="Track regions"
		>
			<div
				ref={scrollerRef}
				className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
								className={`flex min-h-[58px] min-w-[76px] shrink-0 basis-[calc((100vw-24px)/4.5)] flex-col items-center justify-center border-r border-[#3a3f3b] px-2 text-center transition-colors last:border-r-0 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lime-400 sm:flex-1 sm:basis-auto ${
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
			</div>

			{canScrollBackward ? (
				<RegionScrollControl
					direction="backward"
					onClick={() => scrollRegions(scrollerRef.current, -1)}
				/>
			) : null}
			{canScrollForward ? (
				<RegionScrollControl
					direction="forward"
					onClick={() => scrollRegions(scrollerRef.current, 1)}
				/>
			) : null}
		</section>
	);
}

function RegionScrollControl({
	direction,
	onClick,
}: {
	readonly direction: "backward" | "forward";
	readonly onClick: () => void;
}) {
	const isBackward = direction === "backward";
	const label = isBackward
		? "Show previous track regions"
		: "Show more track regions";

	return (
		<div
			className={`pointer-events-none absolute inset-y-0 z-20 flex w-16 items-center ${
				isBackward
					? "left-0 justify-start bg-gradient-to-r from-[#101311] via-[#101311]/90 to-transparent pl-1"
					: "right-0 justify-end bg-gradient-to-l from-[#101311] via-[#101311]/90 to-transparent pr-1"
			}`}
		>
			<button
				type="button"
				className="pointer-events-auto grid size-11 place-items-center rounded-full border border-[#4a504b] bg-[#111412] text-neutral-100 shadow-lg transition-colors hover:border-lime-500 hover:text-lime-300 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-lime-400"
				aria-label={label}
				title={label}
				onClick={onClick}
			>
				{isBackward ? (
					<CaretLeft aria-hidden="true" size={18} weight="bold" />
				) : (
					<CaretRight aria-hidden="true" size={18} weight="bold" />
				)}
			</button>
		</div>
	);
}

function scrollRegions(
	scroller: HTMLDivElement | null,
	direction: -1 | 1,
): void {
	if (scroller === null) return;
	const firstRegion = scroller.querySelector<HTMLElement>("button");
	const stepPx = firstRegion?.getBoundingClientRect().width ?? 76;
	scroller.scrollBy({
		left: direction * stepPx,
		behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
			? "auto"
			: "smooth",
	});
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
