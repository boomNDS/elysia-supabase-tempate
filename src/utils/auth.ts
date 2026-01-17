import { Elysia } from "elysia";
import type { User } from "@supabase/supabase-js";
import { appConfig } from "../config";
import { prisma } from "../lib/prisma";
import { supabaseAdmin } from "../lib/supabase";

export type AuthSession = {
	user: User;
	profile: {
		id: string;
		name: string;
		role: string;
		banned: boolean;
		avatarUrl: string | null;
		createdAt: Date;
		updatedAt: Date;
	} | null;
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
				throw new Response("Unauthorized", { status: 401 });
			}

			const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
			if (error || !data.user) {
				throw new Response("Unauthorized", { status: 401 });
			}

			const profile = await prisma.profile.findUnique({
				where: { id: data.user.id },
			});

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
				throw new Response("Forbidden", { status: 403 });
			} else if (!hasRole && allowlist.length === 0) {
				throw new Response("Forbidden", { status: 403 });
			}

			return { session };
		},
	);
