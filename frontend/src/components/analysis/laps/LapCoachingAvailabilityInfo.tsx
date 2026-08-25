import { Info } from "@phosphor-icons/react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

const TOOLTIP_WIDTH_PX = 292;
const VIEWPORT_MARGIN_PX = 12;

export function LapCoachingAvailabilityInfo({
	lapNumber,
	reason,
	onViewDetails,
}: {
	readonly lapNumber: number;
	readonly reason: string;
	readonly onViewDetails: (anchor: HTMLButtonElement) => void;
}) {
	const tooltipId = useId();
	const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
	const [position, setPosition] = useState({ left: 0, top: 0 });

	useEffect(() => {
		if (anchor === null) return;

		const updatePosition = (): void => setPosition(positionFromAnchor(anchor));
		updatePosition();
		window.addEventListener("resize", updatePosition);
		window.addEventListener("scroll", updatePosition, true);

		return () => {
			window.removeEventListener("resize", updatePosition);
			window.removeEventListener("scroll", updatePosition, true);
		};
	}, [anchor]);

	return (
		<>
			<button
				className="grid size-6 place-items-center rounded-[3px] border border-amber-500/70 text-amber-400 transition-colors hover:border-amber-300 hover:text-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
				type="button"
				aria-label={`Why coaching is unavailable for Lap ${lapNumber}`}
				aria-describedby={anchor ? tooltipId : undefined}
				onPointerEnter={(event) => setAnchor(event.currentTarget)}
				onPointerLeave={(event) => {
					if (document.activeElement !== event.currentTarget) setAnchor(null);
				}}
				onFocus={(event) => setAnchor(event.currentTarget)}
				onBlur={() => setAnchor(null)}
				onClick={(event) => {
					setAnchor(null);
					onViewDetails(event.currentTarget);
				}}
			>
				<Info aria-hidden="true" size={14} weight="bold" />
			</button>

			{anchor
				? createPortal(
						<div
							id={tooltipId}
							className="pointer-events-none fixed z-[90] w-[292px] max-w-[calc(100vw-24px)] rounded-[4px] border border-[#4b504c] bg-[#111412]/98 p-4 text-left shadow-2xl backdrop-blur-sm"
							style={position}
							role="tooltip"
						>
							<div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.05em] text-amber-400 uppercase">
								<Info aria-hidden="true" size={14} weight="bold" />
								Coaching not available
							</div>
							<p className="mt-3 text-[11px] leading-4 text-neutral-300">
								You can still review and compare the recorded telemetry.
							</p>
							<p className="mt-3 text-[11px] leading-4 text-neutral-300">
								{createCoachingExplanation(reason)}
							</p>
							<p className="mt-3 text-[11px] leading-4 text-neutral-400">
								<span className="font-semibold text-neutral-200">Why:</span>{" "}
								{reason}
							</p>
							<div className="mt-4 flex items-center justify-between border-t border-[#303431] pt-3 text-amber-400">
								<Info aria-hidden="true" size={15} weight="bold" />
								<span className="text-[10px] font-semibold underline underline-offset-4">
									View details
								</span>
							</div>
						</div>,
						document.body,
					)
				: null}
		</>
	);
}

function createCoachingExplanation(reason: string): string {
	const normalizedReason = reason.toLowerCase();
	if (normalizedReason.includes("finish")) {
		return "We won’t create coaching advice for this lap because its finish was not recorded reliably.";
	}
	if (normalizedReason.includes("start")) {
		return "We won’t create coaching advice for this lap because its start was not recorded reliably.";
	}

	return "We won’t create coaching advice for this lap because part of it was not recorded reliably.";
}

function positionFromAnchor(anchor: HTMLButtonElement): {
	readonly left: number;
	readonly top: number;
} {
	const rect = anchor.getBoundingClientRect();
	const maximumLeft = Math.max(
		VIEWPORT_MARGIN_PX,
		window.innerWidth - TOOLTIP_WIDTH_PX - VIEWPORT_MARGIN_PX,
	);

	return {
		left: Math.min(
			Math.max(rect.right - TOOLTIP_WIDTH_PX, VIEWPORT_MARGIN_PX),
			maximumLeft,
		),
		top: rect.bottom + 8,
	};
}
