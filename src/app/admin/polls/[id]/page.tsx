import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import {
  approvePoll,
  rejectPoll,
  adminDeletePoll,
} from "@/app/admin/actions";
import {
  adminForceHidePoll,
  adminTogglePin,
  adminToggleFeatured,
  adminRemoveOptionImage,
} from "@/app/admin/polls/actions";
import { PRIVATE_IMAGE_BUCKET, PUBLIC_IMAGE_BUCKET } from "@/lib/supabase/service";
import { AdminPollEditForm } from "@/components/admin-poll-edit-form";
import { AdminOptionImageForm } from "@/components/admin-option-image-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_LABEL: Record<string, string> = {
  pending: "승인 대기 중",
  published: "공개됨",
  rejected: "거절됨",
  hidden: "강제 비공개",
};

export default async function AdminPollDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/");
  }

  const { data: poll } = await supabase
    .from("polls")
    .select("id, question, status, category, is_pinned, is_featured, profiles!polls_owner_id_fkey(username)")
    .eq("id", id)
    .single();

  if (!poll) {
    notFound();
  }

  const { data: options } = await supabase
    .from("poll_options")
    .select("id, label, position, image_path")
    .eq("poll_id", id)
    .order("position");

  const [optionA, optionB] = options ?? [];
  const ownerUsername =
    (poll as unknown as { profiles: { username: string } | null }).profiles?.username ??
    "알 수 없음";

  const imageBucket = poll.status === "published" ? PUBLIC_IMAGE_BUCKET : PRIVATE_IMAGE_BUCKET;
  const imageUrls = new Map<string, string>();
  for (const option of options ?? []) {
    if (!option.image_path) continue;
    if (poll.status === "published") {
      const { data } = supabase.storage.from(imageBucket).getPublicUrl(option.image_path);
      imageUrls.set(option.id, data.publicUrl);
    } else {
      const { data } = await supabase.storage
        .from(imageBucket)
        .createSignedUrl(option.image_path, 60);
      if (data?.signedUrl) imageUrls.set(option.id, data.signedUrl);
    }
  }

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">투표 관리</h1>
          <p className="text-sm text-muted-foreground">만든 사람: {ownerUsername}</p>
        </div>

        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={poll.status === "published" ? "default" : "secondary"}>
                {STATUS_LABEL[poll.status]}
              </Badge>
              {poll.is_pinned && <Badge variant="outline">상단 고정</Badge>}
              {poll.is_featured && <Badge variant="outline">추천</Badge>}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {poll.status !== "published" && (
                <form action={approvePoll.bind(null, id)}>
                  <Button type="submit" size="sm">
                    승인(공개)
                  </Button>
                </form>
              )}
              {poll.status !== "rejected" && (
                <form action={rejectPoll.bind(null, id)}>
                  <Button type="submit" size="sm" variant="outline">
                    거절
                  </Button>
                </form>
              )}
              {poll.status === "published" && (
                <form action={adminForceHidePoll.bind(null, id)}>
                  <Button type="submit" size="sm" variant="outline">
                    강제 비공개
                  </Button>
                </form>
              )}
              <form action={adminTogglePin.bind(null, id, !poll.is_pinned)}>
                <Button type="submit" size="sm" variant="outline">
                  {poll.is_pinned ? "상단 고정 해제" : "상단 고정"}
                </Button>
              </form>
              <form action={adminToggleFeatured.bind(null, id, !poll.is_featured)}>
                <Button type="submit" size="sm" variant="outline">
                  {poll.is_featured ? "추천 해제" : "추천 지정"}
                </Button>
              </form>
              <form action={adminDeletePoll.bind(null, id)}>
                <Button type="submit" size="sm" variant="destructive">
                  삭제
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        {optionA && optionB && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">내용 수정</CardTitle>
            </CardHeader>
            <CardContent>
              <AdminPollEditForm
                pollId={id}
                question={poll.question}
                category={poll.category}
                optionA={{ id: optionA.id, label: optionA.label }}
                optionB={{ id: optionB.id, label: optionB.label }}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">선택지 이미지</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {options?.map((option) => {
              const url = imageUrls.get(option.id);
              return (
                <div key={option.id} className="flex flex-col gap-2">
                  <p className="text-sm font-medium">{option.label}</p>
                  {url ? (
                    <Image
                      src={url}
                      alt={option.label}
                      width={96}
                      height={96}
                      className="rounded object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex size-24 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                      이미지 없음
                    </div>
                  )}
                  <div className="flex flex-wrap items-start gap-2">
                    <AdminOptionImageForm pollId={id} optionId={option.id} />
                    {option.image_path && (
                      <form action={adminRemoveOptionImage.bind(null, id, option.id)}>
                        <Button type="submit" size="sm" variant="ghost">
                          이미지 제거
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
