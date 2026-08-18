import {
	CaretDown,
	CaretLeft,
	CaretRight,
	CaretUp,
	ChartBar,
	ChartLineUp,
	CheckCircle,
} from "@phosphor-icons/react";
import {
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	classifyCoachingPriority,
	formatCoachingPhenomenon,
} from "../../../analysis/coaching-findings";
import { CoachingFinding, type CoachingRailProps } from "../CoachingRail";

const priorityClasses = {
	CRITICAL: {
		badge: "border-[#ff5c5c]/70 text-[#ff5c5c]",
		value: "text-[#ff5c5c]",
	},
	HIGH: {
		badge: "border-[#ff8a3d]/70 text-[#ff8a3d]",
		value: "text-[#ff8a3d]",
	},
	MODERATE: {
		badge: "border-[#f2b84b]/70 text-[#f2b84b]",
		value: "text-[#f2b84b]",
	},
	LOW: {
		badge: "border-[#8b949e]/70 text-[#a8b0b9]",
		value: "text-[#a8b0b9]",
	},
} as const;

export function MobileCoachingSheet(props: CoachingRailProps) {
	return <MobileCoachingSheetContent key={props.status} {...props} />;
}

type MobileCoachingSheetMode = "docked" | "summary" | "evidence";

const SHEET_DOCK_DRAG_THRESHOLD_PX = 44;

function MobileCoachingSheetContent(props: CoachingRailProps) {
	const {
		status,
		findings,
		activeRank,
		fastestLapNumber,
		emptyMessage,
		errorMessage,
	} = props;
	const [mode, setMode] = useState<MobileCoachingSheetMode>("docked");
	const [dragOffsetPx, setDragOffsetPx] = useState(0);
	const activeDragRef = useRef<{
		readonly pointerId: number;
		readonly startClientY: number;
	} | null>(null);
	const removeDragListenersRef = useRef<(() => void) | null>(null);
	const ignoreNextHandleClickRef = useRef(false);
	const activeIndex = Math.max(
		findings.findIndex(({ rank }) => rank === activeRank),
		0,
	);
	const activeFinding = findings[activeIndex] ?? null;
	const isDocked = mode === "docked";
	const isEvidenceOpen = mode === "evidence";

	useEffect(
		() => () => {
			removeDragListenersRef.current?.();
		},
		[],
	);

	function startSheetDrag(event: ReactPointerEvent<HTMLButtonElement>): void {
		if (event.button !== 0) return;
		removeDragListenersRef.current?.();

		activeDragRef.current = {
			pointerId: event.pointerId,
			startClientY: event.clientY,
		};
		ignoreNextHandleClickRef.current = false;
		const handle = event.currentTarget;
		const pointerId = event.pointerId;

		function removeDragListeners(): void {
			window.removeEventListener("pointermove", moveSheetDrag);
			window.removeEventListener("pointerup", finishSheetDrag);
			window.removeEventListener("pointercancel", cancelSheetDrag);
			if (removeDragListenersRef.current === removeDragListeners) {
				removeDragListenersRef.current = null;
			}
		}

		function completeSheetDrag(clientY: number, allowDock: boolean): void {
			const activeDrag = activeDragRef.current;
			if (activeDrag?.pointerId !== pointerId) return;

			const finalOffsetPx = Math.max(0, clientY - activeDrag.startClientY);
			activeDragRef.current = null;
			removeDragListeners();
			if (handle.hasPointerCapture(pointerId)) {
				handle.releasePointerCapture(pointerId);
			}
			setDragOffsetPx(0);
			if (allowDock && finalOffsetPx >= SHEET_DOCK_DRAG_THRESHOLD_PX) {
				setMode("docked");
			}
		}

		function moveSheetDrag(pointerEvent: globalThis.PointerEvent): void {
			const activeDrag = activeDragRef.current;
			if (activeDrag?.pointerId !== pointerEvent.pointerId) return;

			pointerEvent.preventDefault();
			const nextOffsetPx = Math.max(
				0,
				pointerEvent.clientY - activeDrag.startClientY,
			);
			if (nextOffsetPx > 4) ignoreNextHandleClickRef.current = true;
			setDragOffsetPx(nextOffsetPx);
		}

		function finishSheetDrag(pointerEvent: globalThis.PointerEvent): void {
			if (pointerEvent.pointerId !== pointerId) return;
			completeSheetDrag(pointerEvent.clientY, true);
		}

		function cancelSheetDrag(pointerEvent: globalThis.PointerEvent): void {
			if (pointerEvent.pointerId !== pointerId) return;
			completeSheetDrag(pointerEvent.clientY, false);
		}

		removeDragListenersRef.current = removeDragListeners;
		window.addEventListener("pointermove", moveSheetDrag, { passive: false });
		window.addEventListener("pointerup", finishSheetDrag);
		window.addEventListener("pointercancel", cancelSheetDrag);
		handle.setPointerCapture(pointerId);
	}

	return (
		<aside
			className={`fixed inset-x-0 bottom-0 z-40 flex flex-col overflow-hidden rounded-t-[14px] border border-[#343936] bg-[#121513]/[0.985] shadow-[0_-18px_50px_rgba(0,0,0,0.5)] backdrop-blur-sm transition-[height,max-height,transform] ${dragOffsetPx > 0 ? "duration-0" : "duration-200"} ${
				isDocked
					? "h-[68px] max-h-[68px]"
					: isEvidenceOpen
						? "h-[76dvh] max-h-[76dvh]"
						: "max-h-[52dvh]"
			}`}
			style={{ transform: `translateY(${dragOffsetPx}px)` }}
			aria-label={isEvidenceOpen ? "Telemetry evidence" : "Coaching summary"}
		>
			{isDocked ? (
				<DockedCoaching
					status={status}
					finding={activeFinding}
					onOpen={() => setMode("summary")}
				/>
			) : null}

			{!isDocked ? (
				<button
					type="button"
					className="group relative flex h-8 shrink-0 touch-none cursor-grab items-center justify-center border-b border-[#292d2a] active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lime-400"
					aria-label="Minimize coaching panel"
					aria-expanded="true"
					title="Drag down or press to minimize"
					onPointerDown={startSheetDrag}
					onClick={() => {
						if (ignoreNextHandleClickRef.current) {
							ignoreNextHandleClickRef.current = false;
							return;
						}
						setMode("docked");
					}}
				>
					<span className="h-1 w-10 rounded-full bg-neutral-500 transition-colors group-hover:bg-neutral-300" />
					<CaretDown
						className="absolute right-4 text-neutral-500 group-hover:text-neutral-300"
						size={16}
						weight="bold"
						aria-hidden="true"
					/>
				</button>
			) : null}

			{isEvidenceOpen ? (
				<div className="relative flex h-10 shrink-0 items-center justify-center border-b border-[#292d2a] px-4">
					<button
						type="button"
						className="absolute left-4 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.04em] text-neutral-300 uppercase hover:text-white focus-visible:outline-2 focus-visible:outline-lime-400"
						onClick={() => setMode("summary")}
					>
						<CaretLeft aria-hidden="true" size={14} weight="bold" />
						Coaching call
					</button>
					<p className="text-[10px] font-semibold tracking-[0.06em] text-neutral-500 uppercase">
						Telemetry evidence
					</p>
				</div>
			) : null}

			{!isDocked && status === "loading" ? (
				<div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain">
					<SheetMessage title="Loading coaching findings…" />
				</div>
			) : null}

			{!isDocked && status === "error" ? (
				<div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain">
					<SheetMessage
						title="We couldn’t load coaching"
						description={errorMessage ?? "Try opening the stint again."}
						isError
					/>
				</div>
			) : null}

			{!isDocked && status === "unavailable" ? (
				<div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain">
					<UnavailableCoaching />
				</div>
			) : null}

			{!isDocked && status === "ready" && activeFinding === null ? (
				<div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain">
					<EmptyCoaching message={emptyMessage} />
				</div>
			) : null}

			{!isDocked && status === "ready" && activeFinding !== null ? (
				<>
					{findings.length > 1 ? (
						<MobileFindingNavigation activeIndex={activeIndex} {...props} />
					) : null}

					{isEvidenceOpen ? (
						<div className="min-h-0 flex-1 overflow-hidden [&>article]:h-full [&>article]:touch-pan-y">
							<CoachingFinding
								finding={activeFinding}
								fastestLapNumber={fastestLapNumber}
							/>
						</div>
					) : (
						<div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain">
							<CollapsedFinding
								finding={activeFinding}
								onViewEvidence={() => setMode("evidence")}
							/>
						</div>
					)}
				</>
			) : null}
		</aside>
	);
}

function DockedCoaching({
	status,
	finding: rankedFinding,
	onOpen,
}: {
	readonly status: CoachingRailProps["status"];
	readonly finding: CoachingRailProps["findings"][number] | null;
	readonly onOpen: () => void;
}) {
	const finding = rankedFinding?.finding ?? null;
	const priorityLabel = rankedFinding
		? classifyCoachingPriority(rankedFinding.priority)
		: null;
	const theme = priorityLabel ? priorityClasses[priorityLabel] : null;
	const label = findDockedCoachingLabel(status, finding !== null);
	const title = finding
		? formatCoachingPhenomenon(finding.phenomenon)
		: findDockedCoachingTitle(status);

	return (
		<button
			type="button"
			className="grid h-full w-full grid-cols-[36px_minmax(0,1fr)_auto_24px] items-center gap-3 px-4 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lime-400"
			aria-label="Open coaching panel"
			aria-expanded="false"
			onClick={onOpen}
		>
			<span className="grid size-9 place-items-center rounded-[4px] border border-[#454a46] text-neutral-400">
				<ChartBar aria-hidden="true" size={18} />
			</span>
			<span className="min-w-0">
				<span className="block text-[9px] font-semibold tracking-[0.06em] text-neutral-500 uppercase">
					{priorityLabel ? `${priorityLabel} · ${label}` : label}
				</span>
				<span className="mt-0.5 block truncate text-xs font-semibold text-neutral-100 uppercase">
					{title}
				</span>
			</span>
			{finding && theme ? (
				<span className={`text-sm font-semibold tabular-nums ${theme.value}`}>
					+{(finding.impactTimeLossMs / 1_000).toFixed(3)} s
				</span>
			) : null}
			<CaretUp
				className="text-neutral-400"
				size={16}
				weight="bold"
				aria-hidden="true"
			/>
		</button>
	);
}

function findDockedCoachingLabel(
	status: CoachingRailProps["status"],
	hasFinding: boolean,
): string {
	if (status === "loading") return "Loading coaching";
	if (status === "error") return "Coaching unavailable";
	if (status === "unavailable") return "Coaching unavailable";
	return hasFinding ? "Coaching" : "Analysis complete";
}

function findDockedCoachingTitle(status: CoachingRailProps["status"]): string {
	if (status === "loading") return "Checking the selected lap";
	if (status === "error") return "Open for details";
	if (status === "unavailable") return "At least two laps required";
	return "No coaching findings";
}

function MobileFindingNavigation({
	activeIndex,
	findings,
	onSelectRank,
}: CoachingRailProps & { readonly activeIndex: number }) {
	const previousFinding = findings[activeIndex - 1] ?? null;
	const nextFinding = findings[activeIndex + 1] ?? null;
	const buttonClassName =
		"flex h-9 min-w-[92px] items-center justify-center gap-1.5 rounded-[4px] border border-[#454a46] bg-[#111412] px-2 text-[10px] font-semibold tracking-[0.04em] text-neutral-200 uppercase focus-visible:outline-2 focus-visible:outline-lime-400 disabled:cursor-not-allowed disabled:text-neutral-600";

	return (
		<nav
			className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-[#292d2a] px-4 py-2"
			aria-label="Coaching findings"
		>
			<button
				className={`${buttonClassName} w-full max-w-[180px] justify-self-start`}
				type="button"
				disabled={!previousFinding}
				onClick={() => {
					if (previousFinding) onSelectRank(previousFinding.rank);
				}}
			>
				<CaretLeft aria-hidden="true" size={13} weight="bold" />
				Previous
			</button>
			<span className="justify-self-center whitespace-nowrap text-center text-[10px] font-medium tabular-nums text-neutral-300 uppercase">
				{activeIndex + 1} of {findings.length} findings
			</span>
			<button
				className={`${buttonClassName} w-full max-w-[180px] justify-self-end`}
				type="button"
				disabled={!nextFinding}
				onClick={() => {
					if (nextFinding) onSelectRank(nextFinding.rank);
				}}
			>
				Next
				<CaretRight aria-hidden="true" size={13} weight="bold" />
			</button>
		</nav>
	);
}

function CollapsedFinding({
	finding: rankedFinding,
	onViewEvidence,
}: {
	readonly finding: CoachingRailProps["findings"][number];
	readonly onViewEvidence: () => void;
}) {
	const { finding, priority } = rankedFinding;
	const priorityLabel = classifyCoachingPriority(priority);
	const theme = priorityClasses[priorityLabel];

	return (
		<div className="px-6 pb-[calc(16px+env(safe-area-inset-bottom))]">
			<span
				className={`inline-flex rounded-[3px] border px-2 py-1 text-[10px] font-semibold tracking-[0.05em] ${theme.badge}`}
			>
				{priorityLabel} PRIORITY
			</span>
			<h2 className="mt-3 text-lg font-semibold tracking-[0.02em] text-neutral-100 uppercase">
				{formatCoachingPhenomenon(finding.phenomenon)}
			</h2>
			<p
				className={`mt-3 text-[34px] font-semibold leading-none tabular-nums ${theme.value}`}
			>
				+{(finding.impactTimeLossMs / 1_000).toFixed(3)} s
				<span className="ml-2 text-sm font-semibold tracking-[0.05em] uppercase">
					lost
				</span>
			</p>
			<p className="mt-4 text-sm leading-6 text-neutral-200">
				{finding.message}
			</p>
			<button
				type="button"
				className="mt-4 flex min-h-12 w-full items-center justify-between border-t border-[#343936] pt-3 text-left text-sm font-medium text-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400"
				onClick={onViewEvidence}
			>
				<span className="flex items-center gap-3">
					<span className="grid size-9 place-items-center rounded-[4px] border border-[#454a46] text-neutral-300">
						<ChartBar aria-hidden="true" size={18} />
					</span>
					View telemetry evidence
				</span>
				<CaretRight aria-hidden="true" size={18} weight="bold" />
			</button>
		</div>
	);
}

function UnavailableCoaching() {
	return (
		<div className="px-6 pb-[calc(24px+env(safe-area-inset-bottom))]">
			<div className="flex items-center gap-3">
				<ChartLineUp
					className="shrink-0 text-neutral-500"
					size={24}
					weight="light"
				/>
				<span className="rounded-[3px] border border-[#555b57] px-2 py-1 text-[10px] font-semibold tracking-[0.05em] text-neutral-400 uppercase">
					Coaching unavailable
				</span>
			</div>
			<h2 className="mt-4 text-lg font-semibold text-neutral-100 uppercase">
				Coaching requires at least two laps
			</h2>
			<p className="mt-3 text-sm leading-6 text-neutral-400">
				At least two laps are needed for comparison, time delta and coaching.
				Add another lap.
			</p>
		</div>
	);
}

function EmptyCoaching({ message }: { readonly message: string }) {
	return (
		<div className="px-6 pb-[calc(24px+env(safe-area-inset-bottom))]">
			<div className="flex items-center gap-3 text-lime-400">
				<CheckCircle size={24} weight="light" aria-hidden="true" />
				<span className="rounded-[3px] border border-lime-400/60 px-2 py-1 text-[10px] font-semibold tracking-[0.05em] uppercase">
					Analysis complete
				</span>
				<CaretDown className="ml-auto" size={18} aria-hidden="true" />
			</div>
			<h2 className="mt-4 text-lg font-semibold text-neutral-100 uppercase">
				No coaching findings
			</h2>
			<p className="mt-3 text-sm leading-6 text-neutral-300">{message}</p>
		</div>
	);
}

function SheetMessage({
	title,
	description,
	isError = false,
}: {
	readonly title: string;
	readonly description?: string;
	readonly isError?: boolean;
}) {
	return (
		<div
			className="px-6 pb-[calc(24px+env(safe-area-inset-bottom))]"
			role={isError ? "alert" : "status"}
		>
			<p
				className={`text-sm font-medium ${isError ? "text-red-300" : "text-neutral-200"}`}
			>
				{title}
			</p>
			{description ? (
				<p className="mt-2 text-xs leading-5 text-neutral-500">{description}</p>
			) : null}
		</div>
	);
}
