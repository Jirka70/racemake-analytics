import { CheckCircle } from "@phosphor-icons/react";
import { formatLapDeltaMs, formatLapTimeMs } from "./lap-time-format";

export interface LapPickerItemProps {
	readonly lapNumber: number;
	readonly lapTimeMs: number;
	readonly deltaToReferenceMs: number;
	readonly isSelected: boolean;
	readonly isReference: boolean;
	readonly isFastest: boolean;
	readonly onSelect: (lapNumber: number) => void;
}

export function LapPickerItem({
	lapNumber,
	lapTimeMs,
	deltaToReferenceMs,
	isSelected,
	isReference,
	isFastest,
	onSelect,
}: LapPickerItemProps) {
	const stateClassName = isSelected
		? "border-lime-400 bg-lime-400/[0.04] text-lime-300"
		: isReference
			? "cursor-default border-violet-500/70 bg-violet-500/[0.04] text-violet-300"
			: "border-[#303431] bg-[#111412] text-neutral-300 hover:border-neutral-600";
	const stateLabel = isSelected
		? "Reviewing"
		: isReference
			? "In charts"
			: isFastest
				? "Fastest"
				: formatLapDeltaMs(deltaToReferenceMs);

	return (
		<button
			className={`relative flex h-[78px] w-[108px] shrink-0 flex-col rounded-[4px] border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400 ${stateClassName}`}
			type="button"
			aria-pressed={isSelected}
			aria-label={`Lap ${lapNumber}, ${formatLapTimeMs(lapTimeMs)}, ${stateLabel}`}
			disabled={isReference}
			onClick={() => onSelect(lapNumber)}
		>
			<span className="text-xs font-medium">Lap {lapNumber}</span>

			{isSelected && (
				<CheckCircle
					className="absolute right-2 top-2 text-lime-400"
					aria-hidden="true"
					size={15}
					weight="fill"
				/>
			)}

			<span className="mt-1 text-sm font-semibold tabular-nums text-neutral-100">
				{formatLapTimeMs(lapTimeMs)}
			</span>

			<span className="mt-auto text-[11px] tabular-nums text-neutral-400">
				{stateLabel}
			</span>
		</button>
	);
}
