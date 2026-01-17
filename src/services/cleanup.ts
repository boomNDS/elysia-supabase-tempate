import { prisma } from "../lib/prisma";

export type CleanupResult = {
	startedAt: Date;
	finishedAt: Date;
	rateLimitsDeleted: number;
};

// Keep these as code constants (no env needed).
const RATE_LIMIT_RETENTION_DAYS = 30;

export const runCleanup = async (): Promise<CleanupResult> => {
	const startedAt = new Date();
	const now = startedAt;

	// RateLimit.lastRequest is an Int in Postgres; store/compare in seconds to avoid 32-bit overflow.
	const rateLimitCutoffSeconds = Math.floor(
		(now.getTime() - RATE_LIMIT_RETENTION_DAYS * 24 * 60 * 60 * 1000) / 1000,
	);

	// Rate limit table (generic): drop entries older than retention window
	// Note: lastRequest is stored as an integer (seconds epoch).
	const rateLimitsDeleted = (
		await prisma.rateLimit.deleteMany({
			where: { lastRequest: { lt: rateLimitCutoffSeconds } },
		})
	).count;

	return {
		startedAt,
		finishedAt: new Date(),
		rateLimitsDeleted,
	};
};
