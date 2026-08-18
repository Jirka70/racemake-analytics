import { WarningCircle } from "@phosphor-icons/react";
import type { LapFragmentPresentation } from "../../../analysis/lap-fragment-presentation";

export function MobileFragmentSheet({
	fragment,
}: {
	readonly fragment: LapFragmentPresentation;
}) {
	return (
		<aside
			className="fixed inset-x-0 bottom-0 z-40 overflow-hidden rounded-t-[14px] border border-[#343936] bg-[#121513]/[0.985] px-6 pb-[calc(24px+env(safe-area-inset-bottom))] shadow-[0_-18px_50px_rgba(0,0,0,0.5)] backdrop-blur-sm"
			aria-label="Fragment review"
		>
			<div className="flex h-7 items-center justify-center" aria-hidden="true">
				<span className="h-1 w-10 rounded-full bg-neutral-500" />
			</div>
			<div className="flex items-center gap-3 text-amber-300">
				<WarningCircle size={24} weight="light" aria-hidden="true" />
				<span className="rounded-[3px] border border-amber-400/60 px-2 py-1 text-[10px] font-semibold tracking-[0.05em] uppercase">
					Partial telemetry
				</span>
			</div>
			<h2 className="mt-4 text-lg font-semibold text-neutral-100 uppercase">
				Fragment review
			</h2>
			<p className="mt-3 text-sm leading-6 text-neutral-300">
				No complete lap time. This fragment is not used for comparison or
				coaching.
			</p>
			<p className="mt-3 text-xs tabular-nums text-neutral-500">
				{formatPercentage(fragment.capturedRatio)} captured · track position{" "}
				{formatPercentage(fragment.startPosition)}–
				{formatPercentage(fragment.endPosition)}
			</p>
		</aside>
	);
}

function formatPercentage(ratio: number): string {
	return `${(ratio * 100).toFixed(1)}%`;
}
