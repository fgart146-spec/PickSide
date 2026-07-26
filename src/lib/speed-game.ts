// Deterministic per-day shuffle so every visitor sees the same 10 polls for
// a given date, but the set changes daily on its own (same technique as
// pickDailyFeatured on the home page, generalized to N items).
function seededShuffle<T>(items: T[], seed: string): T[] {
  let state = 0;
  for (let i = 0; i < seed.length; i++) {
    state = (state * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    state = (state * 1103515245 + 12345) >>> 0;
    const j = state % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function pickDailySpeedGamePolls<T>(items: T[], count = 10): T[] {
  const today = new Date().toISOString().slice(0, 10);
  return seededShuffle(items, today).slice(0, count);
}

export type PollWithOptionsAndVotes = {
  id: string;
  question: string;
  category: string;
  poll_options: { id: string; label: string; image_path: string | null }[];
  votes: { option_id: string; voter_id: string }[];
};

export function buildSpeedGameQuestions(
  polls: PollWithOptionsAndVotes[],
  voterId: string | null,
  imageUrlFor: (path: string) => string
) {
  return polls.map((poll) => {
    const tally: Record<string, number> = {};
    for (const vote of poll.votes) {
      tally[vote.option_id] = (tally[vote.option_id] ?? 0) + 1;
    }
    const myVote = voterId ? (poll.votes.find((v) => v.voter_id === voterId)?.option_id ?? null) : null;

    return {
      pollId: poll.id,
      question: poll.question,
      category: poll.category,
      options: poll.poll_options.map((option) => ({
        id: option.id,
        label: option.label,
        imageUrl: option.image_path ? imageUrlFor(option.image_path) : null,
        voteCount: tally[option.id] ?? 0,
      })),
      alreadyVotedOptionId: myVote,
    };
  });
}
