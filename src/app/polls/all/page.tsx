import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PUBLIC_IMAGE_BUCKET } from "@/lib/supabase/service";
import { POLL_CATEGORIES, isPollCategory } from "@/lib/categories";
import {
  pickDailySpeedGamePolls,
  buildSpeedGameQuestions,
  type PollWithOptionsAndVotes,
} from "@/lib/speed-game";
import { SpeedGame } from "@/components/speed-game";
import { Button } from "@/components/ui/button";

export default async function AllRandomPollsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: categoryParam } = await searchParams;
  const category = categoryParam && isPollCategory(categoryParam) ? categoryParam : null;

  const supabase = await createClient();

  let query = supabase
    .from("polls")
    .select("id, question, category, poll_options(id, label, image_path), votes(option_id, voter_id)")
    .eq("status", "published")
    .is("deleted_at", null);
  if (category) query = query.eq("category", category);

  const [{ data: polls }, { data: auth }] = await Promise.all([
    query.order("id"),
    supabase.auth.getUser(),
  ]);

  const all = pickDailySpeedGamePolls(
    (polls as unknown as PollWithOptionsAndVotes[]) ?? [],
    polls?.length ?? 0
  );
  const questions = buildSpeedGameQuestions(
    all,
    auth.user?.id ?? null,
    (path) => supabase.storage.from(PUBLIC_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
  );

  const categoryHref = (cat: string | null) => (cat ? `/polls/all?category=${encodeURIComponent(cat)}` : "/polls/all");

  return (
    <div className="flex flex-1 flex-col items-center gap-6 px-4 py-12">
      <div className="flex w-full max-w-md flex-wrap gap-2">
        <Button
          size="sm"
          variant={category === null ? "default" : "outline"}
          nativeButton={false}
          render={<Link href={categoryHref(null)}>전체</Link>}
        />
        {POLL_CATEGORIES.map((cat) => (
          <Button
            key={cat}
            size="sm"
            variant={category === cat ? "default" : "outline"}
            nativeButton={false}
            render={<Link href={categoryHref(cat)}>{cat}</Link>}
          />
        ))}
      </div>

      <SpeedGame
        key={category ?? "all"}
        questions={questions}
        timerSeconds={null}
        resultTitle="전체 랜덤투표 결과"
      />
    </div>
  );
}
