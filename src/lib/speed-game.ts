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

// Per-option vote counts come pre-aggregated from the DB (votes(count)) instead
// of transferring every vote row; the viewer's own votes arrive as a small map.
export type PollWithOptionCounts = {
  id: string;
  question: string;
  category: string;
  poll_options: {
    id: string;
    label: string;
    image_path: string | null;
    votes: { count: number }[];
  }[];
};

export function buildSpeedGameQuestions(
  polls: PollWithOptionCounts[],
  myVoteByPoll: Record<string, string>,
  imageUrlFor: (path: string) => string
) {
  return polls.map((poll) => ({
    pollId: poll.id,
    question: poll.question,
    category: poll.category,
    options: poll.poll_options.map((option) => ({
      id: option.id,
      label: option.label,
      imageUrl: option.image_path ? imageUrlFor(option.image_path) : null,
      voteCount: option.votes[0]?.count ?? 0,
    })),
    alreadyVotedOptionId: myVoteByPoll[poll.id] ?? null,
  }));
}
