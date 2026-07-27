"use client";

import { useState, useTransition, type ReactNode } from "react";
import { UsersIcon, MessageCircleIcon, Share2Icon } from "lucide-react";
import { toast } from "sonner";
import { castVote } from "@/app/polls/actions";
import { VoteCard } from "@/components/vote-card";
import { PICK_PURPLE } from "@/lib/poll-visuals";
import type { PollCategory } from "@/lib/categories";

export type VsOption = { id: string; label: string; imageUrl?: string | null };

type VsPollProps = {
  pollId: string;
  category: PollCategory;
  optionA: VsOption;
  optionB: VsOption;
  /** The viewer's already-cast option, or null. */
  votedOptionId: string | null;
  /** Per-option vote counts — only provided after the viewer has voted (blind voting). */
  counts: Record<string, number> | null;
  totalVotes: number;
  commentCount: number;
  /** Published and open for voting. */
  canVote: boolean;
  reportSlot?: ReactNode;
};

export function VsPoll({
  pollId,
  category,
  optionA,
  optionB,
  votedOptionId,
  counts,
  totalVotes,
  commentCount,
  canVote,
  reportSlot,
}: VsPollProps) {
  const [pending, startTransition] = useTransition();
  const [optimisticId, setOptimisticId] = useState<string | null>(null);

  const effectiveVotedId = votedOptionId ?? optimisticId;
  const hasResults = votedOptionId != null && counts != null;

  const total = counts ? (counts[optionA.id] ?? 0) + (counts[optionB.id] ?? 0) : 0;
  const pct = (id: string) =>
    !counts || total === 0 ? 0 : Math.round(((counts[id] ?? 0) / total) * 100);

  const resultFor = (id: string) =>
    hasResults ? { percent: pct(id), count: counts![id] ?? 0 } : null;
  const winnerId = hasResults
    ? pct(optionA.id) >= pct(optionB.id)
      ? optionA.id
      : optionB.id
    : null;

  function handleSelect(optionId: string) {
    if (!canVote || effectiveVotedId) return;
    setOptimisticId(optionId);
    startTransition(async () => {
      try {
        await castVote(pollId, optionId);
      } catch (e) {
        setOptimisticId(null);
        toast.error(e instanceof Error ? e.message : "투표에 실패했습니다.");
      }
    });
  }

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("링크를 복사했어요.");
      }
    } catch {
      /* share sheet dismissed — ignore */
    }
  }

  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      <div className="relative grid grid-cols-2 gap-3 sm:gap-4">
        <VoteCard
          side="A"
          category={category}
          label={optionA.label}
          imageUrl={optionA.imageUrl}
          clickable={canVote && !effectiveVotedId}
          selected={effectiveVotedId === optionA.id}
          result={resultFor(optionA.id)}
          winner={winnerId === optionA.id}
          onSelect={() => handleSelect(optionA.id)}
        />
        <VoteCard
          side="B"
          category={category}
          label={optionB.label}
          imageUrl={optionB.imageUrl}
          clickable={canVote && !effectiveVotedId}
          selected={effectiveVotedId === optionB.id}
          result={resultFor(optionB.id)}
          winner={winnerId === optionB.id}
          onSelect={() => handleSelect(optionB.id)}
        />

        {/* Floating VS badge */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-sm font-extrabold shadow-lg ring-1 ring-black/5 sm:size-14 sm:text-base dark:bg-neutral-900 dark:ring-white/10"
          style={{ color: PICK_PURPLE }}
        >
          VS
        </div>
      </div>

      {canVote && !effectiveVotedId && (
        <p className="text-center text-xs text-muted-foreground">
          카드를 눌러 투표하면 결과가 공개돼요.
        </p>
      )}

      {/* Footer actions */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <UsersIcon className="size-4" />
          {totalVotes}
        </span>
        <a href="#comments" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
          <MessageCircleIcon className="size-4" />
          {commentCount}
        </a>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={handleShare}
            aria-label="공유하기"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-accent hover:text-foreground"
          >
            <Share2Icon className="size-4" />
          </button>
          {reportSlot}
        </div>
      </div>
    </div>
  );
}
