// Canonical site origin, used wherever an absolute URL is required (OG image
// metadata, share links). Falls back to the known production domain so
// local/preview builds without the env var set still produce valid URLs.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pick-side.vercel.app"
).replace(/\/$/, "");
