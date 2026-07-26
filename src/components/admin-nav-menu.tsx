"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const ADMIN_LINKS = [
  { href: "/admin/polls", label: "승인 관리" },
  { href: "/admin/content", label: "콘텐츠 관리" },
  { href: "/admin/users", label: "사용자 관리" },
  { href: "/admin/home", label: "홈 관리" },
  { href: "/admin/reports", label: "신고 처리" },
  { href: "/admin/office", label: "AI 직원 관리" },
  { href: "/admin/trash", label: "휴지통" },
];

// A hand-rolled dropdown instead of the Base UI Menu: NavBar is a dynamic
// Server Component (it reads the session via cookies), so it re-renders on
// every navigation — which was leaving Base UI's portal-based popup stuck
// mounted after a menu-item click routed away. Plain conditional rendering
// has no portal/animation lifecycle to get out of sync with that.
export function AdminNavMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        관리자 ▾
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 flex min-w-40 flex-col gap-0.5 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {ADMIN_LINKS.map((link) => (
            <button
              key={link.href}
              type="button"
              role="menuitem"
              className="flex items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                setOpen(false);
                router.push(link.href);
              }}
            >
              {link.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
