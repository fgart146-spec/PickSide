import type { Metadata } from "next";
import { PolicyPage, getPolicyDocument } from "@/components/policy-page";

export async function generateMetadata(): Promise<Metadata> {
  const document = await getPolicyDocument("terms");
  return {
    title: document?.title ?? "이용약관",
    alternates: { canonical: "/terms" },
  };
}

export default function TermsPage() {
  return <PolicyPage slug="terms" />;
}
