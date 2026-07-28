"use client";

import { useActionState } from "react";
import { createBoard, type BoardFormState } from "@/app/admin/community/boards/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: BoardFormState = { error: null };

const CHECKBOXES = [
  { name: "is_visible", label: "공개", defaultChecked: true },
  { name: "allow_posts", label: "글쓰기 허용", defaultChecked: true },
  { name: "allow_comments", label: "댓글 허용", defaultChecked: true },
  { name: "allow_images", label: "이미지 첨부 허용", defaultChecked: true },
  { name: "allow_guest_view", label: "비회원 열람 허용", defaultChecked: true },
  { name: "allow_anonymous", label: "익명 글 허용", defaultChecked: false },
  { name: "admin_only_posting", label: "관리자만 작성 가능", defaultChecked: false },
];

export function AdminBoardCreateForm() {
  const [state, formAction, pending] = useActionState(createBoard, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="board-name">이름</Label>
          <Input id="board-name" name="name" required maxLength={30} placeholder="예: 맛집 게시판" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="board-slug">
            slug <span className="text-xs text-muted-foreground">(선택, 비우면 자동 생성)</span>
          </Label>
          <Input id="board-slug" name="slug" maxLength={40} placeholder="예: food-talk" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="board-description">설명 (선택)</Label>
        <Input id="board-description" name="description" maxLength={200} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="board-icon">아이콘 (이모지, 선택)</Label>
          <Input id="board-icon" name="icon" maxLength={8} placeholder="🍜" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="board-color">대표 색상 (선택)</Label>
          <Input id="board-color" name="color" type="color" defaultValue="#7c5cfc" className="h-9 p-1" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border p-3">
        {CHECKBOXES.map((cb) => (
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
        {pending ? "추가 중..." : "게시판 추가"}
      </Button>
    </form>
  );
}
