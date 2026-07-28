"use client";

import { useActionState } from "react";
import { updateCategory, type CategoryFormState } from "@/app/admin/categories/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CategoryRow } from "@/lib/categories";

const initialState: CategoryFormState = { error: null };

export function AdminCategoryEditForm({ category }: { category: CategoryRow }) {
  const action = updateCategory.bind(null, category.id);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cat-name">이름</Label>
          <Input id="cat-name" name="name" required maxLength={30} defaultValue={category.name} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cat-slug">slug</Label>
          <Input id="cat-slug" name="slug" maxLength={40} defaultValue={category.slug} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cat-description">설명 (선택)</Label>
        <Input
          id="cat-description"
          name="description"
          maxLength={200}
          defaultValue={category.description ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cat-icon">아이콘 (이모지, 선택)</Label>
          <Input id="cat-icon" name="icon" maxLength={8} defaultValue={category.icon ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cat-color">대표 색상 (선택)</Label>
          <Input
            id="cat-color"
            name="color"
            type="color"
            defaultValue={category.color ?? "#7c5cfc"}
            className="h-9 p-1"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_visible"
            defaultChecked={category.is_visible}
            className="size-4"
          />
          공개
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="show_on_home"
            defaultChecked={category.show_on_home}
            className="size-4"
          />
          홈 노출
        </label>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "저장 중..." : "저장"}
      </Button>
    </form>
  );
}
