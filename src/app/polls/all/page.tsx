import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PUBLIC_IMAGE_BUCKET } from "@/lib/supabase/service";
import { getVisibleCategories, flattenCategory, type CategoryEmbed } from "@/lib/home-data";
import {
  pickDailySpeedGamePolls,
  buildSpeedGameQuestions,
  type PollWithOptionCounts,
} from "@/lib/speed-game";
import { SpeedGame } from "@/components/speed-game";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "전체 랜덤투표 | PickSide",
  description: "카테고리별로 모든 투표를 랜덤 순서로 빠르게 즐겨보세요.",
};

export default async function AllRandomPollsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: categorySlug } = await searchParams;

  const supabase = await createClient();
  const categories = await getVisibleCategories();
  const activeCategory = categorySlug ? categories.find((c) => c.slug === categorySlug) : null;

  let query = supabase
    .from("polls")
    .select(
      "id, question, categories!polls_category_id_fkey(name, slug, icon, color), poll_options(id, label, image_path, votes(count))"
    )
    .eq("status", "published")
    .is("deleted_at", null);
  if (activeCategory) query = query.eq("category_id", activeCategory.id);

  const [{ data: polls }, { data: auth }] = await Promise.all([
    query.order("id"),
    supabase.auth.getUser(),
  ]);

  // Only the viewer's own votes (to mark their prior pick) — not every vote row.
  const myVoteByPoll: Record<string, string> = {};
  if (auth.user) {
    const { data: myVotes } = await supabase
      .from("votes")
      .select("poll_id, option_id")
      .eq("voter_id", auth.user.id);
    for (const v of myVotes ?? []) myVoteByPoll[v.poll_id] = v.option_id;
  }

  const pollsWithCategoryName = (
    (polls as unknown as ({ categories: CategoryEmbed | null } & Record<string, unknown>)[]) ?? []
  ).map((poll) => ({ ...poll, category: flattenCategory(poll).categoryName }));

  const all = pickDailySpeedGamePolls(
    pollsWithCategoryName as unknown as PollWithOptionCounts[],
    pollsWithCategoryName.length
  );
  const questions = buildSpeedGameQuestions(
    all,
    myVoteByPoll,
    (path) => supabase.storage.from(PUBLIC_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
  );

  const categoryHref = (slug: string | null) =>
    slug ? `/polls/all?category=${encodeURIComponent(slug)}` : "/polls/all";

  return (
    <div className="flex flex-1 flex-col items-center gap-6 px-4 py-12">
      <div className="flex w-full max-w-md flex-wrap gap-2">
        <Button
          size="sm"
          variant={activeCategory === null ? "default" : "outline"}
          nativeButton={false}
          render={<Link href={categoryHref(null)}>전체</Link>}
        />
        {categories.map((cat) => (
          <Button
            key={cat.id}
            size="sm"
            variant={activeCategory?.id === cat.id ? "default" : "outline"}
            nativeButton={false}
            render={
              <Link href={categoryHref(cat.slug)}>
                {cat.icon ? `${cat.icon} ${cat.name}` : cat.name}
              </Link>
            }
          />
        ))}
      </div>

      <SpeedGame
        key={activeCategory?.slug ?? "all"}
        questions={questions}
        timerSeconds={null}
        resultTitle="전체 랜덤투표 결과"
      />
    </div>
  );
}
