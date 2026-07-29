import type { Metadata } from "next";
import { PolicyPage, getPolicyDocument } from "@/components/policy-page";

export async function generateMetadata(): Promise<Metadata> {
  const document = await getPolicyDocument("privacy");
  return {
    title: document?.title ?? "개인정보처리방침",
    alternates: { canonical: "/privacy" },
  };
}

export default function PrivacyPage() {
  return <PolicyPage slug="privacy" />;
}
