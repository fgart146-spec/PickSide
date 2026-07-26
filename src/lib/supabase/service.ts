import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Service-role client — bypasses RLS. Server-only; never import from a
// Client Component or expose SUPABASE_SERVICE_ROLE_KEY to the browser.
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const PRIVATE_IMAGE_BUCKET = "poll-images-private";
export const PUBLIC_IMAGE_BUCKET = "poll-images-public";
export const COMMUNITY_IMAGE_BUCKET = "community-images";
export const SITE_CONTENT_BUCKET = "site-content-images";
