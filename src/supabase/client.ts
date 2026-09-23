import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.js";

export type V3SupabaseClient = SupabaseClient<Database>;

/** Browser-safe client: use only the Supabase URL and publishable/anon key. */
export function createV3SupabaseClient(url: string, publishableKey: string): V3SupabaseClient {
  if (!url || !publishableKey) throw new Error("V3 Supabase URL and publishable key are required");
  return createClient<Database>(url, publishableKey, { auth: { persistSession: true, autoRefreshToken: true } });
}
