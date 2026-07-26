-- ✍️ 콘텐츠 기획자 초안에 이미지 첨부 지원.
-- 결과 JSON 에 base64 이미지를 담아 가져오면 서버가 비공개 버킷(poll-images-private)에
-- 저장하고 그 경로를 여기에 기록합니다. 초안 승인 시 선택지 이미지로 연결되며,
-- 투표가 게시되면 기존 흐름대로 공개 버킷으로 승격됩니다.
alter table public.ai_poll_drafts
  add column if not exists image_path_a text;
alter table public.ai_poll_drafts
  add column if not exists image_path_b text;
alter table public.ai_poll_drafts
  add column if not exists cover_image_path text;
