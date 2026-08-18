import { Info, X } from "@phosphor-icons/react";
import type { DataQualitySummary } from "../../analysis/data-quality";

interface DataQualityBannerProps {
	readonly summary: DataQualitySummary;
	readonly onViewDetails: () => void;
	readonly onDismiss: () => void;
}

export function DataQualityBanner({
	summary,
	onViewDetails,
	onDismiss,
}: DataQualityBannerProps) {
	if (summary.status !== "unavailable") return null;

	return (
		<section
			className="mx-2 mt-2 flex h-[64px] shrink-0 items-center gap-3 rounded-[4px] border border-red-400/35 bg-red-400/[0.035] px-5"
			aria-live="polite"
		>
			<Info
				className="shrink-0 text-red-300"
				aria-hidden="true"
				size={22}
				weight="bold"
			/>

			<div className="min-w-0 flex-1">
				<h2 className="text-xs font-semibold text-red-300">
					Analysis unavailable
				</h2>
				<p className="mt-1 truncate text-[11px] text-neutral-400">
					{summary.bannerDescription}
				</p>
			</div>

			<button
				className="h-9 shrink-0 rounded-[4px] border border-red-400/40 px-4 text-xs font-medium text-red-200 transition-colors hover:border-red-300 hover:bg-red-400/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
				type="button"
				onClick={onViewDetails}
			>
				View data details
			</button>

			<button
				className="grid size-8 shrink-0 place-items-center rounded-[4px] text-neutral-500 transition-colors hover:bg-white/[0.04] hover:text-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
				type="button"
				aria-label="Dismiss data quality notice"
				onClick={onDismiss}
			>
				<X aria-hidden="true" size={16} />
			</button>
		</section>
	);
}
