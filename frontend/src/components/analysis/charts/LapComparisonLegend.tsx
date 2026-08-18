import { Minus } from "@phosphor-icons/react";
import type { IdealLapDefinition } from "../../../analysis/ideal-lap";
import type { LapPickerLap } from "../laps/LapPicker";
import { formatLapTimeMs } from "../laps/lap-time-format";

interface LapComparisonLegendProps {
	readonly comparedLap: LapPickerLap;
	readonly referenceLap: LapPickerLap;
	readonly idealLap: IdealLapDefinition | null;
}

export function LapComparisonLegend({
	comparedLap,
	referenceLap,
	idealLap,
}: LapComparisonLegendProps) {
	return (
		<figure className="flex h-[94px] w-[190px] shrink-0 flex-col justify-center gap-1.5 pl-4 pr-2 text-[11px]">
			<figcaption className="sr-only">Chart legend</figcaption>
			<LegendItem
				lap={comparedLap}
				label="Reviewed lap"
				colorClassName="text-lime-400"
			/>
			<LegendItem
				lap={referenceLap}
				label="Second lap"
				colorClassName="text-violet-400"
			/>
			{idealLap && <IdealLegendItem idealLap={idealLap} />}
		</figure>
	);
}

function IdealLegendItem({
	idealLap,
}: {
	readonly idealLap: IdealLapDefinition;
}) {
	return (
		<details className="group relative">
			<summary className="grid cursor-help list-none grid-cols-[18px_auto_1fr] items-center gap-1.5 outline-none focus-visible:text-neutral-100 [&::-webkit-details-marker]:hidden">
				<span
					className="w-[18px] border-t-2 border-dotted border-[#d4d4d8]"
					aria-hidden="true"
				/>
				<span className="font-medium text-neutral-200">Ideal lap</span>
				<span className="text-right tabular-nums text-neutral-400">
					{formatLapTimeMs(idealLap.durationMs)}
				</span>
			</summary>

			<div className="pointer-events-none absolute top-full right-0 z-50 mt-2 hidden w-[320px] rounded-[4px] border border-[#3b403c] bg-[#151815]/98 p-3 shadow-2xl group-open:block group-hover:block">
				<p className="text-[11px] font-semibold tracking-[0.04em] text-neutral-200">
					IDEAL LAP SOURCES
				</p>
				<p className="mt-1 text-[10px] leading-4 text-neutral-500">
					Fastest recorded pass through each region. This is a theoretical lap,
					not one driven lap.
				</p>
				<div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
					{idealLap.regions.map(({ region, sourceLapNumber }) => (
						<div
							key={region.id}
							className="flex items-center justify-between gap-3"
						>
							<span className="text-neutral-400">{region.id}</span>
							<span className="tabular-nums text-neutral-200">
								Lap {sourceLapNumber}
							</span>
						</div>
					))}
				</div>
			</div>
		</details>
	);
}

function LegendItem({
	lap,
	label,
	colorClassName,
}: {
	readonly lap: LapPickerLap;
	readonly label: string;
	readonly colorClassName: string;
}) {
	return (
		<div className="grid grid-cols-[18px_auto_1fr] items-center gap-1.5">
			<span className="sr-only">{label}:</span>
			<Minus
				className={colorClassName}
				size={18}
				weight="bold"
				aria-hidden="true"
			/>
			<span className={`font-medium ${colorClassName}`}>
				Lap {lap.lapNumber}
			</span>
			<span className="text-right tabular-nums text-neutral-400">
				{formatLapTimeMs(lap.lapTimeMs)}
			</span>
		</div>
	);
}
