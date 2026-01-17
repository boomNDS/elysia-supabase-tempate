import { createClient } from "@supabase/supabase-js";
import { appConfig } from "../config";

const createSupabaseClient = (key: string) =>
	createClient(appConfig.supabaseUrl, key, {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
		},
	});

export const supabasePublic = createSupabaseClient(
	appConfig.supabasePublishableKey,
);

export const supabaseAdmin = createSupabaseClient(appConfig.supabaseSecretKey);

export const createSupabaseUserClient = (accessToken: string) =>
	createClient(appConfig.supabaseUrl, appConfig.supabasePublishableKey, {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
		},
		global: {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		},
	});
