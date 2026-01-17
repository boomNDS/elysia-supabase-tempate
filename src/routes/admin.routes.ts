import { Elysia } from "elysia";

import { t } from "elysia";
import { AuthSession, requireAdmin } from "../utils/auth";
import { listProfiles, updateProfileRole } from "../services/profiles";
import { withStatus } from "../utils/response";

export const adminRouter = new Elysia({ name: "adminRoutes" })
	.use(requireAdmin())
	.guard(
		{
			detail: {
				tags: ["admin"],
			},
		},
		(app) =>
			app
				.get(
					"/admin/users",
					async (ctx) => {
						const { session } = ctx as typeof ctx & { session: AuthSession };
						try {
							const profiles = await listProfiles();
							return { profiles, viewer: session.user };
						} catch (err) {
							return withStatus(
								ctx.set,
								500,
								"failed to list profiles",
								err instanceof Error ? err.message : String(err),
							);
						}
					},
					{
						detail: {
							summary: "List profiles from Supabase for visibility",
						},
					},
				)
				.patch(
					"/admin/users/:id/role",
					async (ctx) => {
						const { params, body } = ctx as typeof ctx & {
							params: { id: string };
							body: { role: string };
						};
						try {
							const profile = await updateProfileRole(params.id, body.role);
							return { profile };
						} catch (err) {
							return withStatus(
								ctx.set,
								500,
								"failed to update role",
								err instanceof Error ? err.message : String(err),
							);
						}
					},
					{
						body: t.Object({
							role: t.String({ minLength: 1 }),
						}),
						detail: {
							summary: "Update a user's role",
						},
					},
				),
	);
