import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { POLL_CATEGORIES, isPollCategory, type PollCategory } from "@/lib/categories";
import { COMMUNITY_BOARDS, BOARD_LABEL } from "@/lib/community-boards";
import { isHomeSectionKey, type HomeSectionKey } from "@/lib/home-sections";
import { SITE_CONTENT_BUCKET } from "@/lib/supabase/service";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdSlot } from "@/components/ad-slot";
import { NoticeBanner } from "@/components/notice-banner";
import { HomePopup, type PopupItem } from "@/components/home-popup";

// Escape ILIKE wildcards so a literal "%" or "_" in the search box is
// matched as text, not treated as a pattern wildcard.
function escapeLike(value: string) {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

const SORT_OPTIONS = ["latest", "popular", "comments"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];
const SORT_LABEL: Record<SortOption, string> = {
  latest: "최신순",
  popular: "인기순",
  comments: "댓글순",
};

type PollListItem = {
  id: string;
  question: string;
  created_at: string;
  category: PollCategory;
  view_count: number;
  is_pinned: boolean;
  is_featured: boolean;
  votes: { count: number }[];
  comments: { count: number }[];
};

function countOf(rows: { count: number }[] | null | undefined) {
  return rows?.[0]?.count ?? 0;
}

// Prefer an admin-curated "추천" poll; if none is marked, fall back to a
// date-seeded pick so the section still rotates daily on its own.
function pickDailyFeatured<T extends { is_featured?: boolean }>(items: T[]): T | null {
  const featured = items.filter((item) => item.is_featured);
  const pool = featured.length > 0 ? featured : items;
  if (pool.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < today.length; i++) {
    hash = (hash * 31 + today.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length];
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; sort?: string }>;
}) {
  const { q, category: categoryParam, sort: sortParam } = await searchParams;
  const query = q?.trim() ?? "";
  const category = categoryParam && isPollCategory(categoryParam) ? categoryParam : null;
  const sort: SortOption = (SORT_OPTIONS as readonly string[]).includes(sortParam ?? "")
    ? (sortParam as SortOption)
    : "latest";

  const supabase = await createClient();

  const baseSelect =
    "id, question, created_at, category, view_count, is_pinned, is_featured, votes(count), comments(count)";
  let polls: PollListItem[] | null;
  let error: { message: string } | null;

  if (!query) {
    let res = supabase
      .from("polls")
      .select(baseSelect)
      .eq("status", "published")
      .is("deleted_at", null);
    if (category) res = res.eq("category", category);
    const final = await res.limit(200);
    polls = final.data;
    error = final.error;
  } else {
    const pattern = `%${escapeLike(query)}%`;

    // Two parameterized queries merged in app code, instead of building a
    // raw .or() filter string from user input (a comma or parenthesis in
    // the search box could otherwise inject extra filter conditions).
    let questionQuery = supabase
      .from("polls")
      .select(baseSelect)
      .eq("status", "published")
      .is("deleted_at", null)
      .ilike("question", pattern);
    if (category) questionQuery = questionQuery.eq("category", category);

    const [byQuestion, matchingOptions] = await Promise.all([
      questionQuery.limit(200),
      supabase.from("poll_options").select("poll_id").ilike("label", pattern),
    ]);

    error = byQuestion.error;

    const optionPollIds = [
      ...new Set((matchingOptions.data ?? []).map((o) => o.poll_id)),
    ];

    let byOption: PollListItem[] = [];
    if (optionPollIds.length > 0) {
      let optionQuery = supabase
        .from("polls")
        .select(baseSelect)
        .eq("status", "published")
        .is("deleted_at", null)
        .in("id", optionPollIds);
      if (category) optionQuery = optionQuery.eq("category", category);
      const res = await optionQuery.limit(200);
      byOption = res.data ?? [];
      error = error ?? res.error;
    }

    const merged = new Map<string, PollListItem>();
    for (const poll of [...(byQuestion.data ?? []), ...byOption]) {
      merged.set(poll.id, poll);
    }
    polls = [...merged.values()];
  }

  polls = polls
    ?.slice()
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      if (sort === "popular") return countOf(b.votes) - countOf(a.votes);
      if (sort === "comments") return countOf(b.comments) - countOf(a.comments);
      return a.created_at < b.created_at ? 1 : -1;
    })
    .slice(0, 50) ?? null;

  // Portal-style homepage widgets — always drawn from the full published
  // pool, independent of whatever search/category the visitor has active
  // in the browsable list below.
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const nowIso = new Date().toISOString();

  const [
    { data: allPublished },
    { count: totalPollCount },
    { count: todayVoteCount },
    { data: homeSections },
    { data: homeBanners },
    { data: popups },
  ] = await Promise.all([
    supabase
      .from("polls")
      .select(baseSelect)
      .eq("status", "published")
      .is("deleted_at", null)
      .order("id")
      .limit(200),
    supabase
      .from("polls")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .is("deleted_at", null),
    supabase
      .from("votes")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString()),
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

  const popupItems: PopupItem[] = (popups ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    imageUrl: p.image_path
      ? supabase.storage.from(SITE_CONTENT_BUCKET).getPublicUrl(p.image_path).data.publicUrl
      : null,
    linkUrl: p.link_url,
  }));

  const visibleSectionKeys = (homeSections ?? [])
    .filter((s) => s.is_visible)
    .map((s) => s.key)
    .filter(isHomeSectionKey);

  const featuredPoll = pickDailyFeatured(allPublished ?? []);
  const popularPolls = (allPublished ?? [])
    .slice()
    .sort((a, b) => countOf(b.votes) - countOf(a.votes))
    .slice(0, 5);
  const latestPolls = (allPublished ?? [])
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 5);

  const buildHref = (overrides: { category?: PollCategory | null; sort?: SortOption }) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    const nextCategory = "category" in overrides ? overrides.category : category;
    const nextSort = overrides.sort ?? sort;
    if (nextCategory) params.set("category", nextCategory);
    if (nextSort !== "latest") params.set("sort", nextSort);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  };

  const categoryNav = (
    <>
      <Button
        size="sm"
        variant={category === null ? "default" : "outline"}
        nativeButton={false}
        className="lg:w-full lg:justify-start"
        render={<Link href={buildHref({ category: null })}>전체</Link>}
      />
      {POLL_CATEGORIES.map((cat) => (
        <Button
          key={cat}
          size="sm"
          variant={category === cat ? "default" : "outline"}
          nativeButton={false}
          className="lg:w-full lg:justify-start"
          render={<Link href={buildHref({ category: cat })}>{cat}</Link>}
        />
      ))}
    </>
  );

  const communityNav = (
    <>
      <Button
        size="sm"
        variant="ghost"
        nativeButton={false}
        className="lg:w-full lg:justify-start"
        render={<Link href="/community">커뮤니티 홈</Link>}
      />
      {COMMUNITY_BOARDS.map((board) => (
        <Button
          key={board}
          size="sm"
          variant="ghost"
          nativeButton={false}
          className="lg:w-full lg:justify-start"
          render={<Link href={`/community/${board}`}>{BOARD_LABEL[board]}</Link>}
        />
      ))}
    </>
  );

  const sortNav = (
    <>
      {SORT_OPTIONS.map((option) => (
        <Button
          key={option}
          size="sm"
          variant={sort === option ? "default" : "ghost"}
          nativeButton={false}
          className="lg:w-full lg:justify-start"
          render={<Link href={buildHref({ sort: option })}>{SORT_LABEL[option]}</Link>}
        />
      ))}
    </>
  );

  const sectionBlocks: Record<HomeSectionKey, ReactNode> = {
    notice_banner: <NoticeBanner />,
    stats: (
      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        <span>
          오늘 참여자 <strong>{todayVoteCount ?? 0}</strong>명
        </span>
        <span>
          전체 투표 <strong>{totalPollCount ?? 0}</strong>개
        </span>
      </div>
    ),
    random_cta: (
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href="/polls/all">🔀 전체 랜덤투표</Link>}
        />
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href="/polls/speed">🎲 스피드 랜덤투표 시작하기</Link>}
        />
      </div>
    ),
    featured: featuredPoll ? (
      <Link href={`/polls/${featuredPoll.id}`}>
        <Card className="border-primary/30 bg-primary/5 transition-colors hover:bg-primary/10">
          <CardHeader>
            <div className="mb-1 flex items-center gap-2">
              <Badge>오늘의 추천 밸런스 게임</Badge>
              <Badge variant="outline">{featuredPoll.category}</Badge>
            </div>
            <CardTitle className="text-lg">{featuredPoll.question}</CardTitle>
            <CardDescription>
              {countOf(featuredPoll.votes)}표 참여 · 댓글 {countOf(featuredPoll.comments)}개
            </CardDescription>
          </CardHeader>
        </Card>
      </Link>
    ) : null,
    popular: (
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">실시간 인기 투표</h2>
        {popularPolls.length === 0 && (
          <p className="text-sm text-muted-foreground">아직 투표가 없어요.</p>
        )}
        <ol className="flex flex-col gap-1">
          {popularPolls.map((poll, i) => (
            <li key={poll.id}>
              <Link
                href={`/polls/${poll.id}`}
                className="flex items-baseline gap-2 rounded px-1 py-1 text-sm hover:bg-accent"
              >
                <span className="text-muted-foreground">{i + 1}</span>
                <span className="flex-1 truncate">{poll.question}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {countOf(poll.votes)}표
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    ),
    latest: (
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">최신 투표</h2>
        {latestPolls.length === 0 && (
          <p className="text-sm text-muted-foreground">아직 투표가 없어요.</p>
        )}
        <ol className="flex flex-col gap-1">
          {latestPolls.map((poll) => (
            <li key={poll.id}>
              <Link
                href={`/polls/${poll.id}`}
                className="flex items-baseline gap-2 rounded px-1 py-1 text-sm hover:bg-accent"
              >
                <Badge variant="outline" className="shrink-0">
                  {poll.category}
                </Badge>
                <span className="flex-1 truncate">{poll.question}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    ),
  };

  return (
    <div className="flex flex-1 flex-col">
      <HomePopup popups={popupItems} />

      <div className="mx-auto hidden w-full max-w-6xl px-4 pt-6 lg:block">
        <AdSlot slot="home-top-banner" />
      </div>

      {homeBanners && homeBanners.length > 0 && (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-6">
          {homeBanners.map((banner) => {
            const imageUrl = banner.image_path
              ? supabase.storage.from(SITE_CONTENT_BUCKET).getPublicUrl(banner.image_path).data
                  .publicUrl
              : null;
            if (!imageUrl) return null;
            const image = (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={banner.title}
                className="aspect-[3/1] w-full rounded-lg object-cover"
              />
            );
            return (
              <div key={banner.id}>
                {banner.link_url ? <Link href={banner.link_url}>{image}</Link> : image}
              </div>
            );
          })}
        </div>
      )}

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:grid lg:grid-cols-[200px_minmax(0,1fr)_300px] lg:items-start lg:gap-8">
        {/* Left sidebar: category + sort nav (desktop only) */}
        <aside className="hidden lg:flex lg:flex-col lg:gap-6">
          <nav className="flex flex-col gap-1">
            <span className="mb-1 text-xs font-medium text-muted-foreground">
              카테고리
            </span>
            {categoryNav}
          </nav>
          <nav className="flex flex-col gap-1 border-t pt-4">
            <span className="mb-1 text-xs font-medium text-muted-foreground">
              커뮤니티
            </span>
            {communityNav}
          </nav>
          <nav className="flex flex-col gap-1 border-t pt-4">
            <span className="mb-1 text-xs font-medium text-muted-foreground">
              정렬
            </span>
            {sortNav}
          </nav>
        </aside>

        {/* Center: main content */}
        <main className="mx-auto flex w-full max-w-lg flex-col gap-6 lg:mx-0 lg:max-w-none">
          {visibleSectionKeys.map((key) => (
            <Fragment key={key}>{sectionBlocks[key]}</Fragment>
          ))}

          <div className="flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">
              둘 중 뭐가 나아? 🤔
            </h1>
            <Button
              size="sm"
              nativeButton={false}
              className="self-start sm:self-auto"
              render={<Link href="/polls/new">투표 만들기</Link>}
            />
          </div>

          <form method="get" className="flex gap-2">
            {category && <input type="hidden" name="category" value={category} />}
            {sort !== "latest" && <input type="hidden" name="sort" value={sort} />}
            <Input
              type="search"
              name="q"
              placeholder="질문이나 선택지로 검색"
              defaultValue={query}
              className="flex-1"
            />
            <Button type="submit" variant="outline">
              검색
            </Button>
          </form>

          {/* Category + community + sort nav (mobile/tablet only, hidden once the sidebar takes over) */}
          <div className="flex flex-col gap-3 lg:hidden">
            <div className="flex flex-wrap gap-2">{categoryNav}</div>
            <div className="flex flex-wrap gap-2 border-t pt-4">{communityNav}</div>
            <div className="flex flex-wrap gap-2 border-t pt-4">{sortNav}</div>
          </div>

          {error && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive text-base">
                  Supabase에 연결할 수 없습니다
                </CardTitle>
                <CardDescription>
                  .env.local에 실제 Supabase 프로젝트 URL/키를 설정하고,
                  supabase/migrations/20260726000000_init.sql을 적용했는지
                  확인해주세요. ({error.message})
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {!error && (query || category) && polls?.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">검색 결과가 없어요</CardTitle>
                <CardDescription>
                  {query && `"${query}"`}
                  {query && category && " · "}
                  {category && `${category} 카테고리`}에 대한 투표를 찾지 못했습니다.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {!error && !query && !category && polls?.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">아직 투표가 없어요</CardTitle>
                <CardDescription>
                  첫 번째 PickSide 투표를 만들어보세요.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          <div className="flex flex-col gap-3">
            {polls?.map((poll, index) => {
              const voteCount = countOf(poll.votes);
              const commentCount = countOf(poll.comments);
              const showInFeedAd =
                (index + 1) % 4 === 0 && index !== (polls?.length ?? 0) - 1;
              return (
                <Fragment key={poll.id}>
                  <Link href={`/polls/${poll.id}`}>
                    <Card className="transition-colors hover:bg-accent">
                      <CardHeader>
                        <div className="mb-1 flex flex-wrap gap-1">
                          <Badge variant="outline">{poll.category}</Badge>
                          {poll.is_pinned && <Badge>📌 고정</Badge>}
                          {poll.is_featured && <Badge variant="secondary">⭐ 추천</Badge>}
                        </div>
                        <CardTitle className="text-base">{poll.question}</CardTitle>
                        <CardDescription>
                          {voteCount}표 참여 · 댓글 {commentCount}개 · 조회수{" "}
                          {poll.view_count}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>
                  {showInFeedAd && <AdSlot slot="home-infeed" />}
                </Fragment>
              );
            })}
          </div>
        </main>

        {/* Right sidebar: ad slots (desktop only) */}
        <aside className="hidden lg:flex lg:flex-col lg:gap-4">
          <AdSlot slot="home-sidebar-1" />
          <AdSlot slot="home-sidebar-2" />
        </aside>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pb-8">
        <AdSlot slot="home-bottom" />
      </div>
    </div>
  );
}
