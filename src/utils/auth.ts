import { Elysia } from "elysia";
import type { User } from "@supabase/supabase-js";
import { appConfig } from "../config";
import { supabaseAdmin } from "../lib/supabase";
import { jsonError } from "./response";
import { ensureProfile } from "../services/auth-service";
import { getProfileById, type Profile } from "../services/profiles";

export type AuthSession = {
	user: User;
	profile: Profile | null;
	accessToken: string;
};

export const getAccessToken = (request: Request) => {
	const authHeader = request.headers.get("authorization") ?? "";
	if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
	return authHeader.slice(7).trim();
};

export const requireSession = () =>
	new Elysia().derive<{ session: AuthSession }, "scoped">(
		{ as: "scoped" },
		async ({ request }) => {
			const accessToken = getAccessToken(request);
			if (!accessToken) {
				throw jsonError(401, "unauthorized");
			}

			const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
			if (error || !data.user) {
				throw jsonError(401, "unauthorized");
			}

			let profile: Profile | null;
			try {
				profile = await getProfileById(data.user.id);
				if (!profile) {
					profile = await ensureProfile(
						data.user.id,
						data.user.user_metadata?.name ?? data.user.email ?? "User",
					);
				}
			} catch (err) {
				throw jsonError(
					500,
					"failed to load profile",
					err instanceof Error ? err.message : String(err),
				);
			}

			return { session: { user: data.user, profile, accessToken } };
		},
	);

export const requireAdmin = () =>
	requireSession().derive<{ session: AuthSession }, "scoped">(
		{ as: "scoped" },
		(ctx) => {
			const { session } = ctx;
			const allowlist = appConfig.adminEmails;
			const hasRole = session.profile?.role === appConfig.adminRole;
			const isAllowlisted =
				allowlist.length === 0
					? false
					: allowlist.includes(session.user.email ?? "");

			if (!hasRole && allowlist.length > 0 && !isAllowlisted) {
				throw jsonError(403, "forbidden");
			} else if (!hasRole && allowlist.length === 0) {
				throw jsonError(403, "forbidden");
			}

			return { session };
		},
	);
