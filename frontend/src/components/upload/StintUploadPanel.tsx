import {
	ArrowClockwise,
	CheckCircle,
	Circle,
	FileText,
	FolderOpen,
	SpinnerGap,
	UploadSimple,
	WarningCircle,
} from "@phosphor-icons/react";
import {
	type ChangeEvent,
	type DragEvent,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	ANALYSIS_STAGES,
	type AnalysisId,
	type AnalysisProgressEvent,
	type AnalysisStage,
} from "../../../../src/http/contracts";
import { ApiError } from "../../api/api-client";
import { useIngestStintMutation } from "../../hooks/use-ingest-stint-mutation";
import {
	STINT_FILE_INPUT_ACCEPT,
	type StintFileValidationIssue,
	validateStintFileSelection,
} from "../../upload/stint-file-policy";
import {
	calculateAnalysisProgressPercentage,
	findAnalysisStageEvent,
	findAnalysisStageVisualStatus,
	findCurrentAnalysisMessage,
	formatAnalysisStageMessage,
} from "../../upload/analysis-progress-presentation";

interface StintUploadPanelProps {
	readonly onAnalysisReady: (analysisId: AnalysisId) => void;
}

const secondaryButtonClassName =
	"inline-flex h-9 items-center justify-center gap-2 rounded-[4px] border border-[#393e3a] bg-[#151815] px-4 text-sm font-medium text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400";

export function StintUploadPanel({ onAnalysisReady }: StintUploadPanelProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const dragDepthRef = useRef(0);
	const [isDragging, setIsDragging] = useState(false);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [validationIssues, setValidationIssues] = useState<
		readonly StintFileValidationIssue[]
	>([]);
	const ingestMutation = useIngestStintMutation();
	const validationMessage = validationIssues[0]?.message ?? null;
	const ingestErrorMessage = ingestMutation.isError
		? findIngestErrorMessage(ingestMutation.error)
		: null;
	const errorMessage = validationMessage ?? ingestErrorMessage;

	function openFilePicker(): void {
		if (ingestMutation.isPending) return;

		if (inputRef.current) {
			inputRef.current.value = "";
			inputRef.current.click();
		}
	}

	function analyzeFile(file: File): void {
		setSelectedFile(file);
		setValidationIssues([]);
		ingestMutation.reset();
		ingestMutation.mutate(file, {
			onSuccess: (response) => onAnalysisReady(response.analysisId),
		});
	}

	function processFiles(files: readonly File[]): void {
		if (ingestMutation.isPending) return;

		const validation = validateStintFileSelection(files);
		if (validation.status === "invalid") {
			setSelectedFile(null);
			setValidationIssues(validation.issues);
			ingestMutation.reset();
			return;
		}

		analyzeFile(validation.file);
	}

	function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
		processFiles(Array.from(event.currentTarget.files ?? []));
		event.currentTarget.value = "";
	}

	function handleDragEnter(event: DragEvent<HTMLElement>): void {
		event.preventDefault();
		if (ingestMutation.isPending) return;

		dragDepthRef.current += 1;
		setIsDragging(true);
	}

	function handleDragOver(event: DragEvent<HTMLElement>): void {
		event.preventDefault();
		if (ingestMutation.isPending) return;

		event.dataTransfer.dropEffect = "copy";
	}

	function handleDragLeave(event: DragEvent<HTMLElement>): void {
		event.preventDefault();
		if (ingestMutation.isPending) return;

		dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
		if (dragDepthRef.current === 0) setIsDragging(false);
	}

	function handleDrop(event: DragEvent<HTMLElement>): void {
		event.preventDefault();
		dragDepthRef.current = 0;
		setIsDragging(false);
		processFiles(Array.from(event.dataTransfer.files));
	}

	function retryAnalysis(): void {
		if (selectedFile) analyzeFile(selectedFile);
	}

	const panelClassName = isDragging
		? "border-lime-400 bg-[#131814]"
		: errorMessage
			? "border-red-400/50 bg-[#151211]"
			: "border-[#303531] bg-[#101311]";

	return (
		<main className="flex min-h-0 flex-1 items-center justify-center p-8">
			<section
				className={`flex min-h-[330px] w-full max-w-[540px] flex-col items-center justify-center rounded-[4px] border px-10 py-12 text-center transition-colors duration-150 ${panelClassName}`}
				aria-label="Open a stint"
				aria-busy={ingestMutation.isPending}
				onDragEnter={handleDragEnter}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
			>
				<input
					ref={inputRef}
					className="sr-only"
					type="file"
					accept={STINT_FILE_INPUT_ACCEPT}
					aria-label="Choose a RACEMAKE stint JSON file"
					onChange={handleFileChange}
				/>

				<div
					className="flex min-h-[230px] w-full flex-col items-center justify-center"
					aria-live="polite"
				>
					{ingestMutation.isPending && selectedFile ? (
						<PendingContent
							file={selectedFile}
							progressEvents={ingestMutation.progressEvents}
						/>
					) : errorMessage ? (
						<ErrorContent
							message={errorMessage}
							file={selectedFile}
							canRetry={selectedFile !== null && ingestMutation.isError}
							onRetry={retryAnalysis}
							onChooseAnother={openFilePicker}
						/>
					) : (
						<IdleContent
							isDragging={isDragging}
							onChooseFile={openFilePicker}
						/>
					)}
				</div>
			</section>
		</main>
	);
}

interface IdleContentProps {
	readonly isDragging: boolean;
	readonly onChooseFile: () => void;
}

function IdleContent({ isDragging, onChooseFile }: IdleContentProps) {
	return (
		<>
			<StatusIcon>
				<UploadSimple aria-hidden="true" size={23} />
			</StatusIcon>
			<h2 className="mt-5 text-xl font-medium tracking-[-0.02em] text-neutral-100">
				{isDragging ? "Release to analyze" : "Open a stint"}
			</h2>
			<p className="mt-2 max-w-sm text-sm leading-6 text-neutral-400">
				{isDragging ? (
					"The stint will be analyzed as soon as you drop the file."
				) : (
					<>
						Drop a RACEMAKE JSON file here or{" "}
						<button
							className="font-medium text-neutral-200 underline decoration-neutral-500 underline-offset-4 transition-colors hover:text-lime-300 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-400"
							type="button"
							onClick={onChooseFile}
						>
							choose a file
						</button>
						.
					</>
				)}
			</p>
			<p className="mt-5 text-[11px] font-medium tracking-[0.08em] text-neutral-600 uppercase">
				RACEMAKE JSON · Maximum 100 MB
			</p>
		</>
	);
}

function PendingContent({
	file,
	progressEvents,
}: {
	readonly file: File;
	readonly progressEvents: readonly AnalysisProgressEvent[];
}) {
	const elapsedSeconds = useElapsedSeconds();
	const progressPercentage = calculateAnalysisProgressPercentage(progressEvents);
	const currentMessage = findCurrentAnalysisMessage(progressEvents);

	return (
		<>
			<StatusIcon>
				<span className="animate-spin motion-reduce:animate-none">
					<SpinnerGap aria-hidden="true" size={23} />
				</span>
			</StatusIcon>
			<p className="mt-5 text-[11px] font-semibold tracking-[0.11em] text-lime-300 uppercase">
				Analyzing stint
			</p>
			<h2 className="mt-2 text-xl font-medium tracking-[-0.02em] text-neutral-100">
				{currentMessage}
			</h2>
			<FileSummary file={file} />

			<div className="mt-6 w-full max-w-sm">
				<div className="mb-2 flex items-center justify-between text-[11px] font-medium tracking-[0.04em] text-neutral-500 uppercase">
					<span>{formatElapsedTime(elapsedSeconds)} elapsed</span>
					<span className="tabular-nums text-neutral-300">
						{progressPercentage}%
					</span>
				</div>
				<div
					className="h-1 overflow-hidden rounded-full bg-[#282d29]"
					role="progressbar"
					aria-label="Stint analysis progress"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={progressPercentage}
				>
					<div
						className="h-full rounded-full bg-lime-400 transition-[width] duration-300 ease-out"
						style={{ width: `${progressPercentage}%` }}
					/>
				</div>

				<ol className="mt-5 grid gap-2.5 text-left">
					{ANALYSIS_STAGES.map((stage) => (
						<AnalysisStageRow
							key={stage}
							stage={stage}
							progressEvents={progressEvents}
						/>
					))}
				</ol>
			</div>
		</>
	);
}

function AnalysisStageRow({
	stage,
	progressEvents,
}: {
	readonly stage: AnalysisStage;
	readonly progressEvents: readonly AnalysisProgressEvent[];
}) {
	const event = findAnalysisStageEvent(stage, progressEvents);
	const status = findAnalysisStageVisualStatus(
		stage,
		event,
		progressEvents.length > 0,
	);
	const message = formatAnalysisStageMessage(stage, status, event);
	const textClassName =
		status === "completed"
			? "text-neutral-300"
			: status === "running"
				? "text-neutral-100"
				: "text-neutral-600";

	return (
		<li className={`flex min-h-5 items-center gap-2.5 text-xs ${textClassName}`}>
			{status === "completed" ? (
				<CheckCircle
					className="shrink-0 text-lime-400"
					aria-hidden="true"
					size={15}
					weight="fill"
				/>
			) : status === "running" ? (
				<SpinnerGap
					className="shrink-0 animate-spin text-lime-300 motion-reduce:animate-none"
					aria-hidden="true"
					size={15}
				/>
			) : (
				<Circle
					className="shrink-0 text-neutral-700"
					aria-hidden="true"
					size={15}
				/>
			)}
			<span>{message}</span>
		</li>
	);
}

interface ErrorContentProps {
	readonly message: string;
	readonly file: File | null;
	readonly canRetry: boolean;
	readonly onRetry: () => void;
	readonly onChooseAnother: () => void;
}

function ErrorContent({
	message,
	file,
	canRetry,
	onRetry,
	onChooseAnother,
}: ErrorContentProps) {
	return (
		<>
			<StatusIcon tone="error">
				<WarningCircle aria-hidden="true" size={23} />
			</StatusIcon>
			<h2 className="mt-5 text-xl font-medium tracking-[-0.02em] text-neutral-100">
				We couldn’t analyze this stint
			</h2>
			<p
				className="mt-2 max-w-sm text-sm leading-6 text-neutral-400"
				role="alert"
			>
				{message}
			</p>
			{file && <FileSummary file={file} />}
			<div className="mt-6 flex items-center justify-center gap-2">
				{canRetry && (
					<button
						className={secondaryButtonClassName}
						type="button"
						onClick={onRetry}
					>
						<ArrowClockwise aria-hidden="true" size={16} />
						Try again
					</button>
				)}
				<button
					className={secondaryButtonClassName}
					type="button"
					onClick={onChooseAnother}
				>
					<FolderOpen aria-hidden="true" size={16} />
					Choose another file
				</button>
			</div>
		</>
	);
}

function FileSummary({ file }: { readonly file: File }) {
	return (
		<div className="mt-5 flex max-w-full items-center gap-2 rounded-[4px] border border-[#303531] bg-[#0d100e] px-3 py-2 text-left">
			<FileText
				className="shrink-0 text-neutral-500"
				aria-hidden="true"
				size={17}
			/>
			<span className="max-w-72 truncate text-xs font-medium text-neutral-300">
				{file.name}
			</span>
			<span className="shrink-0 text-xs text-neutral-600">
				{formatFileSize(file.size)}
			</span>
		</div>
	);
}

function StatusIcon({
	children,
	tone = "default",
}: {
	readonly children: ReactNode;
	readonly tone?: "default" | "error";
}) {
	const toneClassName =
		tone === "error"
			? "border-red-400/40 bg-red-400/5 text-red-300"
			: "border-[#373c38] bg-[#151815] text-lime-300";

	return (
		<div
			className={`grid size-12 place-items-center rounded-full border ${toneClassName}`}
		>
			{children}
		</div>
	);
}

function formatFileSize(sizeBytes: number): string {
	const sizeMegabytes = sizeBytes / (1024 * 1024);
	if (sizeMegabytes >= 1) return `${sizeMegabytes.toFixed(1)} MB`;

	return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
}

function useElapsedSeconds(): number {
	const [elapsedSeconds, setElapsedSeconds] = useState(0);

	useEffect(() => {
		const intervalId = window.setInterval(() => {
			setElapsedSeconds((seconds) => seconds + 1);
		}, 1_000);

		return () => window.clearInterval(intervalId);
	}, []);

	return elapsedSeconds;
}

function formatElapsedTime(elapsedSeconds: number): string {
	const minutes = Math.floor(elapsedSeconds / 60);
	const seconds = elapsedSeconds % 60;

	return minutes > 0
		? `${minutes}:${seconds.toString().padStart(2, "0")}`
		: `${seconds}s`;
}

function findIngestErrorMessage(error: Error): string {
	if (error instanceof ApiError) {
		if (error.code === "MALFORMED_JSON") {
			return "We couldn’t read this file. Choose another RACEMAKE JSON file.";
		}

		if (error.code === "INVALID_TELEMETRY_PAYLOAD") {
			return "This doesn’t look like a supported RACEMAKE stint.";
		}
	}

	return "Something went wrong while analyzing this stint. Your file was not changed.";
}
