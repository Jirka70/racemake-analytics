import {
	type CSSProperties,
	type ReactNode,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import {
	resolveTelemetryTooltipPosition,
	type TelemetryTooltipRectangle,
} from "../../../analysis/telemetry-tooltip-position";

export const TELEMETRY_TOOLTIP_LAYOUT_EVENT =
	"racemake:telemetry-tooltip-layout";

export const TELEMETRY_TOOLTIP_PRIORITY = {
	missingTelemetry: 10,
	coaching: 20,
	selectedSeries: 30,
	cursorValues: 40,
} as const;

const TELEMETRY_TOOLTIP_SELECTOR = [
	"[data-telemetry-tooltip]",
	".telemetry-chart-value-tooltip",
].join(",");

export interface TelemetryFloatingTooltipAnchor {
	readonly xRatio: number;
	readonly yRatio: number;
}

export function TelemetryFloatingTooltip({
	anchor,
	priority,
	id,
	className,
	children,
}: {
	readonly anchor: TelemetryFloatingTooltipAnchor;
	readonly priority: number;
	readonly id?: string;
	readonly className: string;
	readonly children: ReactNode;
}) {
	const tooltipRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState<readonly [number, number] | null>(
		null,
	);

	useLayoutEffect(() => {
		const tooltip = tooltipRef.current;
		const positioningSurface = tooltip?.parentElement;
		const chartSurface = tooltip?.closest<HTMLElement>(
			"[data-telemetry-chart-surface]",
		);
		if (!tooltip || !positioningSurface || !chartSurface) return;

		let animationFrameId: number | null = null;
		const updatePosition = (): void => {
			animationFrameId = null;
			const surfaceBounds = positioningSurface.getBoundingClientRect();
			const tooltipBounds = tooltip.getBoundingClientRect();
			const nextPosition = resolveTelemetryTooltipPosition({
				anchorX: anchor.xRatio * surfaceBounds.width,
				anchorY: anchor.yRatio * surfaceBounds.height,
				tooltipWidth: tooltipBounds.width,
				tooltipHeight: tooltipBounds.height,
				viewWidth: surfaceBounds.width,
				viewHeight: surfaceBounds.height,
				obstacles: readVisibleTelemetryTooltipObstacles({
					chartSurface,
					coordinateElement: positioningSurface,
					excludedElement: tooltip,
					maximumPriorityExclusive: priority,
				}),
			});
			setPosition((currentPosition) =>
				currentPosition?.[0] === nextPosition[0] &&
				currentPosition[1] === nextPosition[1]
					? currentPosition
					: nextPosition,
			);
		};
		const schedulePositionUpdate = (): void => {
			if (animationFrameId !== null) return;
			animationFrameId = requestAnimationFrame(updatePosition);
		};

		updatePosition();
		const resizeObserver = new ResizeObserver(schedulePositionUpdate);
		resizeObserver.observe(positioningSurface);
		resizeObserver.observe(tooltip);
		chartSurface.addEventListener(
			TELEMETRY_TOOLTIP_LAYOUT_EVENT,
			schedulePositionUpdate,
		);

		return () => {
			resizeObserver.disconnect();
			chartSurface.removeEventListener(
				TELEMETRY_TOOLTIP_LAYOUT_EVENT,
				schedulePositionUpdate,
			);
			if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
			chartSurface.dispatchEvent(
				new CustomEvent(TELEMETRY_TOOLTIP_LAYOUT_EVENT),
			);
		};
	}, [anchor.xRatio, anchor.yRatio, priority]);

	useLayoutEffect(() => {
		if (position === null) return;
		tooltipRef.current
			?.closest<HTMLElement>("[data-telemetry-chart-surface]")
			?.dispatchEvent(new CustomEvent(TELEMETRY_TOOLTIP_LAYOUT_EVENT));
	}, [position]);

	const style: CSSProperties = {
		left: position?.[0] ?? 0,
		top: position?.[1] ?? 0,
		visibility: position === null ? "hidden" : "visible",
	};

	return (
		<div
			ref={tooltipRef}
			id={id}
			className={`pointer-events-none absolute ${className}`}
			style={style}
			role="tooltip"
			data-telemetry-tooltip
			data-telemetry-tooltip-priority={priority}
		>
			{children}
		</div>
	);
}

export function readVisibleTelemetryTooltipObstacles({
	chartSurface,
	coordinateElement,
	excludedElement = null,
	maximumPriorityExclusive,
}: {
	readonly chartSurface: HTMLElement;
	readonly coordinateElement: HTMLElement;
	readonly excludedElement?: HTMLElement | null;
	readonly maximumPriorityExclusive: number;
}): readonly TelemetryTooltipRectangle[] {
	const coordinateBounds = coordinateElement.getBoundingClientRect();

	return Array.from(
		chartSurface.querySelectorAll<HTMLElement>(TELEMETRY_TOOLTIP_SELECTOR),
	)
		.filter((element) => {
			if (element === excludedElement) return false;
			if (readTelemetryTooltipPriority(element) >= maximumPriorityExclusive) {
				return false;
			}

			const computedStyle = getComputedStyle(element);
			if (
				computedStyle.display === "none" ||
				computedStyle.visibility === "hidden" ||
				Number.parseFloat(computedStyle.opacity) === 0
			) {
				return false;
			}

			const bounds = element.getBoundingClientRect();
			return bounds.width > 0 && bounds.height > 0;
		})
		.map((element) => {
			const bounds = element.getBoundingClientRect();
			return {
				left: bounds.left - coordinateBounds.left,
				top: bounds.top - coordinateBounds.top,
				right: bounds.right - coordinateBounds.left,
				bottom: bounds.bottom - coordinateBounds.top,
			};
		});
}

function readTelemetryTooltipPriority(element: HTMLElement): number {
	if (element.classList.contains("telemetry-chart-value-tooltip")) {
		return TELEMETRY_TOOLTIP_PRIORITY.cursorValues;
	}

	const priority = Number(element.dataset.telemetryTooltipPriority);
	return Number.isFinite(priority) ? priority : 0;
}
