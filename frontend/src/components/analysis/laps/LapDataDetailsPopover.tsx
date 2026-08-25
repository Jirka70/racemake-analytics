import { X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LapDataDetails } from "../../../analysis/lap-data-quality";
import { LapDataDetailsContent } from "./LapDataDetailsContent";

const POPOVER_WIDTH_PX = 400;
const VIEWPORT_MARGIN_PX = 12;

export function LapDataDetailsPopover({
	lapNumber,
	details,
	anchor,
	onClose,
}: {
	readonly lapNumber: number;
	readonly details: LapDataDetails;
	readonly anchor: HTMLButtonElement;
	readonly onClose: (restoreFocus: boolean) => void;
}) {
	const popoverRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState(() => positionFromAnchor(anchor));

	useEffect(() => {
		setPosition(positionFromAnchor(anchor));

		function closeOnOutsidePointerDown(event: PointerEvent): void {
			if (!(event.target instanceof Node)) return;
			if (
				anchor.contains(event.target) ||
				popoverRef.current?.contains(event.target)
			) {
				return;
			}
			onClose(false);
		}

		function handleKeyDown(event: KeyboardEvent): void {
			if (event.key === "Escape") onClose(true);
		}

		function closeForViewportResize(): void {
			onClose(false);
		}

		function followAnchorOnScroll(): void {
			setPosition(positionFromAnchor(anchor));
		}

		document.addEventListener("pointerdown", closeOnOutsidePointerDown);
		document.addEventListener("keydown", handleKeyDown);
		const scrollOptions = { capture: true, passive: true } as const;
		window.addEventListener("resize", closeForViewportResize);
		window.addEventListener("scroll", followAnchorOnScroll, scrollOptions);

		return () => {
			document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
			document.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("resize", closeForViewportResize);
			window.removeEventListener("scroll", followAnchorOnScroll, scrollOptions);
		};
	}, [anchor, onClose]);

	return createPortal(
		<div
			ref={popoverRef}
			id={`lap-${lapNumber}-data-details`}
			className="fixed z-[70] w-[400px] max-w-[calc(100vw-24px)] rounded-[4px] border border-amber-500/70 bg-[#111412] shadow-2xl"
			style={{ left: position.left, top: position.top }}
			role="dialog"
			aria-label={`Lap ${lapNumber} data details`}
		>
			<header className="flex items-center justify-between gap-4 border-b border-[#303431] px-4 py-3">
				<div>
					<p className="text-[10px] font-semibold tracking-[0.08em] text-amber-400 uppercase">
						Lap {lapNumber} · Data details
					</p>
					<h3 className="mt-1 text-sm font-semibold text-neutral-100">
						Why is this lap limited?
					</h3>
				</div>
				<button
					className="grid size-8 shrink-0 place-items-center rounded-[3px] text-neutral-400 transition-colors hover:bg-[#202421] hover:text-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
					type="button"
					aria-label="Close lap data details"
					onClick={() => onClose(true)}
				>
					<X aria-hidden="true" size={16} weight="bold" />
				</button>
			</header>

			<div className="px-4 py-4">
				<p className="mb-5 text-[11px] leading-4 text-neutral-300">
					{details.summary}
				</p>
				<LapDataDetailsContent details={details} />
			</div>
		</div>,
		document.body,
	);
}

function positionFromAnchor(anchor: HTMLButtonElement): {
	readonly left: number;
	readonly top: number;
} {
	const rect = anchor.getBoundingClientRect();
	const maximumLeft = Math.max(
		VIEWPORT_MARGIN_PX,
		window.innerWidth - POPOVER_WIDTH_PX - VIEWPORT_MARGIN_PX,
	);

	return {
		left: Math.min(Math.max(rect.left, VIEWPORT_MARGIN_PX), maximumLeft),
		top: rect.bottom + 6,
	};
}
