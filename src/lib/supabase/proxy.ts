import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the auth token if needed — do not remove.
  await supabase.auth.getUser();

  await recordVisit(request, supabase, supabaseResponse);

  return supabaseResponse;
}

// Home page "오늘 접속자" counter. Most browsers never authenticate (even
// anonymously — that only happens on guest vote), so visitors are tracked
// by a random id in a long-lived first-party cookie instead of auth.uid().
async function recordVisit(
  request: NextRequest,
  supabase: ReturnType<typeof createServerClient<Database>>,
  response: NextResponse
) {
  let visitorId = request.cookies.get("pv_id")?.value;
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    response.cookies.set("pv_id", visitorId, {
      maxAge: 60 * 60 * 24 * 400,
      sameSite: "lax",
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  if (request.cookies.get("pv_date")?.value === today) {
    return;
  }

  await supabase.from("site_visits").insert({ visitor_id: visitorId, visit_date: today });
  response.cookies.set("pv_date", today, {
    maxAge: 60 * 60 * 24 * 2,
    sameSite: "lax",
  });
}
