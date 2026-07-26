import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("polls")
    .select("id")
    .eq("status", "published")
    .is("deleted_at", null);

  const polls = data ?? [];
  if (polls.length === 0) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const pick = polls[Math.floor(Math.random() * polls.length)];
  return NextResponse.redirect(new URL(`/polls/${pick.id}`, request.url));
}
