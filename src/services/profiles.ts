import { supabaseAdmin } from "../lib/supabase";

type ProfileRow = {
	id: string;
	name: string;
	role: string;
	banned: boolean;
	avatar_url: string | null;
	created_at: string;
	updated_at: string;
};

export type Profile = {
	id: string;
	name: string;
	role: string;
	banned: boolean;
	avatarUrl: string | null;
	createdAt: Date;
	updatedAt: Date;
};

const mapProfile = (row: ProfileRow): Profile => ({
	id: row.id,
	name: row.name,
	role: row.role,
	banned: row.banned,
	avatarUrl: row.avatar_url,
	createdAt: new Date(row.created_at),
	updatedAt: new Date(row.updated_at),
});

export const upsertProfile = async (
	id: string,
	name: string,
): Promise<Profile> => {
	const now = new Date().toISOString();
	const { data, error } = await supabaseAdmin
		.from("profiles")
		.upsert({ id, name, updated_at: now }, { onConflict: "id" })
		.select("*")
		.single();

	if (error || !data) {
		throw new Error(error?.message ?? "Failed to upsert profile");
	}

	return mapProfile(data as ProfileRow);
};

export const getProfileById = async (id: string): Promise<Profile | null> => {
	const { data, error } = await supabaseAdmin
		.from("profiles")
		.select("*")
		.eq("id", id)
		.maybeSingle();

	if (error) {
		throw new Error(error.message);
	}

	return data ? mapProfile(data as ProfileRow) : null;
};

export const listProfiles = async (): Promise<Profile[]> => {
	const { data, error } = await supabaseAdmin
		.from("profiles")
		.select("*")
		.order("created_at", { ascending: false });

	if (error) {
		throw new Error(error.message);
	}

	return (data ?? []).map((row) => mapProfile(row as ProfileRow));
};

export const updateProfile = async (
	id: string,
	updates: { name?: string; avatarUrl?: string },
): Promise<Profile> => {
	const now = new Date().toISOString();
	const payload: Record<string, unknown> = { updated_at: now };
	if (updates.name !== undefined) payload.name = updates.name;
	if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;

	const { data, error } = await supabaseAdmin
		.from("profiles")
		.update(payload)
		.eq("id", id)
		.select("*")
		.single();

	if (error || !data) {
		throw new Error(error?.message ?? "Failed to update profile");
	}

	return mapProfile(data as ProfileRow);
};

export const updateProfileRole = async (
	id: string,
	role: string,
): Promise<Profile> => {
	const now = new Date().toISOString();
	const { data, error } = await supabaseAdmin
		.from("profiles")
		.update({ role, updated_at: now })
		.eq("id", id)
		.select("*")
		.single();

	if (error || !data) {
		throw new Error(error?.message ?? "Failed to update role");
	}

	return mapProfile(data as ProfileRow);
};
