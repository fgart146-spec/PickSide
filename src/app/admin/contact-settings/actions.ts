"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/app/admin/actions";
import { logAdminAction } from "@/lib/audit";

export type ContactSettingsFormState = { error: string | null };

export async function updateContactSettings(
  _prevState: ContactSettingsFormState,
  formData: FormData
): Promise<ContactSettingsFormState> {
  const { supabase, adminId } = await requireAdmin();

  const businessInquiryEnabled = formData.get("businessInquiryEnabled") === "on";
  const businessInquiryLabel = String(formData.get("businessInquiryLabel") ?? "").trim();
  const businessInquiryDescription = String(
    formData.get("businessInquiryDescription") ?? ""
  ).trim();
  const businessInquiryUrl = String(formData.get("businessInquiryUrl") ?? "").trim();
  const businessInquiryOpenNewTab = formData.get("businessInquiryOpenNewTab") === "on";

  if (!businessInquiryLabel || !businessInquiryUrl) {
    return { error: "버튼 문구와 링크 주소는 필수입니다." };
  }
  try {
    new URL(businessInquiryUrl);
  } catch {
    return { error: "올바른 URL 형식을 입력해주세요." };
  }

  const { data: existing } = await supabase
    .from("contact_settings")
    .select(
      "business_inquiry_enabled, business_inquiry_label, business_inquiry_description, business_inquiry_url, business_inquiry_open_new_tab"
    )
    .eq("id", 1)
    .single();

  const { error } = await supabase
    .from("contact_settings")
    .update({
      business_inquiry_enabled: businessInquiryEnabled,
      business_inquiry_label: businessInquiryLabel,
      business_inquiry_description: businessInquiryDescription,
      business_inquiry_url: businessInquiryUrl,
      business_inquiry_open_new_tab: businessInquiryOpenNewTab,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) {
    return { error: error.message };
  }

  await logAdminAction(supabase, {
    adminId,
    action: "contact_settings.update",
    targetType: "contact_settings",
    targetId: "1",
    before: existing,
    after: {
      business_inquiry_enabled: businessInquiryEnabled,
      business_inquiry_label: businessInquiryLabel,
      business_inquiry_description: businessInquiryDescription,
      business_inquiry_url: businessInquiryUrl,
      business_inquiry_open_new_tab: businessInquiryOpenNewTab,
    },
  });

  revalidatePath("/admin/contact-settings");
  revalidatePath("/contact");
  return { error: null };
}
