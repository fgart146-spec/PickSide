"use client";

import { useActionState } from "react";
import {
  updateContactSettings,
  type ContactSettingsFormState,
} from "@/app/admin/contact-settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const initialState: ContactSettingsFormState = { error: null };

export function AdminContactSettingsForm({
  pageEnabled,
  generalEnabled,
  bugEnabled,
  adEnabled,
  partnershipEnabled,
  contactEmail,
  introText,
  businessEnabled,
  businessLabel,
  businessDescription,
  businessUrl,
  businessOpenNewTab,
}: {
  pageEnabled: boolean;
  generalEnabled: boolean;
  bugEnabled: boolean;
  adEnabled: boolean;
  partnershipEnabled: boolean;
  contactEmail: string;
  introText: string;
  businessEnabled: boolean;
  businessLabel: string;
  businessDescription: string;
  businessUrl: string;
  businessOpenNewTab: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateContactSettings, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">기본 설정</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="pageEnabled" defaultChecked={pageEnabled} className="size-4" />
          문의 페이지 활성화
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="generalEnabled"
              defaultChecked={generalEnabled}
              className="size-4"
            />
            일반 문의
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="bugEnabled" defaultChecked={bugEnabled} className="size-4" />
            버그 제보
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="adEnabled" defaultChecked={adEnabled} className="size-4" />
            광고 문의
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="partnershipEnabled"
              defaultChecked={partnershipEnabled}
              className="size-4"
            />
            제휴 문의
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contactEmail">대표 문의 이메일 (선택)</Label>
        <Input
          id="contactEmail"
          name="contactEmail"
          type="email"
          defaultValue={contactEmail}
          placeholder="contact@pickside.com"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="introText">문의 페이지 상단 안내 문구 (선택)</Label>
        <Input id="introText" name="introText" defaultValue={introText} maxLength={200} />
      </div>

      <Separator />

      <p className="text-sm font-medium">비즈니스 문의 (카카오톡 등)</p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="businessInquiryEnabled"
          defaultChecked={businessEnabled}
          className="size-4"
        />
        비즈니스 문의 활성화
      </label>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="businessInquiryLabel">버튼 문구</Label>
        <Input
          id="businessInquiryLabel"
          name="businessInquiryLabel"
          defaultValue={businessLabel}
          maxLength={100}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="businessInquiryDescription">안내 문구</Label>
        <Input
          id="businessInquiryDescription"
          name="businessInquiryDescription"
          defaultValue={businessDescription}
          maxLength={200}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="businessInquiryUrl">외부 링크 (카카오톡 오픈채팅 등)</Label>
        <Input
          id="businessInquiryUrl"
          name="businessInquiryUrl"
          defaultValue={businessUrl}
          placeholder="https://open.kakao.com/o/..."
          required
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="businessInquiryOpenNewTab"
          defaultChecked={businessOpenNewTab}
          className="size-4"
        />
        새 탭에서 열기
      </label>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "저장 중..." : "저장"}
      </Button>
    </form>
  );
}
