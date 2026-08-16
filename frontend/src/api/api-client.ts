export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string | null,
		message: string,
	) {
		super(message);
		this.name = "ApiError";
	}
}

export async function fetchJson<Response>(
	url: string,
	signal: AbortSignal,
): Promise<Response> {
	return requestJson<Response>(url, { signal });
}

export async function requestJson<Response>(
	url: string,
	init?: RequestInit,
): Promise<Response> {
	const response = await fetch(url, init);
	const payload: unknown = await response.json().catch(() => null);

	if (!response.ok) {
		const apiError = readApiError(payload);

		throw new ApiError(
			response.status,
			apiError?.code ?? null,
			apiError?.message ?? `Request failed with status ${response.status}`,
		);
	}

	return payload as Response;
}

export function shouldRetryApiRequest(
	failureCount: number,
	error: Error,
): boolean {
	if (error instanceof ApiError && error.status < 500) {
		return false;
	}

	return failureCount < 1;
}

export function readApiError(
	payload: unknown,
): { readonly code: string | null; readonly message: string } | null {
	if (
		typeof payload !== "object" ||
		payload === null ||
		!("error" in payload)
	) {
		return null;
	}

	const error = payload.error;
	if (typeof error !== "object" || error === null) return null;

	const message =
		"message" in error && typeof error.message === "string"
			? error.message
			: null;

	if (message === null) return null;

	return {
		code: "code" in error && typeof error.code === "string" ? error.code : null,
		message,
	};
}
