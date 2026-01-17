import { createClient } from "@supabase/supabase-js";
import { appConfig } from "../config";

const createSupabaseClient = (key: string) =>
	createClient(appConfig.supabaseUrl, key, {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
		},
	});

export const supabaseAnon = createSupabaseClient(appConfig.supabaseAnonKey);

export const supabaseAdmin = createSupabaseClient(
	appConfig.supabaseServiceRoleKey,
);

export const createSupabaseUserClient = (accessToken: string) =>
	createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
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
