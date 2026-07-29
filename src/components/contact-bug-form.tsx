"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { submitBugReport, type InquiryFormState } from "@/app/contact/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: InquiryFormState = { error: null, success: false };

function detectBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return "Chrome";
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return "Safari";
  if (/Firefox\//.test(ua)) return "Firefox";
  return "기타";
}

function detectDevice(ua: string): string {
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Mobile/.test(ua)) return "모바일";
  return "PC";
}

export function ContactBugForm({
  defaultName,
  defaultEmail,
}: {
  defaultName: string;
  defaultEmail: string;
}) {
  const [state, formAction, pending] = useActionState(submitBugReport, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [pageUrl, setPageUrl] = useState("");
  const [device, setDevice] = useState("");
  const [browser, setBrowser] = useState("");

  useEffect(() => {
    // Best-effort auto-fill from browser-only APIs on mount — the user can
    // still edit any of these before submitting.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPageUrl(document.referrer || "");
    setDevice(detectDevice(navigator.userAgent));
    setBrowser(detectBrowser(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (!pending && state.success) {
      formRef.current?.reset();
    }
  }, [state, pending]);

  if (state.success) {
    return (
      <p className="rounded-md border bg-muted/30 p-4 text-sm">
        제보해주셔서 감사합니다. 확인 후 조치하겠습니다.
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
        <Label htmlFor="bug-name">이름 또는 닉네임</Label>
        <Input id="bug-name" name="name" defaultValue={defaultName} maxLength={60} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bug-email">이메일</Label>
        <Input id="bug-email" name="email" type="email" defaultValue={defaultEmail} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pageUrl">문제가 발생한 페이지 URL</Label>
        <Input
          id="pageUrl"
          name="pageUrl"
          value={pageUrl}
          onChange={(e) => setPageUrl(e.target.value)}
          placeholder="https://pick-side.vercel.app/..."
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="device">사용 기기</Label>
          <Input id="device" name="device" value={device} onChange={(e) => setDevice(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="browser">브라우저</Label>
          <Input
            id="browser"
            name="browser"
            value={browser}
            onChange={(e) => setBrowser(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bug-message">문제 설명</Label>
        <textarea
          id="bug-message"
          name="message"
          rows={4}
          maxLength={5000}
          required
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reproSteps">재현 방법</Label>
        <textarea
          id="reproSteps"
          name="reproSteps"
          rows={3}
          maxLength={2000}
          placeholder="1. ... 2. ... 3. ..."
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="image">이미지 첨부 (선택)</Label>
        <input
          id="image"
          name="image"
          type="file"
          accept="image/*"
          className="text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm"
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "접수 중..." : "제보하기"}
      </Button>
    </form>
  );
}
