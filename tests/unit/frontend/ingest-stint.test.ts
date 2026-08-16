import { describe, expect, spyOn, test } from "bun:test";
import { ingestStint } from "../../../frontend/src/api/ingest-stint";
import type {
	AnalysisId,
	AnalysisProgressEvent,
	IngestResponse,
	IngestStreamEvent,
} from "../../../src/http/contracts";

const RESPONSE: IngestResponse = {
	analysisId: `sha256:${"a".repeat(64)}` as AnalysisId,
	sessionId: "7f3a9c1e-0b52-4d84-9a6e-2c1d5f8b41a0",
	telemetrySchema: "racemake.telemetry.stint.v1",
	status: "ready",
	cacheHit: false,
	receivedFrameCount: 1,
	retainedTimelineFrameCount: 1,
	excludedTimelineFrameCount: 0,
	detectedLapCount: 0,
	racingLapCount: 0,
	detectedCornerCount: 0,
	rankedPhenomenonCount: 0,
	detectorFailureCount: 0,
};

describe("ingestStint", () => {
	test("posts the original file and reports streamed analysis progress", async () => {
		const file = new File(
			['{"schema":"racemake.telemetry.stint.v1"}'],
			"stint.json",
			{ type: "application/json" },
		);
		const progressEvent: AnalysisProgressEvent = {
			type: "progress",
			stage: "DETECTING_LAPS",
			status: "completed",
			completedStageCount: 4,
			totalStageCount: 6,
			details: {
				detectedLapCount: 3,
			},
		};
		const streamEvents: readonly IngestStreamEvent[] = [
			progressEvent,
			{
				type: "completed",
				response: RESPONSE,
			},
		];

		const fetchImplementation = Object.assign(
			async (
				input: Parameters<typeof fetch>[0],
				init?: Parameters<typeof fetch>[1],
			) => {
				expect(input).toBe("/ingest/stream");
				expect(init?.method).toBe("POST");
				expect(init?.headers).toEqual({
					"content-type": "application/json",
					accept: "application/x-ndjson",
				});
				expect(init?.body).toBe(file);

				return new Response(
					`${streamEvents.map((event) => JSON.stringify(event)).join("\n")}\n`,
					{
						headers: {
							"content-type": "application/x-ndjson",
						},
					},
				);
			},
			{ preconnect: globalThis.fetch.preconnect },
		) satisfies typeof fetch;
		const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
			fetchImplementation,
		);

		try {
			const progressEvents: AnalysisProgressEvent[] = [];
			await expect(
				ingestStint(file, {
					onProgress: (event) => progressEvents.push(event),
				}),
			).resolves.toEqual(RESPONSE);
			expect(progressEvents).toEqual([progressEvent]);
		} finally {
			fetchSpy.mockRestore();
		}
	});

	test("rejects a failed stream event as an API error", async () => {
		const file = new File(["{}"], "stint.json", {
			type: "application/json",
		});
		const fetchImplementation = Object.assign(
			async () =>
				new Response(
					`${JSON.stringify({
						type: "failed",
						error: {
							code: "INTERNAL_ERROR",
							message: "Unexpected internal error",
						},
					})}\n`,
				),
			{ preconnect: globalThis.fetch.preconnect },
		) satisfies typeof fetch;
		const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
			fetchImplementation,
		);

		try {
			await expect(
				ingestStint(file, { onProgress: () => undefined }),
			).rejects.toMatchObject({
				name: "ApiError",
				code: "INTERNAL_ERROR",
			});
		} finally {
			fetchSpy.mockRestore();
		}
	});
});
