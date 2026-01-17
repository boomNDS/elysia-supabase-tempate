import { Elysia } from "elysia";

import { appConfig } from "../config";
import { appLogger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { supabaseAdmin } from "../lib/supabase";
import { getAccessToken } from "./auth";

export const docsGuard = () => {
	if (appConfig.nodeEnv !== "production") return new Elysia();

	const adminRole = appConfig.adminRole;
	const allowlist = appConfig.adminEmails;

	return new Elysia().derive(async ({ request }) => {
		if (!request.url.includes("/docs")) return {};

		const accessToken = getAccessToken(request);
		if (!accessToken) throw new Response("Unauthorized", { status: 401 });

		const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
		if (error || !data.user) throw new Response("Unauthorized", { status: 401 });

		const profile = await prisma.profile.findUnique({
			where: { id: data.user.id },
		});

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
			throw new Response("Forbidden", { status: 403 });
		}

		return { session: { user: data.user, profile, accessToken } };
	});
};
