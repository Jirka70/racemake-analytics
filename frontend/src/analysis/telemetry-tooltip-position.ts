export interface TelemetryTooltipRectangle {
	readonly left: number;
	readonly top: number;
	readonly right: number;
	readonly bottom: number;
}

export interface TelemetryTooltipPositionInput {
	readonly anchorX: number;
	readonly anchorY: number;
	readonly tooltipWidth: number;
	readonly tooltipHeight: number;
	readonly viewWidth: number;
	readonly viewHeight: number;
	readonly obstacles: readonly TelemetryTooltipRectangle[];
}

const VIEW_MARGIN_PX = 8;
const ANCHOR_GAP_PX = 12;
const OBSTACLE_GAP_PX = 10;

/**
 * Keeps the telemetry value tooltip inside the chart while preferring the
 * pointer's lower-right quadrant. Visible chart overlays are treated as solid
 * obstacles so their explanatory content remains readable as the pointer moves.
 */
export function resolveTelemetryTooltipPosition({
	anchorX,
	anchorY,
	tooltipWidth,
	tooltipHeight,
	viewWidth,
	viewHeight,
	obstacles,
}: TelemetryTooltipPositionInput): [number, number] {
	const anchorCandidates = [
		[anchorX + ANCHOR_GAP_PX, anchorY + ANCHOR_GAP_PX],
		[anchorX - tooltipWidth - ANCHOR_GAP_PX, anchorY + ANCHOR_GAP_PX],
		[anchorX + ANCHOR_GAP_PX, anchorY - tooltipHeight - ANCHOR_GAP_PX],
		[
			anchorX - tooltipWidth - ANCHOR_GAP_PX,
			anchorY - tooltipHeight - ANCHOR_GAP_PX,
		],
	] as const;
	const obstacleEdgeCandidates = obstacles.flatMap((obstacle) => [
		[anchorX + ANCHOR_GAP_PX, obstacle.bottom + OBSTACLE_GAP_PX],
		[
			anchorX - tooltipWidth - ANCHOR_GAP_PX,
			obstacle.bottom + OBSTACLE_GAP_PX,
		],
		[
			anchorX + ANCHOR_GAP_PX,
			obstacle.top - tooltipHeight - OBSTACLE_GAP_PX,
		],
		[
			anchorX - tooltipWidth - ANCHOR_GAP_PX,
			obstacle.top - tooltipHeight - OBSTACLE_GAP_PX,
		],
		[obstacle.right + OBSTACLE_GAP_PX, anchorY + ANCHOR_GAP_PX],
		[
			obstacle.left - tooltipWidth - OBSTACLE_GAP_PX,
			anchorY + ANCHOR_GAP_PX,
		],
	] as const);
	const candidates = [...anchorCandidates, ...obstacleEdgeCandidates];

	const maximumX = Math.max(
		VIEW_MARGIN_PX,
		viewWidth - tooltipWidth - VIEW_MARGIN_PX,
	);
	const maximumY = Math.max(
		VIEW_MARGIN_PX,
		viewHeight - tooltipHeight - VIEW_MARGIN_PX,
	);

	let bestPosition: [number, number] = [VIEW_MARGIN_PX, VIEW_MARGIN_PX];
	let bestScore = Number.POSITIVE_INFINITY;

	for (const [index, [candidateX, candidateY]] of candidates.entries()) {
		const x = clamp(candidateX, VIEW_MARGIN_PX, maximumX);
		const y = clamp(candidateY, VIEW_MARGIN_PX, maximumY);
		const candidateRectangle = {
			left: x,
			top: y,
			right: x + tooltipWidth,
			bottom: y + tooltipHeight,
		};
		const overlapArea = obstacles.reduce(
			(total, obstacle) =>
				total +
				calculateIntersectionArea(candidateRectangle, {
					left: obstacle.left - OBSTACLE_GAP_PX,
					top: obstacle.top - OBSTACLE_GAP_PX,
					right: obstacle.right + OBSTACLE_GAP_PX,
					bottom: obstacle.bottom + OBSTACLE_GAP_PX,
				}),
			0,
		);
		const clampingDistance =
			Math.abs(candidateX - x) + Math.abs(candidateY - y);
		const score = overlapArea * 1_000_000 + clampingDistance * 1_000 + index;

		if (score < bestScore) {
			bestScore = score;
			bestPosition = [x, y];
		}
	}

	return bestPosition;
}

function calculateIntersectionArea(
	first: TelemetryTooltipRectangle,
	second: TelemetryTooltipRectangle,
): number {
	const width = Math.max(
		0,
		Math.min(first.right, second.right) - Math.max(first.left, second.left),
	);
	const height = Math.max(
		0,
		Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top),
	);
	return width * height;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}
