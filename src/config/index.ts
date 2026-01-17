import { env } from "./env";

const num = (val: string | undefined, fallback: number) => {
	const parsed = Number(val);
	return Number.isFinite(parsed) ? parsed : fallback;
};

const list = (val: string | undefined, fallback: string[]) =>
	val
		?.split(",")
		.map((o) => o.trim())
		.filter(Boolean) || fallback;

export const appConfig = {
	port: num(env.PORT, 3000),
	workers: num(env.WORKERS, 0),
	corsOrigins: list(env.CORS_ORIGINS, ["*"]),
	rateLimitWindowMs: num(env.RATE_LIMIT_WINDOW_MS, 60_000),
	rateLimitMax: num(env.RATE_LIMIT_MAX, 100),
	logLevel: (env.LOG_LEVEL ?? "info") as any,
	resendApiKey: env.RESEND_API_KEY,
	emailFrom: env.EMAIL_FROM ?? "Buddy <no-reply@example.com>",
	nodeEnv: env.NODE_ENV,
	databaseUrl: env.DATABASE_URL,
	adminEmails: list(env.ADMIN_EMAILS, []),
	adminRole: env.ADMIN_ROLE ?? "admin",
	signupMinPasswordLength: num(env.SIGNUP_MIN_PASSWORD_LENGTH, 8),
	signupPwnedChecks: env.SIGNUP_PWNED_CHECKS ?? false,
	signupRateLimitWindowMs: num(env.SIGNUP_RATE_LIMIT_WINDOW_MS, 60_000),
	signupRateLimitMax: num(env.SIGNUP_RATE_LIMIT_MAX, 5),
	frontendUrl: env.FRONTEND_URL,
	supabaseUrl: env.SUPABASE_URL,
	supabasePublishableKey: env.SUPABASE_PUBLISHABLE_KEY,
	supabaseSecretKey: env.SUPABASE_SECRET_KEY,
	magicLinkRedirectUrl:
		env.SUPABASE_MAGIC_LINK_REDIRECT_URL ??
		(env.FRONTEND_URL
			? new URL("/auth", env.FRONTEND_URL).toString()
			: undefined),
	passwordResetRedirectUrl:
		env.SUPABASE_PASSWORD_RESET_REDIRECT_URL ??
		(env.FRONTEND_URL
			? new URL("/auth/forget", env.FRONTEND_URL).toString()
			: undefined),
};
