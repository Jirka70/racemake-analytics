import {
	TELEMETRY_CHART_LABELS,
	type TelemetryChartId,
} from "../../../analysis/telemetry-chart-selection";

export interface MobileChartTabsProps {
	readonly chartIds: readonly TelemetryChartId[];
	readonly activeChartId: TelemetryChartId;
	readonly onSelectChart: (chartId: TelemetryChartId) => void;
}

export function MobileChartTabs({
	chartIds,
	activeChartId,
	onSelectChart,
}: MobileChartTabsProps) {
	return (
		<nav
			className="grid min-h-12 grid-flow-col auto-cols-fr overflow-x-auto rounded-[3px] border border-[#303431] bg-[#101311]"
			aria-label="Telemetry channel"
		>
			{chartIds.map((chartId) => {
				const isActive = chartId === activeChartId;

				return (
					<button
						key={chartId}
						type="button"
						className={`relative min-w-[76px] px-3 py-3 text-xs font-semibold tracking-[0.02em] uppercase transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lime-400 ${
							isActive
								? "bg-white/[0.025] text-lime-400 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-lime-400"
								: "text-neutral-400 hover:text-neutral-100"
						}`}
						aria-pressed={isActive}
						onClick={() => onSelectChart(chartId)}
					>
						{findCompactChartLabel(chartId)}
					</button>
				);
			})}
		</nav>
	);
}

function findCompactChartLabel(chartId: TelemetryChartId): string {
	if (chartId === "time-delta") return "Delta";
	if (chartId === "tyre-temperatures") return "Tyres";
	return TELEMETRY_CHART_LABELS[chartId];
}
