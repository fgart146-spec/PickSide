import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PUBLIC_IMAGE_BUCKET } from "@/lib/supabase/service";
import {
  pickDailySpeedGamePolls,
  buildSpeedGameQuestions,
  type PollWithOptionsAndVotes,
} from "@/lib/speed-game";
import { SpeedGame } from "@/components/speed-game";

export default async function SpeedGamePage() {
  const supabase = await createClient();

  const [{ data: polls }, { data: auth }] = await Promise.all([
    supabase
      .from("polls")
      .select("id, question, category, poll_options(id, label, image_path), votes(option_id, voter_id)")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("id"),
    supabase.auth.getUser(),
  ]);

  if (!polls || polls.length === 0) {
    redirect("/");
  }

  const daily = pickDailySpeedGamePolls(polls as unknown as PollWithOptionsAndVotes[], 10);
  const questions = buildSpeedGameQuestions(
    daily,
    auth.user?.id ?? null,
    (path) => supabase.storage.from(PUBLIC_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
  );

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <SpeedGame questions={questions} timerSeconds={5} resultTitle="스피드 게임 결과" />
    </div>
  );
}
