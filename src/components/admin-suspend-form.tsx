"use client";

import { suspendUser } from "@/app/admin/users/actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DURATIONS = [
  { value: "1", label: "1일" },
  { value: "3", label: "3일" },
  { value: "7", label: "7일" },
  { value: "30", label: "30일" },
];

export function AdminSuspendForm({ userId }: { userId: string }) {
  const action = suspendUser.bind(null, userId);

  return (
    <form action={action} className="flex flex-col gap-3">
      <Select name="days" defaultValue="7">
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DURATIONS.map((d) => (
            <SelectItem key={d.value} value={d.value}>
              {d.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <textarea
        name="reason"
        placeholder="정지 사유 (선택)"
        rows={2}
        maxLength={300}
        className="w-full resize-none rounded-md border bg-background px-2 py-1 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <Button type="submit" variant="destructive" size="sm">
        일시 정지
      </Button>
    </form>
  );
}
