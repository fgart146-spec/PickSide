import { redirect } from "next/navigation";
import Image from "next/image";
import { PencilIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, PRIVATE_IMAGE_BUCKET } from "@/lib/supabase/service";
import { OfficeNav } from "@/components/office-nav";
import { OfficeImportForm } from "@/components/office-import-form";
import {
  generateContentRequest,
  approveDraft,
  rejectDraft,
  archiveDraft,
  updateDraft,
  bulkApproveDrafts,
  bulkDeleteDrafts,
} from "@/app/admin/office/actions";
import { POLL_CATEGORIES } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DRAFT_STATUS_LABEL,
  DUPLICATE_LABEL,
  type DraftStatus,
  type RiskLevel,
} from "@/lib/ai/constants";

export default async function ContentPlannerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) redirect("/");

  const service = createServiceClient();
  const [{ data: drafts }, { data: queuedJob }] = await Promise.all([
    service
      .from("ai_poll_drafts")
      .select(
        "id, title, option_a, option_b, description, category, tags, adult_only, featured, expected_audience, duplicate_risk, rationale, status, created_at, image_path_a, image_path_b, cover_image_path"
      )
      .order("created_at", { ascending: false })
      .limit(100),
    service
      .from("ai_jobs")
      .select("id, created_at")
      .eq("worker", "content_plan")
      .eq("status", "queued")
      .not("request", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const rows = drafts ?? [];
  const pending = rows.filter((d) => d.status === "pending");
  const others = rows.filter((d) => d.status !== "pending");

  // Signed thumbnail URLs for draft images (they live in the private bucket).
  const thumbs = new Map<string, { a: string | null; b: string | null }>();
  await Promise.all(
    pending.map(async (d) => {
      const sign = async (path: string | null) => {
        if (!path) return null;
        const { data } = await service.storage
          .from(PRIVATE_IMAGE_BUCKET)
          .createSignedUrl(path, 120);
        return data?.signedUrl ?? null;
      };
      thumbs.set(d.id, { a: await sign(d.image_path_a), b: await sign(d.image_path_b) });
    })
  );

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <PencilIcon className="size-6 text-primary" />
            콘텐츠 기획자
          </h1>
          <p className="text-sm text-muted-foreground">
            생성된 투표 초안은 항상 <b>검토 대기(pending)</b>로 저장됩니다. 승인하면 투표가 만들어져
            기존 <b>승인 관리</b> 화면으로 넘어갑니다.
          </p>
        </div>

        <OfficeNav active="/admin/office/drafts" />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">작업 요청</CardTitle>
            <CardDescription>중복을 피하도록 최근 투표 목록을 담은 요청 JSON을 만듭니다.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <form action={generateContentRequest}>
              <Button type="submit" size="sm">작업 요청 생성</Button>
            </form>
            {queuedJob && (
              <a
                href={`/admin/office/request/${queuedJob.id}`}
                className="text-sm underline underline-offset-4"
              >
                요청 JSON 다운로드
              </a>
            )}
          </CardContent>
        </Card>

        <OfficeImportForm hint="Claude Code가 만든 투표 초안(JSON)을 붙여넣거나 업로드하세요." />

        {/* 검토 대기 초안 */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            검토 대기 ({pending.length})
          </h2>
          {pending.length === 0 && (
            <p className="text-sm text-muted-foreground">검토할 초안이 없습니다.</p>
          )}
          {pending.map((d) => (
            <Card key={d.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{d.category}</Badge>
                  <Badge
                    variant={d.duplicate_risk === "high" ? "destructive" : "secondary"}
                  >
                    {DUPLICATE_LABEL[d.duplicate_risk as RiskLevel]}
                  </Badge>
                  {d.adult_only && <Badge variant="destructive">성인</Badge>}
                  {d.featured && <Badge>추천</Badge>}
                </div>
                <CardTitle className="text-base">{d.title}</CardTitle>
                <CardDescription>
                  A. {d.option_a} &nbsp;|&nbsp; B. {d.option_b}
                </CardDescription>
                {(thumbs.get(d.id)?.a || thumbs.get(d.id)?.b) && (
                  <div className="flex gap-3 pt-1">
                    {(["a", "b"] as const).map((slot) => {
                      const url = thumbs.get(d.id)?.[slot] ?? null;
                      return (
                        <div key={slot} className="flex flex-col items-center gap-1">
                          {url ? (
                            <Image
                              src={url}
                              alt={slot === "a" ? d.option_a : d.option_b}
                              width={72}
                              height={72}
                              className="size-18 rounded object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="flex size-18 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                              이미지 없음
                            </div>
                          )}
                          <span className="text-[10px] text-muted-foreground">{slot.toUpperCase()}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {d.description && (
                  <CardDescription>{d.description}</CardDescription>
                )}
                {(d.tags?.length ?? 0) > 0 && (
                  <CardDescription className="text-xs">
                    태그: {d.tags.join(", ")}
                  </CardDescription>
                )}
                {d.rationale && (
                  <CardDescription className="text-xs">기획 의도: {d.rationale}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <form action={approveDraft.bind(null, d.id)}>
                    <Button type="submit" size="sm">승인</Button>
                  </form>
                  <form action={rejectDraft.bind(null, d.id)}>
                    <Button type="submit" size="sm" variant="outline">거절</Button>
                  </form>
                  <form action={archiveDraft.bind(null, d.id)}>
                    <Button type="submit" size="sm" variant="ghost">보관</Button>
                  </form>
                </div>

                {/* 초안 수정 */}
                <details className="rounded-md border p-3">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    초안 수정
                  </summary>
                  <form
                    action={updateDraft.bind(null, d.id)}
                    className="mt-3 flex flex-col gap-2"
                  >
                    <input
                      name="title"
                      defaultValue={d.title}
                      className="rounded-md border bg-background px-2 py-1 text-sm"
                    />
                    <div className="flex gap-2">
                      <input
                        name="option_a"
                        defaultValue={d.option_a}
                        className="flex-1 rounded-md border bg-background px-2 py-1 text-sm"
                      />
                      <input
                        name="option_b"
                        defaultValue={d.option_b}
                        className="flex-1 rounded-md border bg-background px-2 py-1 text-sm"
                      />
                    </div>
                    <input
                      name="description"
                      defaultValue={d.description ?? ""}
                      placeholder="설명"
                      className="rounded-md border bg-background px-2 py-1 text-sm"
                    />
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <select
                        name="category"
                        defaultValue={d.category}
                        className="rounded-md border bg-background px-2 py-1"
                      >
                        {POLL_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1">
                        <input type="checkbox" name="adult_only" defaultChecked={d.adult_only} />
                        성인
                      </label>
                      <label className="flex items-center gap-1">
                        <input type="checkbox" name="featured" defaultChecked={d.featured} />
                        추천
                      </label>
                      <Button type="submit" size="sm" variant="secondary">저장</Button>
                    </div>
                  </form>
                </details>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 일괄 처리 */}
        {pending.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">일괄 처리</CardTitle>
              <CardDescription>선택한 초안을 한 번에 승인하거나 삭제합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-2">
                {pending.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="draftId" value={d.id} />
                    <span className="truncate">{d.title}</span>
                  </label>
                ))}
                <div className="flex gap-2 pt-2">
                  <Button type="submit" size="sm" formAction={bulkApproveDrafts}>
                    일괄 승인
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    variant="destructive"
                    formAction={bulkDeleteDrafts}
                  >
                    일괄 삭제
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* 처리된 초안 */}
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            처리 결과 ({others.length})
          </h2>
          {others.slice(0, 40).map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <span className="truncate text-muted-foreground">{d.title}</span>
              <Badge variant="outline">
                {DRAFT_STATUS_LABEL[d.status as DraftStatus] ?? d.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
