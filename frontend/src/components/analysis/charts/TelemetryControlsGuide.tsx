import {
	ArrowsHorizontal,
	CursorClick,
	MagnifyingGlassPlus,
	X,
} from "@phosphor-icons/react";
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	createTelemetryControlsGuideSteps,
	hasSeenTelemetryControlsGuide,
	markTelemetryControlsGuideSeen,
	type TelemetryControlsGuideStepId,
} from "../../../analysis/telemetry-controls-guide";

interface TelemetryControlsGuideProps {
	readonly isAvailable: boolean;
	readonly presentation: "desktop" | "compact";
	readonly onActiveStepChange: (
		stepId: TelemetryControlsGuideStepId | null,
	) => void;
}

export function TelemetryControlsGuide({
	isAvailable,
	presentation,
	onActiveStepChange,
}: TelemetryControlsGuideProps) {
	const [isVisible, setIsVisible] = useState(false);
	const [stepIndex, setStepIndex] = useState(0);
	const hasCheckedStorageRef = useRef(false);
	const dialogRef = useRef<HTMLElement>(null);
	const primaryActionRef = useRef<HTMLButtonElement>(null);
	const titleId = useId();
	const descriptionId = useId();
	const steps = useMemo(
		() => createTelemetryControlsGuideSteps(presentation),
		[presentation],
	);
	const step = steps[stepIndex] ?? steps[0];
	const stepId = step?.id ?? null;
	const isLastStep = stepIndex === steps.length - 1;
	const dismissGuide = useCallback(() => {
		markTelemetryControlsGuideSeen(readBrowserStorage());
		setIsVisible(false);
	}, []);

	useEffect(() => {
		if (!isAvailable || hasCheckedStorageRef.current) return;

		hasCheckedStorageRef.current = true;
		setIsVisible(!hasSeenTelemetryControlsGuide(readBrowserStorage()));
	}, [isAvailable]);

	useEffect(() => {
		if (!isVisible) return;
		primaryActionRef.current?.focus({ preventScroll: true });
	}, [isVisible]);

	useEffect(() => {
		onActiveStepChange(isVisible ? stepId : null);
	}, [isVisible, onActiveStepChange, stepId]);

	useEffect(
		() => () => {
			onActiveStepChange(null);
		},
		[onActiveStepChange],
	);

	useEffect(() => {
		if (!isVisible || presentation !== "compact" || stepId === null) return;
		let revealFrameId: number | null = null;
		const target = stepId === "zoom" ? "zoom" : "chart";

		function revealActiveTarget(): void {
			revealFrameId = null;
			document
				.querySelector<HTMLElement>(
					`[data-telemetry-guide-target="${target}"]`,
				)
				?.scrollIntoView({ block: "end", inline: "nearest" });
		}

		function scheduleActiveTargetReveal(): void {
			if (revealFrameId !== null) cancelAnimationFrame(revealFrameId);
			revealFrameId = requestAnimationFrame(revealActiveTarget);
		}

		scheduleActiveTargetReveal();
		window.addEventListener("resize", scheduleActiveTargetReveal);
		return () => {
			if (revealFrameId !== null) cancelAnimationFrame(revealFrameId);
			window.removeEventListener("resize", scheduleActiveTargetReveal);
		};
	}, [isVisible, presentation, stepId]);

	useEffect(() => {
		if (!isVisible) return;

		function handleDialogKeyboard(event: KeyboardEvent): void {
			if (event.key === "Escape") {
				dismissGuide();
				return;
			}
			if (event.key !== "Tab") return;

			const focusableElements = Array.from(
				dialogRef.current?.querySelectorAll<HTMLButtonElement>(
					"button:not([disabled])",
				) ?? [],
			);
			const firstElement = focusableElements[0];
			const lastElement = focusableElements.at(-1);
			if (!firstElement || !lastElement) return;

			if (event.shiftKey && document.activeElement === firstElement) {
				event.preventDefault();
				lastElement.focus();
				return;
			}
			if (!event.shiftKey && document.activeElement === lastElement) {
				event.preventDefault();
				firstElement.focus();
			}
		}

		window.addEventListener("keydown", handleDialogKeyboard);
		return () => window.removeEventListener("keydown", handleDialogKeyboard);
	}, [dismissGuide, isVisible]);

	if (!isVisible || step === undefined) return null;

	return (
		<>
			<div
				className="fixed inset-0 z-[400] bg-black/35"
				data-guide-step={step.id}
				aria-hidden="true"
			/>
			<section
				ref={dialogRef}
				className={`fixed z-[420] border border-[#4b504c] bg-[#111412]/98 shadow-[0_24px_80px_rgba(0,0,0,0.75)] ${
					presentation === "compact"
						? "inset-x-3 top-[calc(66px+env(safe-area-inset-top))] rounded-[6px] p-4"
						: step.id === "inspect"
							? "bottom-[88px] left-6 w-[420px] rounded-[4px] p-5"
							: "bottom-[88px] left-[clamp(24px,14vw,220px)] w-[420px] rounded-[4px] p-5"
				}`}
				data-testid="telemetry-controls-guide"
				data-guide-step={step.id}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={descriptionId}
			>
				<div className="flex items-start gap-4">
					<div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-lime-400/45 bg-lime-400/8 text-lime-300">
						<GuideIcon stepId={step.id} />
					</div>
					<div className="min-w-0 flex-1 pt-0.5">
						<p className="text-[10px] font-semibold tracking-[0.12em] text-lime-300 uppercase">
							Chart controls
						</p>
						<h2
							id={titleId}
							className="mt-1 text-sm font-semibold tracking-[0.04em] text-neutral-100 uppercase"
						>
							{step.title}
						</h2>
						<p
							id={descriptionId}
							className="mt-1.5 text-[13px] leading-5 text-neutral-300"
						>
							{step.description}
						</p>
					</div>
					<button
						type="button"
						className="-mt-1 -mr-1 flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-[4px] text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-100 focus-visible:outline-2 focus-visible:outline-lime-400"
						onClick={dismissGuide}
						aria-label="Close chart controls guide"
						title="Close guide"
					>
						<X size={20} aria-hidden="true" />
					</button>
				</div>

				<div className="mt-5 flex items-center justify-between gap-3 border-t border-[#303531] pt-4">
					<div className="flex items-center gap-3">
						<span className="min-w-10 text-[11px] tabular-nums text-neutral-500">
							{stepIndex + 1} of {steps.length}
						</span>
						<div className="flex gap-1.5" aria-hidden="true">
							{steps.map((candidate, candidateIndex) => (
								<span
									key={candidate.id}
									className={`h-1 rounded-full ${
										candidateIndex === stepIndex
											? "w-5 bg-lime-400"
											: "w-2 bg-neutral-700"
									}`}
								/>
							))}
						</div>
					</div>

					<div className="flex items-center gap-2">
						{stepIndex === 0 ? (
							<button
								type="button"
								className="min-h-10 cursor-pointer rounded-[3px] px-3 text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-100 focus-visible:outline-2 focus-visible:outline-lime-400"
								onClick={dismissGuide}
							>
								Skip
							</button>
						) : (
							<button
								type="button"
								className="min-h-10 cursor-pointer rounded-[3px] border border-[#4b504c] px-3 text-xs font-medium text-neutral-200 transition-colors hover:border-neutral-400 focus-visible:outline-2 focus-visible:outline-lime-400"
								onClick={() => setStepIndex((current) => current - 1)}
							>
								Back
							</button>
						)}
						<button
							ref={primaryActionRef}
							type="button"
							className="min-h-10 min-w-20 cursor-pointer rounded-[3px] border border-lime-400 bg-lime-400/8 px-4 text-xs font-semibold text-lime-200 transition-colors hover:bg-lime-400/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400"
							onClick={() => {
								if (isLastStep) {
									dismissGuide();
									return;
								}
								setStepIndex((current) => current + 1);
							}}
						>
							{isLastStep ? "Got it" : "Next"}
						</button>
					</div>
				</div>
			</section>
		</>
	);
}

function GuideIcon({
	stepId,
}: {
	readonly stepId: TelemetryControlsGuideStepId;
}) {
	if (stepId === "zoom") {
		return <MagnifyingGlassPlus size={25} weight="bold" aria-hidden="true" />;
	}

	if (stepId === "move") {
		return <ArrowsHorizontal size={26} weight="bold" aria-hidden="true" />;
	}

	return <CursorClick size={25} weight="bold" aria-hidden="true" />;
}

function readBrowserStorage(): Storage | null {
	try {
		return globalThis.localStorage ?? null;
	} catch {
		return null;
	}
}
