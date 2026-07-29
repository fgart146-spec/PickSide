"use client";

import { updateInquiryStatusForm } from "@/app/admin/inquiries/actions";
import { INQUIRY_STATUSES, INQUIRY_STATUS_LABEL } from "@/lib/inquiries";

export function AdminInquiryStatusSelect({
  inquiryId,
  status,
}: {
  inquiryId: string;
  status: string;
}) {
  const action = updateInquiryStatusForm.bind(null, inquiryId);

  return (
    <form action={action}>
      <select
        name="status"
        defaultValue={status}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border bg-background px-2 py-1 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {INQUIRY_STATUSES.map((s) => (
          <option key={s} value={s}>
            {INQUIRY_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    </form>
  );
}
