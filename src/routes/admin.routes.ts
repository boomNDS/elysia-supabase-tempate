import { Elysia } from "elysia";

import { prisma } from "../lib/prisma";
import { AuthSession, requireAdmin } from "../utils/auth";

export const adminRouter = new Elysia({ name: "adminRoutes" })
	.use(requireAdmin())
	.guard(
		{
			detail: {
				tags: ["admin"],
			},
		},
		(app) =>
			app.get(
				"/admin/users",
				async (ctx) => {
					const { session } = ctx as typeof ctx & { session: AuthSession };
					const profiles = await prisma.profile.findMany({
						orderBy: { createdAt: "desc" },
					});

					return { profiles, viewer: session.user };
				},
				{
					detail: {
						summary: "List profiles from Prisma for visibility",
					},
				},
			),
	);
