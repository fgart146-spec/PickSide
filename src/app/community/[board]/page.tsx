import { notFound } from "next/navigation";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isCommunityBoard, BOARD_LABEL, type CommunityBoard } from "@/lib/community-boards";
import { BrowseSidebar } from "@/components/browse-sidebar";
import { Pagination, PAGE_SIZE, parsePage } from "@/components/pagination";
import { escapeLike } from "@/lib/search";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SORT_OPTIONS = ["latest", "popular", "comments"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];
const SORT_LABEL: Record<SortOption, string> = {
  latest: "최신순",
  popular: "인기순",
  comments: "댓글순",
};

type PostListItem = {
  id: string;
  title: string;
  view_count: number;
  created_at: string;
  profiles: { username: string } | null;
  community_post_likes: { count: number }[];
  community_comments: { count: number }[];
};

function countOf(rows: { count: number }[] | null | undefined) {
  return rows?.[0]?.count ?? 0;
}

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ board: string }>;
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>;
}) {
  const { board } = await params;
  if (!isCommunityBoard(board)) {
    notFound();
  }

  const { q, sort: sortParam, page: pageParam } = await searchParams;
  const query = q?.trim() ?? "";
  const sort: SortOption = (SORT_OPTIONS as readonly string[]).includes(sortParam ?? "")
    ? (sortParam as SortOption)
    : "latest";
  const page = parsePage(pageParam);

  const supabase = await createClient();
  const baseSelect =
    "id, title, view_count, created_at, profiles!community_posts_author_id_fkey(username), community_post_likes(count), community_comments(count)";

  let allPosts: PostListItem[] = [];
  let error: { message: string } | null = null;

  if (!query) {
    const res = await supabase
      .from("community_posts")
      .select(baseSelect)
      .eq("board", board)
      .is("deleted_at", null)
      .limit(200);
    allPosts = (res.data as unknown as PostListItem[]) ?? [];
    error = res.error;
  } else {
    const pattern = `%${escapeLike(query)}%`;
    const [byTitle, byBody] = await Promise.all([
      supabase
        .from("community_posts")
        .select(baseSelect)
        .eq("board", board)
        .is("deleted_at", null)
        .ilike("title", pattern)
        .limit(200),
      supabase
        .from("community_posts")
        .select(baseSelect)
        .eq("board", board)
        .is("deleted_at", null)
        .ilike("body", pattern)
        .limit(200),
    ]);

    error = byTitle.error ?? byBody.error;

    const merged = new Map<string, PostListItem>();
    for (const post of [
      ...((byTitle.data as unknown as PostListItem[]) ?? []),
      ...((byBody.data as unknown as PostListItem[]) ?? []),
    ]) {
      merged.set(post.id, post);
    }
    allPosts = [...merged.values()];
  }

  const sorted = allPosts.slice().sort((a, b) => {
    if (sort === "popular")
      return countOf(b.community_post_likes) - countOf(a.community_post_likes);
    if (sort === "comments")
      return countOf(b.community_comments) - countOf(a.community_comments);
    return a.created_at < b.created_at ? 1 : -1;
  });

  const start = (page - 1) * PAGE_SIZE;
  const posts = sorted.slice(start, start + PAGE_SIZE);
  const hasNext = sorted.length > start + PAGE_SIZE;

  const buildHref = (overrides: { sort?: SortOption; page?: number }) => {
    const params2 = new URLSearchParams();
    if (query) params2.set("q", query);
    const nextSort = overrides.sort ?? sort;
    if (nextSort !== "latest") params2.set("sort", nextSort);
    if (overrides.page && overrides.page > 1) params2.set("page", String(overrides.page));
    const qs = params2.toString();
    return qs ? `/community/${board}?${qs}` : `/community/${board}`;
  };

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start lg:gap-8">
      <BrowseSidebar activeSort={sort} />

      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 lg:mx-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            {BOARD_LABEL[board as CommunityBoard]}
          </h1>
          <Button
            size="sm"
            nativeButton={false}
            className="self-start sm:self-auto"
            render={
              <Link href={`/community/${board}/new`}>
                <PlusIcon />
                글쓰기
              </Link>
            }
          />
        </div>

        <form method="get" className="flex gap-2">
          {sort !== "latest" && <input type="hidden" name="sort" value={sort} />}
          <Input
            type="search"
            name="q"
            placeholder="제목이나 내용으로 검색"
            defaultValue={query}
            className="flex-1"
          />
          <Button type="submit" variant="outline">
            검색
          </Button>
        </form>

        <div className="flex flex-wrap gap-2 border-t pt-4">
          {SORT_OPTIONS.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={sort === option ? "default" : "ghost"}
              nativeButton={false}
              render={<Link href={buildHref({ sort: option })}>{SORT_LABEL[option]}</Link>}
            />
          ))}
        </div>

        {error && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive text-base">
                불러오는 중 오류가 발생했습니다
              </CardTitle>
              <CardDescription>{error.message}</CardDescription>
            </CardHeader>
          </Card>
        )}

        {!error && posts.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {query ? "검색 결과가 없어요" : "아직 글이 없어요"}
              </CardTitle>
              <CardDescription>
                {query ? `"${query}"에 대한 글을 찾지 못했습니다.` : "첫 글을 남겨보세요."}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <div className="flex flex-col gap-3">
          {posts.map((post) => (
            <Link key={post.id} href={`/community/${board}/${post.id}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardHeader>
                  <CardTitle className="text-base">{post.title}</CardTitle>
                  <CardDescription>
                    {post.profiles?.username ?? "알 수 없음"} · 좋아요{" "}
                    {countOf(post.community_post_likes)} · 댓글{" "}
                    {countOf(post.community_comments)} · 조회수 {post.view_count}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>

        <Pagination page={page} hasNext={hasNext} makeHref={(p) => buildHref({ page: p })} />
      </div>
    </div>
  );
}
