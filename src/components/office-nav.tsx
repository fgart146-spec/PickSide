import Link from "next/link";
import {
  LayoutDashboardIcon,
  ShieldIcon,
  PencilIcon,
  BarChart3Icon,
  type LucideIcon,
} from "lucide-react";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin/office", label: "AI 대시보드", icon: LayoutDashboardIcon },
  { href: "/admin/office/reports", label: "신고 검토관", icon: ShieldIcon },
  { href: "/admin/office/drafts", label: "콘텐츠 기획자", icon: PencilIcon },
  { href: "/admin/office/analytics", label: "통계 분석가", icon: BarChart3Icon },
];

export function OfficeNav({ active }: { active: string }) {
  return (
    <nav className="flex flex-wrap gap-1 border-b pb-3">
      {TABS.map((tab) => {
        const isActive = tab.href === active;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm " +
              (isActive
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50")
            }
          >
            <Icon className="size-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
