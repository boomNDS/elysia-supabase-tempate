import { Elysia } from "elysia";

import { sendEmailSchema } from "../schemas/email";
import { sendWelcomeEmail } from "../services/email";
import { withStatus } from "../utils/response";

export const emailRouter = new Elysia({ name: "emailRoutes" }).post(
	"/email/send",
	async ({ body, set }) => {
		try {
			await sendWelcomeEmail(body.to, body.name);
		} catch (err) {
			return withStatus(
				set,
				400,
				"failed to send email",
				err instanceof Error ? err.message : String(err),
			);
		}

		return { sent: true };
	},
	{
		body: sendEmailSchema,
		detail: {
			summary: "Send welcome email via Resend using React Email template",
			tags: ["email"],
		},
	},
);
