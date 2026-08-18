import { CheckCircle } from "@phosphor-icons/react";
import type { LapFragmentPresentation } from "../../../analysis/lap-fragment-presentation";

interface LapFragmentPickerItemProps {
	readonly fragment: LapFragmentPresentation;
	readonly isSelected: boolean;
	readonly onSelect: (fragmentIndex: number) => void;
}

export function LapFragmentPickerItem({
	fragment,
	isSelected,
	onSelect,
}: LapFragmentPickerItemProps) {
	const capturedPercentage = formatPercentage(fragment.capturedRatio);
	const title = createFragmentDescription(fragment);

	return (
		<button
			data-review-card-key={`fragment:${fragment.fragmentIndex}`}
			className={`relative flex h-[94px] w-[138px] shrink-0 flex-col rounded-[4px] border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
				isSelected
					? "border-amber-400 bg-amber-400/[0.04] text-amber-300"
					: "border-[#303431] bg-[#111412] text-neutral-300 hover:border-neutral-600"
			}`}
			type="button"
			aria-pressed={isSelected}
			aria-label={title}
			title={title}
			onClick={() => onSelect(fragment.fragmentIndex)}
		>
			<span className="text-xs font-medium">{fragment.label}</span>
			{isSelected ? (
				<CheckCircle
					className="absolute right-2 top-2 text-amber-400"
					aria-hidden="true"
					size={15}
					weight="fill"
				/>
			) : null}
			<span className="mt-1 text-[11px] tabular-nums text-neutral-400">
				{capturedPercentage} captured
			</span>
			<span className="mt-0.5 whitespace-nowrap text-[10px] tabular-nums text-neutral-500">
				{formatPercentage(fragment.startPosition)} →{" "}
				{formatPercentage(fragment.endPosition)}
			</span>
			<div
				className="relative mt-1 h-1.5 overflow-hidden rounded-[2px] border border-[#303431] bg-[#202321]"
				aria-hidden="true"
			>
				{fragment.capturedRanges.map((range) => (
					<span
						key={`${range.startPosition}:${range.endPosition}`}
						className={`absolute inset-y-0 ${isSelected ? "bg-amber-400" : "bg-lime-400"}`}
						style={{
							left: `${range.startPosition * 100}%`,
							width: `${(range.endPosition - range.startPosition) * 100}%`,
						}}
					/>
				))}
			</div>
			<span
				className={`mt-1 text-[10px] ${isSelected ? "text-amber-300" : "text-neutral-500"}`}
			>
				{isSelected ? "Inspecting" : "Partial telemetry"}
			</span>
		</button>
	);
}

function createFragmentDescription(fragment: LapFragmentPresentation): string {
	const capturedPercentage = formatPercentage(fragment.capturedRatio);
	const startPercentage = formatPercentage(fragment.startPosition);
	const endPercentage = formatPercentage(fragment.endPosition);

	return `${fragment.label}. ${capturedPercentage} captured from ${startPercentage} to ${endPercentage}. No complete lap time and not used for comparison or coaching.`;
}

function formatPercentage(ratio: number): string {
	return `${(ratio * 100).toFixed(1)}%`;
}
