import { X } from "@phosphor-icons/react";
import { useLayoutEffect, useRef, useState } from "react";
import type {
	TelemetryChartLapRole,
	TelemetryChartMeasurement,
} from "../../../analysis/telemetry-chart";
import type {
	TelemetryChartPlotInsets,
	TelemetryChartPresentation,
} from "../../../analysis/telemetry-chart-layout";
import type { TelemetrySeriesSelection } from "../../../analysis/telemetry-series-selection";
import {
	resolveTelemetryTooltipPosition,
	type TelemetryTooltipRectangle,
} from "../../../analysis/telemetry-tooltip-position";
import {
	TELEMETRY_TOOLTIP_LAYOUT_EVENT,
	TELEMETRY_TOOLTIP_PRIORITY,
} from "./TelemetryFloatingTooltip";

export interface SelectedTelemetrySeriesAnchor {
	readonly plotXRatio: number;
	readonly chartYRatio: number;
}

export function SelectedTelemetrySeriesPanel({
	selection,
	color,
	presentation,
	anchor,
	plotInsets,
	getTooltipObstacles,
	onClear,
}: {
	readonly selection: TelemetrySeriesSelection;
	readonly color: string;
	readonly presentation: TelemetryChartPresentation;
	readonly anchor: SelectedTelemetrySeriesAnchor;
	readonly plotInsets: TelemetryChartPlotInsets;
	readonly getTooltipObstacles: (
		excludedElement: HTMLElement,
	) => readonly TelemetryTooltipRectangle[];
	readonly onClear: () => void;
}) {
	const panelRef = useRef<HTMLElement>(null);
	const [position, setPosition] = useState<readonly [number, number] | null>(
		null,
	);
	const primaryValue = formatPrimaryValue(
		selection.value,
		selection.measurement,
	);
	const comparisonColor = selection.comparison
		? findRoleColor(selection.comparison.role)
		: null;
	const measurementName = formatMeasurementName(selection.measurement);

	useLayoutEffect(() => {
		const panel = panelRef.current;
		const chartSurface = panel?.parentElement;
		if (!panel || !chartSurface) return;

		let animationFrameId: number | null = null;
		const updatePosition = (): void => {
			animationFrameId = null;
			const surfaceBounds = chartSurface.getBoundingClientRect();
			const panelBounds = panel.getBoundingClientRect();
			const plotWidth = Math.max(
				0,
				surfaceBounds.width - plotInsets.leftPx - plotInsets.rightPx,
			);
			const nextPosition = resolveTelemetryTooltipPosition({
				anchorX: plotInsets.leftPx + anchor.plotXRatio * plotWidth,
				anchorY: anchor.chartYRatio * surfaceBounds.height,
				tooltipWidth: panelBounds.width,
				tooltipHeight: panelBounds.height,
				viewWidth: surfaceBounds.width,
				viewHeight: surfaceBounds.height,
				obstacles: getTooltipObstacles(panel),
			});
			setPosition((currentPosition) =>
				currentPosition?.[0] === nextPosition[0] &&
				currentPosition[1] === nextPosition[1]
					? currentPosition
					: nextPosition,
			);
		};
		const schedulePositionUpdate = (): void => {
			if (animationFrameId !== null) return;
			animationFrameId = requestAnimationFrame(updatePosition);
		};

		updatePosition();
		const resizeObserver = new ResizeObserver(schedulePositionUpdate);
		resizeObserver.observe(chartSurface);
		resizeObserver.observe(panel);
		chartSurface.addEventListener("pointermove", schedulePositionUpdate, true);
		chartSurface.addEventListener("focusin", schedulePositionUpdate, true);
		chartSurface.addEventListener("focusout", schedulePositionUpdate, true);
		chartSurface.addEventListener(
			TELEMETRY_TOOLTIP_LAYOUT_EVENT,
			schedulePositionUpdate,
		);

		return () => {
			resizeObserver.disconnect();
			chartSurface.removeEventListener(
				"pointermove",
				schedulePositionUpdate,
				true,
			);
			chartSurface.removeEventListener("focusin", schedulePositionUpdate, true);
			chartSurface.removeEventListener(
				"focusout",
				schedulePositionUpdate,
				true,
			);
			chartSurface.removeEventListener(
				TELEMETRY_TOOLTIP_LAYOUT_EVENT,
				schedulePositionUpdate,
			);
			if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
		};
	}, [anchor, getTooltipObstacles, plotInsets]);

	useLayoutEffect(() => {
		if (position === null) return;
		panelRef.current
			?.closest<HTMLElement>("[data-telemetry-chart-surface]")
			?.dispatchEvent(new CustomEvent(TELEMETRY_TOOLTIP_LAYOUT_EVENT));
	}, [position]);

	return (
		<aside
			ref={panelRef}
			className={`pointer-events-auto absolute z-[240] border bg-[#111412]/97 shadow-2xl backdrop-blur-sm ${
				presentation === "compact"
					? "w-[min(238px,calc(100%-24px))] rounded-[4px] p-1.5 min-[520px]:p-2.5"
					: "w-[min(252px,calc(100%-24px))] rounded-[3px] p-3"
			}`}
			style={{
				borderColor: `${color}99`,
				left: position?.[0] ?? 0,
				top: position?.[1] ?? 0,
				visibility: position === null ? "hidden" : "visible",
			}}
			aria-label="Selected telemetry series"
			data-telemetry-series-panel
			data-telemetry-tooltip
			data-telemetry-tooltip-priority={
				TELEMETRY_TOOLTIP_PRIORITY.selectedSeries
			}
		>
			<div className="flex items-center gap-2">
				<span
					className="h-2 w-4 rounded-[1px]"
					style={{ backgroundColor: color }}
					aria-hidden="true"
				/>
				<span className="text-[9px] font-semibold tracking-[0.12em] text-neutral-400">
					SELECTED SERIES
				</span>
				<button
					className="ml-auto grid size-7 place-items-center rounded-[3px] bg-white/[0.04] text-neutral-400 transition-colors hover:bg-white/[0.09] hover:text-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 min-[520px]:size-8"
					style={{ outlineColor: color }}
					type="button"
					aria-label="Close selected series details"
					title="Close selected series details"
					onClick={onClear}
				>
					<X aria-hidden="true" size={18} />
				</button>
			</div>

			<h3 className="mt-1 text-[12px] font-semibold" style={{ color }}>
				{selection.lineName} · {measurementName}
			</h3>

			<div className="mt-2 flex items-baseline justify-between gap-3 text-[11px] min-[520px]:mt-3">
				<span className="text-neutral-400">Track position</span>
				<strong className="font-semibold" style={{ color }}>
					{selection.positionPercent.toFixed(1)}%
				</strong>
			</div>

			<p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-neutral-500 min-[520px]:mt-3">
				Selected {measurementName.toLowerCase()}
			</p>
			<p className="mt-1 flex items-baseline gap-1.5 text-neutral-100">
				<strong className="text-[24px] font-medium leading-none">
					{primaryValue.value}
					{selection.measurement === "steering" ? (
						<sup className="ml-0.5 align-super text-[11px] leading-none">°</sup>
					) : null}
				</strong>
				{selection.measurement === "steering" ? null : (
					<span className="text-[12px] text-neutral-300">
						{primaryValue.unit}
					</span>
				)}
			</p>

			<dl className="mt-2.5 space-y-1.5 text-[11px] min-[520px]:mt-4 min-[520px]:space-y-2">
				{selection.comparison ? (
					<div className="flex items-center justify-between gap-3">
						<dt
							className="min-w-0 truncate"
							style={{ color: comparisonColor ?? undefined }}
						>
							Comparison · {selection.comparison.lineName}
						</dt>
						<dd className="shrink-0 text-neutral-200">
							{selection.comparison.value === null
								? "No data"
								: formatInlineValue(
										selection.comparison.value,
										selection.measurement,
									)}
						</dd>
					</div>
				) : null}

				{selection.difference !== null ? (
					<div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3">
						<dt className="truncate text-neutral-400">
							Difference vs {selection.comparison?.lineName ?? "comparison"}
						</dt>
						<dd className="shrink-0 font-medium" style={{ color }}>
							{formatDelta(selection.difference, selection.measurement)}
						</dd>
						<dd className="col-span-2 mt-0.5 text-[9px] text-neutral-600">
							Selected value − comparison value
						</dd>
					</div>
				) : null}

				<div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-2">
					<dt className="text-neutral-400">Selected series telemetry</dt>
					<dd
						className={
							selection.telemetryStatus === "complete"
								? "text-lime-300"
								: "text-amber-300"
						}
					>
						{selection.telemetryStatus === "complete" ? "Complete" : "Partial"}
					</dd>
				</div>
			</dl>

			<p className="mt-2 border-t border-white/[0.06] pt-1.5 text-[9px] leading-relaxed text-neutral-500 min-[520px]:mt-3 min-[520px]:pt-2">
				<strong className="font-semibold text-neutral-400">Close:</strong>{" "}
				{presentation === "desktop"
					? "click ×, click elsewhere in the chart, or press Esc"
					: "tap × or tap elsewhere in the chart"}
			</p>
		</aside>
	);
}

interface FormattedPrimaryValue {
	readonly value: string;
	readonly unit: string;
}

function formatPrimaryValue(
	value: number,
	measurement: TelemetryChartMeasurement,
): FormattedPrimaryValue {
	if (measurement === "time-delta") {
		return { value: formatSigned(value, 3), unit: "s" };
	}
	if (measurement === "speed") {
		return { value: value.toFixed(1), unit: "km/h" };
	}
	if (measurement === "pedal") {
		return {
			value: Math.abs(value).toFixed(0),
			unit: value < 0 ? "% brake" : "% throttle",
		};
	}
	if (measurement === "steering") {
		return { value: formatSigned(value, 1), unit: "°" };
	}
	if (measurement === "gear") {
		return { value: formatGear(value), unit: "gear" };
	}
	if (measurement === "rpm") {
		return { value: Math.round(value).toLocaleString("en-US"), unit: "rpm" };
	}
	return { value: value.toFixed(1), unit: "°C" };
}

function formatInlineValue(
	value: number,
	measurement: TelemetryChartMeasurement,
): string {
	const formatted = formatPrimaryValue(value, measurement);
	return `${formatted.value} ${formatted.unit}`;
}

function formatDelta(
	value: number,
	measurement: TelemetryChartMeasurement,
): string {
	if (measurement === "time-delta") return `${formatSigned(value, 3)} s`;
	if (measurement === "speed") return `${formatSigned(value, 1)} km/h`;
	if (measurement === "pedal") return `${formatSigned(value, 1)} pp`;
	if (measurement === "steering") return `${formatSigned(value, 1)}°`;
	if (measurement === "gear") return `${formatSigned(value, 0)} gear`;
	if (measurement === "rpm") return `${formatSigned(value, 0)} rpm`;
	return `${formatSigned(value, 1)}°C`;
}

function formatMeasurementName(measurement: TelemetryChartMeasurement): string {
	if (measurement === "time-delta") return "Time delta";
	if (measurement === "pedal") return "Pedals";
	if (measurement === "tyre-temperature") return "Tyre temperature";
	return `${measurement.slice(0, 1).toUpperCase()}${measurement.slice(1)}`;
}

function formatSigned(value: number, decimals: number): string {
	const rounded = value.toFixed(decimals);
	return value > 0 ? `+${rounded}` : rounded;
}

function formatGear(value: number): string {
	const gear = Math.round(value);
	if (gear === -1) return "R";
	if (gear === 0) return "N";
	return gear.toFixed(0);
}

function findRoleColor(role: TelemetryChartLapRole): string {
	if (role === "reviewed") return "#a3e635";
	if (role === "second") return "#a78bfa";
	return "#d4d4d8";
}
