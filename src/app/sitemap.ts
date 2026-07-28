import type { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/supabase/service";
import { SITE_URL } from "@/lib/site-url";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createServiceClient();

  const [{ data: polls }, { data: boards }, { data: posts }] = await Promise.all([
    supabase
      .from("polls")
      .select("id, created_at")
      .eq("status", "published")
      .is("deleted_at", null),
    supabase
      .from("community_boards")
      .select("slug")
      .eq("is_visible", true)
      .eq("is_deleted", false),
    supabase
      .from("community_posts")
      .select("id, board_id, updated_at, community_boards!inner(slug, is_visible, is_deleted)")
      .is("deleted_at", null)
      .eq("community_boards.is_visible", true)
      .eq("community_boards.is_deleted", false),
  ]);

  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/community`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${SITE_URL}/polls/all`, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/polls/speed`, changeFrequency: "daily", priority: 0.6 },
  ];

  const pollEntries: MetadataRoute.Sitemap = (polls ?? []).map((poll) => ({
    url: `${SITE_URL}/polls/${poll.id}`,
    lastModified: poll.created_at,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const boardEntries: MetadataRoute.Sitemap = (boards ?? []).map((board) => ({
    url: `${SITE_URL}/community/${board.slug}`,
    changeFrequency: "hourly",
    priority: 0.6,
  }));

  const postEntries: MetadataRoute.Sitemap = (
    (posts as unknown as { id: string; updated_at: string; community_boards: { slug: string } }[]) ??
    []
  ).map((post) => ({
    url: `${SITE_URL}/community/${post.community_boards.slug}/${post.id}`,
    lastModified: post.updated_at,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticEntries, ...pollEntries, ...boardEntries, ...postEntries];
}
