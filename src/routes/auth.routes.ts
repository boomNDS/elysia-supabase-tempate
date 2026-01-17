import { Elysia } from "elysia";
import { appConfig } from "../config";
import { appLogger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import {
	forgotPasswordSchema,
	loginSchema,
	magicLinkSchema,
	resetPasswordSchema,
	signupSchema,
} from "../schemas/auth";
import {
	createSupabaseUserClient,
	supabaseAdmin,
	supabaseAnon,
} from "../lib/supabase";
import { AuthSession, requireSession } from "../utils/auth";
import {
	checkPasswordComplexity,
	checkPwnedPassword,
} from "../utils/passwords";

const ensureProfile = async (userId: string, name: string | null | undefined) =>
	prisma.profile.upsert({
		where: { id: userId },
		update: {
			name: name ?? "User",
		},
		create: {
			id: userId,
			name: name ?? "User",
		},
	});

export const authRouter = new Elysia({ name: "authRoutes" })
	.post(
		"/auth/forgot-password",
		async ({ body }) => {
			const { error } = await supabaseAnon.auth.resetPasswordForEmail(
				body.email,
				appConfig.passwordResetRedirectUrl
					? { redirectTo: appConfig.passwordResetRedirectUrl }
					: undefined,
			);

			if (error) {
				return new Response(error.message, { status: 400 });
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
		async ({ body, request }) => {
			const accessToken =
				body.accessToken ??
				request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

			if (!accessToken) {
				return new Response("Missing access token", { status: 401 });
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
				return new Response("Unauthorized", { status: 401 });
			}

			const { error: updateError } =
				await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
					password: body.password,
				});

			if (updateError) {
				return new Response(updateError.message, { status: 400 });
			}

			return {
				status: 200,
				passwordRecommendations,
			};
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
		async ({ body }) => {
			const { data, error } = await supabaseAnon.auth.signInWithPassword({
				email: body.email,
				password: body.password,
			});

			if (error || !data.user) {
				return new Response(error?.message ?? "Invalid credentials", {
					status: 401,
				});
			}

			const profile = await ensureProfile(
				data.user.id,
				data.user.user_metadata?.name ?? data.user.email ?? "User",
			);

			if (profile.banned) {
				return new Response("User is banned", { status: 403 });
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
		async ({ body }) => {
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

			const { data, error } = await supabaseAnon.auth.signUp({
				email: body.email,
				password: body.password,
				options: {
					data: { name: body.name },
					emailRedirectTo: appConfig.magicLinkRedirectUrl,
				},
			});

			if (error || !data.user) {
				return new Response(error?.message ?? "Unable to sign up", {
					status: 400,
				});
			}

			const profile = await ensureProfile(data.user.id, body.name);

			return {
				user: data.user,
				session: data.session ?? null,
				accessToken: data.session?.access_token ?? null,
				refreshToken: data.session?.refresh_token ?? null,
				profile,
				passwordRecommendations,
				message:
					"Signup successful. Check your email to confirm before signing in.",
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
		async ({ body }) => {
			const { error } = await supabaseAnon.auth.signInWithOtp({
				email: body.email,
				options: appConfig.magicLinkRedirectUrl
					? { emailRedirectTo: appConfig.magicLinkRedirectUrl }
					: undefined,
			});

			if (error) {
				return new Response(error.message, { status: 400 });
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
			const { session } = ctx as typeof ctx & {
				session: AuthSession;
			};

			const supabaseUser = createSupabaseUserClient(session.accessToken);
			const { error } = await supabaseUser.auth.signOut();
			if (error) {
				return new Response(error.message, { status: 400 });
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
		if (error instanceof Error) {
			appLogger.error(error.message, "Auth");
		}
	});
