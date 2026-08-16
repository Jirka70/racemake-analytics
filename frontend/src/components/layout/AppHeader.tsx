import {
	ArrowLeft,
	ArrowsInSimple,
	ArrowsOutSimple,
	CaretLeft,
	CaretRight,
	FolderOpen,
} from "@phosphor-icons/react";
import {
	DataQualityPopover,
	type DataQualityPopoverProps,
} from "./DataQualityPopover";

interface AppHeaderProps {
	readonly showAnalysisControls: boolean;
	readonly racingLapCount: number | null;
	readonly comparedLapNumber: number | null;
	readonly isFullscreen?: boolean;
	readonly onOpenStint?: () => void;
	readonly onBackToAnalysis?: () => void;
	readonly onSelectPreviousLap?: () => void;
	readonly onSelectNextLap?: () => void;
	readonly onToggleFullscreen?: () => void;
	readonly dataQuality?: DataQualityPopoverProps;
}

const iconButtonClassName =
	"grid size-9 shrink-0 place-items-center rounded-[4px] border border-[#303431] bg-[#111412] text-neutral-300 transition-colors hover:border-neutral-600 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400";

export function AppHeader({
	showAnalysisControls,
	racingLapCount,
	comparedLapNumber,
	isFullscreen = false,
	onOpenStint,
	onBackToAnalysis,
	onSelectPreviousLap,
	onSelectNextLap,
	onToggleFullscreen,
	dataQuality,
}: AppHeaderProps) {
	return (
		<header className="relative z-50 grid h-[58px] shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-b border-[#292d2a] bg-[#0b0d0c] px-4">
			<div className="flex min-w-0 items-center gap-5">
				<div className="flex shrink-0 items-center gap-3 pr-5">
					<img
						className="size-[22px] object-contain"
						src="/racemake-mark.png"
						alt="Racemake"
					/>
					<span className="text-[13px] font-semibold tracking-[0.31em] text-neutral-100">
						RACEMAKE
					</span>
				</div>

				<div className="h-9 w-px shrink-0 bg-[#292d2a]" />

				<h1 className="m-0 truncate text-sm font-medium text-neutral-100">
					Stint Analysis
				</h1>

				{racingLapCount !== null && (
					<>
						<div className="hidden h-9 w-px shrink-0 bg-[#292d2a] xl:block" />
						<span className="hidden shrink-0 text-sm text-neutral-300 xl:block">
							{racingLapCount} racing {racingLapCount === 1 ? "lap" : "laps"}
						</span>
					</>
				)}
			</div>

			{showAnalysisControls && (
				<div className="flex items-center gap-2">
					<button
						className={`${iconButtonClassName} disabled:cursor-not-allowed disabled:border-[#252825] disabled:text-neutral-700`}
						type="button"
						aria-label="Review previous lap"
						disabled={!onSelectPreviousLap}
						onClick={onSelectPreviousLap}
					>
						<CaretLeft aria-hidden="true" size={17} weight="bold" />
					</button>
					<div className="flex h-9 min-w-64 items-center justify-center rounded-[4px] border border-[#3a3f3b] bg-[#111412] px-4 text-sm font-medium text-neutral-100">
						<span>
							{comparedLapNumber !== null
								? `Reviewing Lap ${comparedLapNumber}`
								: "Select a lap"}
						</span>
					</div>
					<button
						className={`${iconButtonClassName} disabled:cursor-not-allowed disabled:border-[#252825] disabled:text-neutral-700`}
						type="button"
						aria-label="Review next lap"
						disabled={!onSelectNextLap}
						onClick={onSelectNextLap}
					>
						<CaretRight aria-hidden="true" size={17} weight="bold" />
					</button>
				</div>
			)}

			{showAnalysisControls && (
				<div className="flex items-center justify-end gap-2">
					{onOpenStint && (
						<button
							className="flex h-9 items-center gap-2 rounded-[4px] border border-[#303431] bg-[#111412] px-3 text-sm text-neutral-200 transition-colors hover:border-neutral-600 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400"
							type="button"
							onClick={onOpenStint}
						>
							<FolderOpen aria-hidden="true" size={17} />
							<span>Open stint</span>
						</button>
					)}
					{dataQuality ? <DataQualityPopover {...dataQuality} /> : null}
					{onToggleFullscreen ? (
						<button
							className={iconButtonClassName}
							type="button"
							aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
							title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
							onClick={onToggleFullscreen}
						>
							{isFullscreen ? (
								<ArrowsInSimple aria-hidden="true" size={18} />
							) : (
								<ArrowsOutSimple aria-hidden="true" size={18} />
							)}
						</button>
					) : null}
				</div>
			)}

			{!showAnalysisControls && onBackToAnalysis && (
				<div className="col-start-3 flex items-center justify-end">
					<button
						className="flex h-9 items-center gap-2 rounded-[4px] border border-[#303431] bg-[#111412] px-3 text-sm text-neutral-200 transition-colors hover:border-neutral-600 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400"
						type="button"
						onClick={onBackToAnalysis}
					>
						<ArrowLeft aria-hidden="true" size={17} />
						<span>Back to analysis</span>
					</button>
				</div>
			)}
		</header>
	);
}
