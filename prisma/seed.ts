import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

const DEFAULT_USER = {
	email: "admin@example.com",
	password: "changeme123",
	name: "Admin User",
	role: process.env.SEED_ADMIN_ROLE ?? "admin",
};

const seed = async () => {
	const supabaseUrl = process.env.SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;

	if (!supabaseUrl || !serviceRoleKey) {
		console.warn("Skipping seed: SUPABASE_URL or SUPABASE_SECRET_KEY missing.");
		return;
	}

	const supabase = createClient(supabaseUrl, serviceRoleKey, {
		auth: { persistSession: false, autoRefreshToken: false },
	});

	const findUserByEmail = async (email: string) => {
		const normalizedEmail = email.toLowerCase();
		let page = 1;

		while (true) {
			const result = await supabase.auth.admin.listUsers({
				page,
				perPage: 100,
			});

			if (result.error) {
				throw new Error(result.error.message);
			}

			const match = result.data.users.find(
				(user) => user.email?.toLowerCase() === normalizedEmail,
			);

			if (match) {
				return match;
			}

			if (result.data.nextPage == null) {
				break;
			}

			page = result.data.nextPage;
		}

		return null;
	};

	const existingUser = await findUserByEmail(DEFAULT_USER.email);
	const userId =
		existingUser?.id ??
		(
			await supabase.auth.admin.createUser({
				email: DEFAULT_USER.email,
				password: DEFAULT_USER.password,
				email_confirm: true,
				user_metadata: { name: DEFAULT_USER.name },
				app_metadata: { role: DEFAULT_USER.role },
			})
		).data.user?.id;

	if (!userId) {
		throw new Error("Unable to seed Supabase auth user.");
	}

	const profile = await prisma.profile.upsert({
		where: { id: userId },
		update: {
			name: DEFAULT_USER.name,
			role: DEFAULT_USER.role,
		},
		create: {
			id: userId,
			name: DEFAULT_USER.name,
			role: DEFAULT_USER.role,
		},
	});

	console.log(`Seeded profile ${profile.id} (${DEFAULT_USER.email})`);
};

seed()
	.catch((err) => {
		console.error(err);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
