export const AD_SLOTS = [
  "home-top-banner",
  "home-sidebar-1",
  "home-sidebar-2",
  "home-infeed",
  "home-bottom",
] as const;

export type AdSlotKey = (typeof AD_SLOTS)[number];

export const AD_SLOT_LABEL: Record<AdSlotKey, string> = {
  "home-top-banner": "홈 상단 배너",
  "home-sidebar-1": "홈 사이드바 1",
  "home-sidebar-2": "홈 사이드바 2",
  "home-infeed": "피드 중간 광고",
  "home-bottom": "홈 하단 배너",
};

export function isAdSlotKey(value: string): value is AdSlotKey {
  return (AD_SLOTS as readonly string[]).includes(value);
}

// Every slot renders at a fixed aspect ratio (object-cover) regardless of the
// uploaded image's native size, so mismatched uploads don't produce
// wildly-different banner heights across admins/positions.
export const AD_SLOT_ASPECT: Record<AdSlotKey, string> = {
  "home-top-banner": "aspect-[8/1]",
  "home-sidebar-1": "aspect-[6/5]",
  "home-sidebar-2": "aspect-[6/5]",
  "home-infeed": "aspect-[2/1]",
  "home-bottom": "aspect-[8/1]",
};

export const AD_SLOT_RECOMMENDED_SIZE: Record<AdSlotKey, string> = {
  "home-top-banner": "1200×150px (가로형)",
  "home-sidebar-1": "300×250px",
  "home-sidebar-2": "300×250px",
  "home-infeed": "800×400px",
  "home-bottom": "1200×150px (가로형)",
};
