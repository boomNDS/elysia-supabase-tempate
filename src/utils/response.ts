import { Elysia } from "elysia";

export type ErrorResponse = {
	status: number;
	message: string;
	error?: string;
};

export type SuccessResponse<T> = {
	status: number;
	message: string;
	data: T;
};

export const ok = <T>(
	data: T,
	message = "ok",
	status = 200,
): SuccessResponse<T> => ({
	status,
	message,
	data,
});

export const fail = (
	status: number,
	message: string,
	error?: string,
): ErrorResponse => ({
	status,
	message,
	error,
});

export const jsonError = (status: number, message: string, error?: string) =>
	new Response(JSON.stringify(fail(status, message, error)), {
		status,
		headers: { "content-type": "application/json" },
	});

export const withStatus = (
	set: { status?: number },
	status: number,
	message: string,
	error?: string,
) => {
	set.status = status;
	return fail(status, message, error);
};

const isResponseShape = (value: unknown): value is ErrorResponse | SuccessResponse<unknown> => {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.status === "number" &&
		typeof candidate.message === "string" &&
		("data" in candidate || "error" in candidate)
	);
};

export const responseTransformer = () =>
	new Elysia().onAfterHandle(({ response, set }) => {
		if (response instanceof Response) return response;
		if (isResponseShape(response)) return response;

		const status = typeof set.status === "number" ? set.status : 200;
		set.status = status;
		const message = status >= 400 ? "error" : "ok";

		return ok(response ?? null, message, status);
	});
