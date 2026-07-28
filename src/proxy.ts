import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 renamed the "middleware" file convention to "proxy" — same
// runtime hook, new name/export. See node_modules/next/dist/docs/01-app/
// 03-api-reference/03-file-conventions/proxy.md.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
