"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/app/admin/actions";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";
import { CONTACT_CHANNEL_ICONS } from "@/lib/inquiries";

export type ContactSettingsFormState = { error: string | null };

export async function updateContactSettings(
  _prevState: ContactSettingsFormState,
  formData: FormData
): Promise<ContactSettingsFormState> {
  const { supabase, adminId } = await requireAdmin();

  const pageEnabled = formData.get("pageEnabled") === "on";
  const generalEnabled = formData.get("generalEnabled") === "on";
  const bugEnabled = formData.get("bugEnabled") === "on";
  const adEnabled = formData.get("adEnabled") === "on";
  const partnershipEnabled = formData.get("partnershipEnabled") === "on";
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const introText = String(formData.get("introText") ?? "").trim();

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
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { error: "대표 문의 이메일 형식이 올바르지 않습니다." };
  }

  const { data: existing } = await supabase.from("contact_settings").select("*").eq("id", 1).single();

  const next = {
    page_enabled: pageEnabled,
    general_enabled: generalEnabled,
    bug_enabled: bugEnabled,
    ad_enabled: adEnabled,
    partnership_enabled: partnershipEnabled,
    contact_email: contactEmail || null,
    intro_text: introText || null,
    business_inquiry_enabled: businessInquiryEnabled,
    business_inquiry_label: businessInquiryLabel,
    business_inquiry_description: businessInquiryDescription,
    business_inquiry_url: businessInquiryUrl,
    business_inquiry_open_new_tab: businessInquiryOpenNewTab,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("contact_settings").update(next).eq("id", 1);
  if (error) {
    return { error: error.message };
  }

  await logAdminAction(supabase, {
    adminId,
    action: "contact_settings.update",
    targetType: "contact_settings",
    targetId: "1",
    before: existing,
    after: next,
  });

  revalidatePath("/admin/contact-settings");
  revalidatePath("/contact");
  return { error: null };
}

export type ContactChannelFormState = { error: string | null; success: boolean };

function readChannelFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const buttonLabel = String(formData.get("buttonLabel") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const icon = String(formData.get("icon") ?? "link").trim();
  const isVisible = formData.get("isVisible") === "on";
  const openNewTab = formData.get("openNewTab") === "on";
  const sortOrder = Number(formData.get("sortOrder") ?? 0) || 0;
  return { name, buttonLabel, description, url, icon, isVisible, openNewTab, sortOrder };
}

function validateChannel(fields: ReturnType<typeof readChannelFields>): string | null {
  if (!fields.name || !fields.buttonLabel || !fields.url) {
    return "채널 이름, 버튼 문구, 링크 주소는 필수입니다.";
  }
  try {
    new URL(fields.url);
  } catch {
    return "올바른 URL 형식을 입력해주세요.";
  }
  if (!(CONTACT_CHANNEL_ICONS as readonly string[]).includes(fields.icon)) {
    return "올바르지 않은 아이콘입니다.";
  }
  return null;
}

export async function createContactChannel(
  _prevState: ContactChannelFormState,
  formData: FormData
): Promise<ContactChannelFormState> {
  const { adminId } = await requireAdmin();
  const fields = readChannelFields(formData);
  const validationError = validateChannel(fields);
  if (validationError) return { error: validationError, success: false };

  const service = createServiceClient();
  const { data: channel, error } = await service
    .from("contact_channels")
    .insert({
      name: fields.name,
      button_label: fields.buttonLabel,
      description: fields.description || null,
      url: fields.url,
      icon: fields.icon,
      is_visible: fields.isVisible,
      open_new_tab: fields.openNewTab,
      sort_order: fields.sortOrder,
    })
    .select("id")
    .single();
  if (error) return { error: error.message, success: false };

  await logAdminAction(service, {
    adminId,
    action: "contact_channel.create",
    targetType: "contact_channels",
    targetId: channel?.id ?? null,
    after: fields,
  });

  revalidatePath("/admin/contact-settings");
  revalidatePath("/contact");
  return { error: null, success: true };
}

export async function updateContactChannel(
  channelId: string,
  _prevState: ContactChannelFormState,
  formData: FormData
): Promise<ContactChannelFormState> {
  const { adminId } = await requireAdmin();
  const fields = readChannelFields(formData);
  const validationError = validateChannel(fields);
  if (validationError) return { error: validationError, success: false };

  const service = createServiceClient();
  const { data: existing } = await service
    .from("contact_channels")
    .select("*")
    .eq("id", channelId)
    .single();

  const { error } = await service
    .from("contact_channels")
    .update({
      name: fields.name,
      button_label: fields.buttonLabel,
      description: fields.description || null,
      url: fields.url,
      icon: fields.icon,
      is_visible: fields.isVisible,
      open_new_tab: fields.openNewTab,
      sort_order: fields.sortOrder,
      updated_at: new Date().toISOString(),
    })
    .eq("id", channelId);
  if (error) return { error: error.message, success: false };

  await logAdminAction(service, {
    adminId,
    action: "contact_channel.update",
    targetType: "contact_channels",
    targetId: channelId,
    before: existing,
    after: fields,
  });

  revalidatePath("/admin/contact-settings");
  revalidatePath("/contact");
  return { error: null, success: true };
}

export async function deleteContactChannel(channelId: string) {
  const { adminId } = await requireAdmin();
  const service = createServiceClient();

  const { error } = await service.from("contact_channels").delete().eq("id", channelId);
  if (error) throw new Error(error.message);

  await logAdminAction(service, {
    adminId,
    action: "contact_channel.delete",
    targetType: "contact_channels",
    targetId: channelId,
  });

  revalidatePath("/admin/contact-settings");
  revalidatePath("/contact");
}
