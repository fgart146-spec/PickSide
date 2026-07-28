import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-background/60 px-4 py-6 text-xs text-muted-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} PickSide</p>
        <nav className="flex items-center gap-4">
          <Link href="/terms" className="hover:text-foreground hover:underline underline-offset-4">
            이용약관
          </Link>
          <Link href="/privacy" className="hover:text-foreground hover:underline underline-offset-4">
            개인정보처리방침
          </Link>
        </nav>
      </div>
    </footer>
  );
}
