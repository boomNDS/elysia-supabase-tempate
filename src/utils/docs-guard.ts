import { Elysia } from "elysia";

import { appConfig } from "../config";
import { appLogger } from "../lib/logger";
import { supabaseAdmin } from "../lib/supabase";
import { getAccessToken } from "./auth";
import { jsonError } from "./response";
import { ensureProfile } from "../services/auth-service";
import { getProfileById } from "../services/profiles";

export const docsGuard = () => {
	if (appConfig.nodeEnv !== "production") return new Elysia();

	const adminRole = appConfig.adminRole;
	const allowlist = appConfig.adminEmails;

	return new Elysia().derive(async ({ request }) => {
		if (!request.url.includes("/docs")) return {};

		const accessToken = getAccessToken(request);
		if (!accessToken) throw jsonError(401, "unauthorized");

		const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
		if (error || !data.user) throw jsonError(401, "unauthorized");

		let profile;
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

		const hasRole = profile?.role === adminRole;
		const isAllowlisted =
			allowlist.length === 0
				? false
				: allowlist.includes(data.user.email ?? "");

		if (!hasRole && !isAllowlisted) {
			appLogger.warn(
				`Docs access denied for ${data.user.email ?? "unknown"}`,
				"DocsGuard",
			);
			throw jsonError(403, "forbidden");
		}

		return { session: { user: data.user, profile, accessToken } };
	});
};
