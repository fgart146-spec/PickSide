import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { INQUIRY_TYPE_LABEL, INQUIRY_STATUS_LABEL, type InquiryType } from "@/lib/inquiries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type BugDetails = { pageUrl?: string; device?: string; browser?: string; reproSteps?: string };
type AdDetails = { companyName?: string; adPosition?: string; adPeriod?: string; budget?: string };
type PartnershipDetails = {
  companyName?: string;
  websiteUrl?: string;
  cooperationType?: string;
};

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <p className="text-sm whitespace-pre-wrap">{value}</p>
    </div>
  );
}

export default async function AdminInquiryDetailPage({
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

  const { data: inquiry } = await supabase
    .from("inquiries")
    .select("*")
    .eq("id", id)
    .single();

  if (!inquiry) {
    notFound();
  }

  const type = inquiry.type as InquiryType;
  const details = (inquiry.details ?? {}) as BugDetails & AdDetails & PartnershipDetails;

  let imageUrl: string | null = null;
  if (inquiry.image_path) {
    const { data } = await supabase.storage
      .from("inquiry-attachments")
      .createSignedUrl(inquiry.image_path, 300);
    imageUrl = data?.signedUrl ?? null;
  }

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">문의 상세</h1>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline">{INQUIRY_TYPE_LABEL[type]}</Badge>
            <Badge variant="secondary">{INQUIRY_STATUS_LABEL[inquiry.status] ?? inquiry.status}</Badge>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{inquiry.subject || inquiry.name}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field label="이름 / 담당자명" value={inquiry.name} />
            <Field label="이메일" value={inquiry.email} />
            <Field label="접수일" value={new Date(inquiry.created_at).toLocaleString("ko-KR")} />

            {type === "bug" && (
              <>
                <Field label="문제가 발생한 페이지 URL" value={details.pageUrl} />
                <Field label="사용 기기" value={details.device} />
                <Field label="브라우저" value={details.browser} />
                <Field label="재현 방법" value={details.reproSteps} />
              </>
            )}
            {type === "ad" && (
              <>
                <Field label="회사명 또는 브랜드명" value={details.companyName} />
                <Field label="광고 희망 위치" value={details.adPosition} />
                <Field label="광고 기간" value={details.adPeriod} />
                <Field label="예상 예산" value={details.budget} />
              </>
            )}
            {type === "partnership" && (
              <>
                <Field label="회사명 또는 커뮤니티명" value={details.companyName} />
                <Field label="웹사이트 또는 SNS 주소" value={details.websiteUrl} />
                <Field label="기대하는 협력 방식" value={details.cooperationType} />
              </>
            )}

            <Field
              label={type === "bug" ? "문제 설명" : "문의 내용"}
              value={inquiry.message}
            />

            {imageUrl && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">첨부 이미지</span>
                <Image
                  src={imageUrl}
                  alt="첨부 이미지"
                  width={480}
                  height={320}
                  className="h-auto w-full rounded-md border object-contain"
                  unoptimized
                />
              </div>
            )}

            {inquiry.admin_note && <Field label="관리자 메모" value={inquiry.admin_note} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
