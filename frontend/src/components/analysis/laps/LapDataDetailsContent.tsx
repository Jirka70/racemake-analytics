import { Check, Warning } from "@phosphor-icons/react";
import type { LapDataDetails } from "../../../analysis/lap-data-quality";

export function LapDataDetailsContent({
	details,
	compact = false,
}: {
	readonly details: LapDataDetails;
	readonly compact?: boolean;
}) {
	return (
		<div className={compact ? "space-y-4" : "space-y-5"}>
			<section>
				<h4 className="text-[10px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
					What happened
				</h4>
				<ul className="mt-2 space-y-2">
					{details.whatHappened.map((item) => (
						<li
							key={item}
							className="flex gap-2 text-[11px] leading-4 text-neutral-300"
						>
							<Warning
								className="mt-0.5 shrink-0 text-amber-400"
								aria-hidden="true"
								size={13}
								weight="bold"
							/>
							<span>{item}</span>
						</li>
					))}
				</ul>
			</section>

			<section>
				<h4 className="text-[10px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
					What this affects
				</h4>
				<ul className="mt-2 space-y-1.5 text-[11px] leading-4 text-neutral-300">
					{details.whatThisAffects.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
			</section>

			<section>
				<h4 className="text-[10px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
					Still available
				</h4>
				<ul className="mt-2 space-y-1.5">
					{details.stillAvailable.map((item) => (
						<li
							key={item}
							className="flex gap-2 text-[11px] leading-4 text-neutral-300"
						>
							<Check
								className="mt-0.5 shrink-0 text-lime-400"
								aria-hidden="true"
								size={13}
								weight="bold"
							/>
							<span>{item}</span>
						</li>
					))}
				</ul>
			</section>
		</div>
	);
}
