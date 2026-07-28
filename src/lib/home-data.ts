import { unstable_cache } from "next/cache";
import { createServiceClient, SITE_CONTENT_BUCKET } from "@/lib/supabase/service";
import { isHomeSectionKey, type HomeSectionKey } from "@/lib/home-sections";

// Widget rows now read the denormalized vote_count/comment_count columns
// (migration 20260727000007) instead of asking PostgREST to aggregate
// votes(count)/comments(count) per row. category_id (migration
// 20260727000009) is joined to the admin-managed categories table instead
// of trusting the legacy `category` enum column, so brand-new categories
// display correctly too.
const WIDGET_SELECT =
  "id, question, vote_count, comment_count, categories!polls_category_id_fkey(name, slug, icon, color)";

export type CategoryEmbed = { name: string; slug: string; icon: string | null; color: string | null };

export function flattenCategory(row: { categories: CategoryEmbed | null }) {
  return {
    categoryName: row.categories?.name ?? "미분류",
    categorySlug: row.categories?.slug ?? "uncategorized",
    categoryIcon: row.categories?.icon ?? null,
    categoryColor: row.categories?.color ?? null,
  };
}

export type PollWidget = {
  id: string;
  question: string;
  categoryName: string;
  categorySlug: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  vote_count: number;
  comment_count: number;
};

export type CategoryNavItem = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
};

async function loadVisibleCategories(): Promise<CategoryNavItem[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, icon, color")
    .eq("is_visible", true)
    .eq("is_deleted", false)
    .order("display_order", { ascending: true });
  return data ?? [];
}

// Cached alongside the rest of the home portal data — category admin
// actions call revalidateTag("home-portal") so a new/edited/hidden category
// shows up within the same request cycle, not after the 60s TTL.
export const getVisibleCategories = unstable_cache(
  loadVisibleCategories,
  ["visible-categories"],
  { revalidate: 60, tags: ["home-portal"] }
);

export async function getCategoryBySlug(slug: string): Promise<CategoryNavItem | null> {
  const categories = await getVisibleCategories();
  return categories.find((c) => c.slug === slug) ?? null;
}

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

export type CommunityHighlight = {
  id: string;
  title: string;
  boardSlug: string;
  boardName: string;
};

export type HomePortalData = {
  stats: { totalPollCount: number; todayVoteCount: number };
  visibleSectionKeys: HomeSectionKey[];
  featuredPoll: PollWidget | null;
  popularPolls: PollWidget[];
  latestPolls: PollWidget[];
  banners: HomeBanner[];
  popups: HomePopupItem[];
  communityHighlights: CommunityHighlight[];
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
    { data: communityPosts },
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
    supabase
      .from("community_posts")
      .select(
        "id, title, created_at, community_post_likes(count), community_boards!inner(slug, name, is_visible, is_deleted)"
      )
      .is("deleted_at", null)
      .eq("community_boards.is_visible", true)
      .eq("community_boards.is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const publicUrl = (path: string) =>
    supabase.storage.from(SITE_CONTENT_BUCKET).getPublicUrl(path).data.publicUrl;

  const visibleSectionKeys = (homeSections ?? [])
    .filter((s) => s.is_visible)
    .map((s) => s.key)
    .filter(isHomeSectionKey);

  const toWidget = (row: unknown) => {
    const r = row as { id: string; question: string; vote_count: number; comment_count: number } & {
      categories: CategoryEmbed | null;
    };
    return { id: r.id, question: r.question, vote_count: r.vote_count, comment_count: r.comment_count, ...flattenCategory(r) };
  };

  const popularWidgets = (popular ?? []).map(toWidget);
  const latestWidgets = (latest ?? []).map(toWidget);
  const featuredWidgets = (featuredPool ?? []).map(toWidget);

  const pool = featuredWidgets.length > 0 ? featuredWidgets : latestWidgets;

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

  const communityHighlights: CommunityHighlight[] = (
    (communityPosts as unknown as {
      id: string;
      title: string;
      community_post_likes: { count: number }[];
      community_boards: { slug: string; name: string } | null;
    }[]) ?? []
  )
    .filter((p) => p.community_boards)
    .sort((a, b) => (b.community_post_likes[0]?.count ?? 0) - (a.community_post_likes[0]?.count ?? 0))
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      title: p.title,
      boardSlug: p.community_boards!.slug,
      boardName: p.community_boards!.name,
    }));

  return {
    stats: {
      totalPollCount: totalPollCount ?? 0,
      todayVoteCount: todayVoteCount ?? 0,
    },
    visibleSectionKeys,
    featuredPoll: pickDailyFeatured(pool),
    popularPolls: popularWidgets,
    latestPolls: latestWidgets,
    banners,
    popups: popupItems,
    communityHighlights,
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
  categoryName: string;
  categorySlug: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  view_count: number;
  is_pinned: boolean;
  is_featured: boolean;
  vote_count: number;
  comment_count: number;
};

const LIST_SELECT =
  "id, question, created_at, view_count, is_pinned, is_featured, vote_count, comment_count, categories!polls_category_id_fkey(name, slug, icon, color)";

async function loadPollPage(
  categoryId: string | null,
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
  if (categoryId) q = q.eq("category_id", categoryId);

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
  const rows = (data ?? []) as unknown as ({
    id: string;
    question: string;
    created_at: string;
    view_count: number;
    is_pinned: boolean;
    is_featured: boolean;
    vote_count: number;
    comment_count: number;
  } & { categories: CategoryEmbed | null })[];
  const items: PollListItem[] = rows.map((r) => ({
    id: r.id,
    question: r.question,
    created_at: r.created_at,
    view_count: r.view_count,
    is_pinned: r.is_pinned,
    is_featured: r.is_featured,
    vote_count: r.vote_count,
    comment_count: r.comment_count,
    ...flattenCategory(r),
  }));
  return { polls: items.slice(0, POLL_PAGE_SIZE), hasNext: items.length > POLL_PAGE_SIZE };
}

// Published poll pages are identical for every visitor, so cache them keyed
// by (category, sort, page). 30s revalidate: a newly published poll appears
// within half a minute; admin poll actions can also revalidateTag it.
export const getPublishedPollPage = unstable_cache(loadPollPage, ["published-poll-page"], {
  revalidate: 30,
  tags: ["home-portal"],
});
