import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/nav-bar";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/sonner";
import { SITE_URL } from "@/lib/site-url";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "PickSide",
  description: "둘 중 하나를 골라 투표하는 서비스, PickSide",
  verification: {
    google: "yS2MeFG84-UO99z3qQ7acbHi3qOgDckT2yxMKvtHwJI",
    other: {
      "naver-site-verification": "285fff94412786a6cccf4b9d3dd0e1ffa3c9b000",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col bg-[url('/site-background.webp')] bg-cover bg-center bg-fixed bg-no-repeat"
      >
        <NavBar />
        {children}
        <SiteFooter />
        <Toaster />
        {/* Google AdSense — raw async tag so it appears verbatim in <head>.
            React 19 hoists async scripts to <head>; next/script would instead
            emit its own loader shim, which AdSense's verifier doesn't detect. */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4960740109673485"
          crossOrigin="anonymous"
        />
      </body>
    </html>
  );
}
