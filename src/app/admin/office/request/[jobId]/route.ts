import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// Download the generated request spec for a job as a JSON attachment
// (작업 요청 JSON 다운로드). Admin-gated; jobId is a DB uuid so no filesystem
// path is ever derived from user input.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) {
    return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
  }

  const service = createServiceClient();
  const { data: job } = await service
    .from("ai_jobs")
    .select("id, worker, kind, request")
    .eq("id", jobId)
    .single();

  if (!job || !job.request) {
    return NextResponse.json({ error: "작업 요청을 찾을 수 없습니다." }, { status: 404 });
  }

  const body = JSON.stringify(job.request, null, 2);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="ai-request-${job.worker}-${job.id}.json"`,
    },
  });
}
