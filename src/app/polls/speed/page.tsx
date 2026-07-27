import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PUBLIC_IMAGE_BUCKET } from "@/lib/supabase/service";
import {
  pickDailySpeedGamePolls,
  buildSpeedGameQuestions,
  type PollWithOptionCounts,
} from "@/lib/speed-game";
import { SpeedGame } from "@/components/speed-game";

export default async function SpeedGamePage() {
  const supabase = await createClient();

  const [{ data: polls }, { data: auth }] = await Promise.all([
    supabase
      .from("polls")
      .select("id, question, category, poll_options(id, label, image_path, votes(count))")
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

  const daily = pickDailySpeedGamePolls(polls as unknown as PollWithOptionCounts[], 10);
  const questions = buildSpeedGameQuestions(
    daily,
    myVoteByPoll,
    (path) => supabase.storage.from(PUBLIC_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
  );

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <SpeedGame questions={questions} timerSeconds={5} resultTitle="스피드 게임 결과" />
    </div>
  );
}
