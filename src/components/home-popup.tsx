"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export type PopupItem = {
  id: string;
  title: string;
  body: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
};

function dismissKey(id: string) {
  return `pickside-popup-dismissed-${id}`;
}

export function HomePopup({ popups }: { popups: PopupItem[] }) {
  const [visibleId, setVisibleId] = useState<string | null>(null);

  useEffect(() => {
    // Reading localStorage has to happen post-mount (it's unavailable during
    // SSR), so this can't be collapsed into a lazy useState initializer
    // without causing a hydration mismatch.
    const today = new Date().toISOString().slice(0, 10);
    const next = popups.find((p) => localStorage.getItem(dismissKey(p.id)) !== today);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisibleId(next?.id ?? null);
  }, [popups]);

  if (!visibleId) return null;
  const popup = popups.find((p) => p.id === visibleId);
  if (!popup) return null;

  const close = () => setVisibleId(null);
  const hideToday = () => {
    localStorage.setItem(dismissKey(popup.id), new Date().toISOString().slice(0, 10));
    setVisibleId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-lg border bg-background shadow-lg">
        {popup.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={popup.imageUrl}
            alt={popup.title}
            className="max-h-[60vh] w-full bg-muted object-contain"
          />
        )}
        <div className="flex flex-col gap-2 p-4">
          <h2 className="text-lg font-semibold">{popup.title}</h2>
          {popup.body && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{popup.body}</p>}
          {popup.linkUrl && (
            <a
              href={popup.linkUrl}
              className="text-sm text-primary underline underline-offset-4"
            >
              자세히 보기
            </a>
          )}
        </div>
        <div className="flex items-center justify-between border-t px-4 py-3">
          <Button variant="ghost" size="sm" onClick={hideToday}>
            오늘 하루 그만보기
          </Button>
          <Button variant="outline" size="sm" onClick={close}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
}
