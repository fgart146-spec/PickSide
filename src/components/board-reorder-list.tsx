"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { GripVerticalIcon } from "lucide-react";
import { reorderBoards, toggleBoardVisibility } from "@/app/admin/community/boards/actions";
import { AdminBoardDeleteButton } from "@/components/admin-board-delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CommunityBoardRow } from "@/lib/community-boards";

export function BoardReorderList({
  boards,
  postCounts,
}: {
  boards: CommunityBoardRow[];
  postCounts: Record<string, number>;
}) {
  const [items, setItems] = useState(boards);
  const [dragId, setDragId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const from = items.findIndex((b) => b.id === dragId);
    const to = items.findIndex((b) => b.id === targetId);
    if (from === -1 || to === -1) return;

    const next = items.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    setDragId(null);
    startTransition(() => {
      reorderBoards(next.map((b) => b.id));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((board) => {
        const otherBoards = items
          .filter((b) => b.id !== board.id)
          .map((b) => ({ id: b.id, name: b.name }));

        return (
          <Card
            key={board.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(board.id)}
            className={dragId === board.id ? "opacity-50" : undefined}
          >
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              {/* Only the handle itself is draggable — see category-reorder-list.tsx for why. */}
              <span
                draggable
                onDragStart={() => setDragId(board.id)}
                className="shrink-0 cursor-grab active:cursor-grabbing"
              >
                <GripVerticalIcon className="size-4 text-muted-foreground" aria-hidden />
              </span>
              {board.color && (
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: board.color }}
                  aria-hidden
                />
              )}
              <div className="flex-1">
                <CardTitle className="flex items-center gap-1.5 text-base">
                  {board.icon && <span>{board.icon}</span>}
                  {board.name}
                  {board.is_system && (
                    <Badge variant="outline" className="text-xs">
                      시스템
                    </Badge>
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  /community/{board.slug} · 게시글 {postCounts[board.id] ?? 0}개
                </p>
              </div>
              <Badge variant={board.is_visible ? "default" : "outline"}>
                {board.is_visible ? "공개" : "숨김"}
              </Badge>
              <Badge variant={board.allow_posts ? "secondary" : "outline"}>
                {board.allow_posts ? "글쓰기 가능" : "글쓰기 금지"}
              </Badge>
              <Badge variant={board.allow_comments ? "secondary" : "outline"}>
                {board.allow_comments ? "댓글 가능" : "댓글 금지"}
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href={`/admin/community/boards/${board.id}/edit`}>수정</Link>}
              />
              <form action={toggleBoardVisibility.bind(null, board.id, !board.is_visible)}>
                <Button type="submit" size="sm" variant="outline">
                  {board.is_visible ? "숨기기" : "공개하기"}
                </Button>
              </form>
              {!board.is_system && (
                <AdminBoardDeleteButton
                  boardId={board.id}
                  boardName={board.name}
                  postCount={postCounts[board.id] ?? 0}
                  otherBoards={otherBoards}
                />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
