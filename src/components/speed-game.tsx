"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { castVote } from "@/app/polls/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type SpeedGameOption = {
  id: string;
  label: string;
  imageUrl: string | null;
  voteCount: number;
};

export type SpeedGameQuestion = {
  pollId: string;
  question: string;
  category: string;
  options: SpeedGameOption[];
  alreadyVotedOptionId: string | null;
};

type Answer = {
  pollId: string;
  question: string;
  options: SpeedGameOption[];
  pickedOptionId: string | null;
};

function topOption(options: SpeedGameOption[]): SpeedGameOption | null {
  if (options.length === 0) return null;
  return [...options].sort((a, b) => b.voteCount - a.voteCount)[0];
}

function isTie(options: SpeedGameOption[]): boolean {
  if (options.length < 2) return false;
  const sorted = [...options].sort((a, b) => b.voteCount - a.voteCount);
  return sorted[0].voteCount === sorted[1].voteCount;
}

export function SpeedGame({
  questions,
  timerSeconds = 5,
  resultTitle = "스피드 게임 결과",
}: {
  questions: SpeedGameQuestion[];
  /** Seconds per question before auto-skip; pass null for an untimed, manual-skip flow. */
  timerSeconds?: number | null;
  resultTitle?: string;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(timerSeconds ?? 0);
  const [pending, setPending] = useState(false);

  const current = index < questions.length ? questions[index] : null;
  const finished = index >= questions.length && questions.length > 0;

  function advance(pickedOptionId: string | null) {
    if (!current) return;
    setAnswers((prev) => [
      ...prev,
      {
        pollId: current.pollId,
        question: current.question,
        options: current.options,
        pickedOptionId,
      },
    ]);
    setIndex((i) => i + 1);
  }

  useEffect(() => {
    if (!current) return;

    if (current.alreadyVotedOptionId) {
      // Already voted on this one in a previous visit — votes are insert-only,
      // so re-clicking a different option here would silently fail. Record
      // the historical pick and move straight on instead of running a timer.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      advance(current.alreadyVotedOptionId);
      return;
    }

    if (timerSeconds === null) return;

    setSecondsLeft(timerSeconds);
    const start = Date.now();
    const timer = setInterval(() => {
      const remaining = Math.max(0, timerSeconds - (Date.now() - start) / 1000);
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        advance(null);
      }
    }, 100);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  async function pick(optionId: string) {
    if (pending || !current) return;
    setPending(true);
    try {
      await castVote(current.pollId, optionId);
    } catch {
      // Ignore — a race with the unique vote constraint (or a network blip)
      // shouldn't stall the game.
    }
    setPending(false);
    advance(optionId);
  }

  if (questions.length === 0) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>참여할 수 있는 투표가 없어요</CardTitle>
        </CardHeader>
        <CardContent>
          <Button nativeButton={false} render={<Link href="/">홈으로</Link>} />
        </CardContent>
      </Card>
    );
  }

  if (finished) {
    const answeredCount = answers.filter((a) => a.pickedOptionId).length;
    const agreeCount = answers.filter((a) => {
      if (!a.pickedOptionId || isTie(a.options)) return false;
      return topOption(a.options)?.id === a.pickedOptionId;
    }).length;

    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{resultTitle}</CardTitle>
          <CardDescription>
            {questions.length}문제 중 {answeredCount}개 참여 · 다수 의견과 {agreeCount}개 일치
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {answers.map((answer, i) => {
            const top = topOption(answer.options);
            const tie = isTie(answer.options);
            const picked = answer.options.find((o) => o.id === answer.pickedOptionId);
            return (
              <div key={answer.pollId} className="rounded-md border p-3 text-sm">
                <p className="font-medium">
                  {i + 1}. {answer.question}
                </p>
                <p className="mt-1 text-muted-foreground">
                  내 선택: {picked ? picked.label : "스킵"}
                  {picked && tie && " · 동률"}
                  {picked && !tie && top && (
                    <span
                      className={
                        answer.pickedOptionId === top.id ? "text-primary" : "text-muted-foreground"
                      }
                    >
                      {" · "}
                      {answer.pickedOptionId === top.id ? "다수 의견과 일치" : "다수 의견과 다름"}
                    </span>
                  )}
                </p>
              </div>
            );
          })}
          <Button nativeButton={false} render={<Link href="/">홈으로</Link>} />
        </CardContent>
      </Card>
    );
  }

  if (!current) return null;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Badge variant="outline">{current.category}</Badge>
          {timerSeconds !== null && (
            <span className="text-sm font-semibold tabular-nums">{Math.ceil(secondsLeft)}초</span>
          )}
        </div>
        {timerSeconds !== null && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-100 ease-linear"
              style={{ width: `${(secondsLeft / timerSeconds) * 100}%` }}
            />
          </div>
        )}
        <CardTitle className="pt-2 text-xl">{current.question}</CardTitle>
        <CardDescription>
          {index + 1} / {questions.length}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {current.options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={pending}
            onClick={() => pick(option.id)}
            className="flex items-center gap-3 rounded-md border p-4 text-left transition-colors hover:bg-accent disabled:opacity-50"
          >
            {option.imageUrl && (
              <Image
                src={option.imageUrl}
                alt={option.label}
                width={48}
                height={48}
                className="rounded object-cover"
                unoptimized
              />
            )}
            <span className="font-medium">{option.label}</span>
          </button>
        ))}
        {timerSeconds === null && (
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => advance(null)}>
            건너뛰기
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
