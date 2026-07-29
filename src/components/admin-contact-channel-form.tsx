"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { ContactChannelFormState } from "@/app/admin/contact-settings/actions";
import { CONTACT_CHANNEL_ICONS, CONTACT_CHANNEL_ICON_LABEL, type ContactChannelIcon } from "@/lib/inquiries";
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

const initialState: ContactChannelFormState = { error: null, success: false };

export type ContactChannelDefaults = {
  name: string;
  buttonLabel: string;
  description: string;
  url: string;
  icon: string;
  isVisible: boolean;
  openNewTab: boolean;
  sortOrder: number;
};

export function AdminContactChannelForm({
  action,
  defaults,
  submitLabel,
  resetOnSuccess = false,
}: {
  action: (prevState: ContactChannelFormState, formData: FormData) => Promise<ContactChannelFormState>;
  defaults: ContactChannelDefaults;
  submitLabel: string;
  /** True for the "add new channel" form (clears after success); false for
   * an existing channel's edit form (keeps showing the just-saved values). */
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [icon, setIcon] = useState<string>(defaults.icon);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && state.success && resetOnSuccess) {
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIcon(defaults.icon);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, pending]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>채널 이름</Label>
          <Input name="name" defaultValue={defaults.name} maxLength={40} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>버튼 문구</Label>
          <Input name="buttonLabel" defaultValue={defaults.buttonLabel} maxLength={60} required />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>안내 문구 (선택)</Label>
        <Input name="description" defaultValue={defaults.description} maxLength={200} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>링크 주소</Label>
        <Input name="url" defaultValue={defaults.url} placeholder="https://..." required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>아이콘</Label>
          <input type="hidden" name="icon" value={icon} />
          <Select value={icon} onValueChange={(v) => setIcon(v ?? "link")}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {() => CONTACT_CHANNEL_ICON_LABEL[icon as ContactChannelIcon] ?? "선택"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CONTACT_CHANNEL_ICONS.map((key) => (
                <SelectItem key={key} value={key}>
                  {CONTACT_CHANNEL_ICON_LABEL[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>노출 순서</Label>
          <Input name="sortOrder" type="number" defaultValue={defaults.sortOrder} />
        </div>
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isVisible" defaultChecked={defaults.isVisible} className="size-4" />
          노출
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="openNewTab"
            defaultChecked={defaults.openNewTab}
            className="size-4"
          />
          새 탭에서 열기
        </label>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && !pending && (
        <p className="text-sm text-muted-foreground">저장했어요.</p>
      )}
      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "저장 중..." : submitLabel}
      </Button>
    </form>
  );
}
