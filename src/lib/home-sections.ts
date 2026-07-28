export const HOME_SECTIONS = [
  "featured",
  "popular",
  "latest",
  "random_cta",
  "stats",
  "notice_banner",
  "community_highlights",
] as const;

export type HomeSectionKey = (typeof HOME_SECTIONS)[number];

export const HOME_SECTION_LABEL: Record<HomeSectionKey, string> = {
  featured: "오늘의 추천 밸런스 게임",
  popular: "실시간 인기 투표",
  latest: "최신 투표",
  random_cta: "랜덤 투표 시작하기",
  stats: "오늘 접속자 수 · 전체 투표 수",
  notice_banner: "공지사항 및 이벤트 배너",
  community_highlights: "커뮤니티 인기글",
};

export function isHomeSectionKey(value: string): value is HomeSectionKey {
  return (HOME_SECTIONS as readonly string[]).includes(value);
}
