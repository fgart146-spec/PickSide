"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Share2Icon, LinkIcon, DownloadIcon } from "lucide-react";
import { toast } from "sonner";

export function ShareMenu({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Safe to read directly: this only affects markup inside `{open && ...}`,
  // which never renders during SSR/hydration (open starts false and can
  // only flip true from a client click), so there's no server/client
  // mismatch to worry about.
  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  // Portaled to <body> and positioned via getBoundingClientRect, instead of
  // `absolute` inside the trigger's own container — the trigger sits inside
  // a Card with overflow-hidden (for its rounded corners), which was
  // clipping the dropdown before it could render on top.
  useLayoutEffect(() => {
    if (!open || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, left: rect.right - 208 });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("링크를 복사했어요.");
    setOpen(false);
  }

  async function nativeShare() {
    try {
      await navigator.share({ url: window.location.href, title });
    } catch {
      /* share sheet dismissed */
    }
    setOpen(false);
  }

  function shareToX() {
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      title
    )}&url=${encodeURIComponent(window.location.href)}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer,width=600,height=500");
    setOpen(false);
  }

  function shareToFacebook() {
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      window.location.href
    )}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer,width=600,height=500");
    setOpen(false);
  }

  async function saveShareImage() {
    try {
      const res = await fetch(`${window.location.pathname}/opengraph-image`);
      if (!res.ok) throw new Error("이미지를 불러오지 못했어요.");
      const blob = await res.blob();
      const file = new File([blob], "pickside-poll.png", { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title });
        setOpen(false);
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = "pickside-poll.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success("이미지를 저장했어요. 인스타그램 스토리에 올려보세요.");
    } catch {
      toast.error("이미지 저장에 실패했어요.");
    }
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="공유하기"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-accent hover:text-foreground"
      >
        <Share2Icon className="size-4" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: position.top, left: position.left }}
            className="fixed z-50 flex w-52 flex-col gap-0.5 rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-md"
          >
            <button
              type="button"
              role="menuitem"
              onClick={copyLink}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
            >
              <LinkIcon className="size-4" />
              링크 복사
            </button>
            {canNativeShare && (
              <button
                type="button"
                role="menuitem"
                onClick={nativeShare}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
              >
                <Share2Icon className="size-4" />
                공유하기
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={shareToX}
              className="rounded-md px-2 py-1.5 text-left hover:bg-accent"
            >
              X에 공유
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={shareToFacebook}
              className="rounded-md px-2 py-1.5 text-left hover:bg-accent"
            >
              Facebook에 공유
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={saveShareImage}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
            >
              <DownloadIcon className="size-4" />
              인스타그램 스토리용 이미지
            </button>
            <button
              type="button"
              role="menuitem"
              disabled
              className="rounded-md px-2 py-1.5 text-left text-muted-foreground opacity-50"
            >
              카카오톡 공유 (준비 중)
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}
