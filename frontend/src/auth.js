import { createClient } from "@supabase/supabase-js";

// The Supabase client talks to Supabase Auth (sign up, sign in, sessions).
// Its settings come from the backend (/api/config), so changing them never needs a rebuild.
let client = null;
let initPromise = null;

export function initAuth() {
  if (!initPromise) {
    initPromise = (async () => {
      const res = await fetch("/api/config");
      if (!res.ok) throw new Error("Could not load the app settings.");
      const { supabase_url, supabase_anon_key } = await res.json();
      if (!supabase_url || !supabase_anon_key) {
        throw new Error("Login is not set up on the server yet (missing Supabase settings).");
      }
      client = createClient(supabase_url, supabase_anon_key);
      return client;
    })();
    initPromise.catch(() => {
      initPromise = null; // allow a retry on the next load
    });
  }
  return initPromise;
}

export const getClient = () => client;

// The login token that proves who the user is; sent with every API request.
// supabase-js refreshes it automatically when it is about to expire.
export async function getAccessToken() {
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}
