import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/nav-bar";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PickSide",
  description: "둘 중 하나를 골라 투표하는 서비스, PickSide",
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
        className="min-h-full flex flex-col bg-[url('/site-background.png')] bg-cover bg-center bg-fixed bg-no-repeat"
      >
        <NavBar />
        {children}
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
