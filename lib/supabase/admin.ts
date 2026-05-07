import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export function getSupabaseAdmin() {
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

  if (!serviceRoleKey) {
    throw new Error(
      "Nedostaje SUPABASE_SERVICE_ROLE_KEY u .env.local za admin sync brisanje. Dodaj ga i restartaj aplikaciju.",
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
