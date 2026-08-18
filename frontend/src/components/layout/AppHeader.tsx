import {
	ArrowLeft,
	ArrowsInSimple,
	ArrowsOutSimple,
	CaretLeft,
	CaretRight,
	FolderOpen,
} from "@phosphor-icons/react";
import { useCompactAnalysisLayout } from "../../hooks/use-compact-analysis-layout";
import {
	DataQualityPopover,
	type DataQualityPopoverProps,
} from "./DataQualityPopover";

interface AppHeaderProps {
	readonly showAnalysisControls: boolean;
	readonly racingLapCount: number | null;
	readonly comparedLapNumber: number | null;
	readonly reviewTitle?: string;
	readonly reviewTone?: "default" | "fragment";
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

const compactActionButtonClassName =
	"flex h-8 min-w-8 shrink-0 items-center justify-center gap-0 whitespace-nowrap rounded-[4px] border border-[#303431] bg-[#111412] px-2 text-[11px] text-neutral-200 transition-colors hover:border-neutral-600 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400 min-[720px]:gap-2 min-[720px]:px-3 min-[720px]:text-xs";

export function AppHeader({
	showAnalysisControls,
	racingLapCount,
	comparedLapNumber,
	reviewTitle,
	reviewTone = "default",
	isFullscreen = false,
	onOpenStint,
	onBackToAnalysis,
	onSelectPreviousLap,
	onSelectNextLap,
	onToggleFullscreen,
	dataQuality,
}: AppHeaderProps) {
	const isCompact = useCompactAnalysisLayout();

	if (isCompact) {
		return (
			<header className="relative z-50 grid h-[52px] shrink-0 grid-cols-[minmax(32px,1fr)_auto_minmax(68px,1fr)] items-center gap-1.5 border-b border-[#292d2a] bg-[#0b0d0c] px-2.5">
				<div className="flex min-w-0 items-center gap-2">
					<img
						className="size-[18px] shrink-0 object-contain"
						src="/racemake-mark.png"
						alt="Racemake"
					/>
					<span className="hidden truncate text-[9px] font-semibold tracking-[0.2em] text-neutral-100 min-[520px]:inline">
						RACEMAKE
					</span>
				</div>

				<h1 className="m-0 truncate px-1 text-center text-[9px] font-semibold tracking-[0.04em] text-neutral-100 uppercase min-[420px]:text-[10px]">
					Stint Analysis
				</h1>

				<div className="flex min-w-0 items-center justify-end gap-1.5">
					{showAnalysisControls && onOpenStint ? (
						<button
							className={compactActionButtonClassName}
							type="button"
							aria-label="Open stint"
							onClick={onOpenStint}
						>
							<FolderOpen aria-hidden="true" size={17} />
							<span className="sr-only min-[720px]:not-sr-only">
								Open stint
							</span>
						</button>
					) : null}
					{showAnalysisControls && dataQuality ? (
						<DataQualityPopover {...dataQuality} presentation="compact" />
					) : null}
					{!showAnalysisControls && onBackToAnalysis ? (
						<button
							className={iconButtonClassName}
							type="button"
							aria-label="Back to analysis"
							onClick={onBackToAnalysis}
						>
							<ArrowLeft aria-hidden="true" size={17} />
						</button>
					) : null}
				</div>
			</header>
		);
	}

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
					<div
						className={`flex h-9 w-56 min-w-0 items-center justify-center rounded-[4px] border bg-[#111412] px-3 text-sm font-medium 2xl:w-64 ${
							reviewTone === "fragment"
								? "border-amber-400/40 text-amber-300"
								: "border-[#3a3f3b] text-neutral-100"
						}`}
					>
						<span className="truncate">
							{reviewTitle ??
								(comparedLapNumber !== null
									? `Reviewing Lap ${comparedLapNumber}`
									: "Select a lap")}
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
							className="flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-[4px] border border-[#303431] bg-[#111412] px-3 text-sm text-neutral-200 transition-colors hover:border-neutral-600 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400"
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
