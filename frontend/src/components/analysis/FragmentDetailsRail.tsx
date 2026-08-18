import { ChartDonut, Flag, FlagCheckered } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import type { LapFragmentPresentation } from "../../analysis/lap-fragment-presentation";

export function FragmentDetailsRail({
	fragment,
}: {
	readonly fragment: LapFragmentPresentation;
}) {
	return (
		<aside className="flex h-full min-h-0 flex-col rounded-[3px] border border-[#292d2a] bg-[#101311]">
			<header className="flex h-[58px] shrink-0 items-center border-b border-[#292d2a] px-5">
				<h2 className="m-0 text-xs font-semibold tracking-[0.04em] text-neutral-200">
					FRAGMENT DETAILS
				</h2>
			</header>

			<div className="p-5">
				<FragmentFact
					icon={<ChartDonut size={20} weight="light" aria-hidden="true" />}
					text={`${formatPercentage(fragment.capturedRatio)} captured`}
				/>
				<FragmentFact
					icon={<Flag size={20} weight="light" aria-hidden="true" />}
					text={
						fragment.startPosition === 0
							? "Starts at lap start"
							: `Starts at ${formatPercentage(fragment.startPosition)}`
					}
				/>
				<FragmentFact
					icon={<FlagCheckered size={20} weight="light" aria-hidden="true" />}
					text={
						fragment.endPosition === 1
							? "Ends at lap finish"
							: `Ends at ${formatPercentage(fragment.endPosition)}`
					}
				/>

				<div className="mt-6 border-t border-[#292d2a] pt-5">
					<p className="text-sm leading-6 text-neutral-400">
						This view is for inspecting recorded inputs only. Fragment data is
						not used for lap comparison or coaching.
					</p>
				</div>
			</div>
		</aside>
	);
}

function FragmentFact({
	icon,
	text,
}: {
	readonly icon: ReactNode;
	readonly text: string;
}) {
	return (
		<div className="mb-4 flex items-center gap-3 text-neutral-300">
			<span className="text-amber-400">{icon}</span>
			<span className="text-sm">{text}</span>
		</div>
	);
}

function formatPercentage(ratio: number): string {
	return `${(ratio * 100).toFixed(1)}%`;
}
