import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  approvePoll,
  rejectPoll,
  adminDeletePoll,
  approveAllPending,
} from "@/app/admin/actions";
import { PRIVATE_IMAGE_BUCKET } from "@/lib/supabase/service";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Pagination, PAGE_SIZE, parsePage } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const REVIEWED_STATUS_LABEL: Record<string, string> = {
  published: "공개됨",
  rejected: "거절됨",
  hidden: "강제 비공개",
};

export default async function AdminPollsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
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

  const { data: polls } = await supabase
    .from("polls")
    .select("id, question, status, created_at, profiles(username)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const pending = polls?.filter((p) => p.status === "pending") ?? [];
  const reviewed = polls?.filter((p) => p.status !== "pending") ?? [];

  const { page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const reviewedStart = (page - 1) * PAGE_SIZE;
  const reviewedPage = reviewed.slice(reviewedStart, reviewedStart + PAGE_SIZE);
  const reviewedHasNext = reviewed.length > reviewedStart + PAGE_SIZE;

  const pendingOptions = new Map<
    string,
    { id: string; label: string; imageUrl: string | null }[]
  >();

  for (const poll of pending) {
    const { data: options } = await supabase
      .from("poll_options")
      .select("id, label, image_path")
      .eq("poll_id", poll.id)
      .order("position");

    const withUrls = await Promise.all(
      (options ?? []).map(async (option) => {
        if (!option.image_path) {
          return { id: option.id, label: option.label, imageUrl: null };
        }
        const { data } = await supabase.storage
          .from(PRIVATE_IMAGE_BUCKET)
          .createSignedUrl(option.image_path, 60);
        return { id: option.id, label: option.label, imageUrl: data?.signedUrl ?? null };
      })
    );

    pendingOptions.set(poll.id, withUrls);
  }

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">투표 승인 관리</h1>
          <p className="text-sm text-muted-foreground">
            새로 만들어진 투표를 검토하고 공개 여부를 결정합니다.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              승인 대기 ({pending.length})
            </h2>
            {pending.length > 0 && (
              <form action={approveAllPending}>
                <ConfirmSubmitButton
                  size="sm"
                  confirmMessage={`대기 중인 투표 ${pending.length}개를 모두 승인할까요?`}
                >
                  대기 전체 승인
                </ConfirmSubmitButton>
              </form>
            )}
          </div>
          {pending.length === 0 && (
            <p className="text-sm text-muted-foreground">대기 중인 투표가 없습니다.</p>
          )}
          {pending.map((poll) => {
            const ownerUsername =
              (poll as unknown as { profiles: { username: string } | null })
                .profiles?.username ?? "알 수 없음";
            const options = pendingOptions.get(poll.id) ?? [];
            return (
              <Card key={poll.id}>
                <CardHeader>
                  <CardTitle className="text-base">{poll.question}</CardTitle>
                  <CardDescription>만든 사람: {ownerUsername}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex gap-3">
                    {options.map((option) => (
                      <div key={option.id} className="flex flex-col items-center gap-1">
                        {option.imageUrl ? (
                          <Image
                            src={option.imageUrl}
                            alt={option.label}
                            width={64}
                            height={64}
                            className="rounded object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="flex size-16 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                            이미지 없음
                          </div>
                        )}
                        <span className="text-xs">{option.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <form action={approvePoll.bind(null, poll.id)}>
                      <Button type="submit" size="sm">
                        승인
                      </Button>
                    </form>
                    <form action={rejectPoll.bind(null, poll.id)}>
                      <Button type="submit" size="sm" variant="outline">
                        거절
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            처리 완료 ({reviewed.length})
          </h2>
          {reviewedPage.map((poll) => {
            const ownerUsername =
              (poll as unknown as { profiles: { username: string } | null })
                .profiles?.username ?? "알 수 없음";
            return (
              <Card key={poll.id}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">{poll.question}</CardTitle>
                    <CardDescription>만든 사람: {ownerUsername}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={poll.status === "published" ? "default" : "destructive"}>
                      {REVIEWED_STATUS_LABEL[poll.status] ?? poll.status}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/admin/polls/${poll.id}`}>관리</Link>}
                    />
                    <form action={adminDeletePoll.bind(null, poll.id)}>
                      <Button type="submit" size="sm" variant="ghost">
                        삭제
                      </Button>
                    </form>
                  </div>
                </CardHeader>
              </Card>
            );
          })}

          <Pagination
            page={page}
            hasNext={reviewedHasNext}
            makeHref={(p) => (p > 1 ? `/admin/polls?page=${p}` : "/admin/polls")}
          />
        </div>
      </div>
    </div>
  );
}
