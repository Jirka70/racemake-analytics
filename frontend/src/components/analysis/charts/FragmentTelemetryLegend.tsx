import { Minus } from "@phosphor-icons/react";
import type { LapFragmentPresentation } from "../../../analysis/lap-fragment-presentation";

interface FragmentTelemetryLegendProps {
	readonly fragment: LapFragmentPresentation;
}

export function FragmentTelemetryLegend({
	fragment,
}: FragmentTelemetryLegendProps) {
	const capturedPercentage = `${(fragment.capturedRatio * 100).toFixed(1)}%`;

	return (
		<figure className="flex h-[94px] w-[190px] shrink-0 flex-col justify-center pl-4 pr-2 text-[11px]">
			<figcaption className="sr-only">Chart legend</figcaption>
			<div className="grid grid-cols-[18px_auto_1fr] items-center gap-1.5">
				<span className="sr-only">Reviewed fragment:</span>
				<Minus
					className="text-lime-400"
					size={18}
					weight="bold"
					aria-hidden="true"
				/>
				<span className="truncate font-medium text-lime-400">
					{fragment.label}
				</span>
				<span
					className="text-right tabular-nums text-neutral-400"
					title={`${capturedPercentage} captured`}
				>
					{capturedPercentage}
				</span>
			</div>
		</figure>
	);
}
