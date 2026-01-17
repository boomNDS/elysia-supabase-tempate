import { Elysia } from "elysia";
import { withStatus } from "../utils/response";

export const systemRouter = new Elysia({ name: "systemRoutes" }).get(
	"/health",
	({ set }) => {
		try {
			return {
				uptimeMs: Math.round(process.uptime() * 1000),
			};
		} catch (err) {
			return withStatus(
				set,
				500,
				"health check failed",
				err instanceof Error ? err.message : String(err),
			);
		}
	},
	{
		detail: {
			summary: "Health check",
			tags: ["system"],
		},
	},
);
