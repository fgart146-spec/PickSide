"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitPartnershipInquiry, type InquiryFormState } from "@/app/contact/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: InquiryFormState = { error: null, success: false };

export function ContactPartnershipForm({
  defaultName,
  defaultEmail,
}: {
  defaultName: string;
  defaultEmail: string;
}) {
  const [state, formAction, pending] = useActionState(submitPartnershipInquiry, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && state.success) {
      formRef.current?.reset();
    }
  }, [state, pending]);

  if (state.success) {
    return (
      <p className="rounded-md border bg-muted/30 p-4 text-sm">
        제휴 제안이 접수되었습니다. 검토 후 연락드리겠습니다.
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <input
        type="text"
        name="website_url_confirm"
        tabIndex={-1}
        autoComplete="off"
        className="absolute h-0 w-0 opacity-0"
        aria-hidden="true"
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pt-name">담당자명</Label>
        <Input id="pt-name" name="name" defaultValue={defaultName} maxLength={60} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pt-email">이메일</Label>
        <Input id="pt-email" name="email" type="email" defaultValue={defaultEmail} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pt-companyName">회사명 또는 커뮤니티명</Label>
        <Input id="pt-companyName" name="companyName" maxLength={100} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="websiteUrl">웹사이트 또는 SNS 주소</Label>
        <Input id="websiteUrl" name="websiteUrl" placeholder="https://..." />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cooperationType">기대하는 협력 방식</Label>
        <Input id="cooperationType" name="cooperationType" placeholder="예: 콘텐츠 교차 홍보, 공동 이벤트" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pt-message">제휴 제안 내용</Label>
        <textarea
          id="pt-message"
          name="message"
          rows={6}
          maxLength={5000}
          required
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "접수 중..." : "제휴 제안하기"}
      </Button>
    </form>
  );
}
