import { ArrowsLeftRight, CaretDown } from "@phosphor-icons/react";
import type { LapPickerLap } from "./LapPicker";

interface ComparisonLapSelectProps {
	readonly laps: readonly LapPickerLap[];
	readonly comparedLapNumber: number | null;
	readonly referenceLapNumber: number | null;
	readonly onSelect: (lapNumber: number) => void;
	readonly onSwap: () => void;
}

export function ComparisonLapSelect({
	laps,
	comparedLapNumber,
	referenceLapNumber,
	onSelect,
	onSwap,
}: ComparisonLapSelectProps) {
	const hasCompleteSelection =
		comparedLapNumber !== null && referenceLapNumber !== null;

	return (
		<div className="mt-2">
			<span className="block text-[10px] font-medium tracking-[0.05em] text-neutral-500 uppercase">
				Second lap in charts
			</span>
			<div className="mt-1 flex items-center gap-1.5">
				<div className="relative min-w-0 flex-1">
					<select
						className="h-8 w-full appearance-none truncate rounded-[4px] border border-violet-500/60 bg-violet-500/[0.04] pl-2.5 pr-7 text-xs font-medium text-violet-200 outline-none transition-colors hover:border-violet-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:text-neutral-500"
						aria-label="Second lap shown in charts"
						value={referenceLapNumber ?? ""}
						disabled={!hasCompleteSelection}
						onChange={(event) => onSelect(Number(event.currentTarget.value))}
					>
						{!hasCompleteSelection && (
							<option value="">No comparison lap</option>
						)}
						{laps.map((lap) => (
							<option
								key={lap.lapNumber}
								value={lap.lapNumber}
								disabled={lap.lapNumber === comparedLapNumber}
							>
								{formatComparisonOption(lap)}
							</option>
						))}
					</select>
					<CaretDown
						className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-violet-300"
						aria-hidden="true"
						size={12}
						weight="bold"
					/>
				</div>
				<button
					className="flex h-8 shrink-0 items-center gap-1.5 rounded-[4px] border border-[#353a36] bg-[#111412] px-2.5 text-[11px] font-medium text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400 disabled:cursor-not-allowed disabled:text-neutral-600"
					type="button"
					disabled={!hasCompleteSelection}
					onClick={onSwap}
				>
					<ArrowsLeftRight aria-hidden="true" size={13} />
					Swap
				</button>
			</div>
		</div>
	);
}

function formatComparisonOption(lap: LapPickerLap): string {
	return lap.isFastest
		? `Lap ${lap.lapNumber} · Fastest`
		: `Lap ${lap.lapNumber}`;
}
