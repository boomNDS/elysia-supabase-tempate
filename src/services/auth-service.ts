import { appConfig } from "../config";
import { appLogger } from "../lib/logger";
import { upsertProfile } from "./profiles";

const isUuid = (value: string) =>
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
		value,
	);

export const ensureProfile = async (userId: unknown, name: unknown) => {
	if (typeof userId !== "string") {
		throw new Error(
			`Supabase user id must be a string; received ${Object.prototype.toString.call(
				userId,
			)}`,
		);
	}
	const normalizedId = userId.trim();
	if (!isUuid(normalizedId)) {
		throw new Error(`Supabase user id is not a UUID: ${normalizedId}`);
	}
	const safeName =
		typeof name === "string" && name.trim().length > 0 ? name : "User";

	appLogger.log(`syncing profile id=${normalizedId}`, "Auth");

	return upsertProfile(normalizedId, safeName);
};

export const logSupabaseAuthResult = (
	action: string,
	result: { error?: { message: string; name?: string } | null; userId?: string },
) => {
	if (appConfig.nodeEnv === "production") return;
	const errorLabel = result.error
		? `${result.error.name ?? "Error"}: ${result.error.message}`
		: "none";
	appLogger.log(
		`supabase ${action} result userId=${result.userId ?? "none"} error=${errorLabel}`,
		"Auth",
	);
};
