import {
	ArrowsLeftRight,
	CaretDown,
	Check,
	WarningCircle,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import {
	createLapTelemetryGapSummary,
	createSamplingGapPositionSegments,
} from "../../../analysis/telemetry-gaps";
import type { LapPickerLap } from "../laps/LapPicker";
import { formatLapDeltaMs, formatLapTimeMs } from "../laps/lap-time-format";

type MobileLapSelectorId = "reference" | "reviewed";

interface MobileLapComparisonPickerProps {
	readonly laps: readonly LapPickerLap[];
	readonly comparedLapNumber: number | null;
	readonly referenceLapNumber: number | null;
	readonly onSelectComparedLap: (lapNumber: number) => void;
	readonly onSelectReferenceLap: (lapNumber: number) => void;
	readonly onSwapLaps: () => void;
}

export function MobileLapComparisonPicker({
	laps,
	comparedLapNumber,
	referenceLapNumber,
	onSelectComparedLap,
	onSelectReferenceLap,
	onSwapLaps,
}: MobileLapComparisonPickerProps) {
	const [openSelector, setOpenSelector] = useState<MobileLapSelectorId | null>(
		null,
	);
	const rootRef = useRef<HTMLDivElement>(null);
	const hasCompleteSelection =
		comparedLapNumber !== null && referenceLapNumber !== null;

	useEffect(() => {
		if (openSelector === null) return;

		function closeOnOutsidePointerDown(event: PointerEvent): void {
			if (
				event.target instanceof Node &&
				!rootRef.current?.contains(event.target)
			) {
				setOpenSelector(null);
			}
		}

		function closeOnEscape(event: KeyboardEvent): void {
			if (event.key === "Escape") setOpenSelector(null);
		}

		document.addEventListener("pointerdown", closeOnOutsidePointerDown);
		document.addEventListener("keydown", closeOnEscape);

		return () => {
			document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
			document.removeEventListener("keydown", closeOnEscape);
		};
	}, [openSelector]);

	return (
		<section className="border-b border-[#292d2a] px-3 py-3">
			<div ref={rootRef} className="mx-auto max-w-[820px]">
				<p className="mb-2 text-[10px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
					Compare laps
				</p>
				<div className="grid items-start gap-2 sm:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)]">
					<MobileLapSelector
						accent="reviewed"
						containerClassName="order-1"
						label="Reviewed lap"
						laps={laps}
						selectedLapNumber={comparedLapNumber}
						disabledLapNumber={referenceLapNumber}
						isOpen={openSelector === "reviewed"}
						onToggle={() =>
							setOpenSelector((current) =>
								current === "reviewed" ? null : "reviewed",
							)
						}
						onSelect={(lapNumber) => {
							onSelectComparedLap(lapNumber);
							setOpenSelector(null);
						}}
					/>

					<MobileLapSelector
						accent="reference"
						containerClassName="order-2 sm:order-3"
						label="Reference lap"
						laps={laps}
						selectedLapNumber={referenceLapNumber}
						disabledLapNumber={comparedLapNumber}
						isOpen={openSelector === "reference"}
						onToggle={() =>
							setOpenSelector((current) =>
								current === "reference" ? null : "reference",
							)
						}
						onSelect={(lapNumber) => {
							onSelectReferenceLap(lapNumber);
							setOpenSelector(null);
						}}
					/>

					<button
						className="order-3 flex h-9 items-center justify-center gap-2 rounded-[4px] border border-[#353a36] bg-[#111412] px-3 text-[10px] font-semibold tracking-[0.05em] text-neutral-300 uppercase transition-colors hover:border-neutral-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400 disabled:cursor-not-allowed disabled:text-neutral-600 sm:order-2 sm:h-16 sm:flex-col sm:gap-1 sm:px-0"
						type="button"
						disabled={!hasCompleteSelection}
						onClick={onSwapLaps}
					>
						<ArrowsLeftRight aria-hidden="true" size={15} weight="bold" />
						Swap
					</button>
				</div>
			</div>
		</section>
	);
}

function MobileLapSelector({
	accent,
	containerClassName,
	label,
	laps,
	selectedLapNumber,
	disabledLapNumber,
	isOpen,
	onToggle,
	onSelect,
}: {
	readonly accent: "reference" | "reviewed";
	readonly containerClassName: string;
	readonly label: string;
	readonly laps: readonly LapPickerLap[];
	readonly selectedLapNumber: number | null;
	readonly disabledLapNumber: number | null;
	readonly isOpen: boolean;
	readonly onToggle: () => void;
	readonly onSelect: (lapNumber: number) => void;
}) {
	const selectedLap = laps.find((lap) => lap.lapNumber === selectedLapNumber);
	const selectableOptionCount = laps.filter(
		(lap) => lap.isEligible && lap.lapNumber !== disabledLapNumber,
	).length;
	const listId = `mobile-${accent}-lap-options`;
	const accentClasses =
		accent === "reviewed"
			? "border-lime-400/80 text-lime-300 focus-visible:outline-lime-400"
			: "border-violet-500/70 text-violet-300 focus-visible:outline-violet-400";

	return (
		<div className={`min-w-0 ${containerClassName}`}>
			<button
				className={`flex min-h-16 w-full items-center justify-between gap-3 rounded-[4px] border bg-[#111412] px-3 py-2 text-left transition-colors hover:bg-[#151916] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:border-[#303431] disabled:text-neutral-600 ${accentClasses}`}
				type="button"
				aria-label={`Choose ${label.toLowerCase()}`}
				aria-expanded={isOpen}
				aria-controls={listId}
				disabled={selectableOptionCount === 0}
				onClick={onToggle}
			>
				<span className="min-w-0 flex-1">
					<span className="block text-[9px] font-semibold tracking-[0.07em] uppercase">
						{label}
					</span>
					{selectedLap ? (
						<SelectedLapValue lap={selectedLap} />
					) : (
						<span className="mt-1 block text-sm font-medium text-neutral-500">
							No comparison lap
						</span>
					)}
				</span>
				<CaretDown
					className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
					aria-hidden="true"
					size={16}
					weight="bold"
				/>
			</button>

			{isOpen ? (
				<div
					id={listId}
					className="mt-1 overflow-hidden rounded-[4px] border border-[#3d423e] bg-[#111412] shadow-xl"
					role="listbox"
					aria-label={`${label} options`}
				>
					{laps.map((lap) => {
						const isSelected = lap.lapNumber === selectedLapNumber;
						const isDisabled =
							!lap.isEligible || lap.lapNumber === disabledLapNumber;

						return (
							<MobileLapOption
								key={lap.lapNumber}
								lap={lap}
								isSelected={isSelected}
								isDisabled={isDisabled}
								onSelect={onSelect}
							/>
						);
					})}
				</div>
			) : null}
		</div>
	);
}

function SelectedLapValue({ lap }: { readonly lap: LapPickerLap }) {
	const gapSummary = createLapTelemetryGapSummary(
		lap.lapNumber,
		lap.samplingGaps,
	);
	const hasVisibleGap = gapSummary.visibleGaps.length > 0;

	return (
		<>
			<span className="mt-1 block truncate text-sm font-semibold tabular-nums text-neutral-100">
				Lap {lap.lapNumber} · {formatLapTimeMs(lap.lapTimeMs)}
			</span>
			<span
				className={`mt-0.5 flex items-center gap-1 text-[9px] font-medium ${hasVisibleGap ? "text-amber-400" : "text-neutral-500"}`}
			>
				{hasVisibleGap ? (
					<WarningCircle aria-hidden="true" size={11} weight="bold" />
				) : null}
				{formatLapSupportingLabel(
					lap,
					gapSummary.coveragePercent,
					hasVisibleGap,
				)}
			</span>
		</>
	);
}

function MobileLapOption({
	lap,
	isSelected,
	isDisabled,
	onSelect,
}: {
	readonly lap: LapPickerLap;
	readonly isSelected: boolean;
	readonly isDisabled: boolean;
	readonly onSelect: (lapNumber: number) => void;
}) {
	const gapSummary = createLapTelemetryGapSummary(
		lap.lapNumber,
		lap.samplingGaps,
	);
	const hasVisibleGap = gapSummary.visibleGaps.length > 0;

	return (
		<button
			className="relative flex min-h-[58px] w-full items-center gap-3 border-t border-[#292d2a] px-3 py-2 text-left first:border-t-0 enabled:hover:bg-[#191d1a] enabled:focus-visible:bg-[#191d1a] enabled:focus-visible:outline-2 enabled:focus-visible:outline-offset-[-2px] enabled:focus-visible:outline-lime-400 disabled:cursor-not-allowed disabled:bg-[#0e100f] disabled:text-neutral-600"
			type="button"
			role="option"
			aria-selected={isSelected}
			disabled={isDisabled}
			onClick={() => onSelect(lap.lapNumber)}
		>
			<span className="min-w-0 flex-1">
				<span className="flex items-baseline justify-between gap-3">
					<span className="text-xs font-semibold">
						Lap {lap.lapNumber}
						{lap.isFastest ? " · Fastest" : ""}
					</span>
					<span className="shrink-0 text-xs font-medium tabular-nums text-neutral-300">
						{formatLapTimeMs(lap.lapTimeMs)}
					</span>
				</span>
				<span
					className={`mt-1 flex items-center gap-1 text-[9px] ${hasVisibleGap ? "text-amber-400" : "text-neutral-500"}`}
				>
					{hasVisibleGap ? (
						<WarningCircle aria-hidden="true" size={11} weight="bold" />
					) : null}
					{formatLapSupportingLabel(
						lap,
						gapSummary.coveragePercent,
						hasVisibleGap,
					)}
				</span>
				{hasVisibleGap ? (
					<LapGapBar visibleGaps={gapSummary.visibleGaps} />
				) : null}
			</span>
			{isSelected ? (
				<Check
					className="shrink-0 text-lime-400"
					aria-hidden="true"
					size={16}
					weight="bold"
				/>
			) : null}
		</button>
	);
}

function LapGapBar({
	visibleGaps,
}: {
	readonly visibleGaps: ReturnType<
		typeof createLapTelemetryGapSummary
	>["visibleGaps"];
}) {
	return (
		<span
			className="relative mt-1.5 block h-1 overflow-hidden rounded-[2px] bg-[#303431]"
			aria-hidden="true"
		>
			{visibleGaps.flatMap((gap) =>
				createSamplingGapPositionSegments(gap).map((segment) => (
					<span
						key={`${gap.gapStartTimestampMs}-${segment.startPercent}`}
						className="absolute inset-y-0 bg-amber-500"
						style={{
							left: `${segment.startPercent}%`,
							width: `${segment.endPercent - segment.startPercent}%`,
						}}
					/>
				)),
			)}
		</span>
	);
}

function formatLapSupportingLabel(
	lap: LapPickerLap,
	coveragePercent: number,
	hasVisibleGap: boolean,
): string {
	if (!lap.isEligible && hasVisibleGap) {
		return `Excluded · Data gap · ${coveragePercent.toFixed(1)}% telemetry`;
	}
	if (!lap.isEligible) return "Excluded";
	if (hasVisibleGap) {
		return `Data gap · ${coveragePercent.toFixed(1)}% telemetry`;
	}
	if (lap.isFastest) return "Fastest";
	return formatLapDeltaMs(lap.deltaToReferenceMs);
}
