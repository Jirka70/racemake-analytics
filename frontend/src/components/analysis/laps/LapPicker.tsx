import type { ReactNode } from "react";
import type { IdealLapDefinition } from "../../../analysis/ideal-lap";
import { ComparisonLapSelect } from "./ComparisonLapSelect";
import { LapComparisonLegend } from "../charts/LapComparisonLegend";
import { formatLapTimeMs } from "./lap-time-format";
import { LapPickerItem } from "./LapPickerItem";

export interface LapPickerLap {
	readonly lapNumber: number;
	readonly lapTimeMs: number;
	readonly deltaToReferenceMs: number;
	readonly isFastest: boolean;
}

export interface LapPickerProps {
	readonly status: "loading" | "ready" | "empty" | "error";
	readonly laps: readonly LapPickerLap[];
	readonly idealLap: IdealLapDefinition | null;
	readonly comparedLapNumber: number | null;
	readonly referenceLapNumber: number | null;
	readonly errorMessage: string | null;
	readonly onSelectComparedLap: (lapNumber: number) => void;
	readonly onSelectReferenceLap: (lapNumber: number) => void;
	readonly onSwapLaps: () => void;
	readonly chartControls?: ReactNode;
}

export function LapPicker({
	status,
	laps,
	idealLap,
	comparedLapNumber,
	referenceLapNumber,
	errorMessage,
	onSelectComparedLap,
	onSelectReferenceLap,
	onSwapLaps,
	chartControls,
}: LapPickerProps) {
	const comparedLap = laps.find((lap) => lap.lapNumber === comparedLapNumber);
	const referenceLap = laps.find((lap) => lap.lapNumber === referenceLapNumber);

	return (
		<section className="flex min-w-0 rounded-[3px] border border-[#292d2a] bg-[#101311]">
			<div className="w-[238px] shrink-0 px-4 py-3">
				<h2 className="m-0 text-[11px] font-semibold tracking-[0.04em] text-neutral-300">
					CHOOSE A LAP TO REVIEW
				</h2>
				<p className="mt-0.5 text-[11px] text-neutral-500">Select a lap card</p>

				{status === "ready" && (
					<ComparisonLapSelect
						laps={laps}
						comparedLapNumber={comparedLapNumber}
						referenceLapNumber={referenceLapNumber}
						onSelect={onSelectReferenceLap}
						onSwap={onSwapLaps}
					/>
				)}
			</div>

			<div className="flex min-w-0 flex-1">
				<div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-1 py-3">
					{status === "loading" && (
						<p className="text-sm text-neutral-400" aria-live="polite">
							Loading stint…
						</p>
					)}

					{status === "empty" && (
						<div aria-live="polite">
							<p className="text-sm font-medium text-neutral-200">
								No stint selected
							</p>
							<p className="mt-1 text-xs text-neutral-500">
								Open a stint to start comparing laps.
							</p>
						</div>
					)}

					{status === "error" && (
						<div className="max-w-md" role="alert">
							<p className="text-sm font-medium text-red-300">
								We couldn’t load this stint
							</p>
							<p className="mt-1 text-xs text-neutral-400">
								{errorMessage ?? "Try opening it again."}
							</p>
						</div>
					)}

					{status === "ready" && idealLap !== null && (
						<div
							className="flex h-[78px] w-[108px] shrink-0 flex-col rounded-[4px] border border-[#303431] bg-[#111412] px-3 py-2"
							title="Theoretical time composed from the fastest observed pass through each region"
						>
							<span className="text-xs font-medium text-neutral-300">
								Ideal
							</span>
							<span className="mt-1 text-sm font-semibold tabular-nums text-neutral-100">
								{formatLapTimeMs(idealLap.durationMs)}
							</span>
							<span className="mt-auto whitespace-nowrap text-[11px] text-neutral-500">
								Best sections
							</span>
						</div>
					)}

					{status === "ready" &&
						laps.map((lap) => (
							<LapPickerItem
								key={lap.lapNumber}
								{...lap}
								isSelected={lap.lapNumber === comparedLapNumber}
								isReference={lap.lapNumber === referenceLapNumber}
								onSelect={onSelectComparedLap}
							/>
						))}

					{status === "ready" && laps.length === 0 && (
						<p className="text-sm text-neutral-400">
							No racing laps are available for comparison.
						</p>
					)}
				</div>

				{status === "ready" && comparedLap && referenceLap && (
					<div className="ml-auto flex h-[78px] shrink-0 border-l border-[#292d2a]">
						<LapComparisonLegend
							comparedLap={comparedLap}
							referenceLap={referenceLap}
							idealLap={idealLap}
						/>
						{chartControls}
					</div>
				)}
			</div>
		</section>
	);
}
