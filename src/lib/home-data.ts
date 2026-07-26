import { unstable_cache } from "next/cache";
import { createServiceClient, SITE_CONTENT_BUCKET } from "@/lib/supabase/service";
import { isHomeSectionKey, type HomeSectionKey } from "@/lib/home-sections";
import type { PollCategory } from "@/lib/categories";

// Widget rows now read the denormalized vote_count/comment_count columns
// (migration 20260727000007) instead of asking PostgREST to aggregate
// votes(count)/comments(count) per row.
const WIDGET_SELECT = "id, question, category, vote_count, comment_count";

export type PollWidget = {
  id: string;
  question: string;
  category: PollCategory;
  vote_count: number;
  comment_count: number;
};

export type HomeBanner = {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
};

export type HomePopupItem = {
  id: string;
  title: string;
  body: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
};

export type HomePortalData = {
  stats: { totalPollCount: number; todayVoteCount: number };
  visibleSectionKeys: HomeSectionKey[];
  featuredPoll: PollWidget | null;
  popularPolls: PollWidget[];
  latestPolls: PollWidget[];
  banners: HomeBanner[];
  popups: HomePopupItem[];
};

// Prefer an admin-curated "추천" poll; if none is marked, fall back to a
// date-seeded pick so the section still rotates daily on its own.
function pickDailyFeatured(items: PollWidget[]): PollWidget | null {
  if (items.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < today.length; i++) {
    hash = (hash * 31 + today.charCodeAt(i)) >>> 0;
  }
  return items[hash % items.length];
}

async function loadHomePortalData(): Promise<HomePortalData> {
  // Service client: this data is identical for every visitor and never
  // depends on the request's cookies, so it is safe to compute once and
  // cache. (unstable_cache forbids reading cookies/headers inside.)
  const supabase = createServiceClient();

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const nowIso = new Date().toISOString();

  const published = () =>
    supabase.from("polls").select(WIDGET_SELECT).eq("status", "published").is("deleted_at", null);

  const [
    { count: totalPollCount },
    { count: todayVoteCount },
    { data: popular },
    { data: latest },
    { data: featuredPool },
    { data: homeSections },
    { data: homeBanners },
    { data: popups },
  ] = await Promise.all([
    supabase
      .from("polls")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .is("deleted_at", null),
    supabase
      .from("votes")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString()),
    published().order("vote_count", { ascending: false }).limit(5),
    published().order("created_at", { ascending: false }).limit(5),
    published().eq("is_featured", true).order("created_at", { ascending: false }).limit(50),
    supabase
      .from("home_sections")
      .select("key, is_visible, sort_order")
      .order("sort_order", { ascending: true }),
    supabase
      .from("banners")
      .select("id, title, image_path, link_url")
      .eq("kind", "home")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(5),
    supabase
      .from("popups")
      .select("id, title, body, image_path, link_url")
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const publicUrl = (path: string) =>
    supabase.storage.from(SITE_CONTENT_BUCKET).getPublicUrl(path).data.publicUrl;

  const visibleSectionKeys = (homeSections ?? [])
    .filter((s) => s.is_visible)
    .map((s) => s.key)
    .filter(isHomeSectionKey);

  const pool = featuredPool && featuredPool.length > 0 ? featuredPool : latest ?? [];

  const banners: HomeBanner[] = (homeBanners ?? [])
    .map((b) => ({
      id: b.id,
      title: b.title,
      imageUrl: b.image_path ? publicUrl(b.image_path) : "",
      linkUrl: b.link_url,
    }))
    .filter((b) => b.imageUrl);

  const popupItems: HomePopupItem[] = (popups ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    imageUrl: p.image_path ? publicUrl(p.image_path) : null,
    linkUrl: p.link_url,
  }));

  return {
    stats: {
      totalPollCount: totalPollCount ?? 0,
      todayVoteCount: todayVoteCount ?? 0,
    },
    visibleSectionKeys,
    featuredPoll: pickDailyFeatured(pool),
    popularPolls: popular ?? [],
    latestPolls: latest ?? [],
    banners,
    popups: popupItems,
  };
}

// Cached for all visitors. Short revalidate keeps the homepage fresh within
// a minute without hammering the database on every request. Bump the tag
// ("home-portal") via revalidateTag on mutations if you want instant updates.
export const getHomePortalData = unstable_cache(loadHomePortalData, ["home-portal-data"], {
  revalidate: 60,
  tags: ["home-portal"],
});

// ---------------------------------------------------------------------------
// Paginated main poll list
// ---------------------------------------------------------------------------

export const POLL_PAGE_SIZE = 10;

export type PollSort = "latest" | "popular" | "comments";

export type PollListItem = {
  id: string;
  question: string;
  created_at: string;
  category: PollCategory;
  view_count: number;
  is_pinned: boolean;
  is_featured: boolean;
  vote_count: number;
  comment_count: number;
};

const LIST_SELECT =
  "id, question, created_at, category, view_count, is_pinned, is_featured, vote_count, comment_count";

async function loadPollPage(
  category: PollCategory | null,
  sort: PollSort,
  page: number
): Promise<{ polls: PollListItem[]; hasNext: boolean }> {
  const supabase = createServiceClient();
  const from = (page - 1) * POLL_PAGE_SIZE;

  let q = supabase
    .from("polls")
    .select(LIST_SELECT)
    .eq("status", "published")
    .is("deleted_at", null);
  if (category) q = q.eq("category", category);

  // Pinned first, then the requested sort — ordered in the database so we
  // only transfer one page of rows instead of the whole table.
  q = q.order("is_pinned", { ascending: false });
  if (sort === "popular") q = q.order("vote_count", { ascending: false });
  else if (sort === "comments") q = q.order("comment_count", { ascending: false });
  else q = q.order("created_at", { ascending: false });
  // Stable tiebreaker so rows don't shuffle between pages when the sort key ties.
  q = q.order("id", { ascending: true });

  // Fetch one extra row to detect a next page without a separate count query.
  const { data, error } = await q.range(from, from + POLL_PAGE_SIZE);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as PollListItem[];
  return { polls: rows.slice(0, POLL_PAGE_SIZE), hasNext: rows.length > POLL_PAGE_SIZE };
}

// Published poll pages are identical for every visitor, so cache them keyed
// by (category, sort, page). 30s revalidate: a newly published poll appears
// within half a minute; admin poll actions can also revalidateTag it.
export const getPublishedPollPage = unstable_cache(loadPollPage, ["published-poll-page"], {
  revalidate: 30,
  tags: ["home-portal"],
});
