import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PUBLIC_IMAGE_BUCKET } from "@/lib/supabase/service";
import { flattenCategory, type CategoryEmbed } from "@/lib/home-data";
import {
  pickDailySpeedGamePolls,
  buildSpeedGameQuestions,
  type PollWithOptionCounts,
} from "@/lib/speed-game";
import { SpeedGame } from "@/components/speed-game";

export const metadata: Metadata = {
  title: "스피드 게임 | PickSide",
  description: "5초 안에 골라라! PickSide 스피드 게임.",
};

export default async function SpeedGamePage() {
  const supabase = await createClient();

  const [{ data: polls }, { data: auth }] = await Promise.all([
    supabase
      .from("polls")
      .select(
        "id, question, categories!polls_category_id_fkey(name, slug, icon, color), poll_options(id, label, image_path, votes(count))"
      )
      .eq("status", "published")
      .is("deleted_at", null)
      .order("id"),
    supabase.auth.getUser(),
  ]);

  if (!polls || polls.length === 0) {
    redirect("/");
  }

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
    polls as unknown as ({ categories: CategoryEmbed | null } & Record<string, unknown>)[]
  )
    .map((poll) => ({ ...poll, category: flattenCategory(poll).categoryName }))
    .filter((poll) => !myVoteByPoll[(poll as unknown as { id: string }).id]);

  const daily = pickDailySpeedGamePolls(
    pollsWithCategoryName as unknown as PollWithOptionCounts[],
    10
  );
  const questions = buildSpeedGameQuestions(daily, (path) =>
    supabase.storage.from(PUBLIC_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
  );

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <SpeedGame questions={questions} timerSeconds={5} resultTitle="스피드 게임 결과" />
    </div>
  );
}
