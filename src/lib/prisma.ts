import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";
import { appConfig } from "../config";

declare global {
	// eslint-disable-next-line no-var
	var __prisma: ReturnType<typeof createClient> | undefined;
}

// Prisma 7 requires driver adapters; use pg Pool + PrismaPg
const pool = new pg.Pool({
	connectionString: appConfig.databaseUrl,
});

const createClient = () => {
	return new PrismaClient({ adapter: new PrismaPg(pool) });
};

const prismaClient = globalThis.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
	globalThis.__prisma = prismaClient;
}

export const prisma = prismaClient;
