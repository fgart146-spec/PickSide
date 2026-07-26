import Link from "next/link";

const TABS = [
  { href: "/admin/office", label: "AI 대시보드" },
  { href: "/admin/office/reports", label: "🛡️ 신고 검토관" },
  { href: "/admin/office/drafts", label: "✍️ 콘텐츠 기획자" },
  { href: "/admin/office/analytics", label: "📊 통계 분석가" },
];

export function OfficeNav({ active }: { active: string }) {
  return (
    <nav className="flex flex-wrap gap-1 border-b pb-3">
      {TABS.map((tab) => {
        const isActive = tab.href === active;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              "rounded-md px-3 py-1.5 text-sm " +
              (isActive
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50")
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
