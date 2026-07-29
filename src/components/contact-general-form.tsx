"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitGeneralInquiry, type InquiryFormState } from "@/app/contact/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: InquiryFormState = { error: null, success: false };

export function ContactGeneralForm({
  defaultName,
  defaultEmail,
}: {
  defaultName: string;
  defaultEmail: string;
}) {
  const [state, formAction, pending] = useActionState(submitGeneralInquiry, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && state.success) {
      formRef.current?.reset();
    }
  }, [state, pending]);

  if (state.success) {
    return (
      <p className="rounded-md border bg-muted/30 p-4 text-sm">
        문의가 접수되었습니다. 빠른 시일 내에 답변드리겠습니다.
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
        <Label htmlFor="name">이름 또는 닉네임</Label>
        <Input id="name" name="name" defaultValue={defaultName} maxLength={60} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">이메일</Label>
        <Input id="email" name="email" type="email" defaultValue={defaultEmail} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="subject">문의 제목</Label>
        <Input id="subject" name="subject" maxLength={200} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="message">문의 내용</Label>
        <textarea
          id="message"
          name="message"
          rows={6}
          maxLength={5000}
          required
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "접수 중..." : "문의 보내기"}
      </Button>
    </form>
  );
}
