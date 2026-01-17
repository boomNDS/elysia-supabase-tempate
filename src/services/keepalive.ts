import { supabaseAdmin } from "../lib/supabase";

export const pingSupabase = async () => {
	const { error } = await supabaseAdmin
		.from("profiles")
		.select("id")
		.limit(1);

	if (error) {
		throw new Error(error.message);
	}
};
