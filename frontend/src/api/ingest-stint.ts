import type {
	AnalysisProgressEvent,
	IngestResponse,
	IngestStreamEvent,
} from "../../../src/http/contracts";
import { API_ERRORS } from "../../../src/http/api-errors";
import { ApiError, readApiError } from "./api-client";
import { ingestStreamEventSchema } from "./schemas/ingest-stream-event";

interface IngestStintOptions {
	readonly onProgress: (event: AnalysisProgressEvent) => void;
}

export async function ingestStint(
	file: File,
	options: IngestStintOptions,
): Promise<IngestResponse> {
	const response = await fetch("/ingest/stream", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			accept: "application/x-ndjson",
		},
		body: file,
	});

	if (!response.ok) {
		const payload: unknown = await response.json().catch(() => null);
		const apiError = readApiError(payload);

		throw new ApiError(
			response.status,
			apiError?.code ?? null,
			apiError?.message ?? `Request failed with status ${response.status}`,
		);
	}

	if (!response.body) {
		throw createInvalidStreamError();
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	while (true) {
		const chunk = await reader.read();
		buffer += decoder.decode(chunk.value, {
			stream: !chunk.done,
		});

		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";

		for (const line of lines) {
			const completedResponse = processStreamLine(line, options);
			if (completedResponse) return completedResponse;
		}

		if (chunk.done) break;
	}

	const completedResponse = processStreamLine(buffer, options);
	if (completedResponse) return completedResponse;

	throw new ApiError(
		500,
		"INCOMPLETE_ANALYSIS_STREAM",
		"The analysis connection ended before a result was returned.",
	);
}

function processStreamLine(
	line: string,
	options: IngestStintOptions,
): IngestResponse | null {
	if (!line.trim()) return null;

	const event = parseStreamEvent(line);

	if (event.type === "progress") {
		options.onProgress(event);
		return null;
	}

	if (event.type === "failed") {
		throw new ApiError(
			API_ERRORS[event.error.code].status,
			event.error.code,
			event.error.message,
		);
	}

	return event.response;
}

function parseStreamEvent(line: string): IngestStreamEvent {
	try {
		const payload: unknown = JSON.parse(line);
		return ingestStreamEventSchema.parse(payload);
	} catch {
		throw createInvalidStreamError();
	}
}

function createInvalidStreamError(): ApiError {
	return new ApiError(
		500,
		"INVALID_ANALYSIS_STREAM",
		"The server returned an invalid analysis update.",
	);
}
