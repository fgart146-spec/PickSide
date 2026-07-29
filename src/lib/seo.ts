import { SITE_URL } from "@/lib/site-url";

// Centralized SEO copy/config. Currently single-locale (Korean primary,
// English keywords folded in for cross-language discovery) — kept in one
// module so a future per-locale split (/ko, /en) only has to swap what's
// exported here instead of hunting strings across every page.

export const SITE_NAME = "PickSide";

export const SITE_TITLE = "PickSide | 밸런스게임 커뮤니티";
export const SITE_TITLE_EN = "PickSide | Balance Game & Would You Rather Community";

export const SITE_DESCRIPTION =
  "PickSide는 다양한 밸런스게임을 만들고, 투표하고, 의견을 나누는 커뮤니티입니다. " +
  "Create, vote and discuss fun Balance Games and Would You Rather questions.";

export const SITE_KEYWORDS = [
  "밸런스게임",
  "밸런스 게임",
  "밸런스게임 커뮤니티",
  "선택 게임",
  "양자택일",
  "투표",
  "투표게임",
  "투표 커뮤니티",
  "커뮤니티",
  "Balance Game",
  "Balance Games",
  "Would You Rather",
  "Choice Game",
  "Choice Games",
  "Voting Game",
  "Online Poll",
  "Poll Community",
  "Voting Community",
  "Decision Game",
  "This or That",
  "Either Or",
];

export const OG_TITLE = "PickSide | Balance Game Community";
export const OG_DESCRIPTION =
  "Create, vote and discuss fun Balance Games and Would You Rather questions.";

// ---------------------------------------------------------------------------
// Poll URL slugs — /polls/<uuid>-<slugified-question>. The id is the only
// part that's ever looked up in the DB; the slug is decorative (SEO/CTR),
// so it can be derived from the current question text on every request
// without needing a stored/unique column or a migration.
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Pulls the poll id back out of a route param that may carry a slug suffix. */
export function extractPollId(param: string): string {
  const match = param.match(UUID_RE);
  return match ? match[0] : param;
}

export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/['"“”‘’]/g, "")
    .replace(/[\s/#?&=]+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .replace(/-$/, "");
}

export function pollPath(id: string, question: string): string {
  const slug = slugify(question);
  // Percent-encode explicitly rather than relying on each caller (sitemap
  // XML, <Link href>, canonical/OG meta) to encode non-ASCII consistently
  // on its own — Next.js does this automatically for some of those but not
  // all (e.g. sitemap.xml's <loc> came out with raw Hangul, unencoded).
  return slug ? `/polls/${id}-${encodeURIComponent(slug)}` : `/polls/${id}`;
}

export function pollUrl(id: string, question: string): string {
  return `${SITE_URL}${pollPath(id, question)}`;
}

// ---------------------------------------------------------------------------
// JSON-LD builders
// ---------------------------------------------------------------------------

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: [
      "밸런스게임 커뮤니티",
      "Balance Game Community",
      "Would You Rather Community",
      "Online Poll Community",
    ],
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.webp`,
    description: SITE_DESCRIPTION,
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function webPageJsonLd(params: { name: string; description: string; url: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: params.name,
    description: params.description,
    url: params.url,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
  };
}
