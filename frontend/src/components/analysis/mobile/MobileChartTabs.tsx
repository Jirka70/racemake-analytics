import {
	CaretDown,
	CaretUp,
	ChartLine,
	Circle,
	Engine,
	GearSix,
	RadioButton,
	SlidersHorizontal,
	Speedometer,
	SteeringWheel,
	Thermometer,
	Waveform,
	type Icon,
} from "@phosphor-icons/react";
import { useId, useState } from "react";
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
	const [isOpen, setIsOpen] = useState(false);
	const optionsId = useId();
	const radioGroupName = `${optionsId}-channel`;

	return (
		<nav aria-label="Telemetry channel">
			<button
				type="button"
				className={`flex min-h-12 w-full items-center gap-2.5 border border-[#303431] bg-[#101311] px-3.5 py-3 text-left transition-colors hover:border-[#454a46] hover:bg-[#141715] focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lime-400 ${
					isOpen ? "rounded-t-[3px]" : "rounded-[3px]"
				}`}
				aria-expanded={isOpen}
				aria-controls={optionsId}
				onClick={() => setIsOpen((currentIsOpen) => !currentIsOpen)}
			>
				<Waveform
					className="shrink-0 text-neutral-300"
					size={20}
					weight="bold"
					aria-hidden="true"
				/>
				<span className="text-xs font-semibold tracking-[0.08em] text-neutral-100">
					CHANNELS
				</span>
				<span className="ml-auto text-sm font-semibold text-lime-400">
					{findCompactChartLabel(activeChartId)}
				</span>
				{isOpen ? (
					<CaretUp
						className="shrink-0 text-lime-400"
						size={17}
						weight="bold"
						aria-hidden="true"
					/>
				) : (
					<CaretDown
						className="shrink-0 text-lime-400"
						size={17}
						weight="bold"
						aria-hidden="true"
					/>
				)}
			</button>

			{isOpen && (
				<fieldset
					id={optionsId}
					className="grid grid-cols-2 gap-1.5 rounded-b-[3px] border-x border-b border-[#303431] bg-[#101311] p-2.5"
				>
					<legend className="sr-only">Choose telemetry channel</legend>
					{chartIds.map((chartId) => (
						<MobileChartOption
							key={chartId}
							chartId={chartId}
							groupName={radioGroupName}
							isActive={chartId === activeChartId}
							onSelect={() => {
								onSelectChart(chartId);
								setIsOpen(false);
							}}
						/>
					))}
				</fieldset>
			)}
		</nav>
	);
}

function MobileChartOption({
	chartId,
	groupName,
	isActive,
	onSelect,
}: {
	readonly chartId: TelemetryChartId;
	readonly groupName: string;
	readonly isActive: boolean;
	readonly onSelect: () => void;
}) {
	const ChartIcon = TELEMETRY_CHART_ICONS[chartId];
	const spansBothColumns = chartId === "tyre-temperatures";

	return (
		<label
			className={`flex min-h-12 min-w-0 items-center gap-2.5 rounded-[3px] border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lime-400 ${
				spansBothColumns ? "col-span-2" : ""
			} ${
				isActive
					? "border-lime-400 bg-lime-400/[0.04] text-lime-400"
					: "cursor-pointer border-[#353a36] bg-[#111412] text-neutral-200 hover:border-[#555b57] hover:bg-[#171a18]"
			}`}
		>
			<input
				type="radio"
				className="peer sr-only"
				name={groupName}
				value={chartId}
				checked={isActive}
				onChange={onSelect}
			/>
			<ChartIcon
				className="shrink-0"
				size={20}
				weight="regular"
				aria-hidden="true"
			/>
			<span className="min-w-0 truncate text-xs font-medium">
				{findChartOptionLabel(chartId)}
			</span>
			{isActive ? (
				<RadioButton
					className="ml-auto shrink-0 text-lime-400 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-lime-400"
					size={20}
					weight="fill"
					aria-hidden="true"
				/>
			) : (
				<Circle
					className="ml-auto shrink-0 text-neutral-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-lime-400"
					size={20}
					weight="regular"
					aria-hidden="true"
				/>
			)}
		</label>
	);
}

const TELEMETRY_CHART_ICONS: Readonly<Record<TelemetryChartId, Icon>> = {
	"time-delta": ChartLine,
	speed: Speedometer,
	pedals: SlidersHorizontal,
	steering: SteeringWheel,
	gear: GearSix,
	rpm: Engine,
	"tyre-temperatures": Thermometer,
};

function findCompactChartLabel(chartId: TelemetryChartId): string {
	if (chartId === "time-delta") return "Delta";
	if (chartId === "tyre-temperatures") return "Tyres";
	return TELEMETRY_CHART_LABELS[chartId];
}

function findChartOptionLabel(chartId: TelemetryChartId): string {
	if (chartId === "time-delta") return "Delta";
	return TELEMETRY_CHART_LABELS[chartId];
}
