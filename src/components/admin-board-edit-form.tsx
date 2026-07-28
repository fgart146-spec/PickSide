"use client";

import { useActionState } from "react";
import { updateBoard, type BoardFormState } from "@/app/admin/community/boards/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CommunityBoardRow } from "@/lib/community-boards";

const initialState: BoardFormState = { error: null };

function checkboxes(board: CommunityBoardRow) {
  return [
    { name: "is_visible", label: "공개", defaultChecked: board.is_visible },
    { name: "allow_posts", label: "글쓰기 허용", defaultChecked: board.allow_posts },
    { name: "allow_comments", label: "댓글 허용", defaultChecked: board.allow_comments },
    { name: "allow_images", label: "이미지 첨부 허용", defaultChecked: board.allow_images },
    { name: "allow_guest_view", label: "비회원 열람 허용", defaultChecked: board.allow_guest_view },
    { name: "allow_anonymous", label: "익명 글 허용", defaultChecked: board.allow_anonymous },
    {
      name: "admin_only_posting",
      label: "관리자만 작성 가능",
      defaultChecked: board.admin_only_posting,
    },
  ];
}

export function AdminBoardEditForm({ board }: { board: CommunityBoardRow }) {
  const action = updateBoard.bind(null, board.id);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="board-name">이름</Label>
          <Input id="board-name" name="name" required maxLength={30} defaultValue={board.name} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="board-slug">slug</Label>
          <Input id="board-slug" name="slug" maxLength={40} defaultValue={board.slug} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="board-description">설명 (선택)</Label>
        <Input
          id="board-description"
          name="description"
          maxLength={200}
          defaultValue={board.description ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="board-icon">아이콘 (이모지, 선택)</Label>
          <Input id="board-icon" name="icon" maxLength={8} defaultValue={board.icon ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="board-color">대표 색상 (선택)</Label>
          <Input
            id="board-color"
            name="color"
            type="color"
            defaultValue={board.color ?? "#7c5cfc"}
            className="h-9 p-1"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border p-3">
        {checkboxes(board).map((cb) => (
          <label key={cb.name} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={cb.name}
              defaultChecked={cb.defaultChecked}
              className="size-4"
            />
            {cb.label}
          </label>
        ))}
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "저장 중..." : "저장"}
      </Button>
    </form>
  );
}
