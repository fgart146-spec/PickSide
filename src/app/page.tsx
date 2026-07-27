import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { POLL_CATEGORIES, isPollCategory, type PollCategory } from "@/lib/categories";
import { COMMUNITY_BOARDS, BOARD_LABEL } from "@/lib/community-boards";
import { type HomeSectionKey } from "@/lib/home-sections";
import { escapeLike } from "@/lib/search";
import {
  getHomePortalData,
  getPublishedPollPage,
  POLL_PAGE_SIZE,
  type PollListItem,
  type PollSort,
} from "@/lib/home-data";
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
import { HomePopup } from "@/components/home-popup";
import {
  ShuffleIcon,
  DicesIcon,
  ScaleIcon,
  PinIcon,
  StarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";

const SORT_OPTIONS = ["latest", "popular", "comments"] as const;
type SortOption = PollSort;
const SORT_LABEL: Record<SortOption, string> = {
  latest: "최신순",
  popular: "인기순",
  comments: "댓글순",
};

// Reads the denormalized vote_count/comment_count columns instead of
// aggregating votes(count)/comments(count) per row.
const baseSelect =
  "id, question, created_at, category, view_count, is_pinned, is_featured, vote_count, comment_count";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; sort?: string; page?: string }>;
}) {
  const { q, category: categoryParam, sort: sortParam, page: pageParam } = await searchParams;
  const query = q?.trim() ?? "";
  const category = categoryParam && isPollCategory(categoryParam) ? categoryParam : null;
  const sort: SortOption = (SORT_OPTIONS as readonly string[]).includes(sortParam ?? "")
    ? (sortParam as SortOption)
    : "latest";
  const parsedPage = Number(pageParam);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  // Portal widgets (cached, cookie-independent) are fetched in parallel with
  // the main poll list so the two round-trips overlap instead of stacking.
  const portalPromise = getHomePortalData();

  let polls: PollListItem[] = [];
  let hasNext = false;
  let error: { message: string } | null = null;

  if (!query) {
    // Default browse: one cached, database-paginated page of 10 rows.
    try {
      const res = await getPublishedPollPage(category, sort, page);
      polls = res.polls;
      hasNext = res.hasNext;
    } catch (e) {
      error = { message: e instanceof Error ? e.message : String(e) };
    }
  } else {
    const supabase = await createClient();
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

    const sorted = [...merged.values()].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      if (sort === "popular") return b.vote_count - a.vote_count;
      if (sort === "comments") return b.comment_count - a.comment_count;
      return a.created_at < b.created_at ? 1 : -1;
    });

    const start = (page - 1) * POLL_PAGE_SIZE;
    polls = sorted.slice(start, start + POLL_PAGE_SIZE);
    hasNext = sorted.length > start + POLL_PAGE_SIZE;
  }

  const {
    stats,
    visibleSectionKeys,
    featuredPoll,
    popularPolls,
    latestPolls,
    banners: homeBanners,
    popups: popupItems,
  } = await portalPromise;

  const buildHref = (overrides: {
    category?: PollCategory | null;
    sort?: SortOption;
    page?: number;
  }) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    const nextCategory = "category" in overrides ? overrides.category : category;
    const nextSort = overrides.sort ?? sort;
    if (nextCategory) params.set("category", nextCategory);
    if (nextSort !== "latest") params.set("sort", nextSort);
    if (overrides.page && overrides.page > 1) params.set("page", String(overrides.page));
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
          오늘 참여자 <strong>{stats.todayVoteCount}</strong>명
        </span>
        <span>
          전체 투표 <strong>{stats.totalPollCount}</strong>개
        </span>
      </div>
    ),
    random_cta: (
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={
            <Link href="/polls/all">
              <ShuffleIcon />
              전체 랜덤투표
            </Link>
          }
        />
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={
            <Link href="/polls/speed">
              <DicesIcon />
              스피드 랜덤투표 시작하기
            </Link>
          }
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
              {featuredPoll.vote_count}표 참여 · 댓글 {featuredPoll.comment_count}개
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
                  {poll.vote_count}표
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
            const image = (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={banner.imageUrl}
                alt={banner.title}
                className="aspect-[3/1] w-full rounded-lg object-cover"
              />
            );
            return (
              <div key={banner.id}>
                {banner.linkUrl ? <Link href={banner.linkUrl}>{image}</Link> : image}
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
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <ScaleIcon className="size-6 text-primary" />
              둘 중 뭐가 나아?
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

          {!error && (query || category) && polls.length === 0 && (
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

          {!error && !query && !category && page === 1 && polls.length === 0 && (
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
            {polls.map((poll, index) => {
              const showInFeedAd =
                (index + 1) % 4 === 0 && index !== polls.length - 1;
              return (
                <Fragment key={poll.id}>
                  <Link href={`/polls/${poll.id}`}>
                    <Card className="transition-colors hover:bg-accent">
                      <CardHeader>
                        <div className="mb-1 flex flex-wrap gap-1">
                          <Badge variant="outline">{poll.category}</Badge>
                          {poll.is_pinned && (
                            <Badge>
                              <PinIcon />
                              고정
                            </Badge>
                          )}
                          {poll.is_featured && (
                            <Badge variant="secondary">
                              <StarIcon />
                              추천
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-base">{poll.question}</CardTitle>
                        <CardDescription>
                          {poll.vote_count}표 참여 · 댓글 {poll.comment_count}개 · 조회수{" "}
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

          {/* Pagination — only when there is more than one page */}
          {(page > 1 || hasNext) && (
            <div className="flex items-center justify-center gap-3 pt-2">
              {page > 1 ? (
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={
                    <Link href={buildHref({ page: page - 1 })}>
                      <ChevronLeftIcon />
                      이전
                    </Link>
                  }
                />
              ) : (
                <Button size="sm" variant="outline" disabled>
                  <ChevronLeftIcon />
                  이전
                </Button>
              )}
              <span className="text-sm text-muted-foreground">{page} 페이지</span>
              {hasNext ? (
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={
                    <Link href={buildHref({ page: page + 1 })}>
                      다음
                      <ChevronRightIcon />
                    </Link>
                  }
                />
              ) : (
                <Button size="sm" variant="outline" disabled>
                  다음
                  <ChevronRightIcon />
                </Button>
              )}
            </div>
          )}
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
