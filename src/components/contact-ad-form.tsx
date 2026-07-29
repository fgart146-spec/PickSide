"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { submitAdInquiry, type InquiryFormState } from "@/app/contact/actions";
import { AD_POSITION_OPTIONS } from "@/lib/inquiries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialState: InquiryFormState = { error: null, success: false };

export function ContactAdForm({
  defaultName,
  defaultEmail,
}: {
  defaultName: string;
  defaultEmail: string;
}) {
  const [state, formAction, pending] = useActionState(submitAdInquiry, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [adPosition, setAdPosition] = useState("");

  useEffect(() => {
    if (!pending && state.success) {
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAdPosition("");
    }
  }, [state, pending]);

  if (state.success) {
    return (
      <p className="rounded-md border bg-muted/30 p-4 text-sm">
        광고 문의가 접수되었습니다. 담당자가 확인 후 연락드리겠습니다.
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
        <Label htmlFor="ad-name">담당자명</Label>
        <Input id="ad-name" name="name" defaultValue={defaultName} maxLength={60} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ad-email">이메일</Label>
        <Input id="ad-email" name="email" type="email" defaultValue={defaultEmail} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="companyName">회사명 또는 브랜드명</Label>
        <Input id="companyName" name="companyName" maxLength={100} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="adPosition">광고 희망 위치</Label>
        <input type="hidden" name="adPosition" value={adPosition} />
        <Select value={adPosition} onValueChange={(value) => setAdPosition(value ?? "")}>
          <SelectTrigger id="adPosition" className="w-full">
            <SelectValue placeholder="위치 선택">
              {() => adPosition || "위치 선택"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {AD_POSITION_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="adPeriod">광고 기간</Label>
          <Input id="adPeriod" name="adPeriod" placeholder="예: 2주, 1개월" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="budget">예상 예산</Label>
          <Input id="budget" name="budget" placeholder="예: 50만원" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ad-message">문의 내용</Label>
        <textarea
          id="ad-message"
          name="message"
          rows={5}
          maxLength={5000}
          required
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "접수 중..." : "광고 문의하기"}
      </Button>
    </form>
  );
}
