import { Check, SlidersHorizontal } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";
import {
	ADDITIONAL_TELEMETRY_CHARTS,
	DEFAULT_VISIBLE_TELEMETRY_CHARTS,
	PRIMARY_TELEMETRY_CHARTS,
	TELEMETRY_CHART_IDS,
	TELEMETRY_CHART_LABELS,
	type TelemetryChartId,
} from "../../../analysis/telemetry-chart-selection";

interface ChartChannelSelectorProps {
	readonly visibleChartIds: readonly TelemetryChartId[];
	readonly availableChartIds?: readonly TelemetryChartId[];
	readonly defaultVisibleChartIds?: readonly TelemetryChartId[];
	readonly onToggleChart: (chartId: TelemetryChartId) => void;
	readonly onReset: () => void;
}

export function ChartChannelSelector({
	visibleChartIds,
	availableChartIds = TELEMETRY_CHART_IDS,
	defaultVisibleChartIds = DEFAULT_VISIBLE_TELEMETRY_CHARTS,
	onToggleChart,
	onReset,
}: ChartChannelSelectorProps) {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const popoverId = useId();
	const primaryChartIds = PRIMARY_TELEMETRY_CHARTS.filter((chartId) =>
		availableChartIds.includes(chartId),
	);
	const additionalChartIds = ADDITIONAL_TELEMETRY_CHARTS.filter((chartId) =>
		availableChartIds.includes(chartId),
	);

	useEffect(() => {
		if (!isOpen) return;

		function closeOnOutsidePointerDown(event: PointerEvent): void {
			if (
				event.target instanceof Node &&
				!containerRef.current?.contains(event.target)
			) {
				setIsOpen(false);
			}
		}

		function closeOnEscape(event: KeyboardEvent): void {
			if (event.key === "Escape") setIsOpen(false);
		}

		document.addEventListener("pointerdown", closeOnOutsidePointerDown);
		document.addEventListener("keydown", closeOnEscape);

		return () => {
			document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
			document.removeEventListener("keydown", closeOnEscape);
		};
	}, [isOpen]);

	return (
		<div ref={containerRef} className="relative shrink-0 self-center pr-2">
			<button
				type="button"
				className="flex h-8 items-center gap-2 rounded-[3px] border border-[#454a46] bg-[#111412] px-2.5 text-[10px] font-semibold tracking-[0.04em] text-neutral-200 transition-colors hover:border-neutral-500 hover:bg-[#171a18] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400"
				aria-expanded={isOpen}
				aria-controls={popoverId}
				onClick={() => setIsOpen((currentIsOpen) => !currentIsOpen)}
			>
				<SlidersHorizontal size={15} weight="bold" aria-hidden="true" />
				{visibleChartIds.length} CHARTS
			</button>

			{isOpen && (
				<div
					id={popoverId}
					className="absolute top-full right-2 z-50 mt-1.5 w-60 rounded-[3px] border border-[#454a46] bg-[#151816] p-3 shadow-2xl shadow-black/60"
					role="dialog"
					aria-label="Choose visible telemetry charts"
				>
					<h2 className="text-xs font-semibold tracking-[0.04em] text-neutral-100">
						CHARTS
					</h2>
					{primaryChartIds.length > 0 && (
						<ChartSelectionGroup
							label="PRIMARY"
							chartIds={primaryChartIds}
							visibleChartIds={visibleChartIds}
							onToggleChart={onToggleChart}
						/>
					)}
					{additionalChartIds.length > 0 && (
						<ChartSelectionGroup
							label="ADDITIONAL"
							chartIds={additionalChartIds}
							visibleChartIds={visibleChartIds}
							onToggleChart={onToggleChart}
						/>
					)}
					<button
						type="button"
						className="mt-2 text-left text-[11px] font-medium text-violet-300 hover:text-violet-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:cursor-default disabled:text-neutral-600"
						onClick={onReset}
						disabled={areDefaultChartsVisible(
							visibleChartIds,
							defaultVisibleChartIds,
						)}
					>
						Reset to default
					</button>
				</div>
			)}
		</div>
	);
}

function ChartSelectionGroup({
	label,
	chartIds,
	visibleChartIds,
	onToggleChart,
}: {
	readonly label: string;
	readonly chartIds: readonly TelemetryChartId[];
	readonly visibleChartIds: readonly TelemetryChartId[];
	readonly onToggleChart: (chartId: TelemetryChartId) => void;
}) {
	return (
		<fieldset className="mt-3">
			<legend className="mb-1 text-[9px] font-semibold tracking-[0.08em] text-neutral-500">
				{label}
			</legend>
			<div className="space-y-0.5">
				{chartIds.map((chartId) => {
					const isChecked = visibleChartIds.includes(chartId);
					const isOnlyVisibleChart = isChecked && visibleChartIds.length === 1;

					return (
						<label
							key={chartId}
							className={`flex min-h-8 items-center gap-2 rounded-[2px] px-1.5 text-[12px] transition-colors ${
								isOnlyVisibleChart
									? "cursor-not-allowed text-neutral-500"
									: "cursor-pointer text-neutral-200 hover:bg-white/[0.04]"
							}`}
						>
							<input
								type="checkbox"
								className="peer sr-only"
								checked={isChecked}
								disabled={isOnlyVisibleChart}
								onChange={() => onToggleChart(chartId)}
							/>
							<span className="flex size-4 items-center justify-center rounded-[2px] border border-[#555b57] bg-[#0f1210] text-[#0b0d0c] peer-checked:border-lime-400 peer-checked:bg-lime-400 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-lime-400">
								{isChecked && (
									<Check size={12} weight="bold" aria-hidden="true" />
								)}
							</span>
							<span>{TELEMETRY_CHART_LABELS[chartId]}</span>
						</label>
					);
				})}
			</div>
		</fieldset>
	);
}

function areDefaultChartsVisible(
	visibleChartIds: readonly TelemetryChartId[],
	defaultVisibleChartIds: readonly TelemetryChartId[],
): boolean {
	return (
		visibleChartIds.length === defaultVisibleChartIds.length &&
		defaultVisibleChartIds.every((chartId) => visibleChartIds.includes(chartId))
	);
}
