import { pingSupabase } from "../services/keepalive";

const run = async () => {
	await pingSupabase();
	console.log("supabase keepalive ping ok");
};

run().catch((err) => {
	console.error(`supabase keepalive ping failed: ${err}`);
	process.exit(1);
});
