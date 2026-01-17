import "dotenv/config";
import { z } from "zod";

const envSchema = z
	.object({
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
		PORT: z.string().optional(),
		WORKERS: z.string().optional(),
		CORS_ORIGINS: z.string().optional(),
		RATE_LIMIT_WINDOW_MS: z.string().optional(),
		RATE_LIMIT_MAX: z.string().optional(),
		LOG_LEVEL: z.string().optional(),
		RESEND_API_KEY: z.string().optional(),
		EMAIL_FROM: z.string().optional(),
		ADMIN_EMAILS: z.string().optional(),
		ADMIN_ROLE: z.string().optional(),
		SIGNUP_MIN_PASSWORD_LENGTH: z.string().optional(),
		SIGNUP_PWNED_CHECKS: z
			.enum(["true", "false"])
			.optional()
			.transform((v) => v === "true"),
		SIGNUP_RATE_LIMIT_WINDOW_MS: z.string().optional(),
		SIGNUP_RATE_LIMIT_MAX: z.string().optional(),
		FRONTEND_URL: z.string().optional(),
		SUPABASE_URL: z.string().min(1, "SUPABASE_URL is required"),
		SUPABASE_PUBLISHABLE_KEY: z
			.string()
			.min(1, "SUPABASE_PUBLISHABLE_KEY is required"),
		SUPABASE_SECRET_KEY: z.string().min(1, "SUPABASE_SECRET_KEY is required"),
		SUPABASE_MAGIC_LINK_REDIRECT_URL: z.string().optional(),
		SUPABASE_PASSWORD_RESET_REDIRECT_URL: z.string().optional(),
		DATABASE_URL: z.string(),
	});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
	console.error("❌ Invalid environment configuration");
	console.error(parsed.error.format());
	process.exit(1);
}

export const env = parsed.data;
