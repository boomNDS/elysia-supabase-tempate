import { Elysia } from "elysia";
import {
	forgotPasswordSchema,
	loginSchema,
	magicLinkSchema,
	resetPasswordSchema,
	signupSchema,
	updateProfileSchema,
} from "../schemas/auth";
import { appConfig } from "../config";
import { appLogger } from "../lib/logger";
import {
	createSupabaseUserClient,
	supabaseAdmin,
	supabasePublic,
} from "../lib/supabase";
import { AuthSession, requireSession } from "../utils/auth";
import {
	checkPasswordComplexity,
	checkPwnedPassword,
} from "../utils/passwords";
import { withStatus } from "../utils/response";
import { ensureProfile, logSupabaseAuthResult } from "../services/auth-service";
import { updateProfile } from "../services/profiles";

const findExistingUserByEmail = async (email: string) => {
	const admin = supabaseAdmin.auth.admin as {
		getUserByEmail?: (value: string) => Promise<{
			data: { user: { id: string } | null };
			error: { message: string } | null;
		}>;
		listUsers?: (params?: {
			page?: number;
			perPage?: number;
		}) => Promise<{
			data: { users: Array<{ id: string; email?: string | null }> };
			error: { message: string } | null;
		}>;
	};

	if (typeof admin.getUserByEmail === "function") {
		const result = await admin.getUserByEmail(email);
		if (result.error) {
			appLogger.warn(
				`supabase lookup failed: ${result.error.message}`,
				"Auth",
			);
		}
		return result.data.user;
	}

	if (typeof admin.listUsers === "function") {
		const result = await admin.listUsers({ page: 1, perPage: 200 });
		if (result.error) {
			appLogger.warn(
				`supabase listUsers failed: ${result.error.message}`,
				"Auth",
			);
			return null;
		}
		return (
			result.data.users.find(
				(user) => user.email?.toLowerCase() === email.toLowerCase(),
			) ?? null
		);
	}

	appLogger.warn("supabase admin user lookup unavailable; skipping precheck", "Auth");
	return null;
};

export const authRouter = new Elysia({ name: "authRoutes" })
	.post(
		"/auth/forgot-password",
		async ({ body, set }) => {
			const { error } = await supabasePublic.auth.resetPasswordForEmail(
				body.email,
				appConfig.passwordResetRedirectUrl
					? { redirectTo: appConfig.passwordResetRedirectUrl }
					: undefined,
			);

			if (error) {
				return withStatus(
					set,
					400,
					"failed to send reset email",
					error.message,
				);
			}

			return { sent: true };
		},
		{
			body: forgotPasswordSchema,
			detail: {
				summary: "Request a password reset token (email sent if user exists)",
				tags: ["auth"],
			},
		},
	)
	.post(
		"/auth/reset-password",
		async ({ body, request, set }) => {
			const accessToken =
				body.accessToken ??
				request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

			if (!accessToken) {
				return withStatus(set, 401, "missing access token");
			}

			const passwordRecommendations: string[] = [];
			const complexity = checkPasswordComplexity(body.password);
			if (!complexity.ok) {
				passwordRecommendations.push(...complexity.errors);
			}

			if (appConfig.signupPwnedChecks) {
				try {
					const pwned = await checkPwnedPassword(body.password);
					if (pwned.compromised) {
						passwordRecommendations.push("avoid known breached passwords");
					}
				} catch {
					// Best-effort recommendation only.
				}
			}

			const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
			if (error || !data.user) {
				return withStatus(set, 401, "unauthorized");
			}

			const { error: updateError } =
				await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
					password: body.password,
				});

			if (updateError) {
				return withStatus(
					set,
					400,
					"failed to reset password",
					updateError.message,
				);
			}

			return { passwordRecommendations };
		},
		{
			body: resetPasswordSchema,
			detail: {
				summary: "Reset password with a valid reset token",
				tags: ["auth"],
			},
		},
	)
	.post(
		"/auth/login",
		async ({ body, set }) => {
			const { data, error } = await supabasePublic.auth.signInWithPassword({
				email: body.email,
				password: body.password,
			});

			logSupabaseAuthResult("login", {
				error: error ?? null,
				userId: data.user?.id,
			});

			if (error || !data.user) {
				return withStatus(set, 401, "invalid credentials", error?.message);
			}

			let profile;
			try {
				profile = await ensureProfile(
					data.user.id,
					data.user.user_metadata?.name ?? data.user.email ?? "User",
				);
			} catch (err) {
				appLogger.error(
					`profile upsert failed: ${err instanceof Error ? err.message : err}`,
					"Auth",
				);
				return withStatus(set, 500, "failed to sync profile");
			}

			if (profile.banned) {
				return withStatus(set, 403, "user is banned");
			}

			return {
				accessToken: data.session?.access_token ?? null,
				refreshToken: data.session?.refresh_token ?? null,
				user: data.user,
				profile,
			};
		},
		{
			body: loginSchema,
			detail: {
				summary:
					"Sign in with email/password and return Supabase session tokens",
				tags: ["auth"],
			},
		},
	)
	.post(
		"/auth/signup",
		async ({ body, set }) => {
			const passwordRecommendations: string[] = [];
			const complexity = checkPasswordComplexity(body.password);
			if (!complexity.ok) {
				passwordRecommendations.push(...complexity.errors);
			}

			if (appConfig.signupPwnedChecks) {
				try {
					const pwned = await checkPwnedPassword(body.password);
					if (pwned.compromised) {
						passwordRecommendations.push("avoid known breached passwords");
					}
				} catch {
					// Best-effort recommendation only.
				}
			}

			const existing = await findExistingUserByEmail(body.email);
			if (existing) {
				return withStatus(set, 409, "user already exists");
			}

			const { data, error } = await supabasePublic.auth.signUp({
				email: body.email,
				password: body.password,
				options: {
					data: { name: body.name },
					emailRedirectTo: appConfig.magicLinkRedirectUrl,
				},
			});

			logSupabaseAuthResult("signup", {
				error: error ?? null,
				userId: data.user?.id,
			});

			if (error || !data.user) {
				return withStatus(set, 400, "unable to sign up", error?.message);
			}

			let profile;
			try {
				profile = await ensureProfile(data.user.id, body.name);
			} catch (err) {
				appLogger.error(
					`profile upsert failed: ${err instanceof Error ? err.message : err}`,
					"Auth",
				);
				return withStatus(set, 500, "failed to sync profile");
			}

			return {
				user: data.user,
				session: data.session ?? null,
				accessToken: data.session?.access_token ?? null,
				refreshToken: data.session?.refresh_token ?? null,
				profile,
				passwordRecommendations,
			};
		},
		{
			body: signupSchema,
			detail: {
				summary: "Sign up with email/password and create a profile",
				tags: ["auth"],
			},
		},
	)
	.post(
		"/auth/magic-link",
		async ({ body, set }) => {
			const { error } = await supabasePublic.auth.signInWithOtp({
				email: body.email,
				options: appConfig.magicLinkRedirectUrl
					? { emailRedirectTo: appConfig.magicLinkRedirectUrl }
					: undefined,
			});

			if (error) {
				return withStatus(set, 400, "failed to send magic link", error.message);
			}

			return { sent: true };
		},
		{
			body: magicLinkSchema,
			detail: {
				summary: "Send a magic link email",
				tags: ["auth"],
			},
		},
	)
	.patch(
		"/auth/profile",
		async (ctx) => {
			const { session, body } = ctx as typeof ctx & {
				session: AuthSession;
				body: { name?: string; avatarUrl?: string };
			};

			if (body.name || body.avatarUrl) {
				const userMetadata: Record<string, string> = {};
				if (body.name) userMetadata.name = body.name;
				if (body.avatarUrl) userMetadata.avatar_url = body.avatarUrl;

				const { error } = await supabaseAdmin.auth.admin.updateUserById(
					session.user.id,
					{
						user_metadata: userMetadata,
					},
				);
				if (error) {
					return withStatus(
						ctx.set,
						400,
						"failed to update auth metadata",
						error.message,
					);
				}
			}

			const updated = await updateProfile(session.user.id, {
				name: body.name,
				avatarUrl: body.avatarUrl,
			});

			return { profile: updated };
		},
		{
			body: updateProfileSchema,
			detail: {
				summary: "Update the current user's profile",
				tags: ["auth"],
			},
		},
	)
	.use(requireSession())
	.get(
		"/auth/me",
		(ctx) => {
			const { session } = ctx as typeof ctx & { session: AuthSession };
			return { session };
		},
		{
			detail: {
				summary: "Inspect current Supabase session",
				tags: ["auth"],
			},
		},
	)
	.post(
		"/auth/logout",
		async (ctx) => {
			const { session } = ctx as typeof ctx & { session: AuthSession };

			const supabaseUser = createSupabaseUserClient(session.accessToken);
			const { error } = await supabaseUser.auth.signOut();
			if (error) {
				return withStatus(
					ctx.set,
					400,
					"failed to sign out",
					error.message,
				);
			}

			return { success: true };
		},
		{
			detail: {
				summary: "Sign out of Supabase session",
				tags: ["auth"],
			},
		},
	)
	.onError(({ error }) => {
		// Errors are normalized by the global error handler.
		if (error instanceof Error) {
			console.error(error.message);
		}
	});
