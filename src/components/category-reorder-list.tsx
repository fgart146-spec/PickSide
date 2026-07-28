"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { GripVerticalIcon } from "lucide-react";
import {
  reorderCategories,
  toggleCategoryVisibility,
  toggleShowOnHome,
} from "@/app/admin/categories/actions";
import { AdminCategoryDeleteButton } from "@/components/admin-category-delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CategoryRow } from "@/lib/categories";

export function CategoryReorderList({
  categories,
  pollCounts,
  publishedPollCounts,
}: {
  categories: CategoryRow[];
  pollCounts: Record<string, number>;
  publishedPollCounts: Record<string, number>;
}) {
  const [items, setItems] = useState(categories);
  const [dragId, setDragId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const from = items.findIndex((c) => c.id === dragId);
    const to = items.findIndex((c) => c.id === targetId);
    if (from === -1 || to === -1) return;

    const next = items.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    setDragId(null);
    startTransition(() => {
      reorderCategories(next.map((c) => c.id));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((category) => {
        const otherCategories = items
          .filter((c) => c.id !== category.id)
          .map((c) => ({ id: c.id, name: c.name }));

        return (
          <Card
            key={category.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(category.id)}
            className={dragId === category.id ? "opacity-50" : undefined}
          >
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              {/* Only the handle itself is draggable — making the whole Card
                  draggable suppressed click events on its buttons/links in
                  testing (a known browser quirk with draggable ancestors). */}
              <span
                draggable
                onDragStart={() => setDragId(category.id)}
                className="shrink-0 cursor-grab active:cursor-grabbing"
              >
                <GripVerticalIcon className="size-4 text-muted-foreground" aria-hidden />
              </span>
              {category.color && (
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: category.color }}
                  aria-hidden
                />
              )}
              <div className="flex-1">
                <CardTitle className="flex items-center gap-1.5 text-base">
                  {category.icon && <span>{category.icon}</span>}
                  {category.name}
                  {category.is_system && (
                    <Badge variant="outline" className="text-xs">
                      시스템
                    </Badge>
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  /category/{category.slug} · 투표 {publishedPollCounts[category.id] ?? 0}개
                </p>
              </div>
              <Badge variant={category.is_visible ? "default" : "outline"}>
                {category.is_visible ? "공개" : "숨김"}
              </Badge>
              {category.show_on_home && <Badge variant="secondary">홈 노출</Badge>}
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href={`/admin/categories/${category.id}/edit`}>수정</Link>}
              />
              <form action={toggleCategoryVisibility.bind(null, category.id, !category.is_visible)}>
                <Button type="submit" size="sm" variant="outline">
                  {category.is_visible ? "숨기기" : "공개하기"}
                </Button>
              </form>
              <form action={toggleShowOnHome.bind(null, category.id, !category.show_on_home)}>
                <Button type="submit" size="sm" variant="outline">
                  {category.show_on_home ? "홈에서 제외" : "홈에 노출"}
                </Button>
              </form>
              {!category.is_system && (
                <AdminCategoryDeleteButton
                  categoryId={category.id}
                  categoryName={category.name}
                  pollCount={pollCounts[category.id] ?? 0}
                  otherCategories={otherCategories}
                />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
