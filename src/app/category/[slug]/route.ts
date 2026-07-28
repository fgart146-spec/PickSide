import { NextResponse } from "next/server";
import { getCategoryBySlug } from "@/lib/home-data";

// /category/<slug> (the URL shape admins see when managing categories)
// redirects to the home page's existing ?category=<slug> filter, which
// already does all the real listing/pagination/sorting work. An unknown or
// hidden slug (e.g. a deleted category's old URL) falls back to the
// unfiltered home page instead of a dead end.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  const target = category ? `/?category=${encodeURIComponent(category.slug)}` : "/";
  return NextResponse.redirect(new URL(target, request.url));
}
