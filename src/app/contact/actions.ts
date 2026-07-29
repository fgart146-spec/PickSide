"use server";

import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { isValidEmail, isReasonableLength } from "@/lib/inquiries";
import { toOptimizedWebp } from "@/lib/image-processing";

export type InquiryFormState = { error: string | null; success: boolean };

// Honeypot field name — a real visitor never sees or fills this (hidden via
// CSS, not `type="hidden"`, so unsophisticated bots that skip hidden inputs
// but fill every visible-looking field still get caught).
const HONEYPOT_FIELD = "website_url_confirm";

const MAX_SUBMISSIONS_PER_IP_PER_DAY = 10;

async function getRequestIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip");
}

async function checkSpam(formData: FormData, email: string): Promise<string | null> {
  if (String(formData.get(HONEYPOT_FIELD) ?? "").trim()) {
    // Bots fill honeypots; pretend success so they don't learn to skip it.
    return "__honeypot__";
  }

  const service = createServiceClient();
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: recentByEmail } = await service
    .from("inquiries")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", oneMinuteAgo);

  if ((recentByEmail ?? 0) > 0) {
    return "잠시 후 다시 시도해주세요. (중복 제출 방지)";
  }

  const ip = await getRequestIp();
  if (ip) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: todayByIp } = await service
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", ip)
      .gte("created_at", oneDayAgo);

    if ((todayByIp ?? 0) >= MAX_SUBMISSIONS_PER_IP_PER_DAY) {
      return "오늘 문의 가능 횟수를 초과했습니다. 내일 다시 시도해주세요.";
    }
  }

  return null;
}

function validateCommon(name: string, email: string, message: string): string | null {
  if (!name || !email || !message) {
    return "필수 항목을 모두 입력해주세요.";
  }
  if (!isValidEmail(email)) {
    return "올바른 이메일 형식을 입력해주세요.";
  }
  if (!isReasonableLength(name, 1, 60)) {
    return "이름/닉네임은 1~60자로 입력해주세요.";
  }
  if (!isReasonableLength(message, 5, 5000)) {
    return "문의 내용은 5~5000자로 입력해주세요.";
  }
  return null;
}

export async function submitGeneralInquiry(
  _prevState: InquiryFormState,
  formData: FormData
): Promise<InquiryFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  const commonError = validateCommon(name, email, message);
  if (commonError) return { error: commonError, success: false };
  if (!subject) return { error: "문의 제목을 입력해주세요.", success: false };

  const spamResult = await checkSpam(formData, email);
  if (spamResult === "__honeypot__") return { error: null, success: true };
  if (spamResult) return { error: spamResult, success: false };

  const userId = await currentUserId();
  const service = createServiceClient();
  const { error } = await service.from("inquiries").insert({
    type: "general",
    name,
    email,
    subject,
    message,
    user_id: userId,
    ip_address: await getRequestIp(),
  });
  if (error) return { error: "문의 접수에 실패했습니다. 잠시 후 다시 시도해주세요.", success: false };

  return { error: null, success: true };
}

export async function submitBugReport(
  _prevState: InquiryFormState,
  formData: FormData
): Promise<InquiryFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const pageUrl = String(formData.get("pageUrl") ?? "").trim();
  const device = String(formData.get("device") ?? "").trim();
  const browser = String(formData.get("browser") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const reproSteps = String(formData.get("reproSteps") ?? "").trim();
  const image = formData.get("image");

  const commonError = validateCommon(name, email, message);
  if (commonError) return { error: commonError, success: false };

  const spamResult = await checkSpam(formData, email);
  if (spamResult === "__honeypot__") return { error: null, success: true };
  if (spamResult) return { error: spamResult, success: false };

  const service = createServiceClient();

  let imagePath: string | null = null;
  if (image instanceof File && image.size > 0) {
    if (image.size > 10 * 1024 * 1024) {
      return { error: "이미지는 10MB 이하로 올려주세요.", success: false };
    }
    const optimized = await toOptimizedWebp(await image.arrayBuffer(), { maxWidth: 1600 });
    const path = `${crypto.randomUUID()}.webp`;
    const { error: uploadError } = await service.storage
      .from("inquiry-attachments")
      .upload(path, optimized, { contentType: "image/webp" });
    if (uploadError) {
      return { error: `이미지 업로드 실패: ${uploadError.message}`, success: false };
    }
    imagePath = path;
  }

  const userId = await currentUserId();
  const { error } = await service.from("inquiries").insert({
    type: "bug",
    name,
    email,
    message,
    details: { pageUrl, device, browser, reproSteps },
    image_path: imagePath,
    user_id: userId,
    ip_address: await getRequestIp(),
  });
  if (error) return { error: "문의 접수에 실패했습니다. 잠시 후 다시 시도해주세요.", success: false };

  return { error: null, success: true };
}

export async function submitAdInquiry(
  _prevState: InquiryFormState,
  formData: FormData
): Promise<InquiryFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const companyName = String(formData.get("companyName") ?? "").trim();
  const adPosition = String(formData.get("adPosition") ?? "").trim();
  const adPeriod = String(formData.get("adPeriod") ?? "").trim();
  const budget = String(formData.get("budget") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  const commonError = validateCommon(name, email, message);
  if (commonError) return { error: commonError, success: false };
  if (!companyName) return { error: "회사명 또는 브랜드명을 입력해주세요.", success: false };

  const spamResult = await checkSpam(formData, email);
  if (spamResult === "__honeypot__") return { error: null, success: true };
  if (spamResult) return { error: spamResult, success: false };

  const userId = await currentUserId();
  const service = createServiceClient();
  const { error } = await service.from("inquiries").insert({
    type: "ad",
    name,
    email,
    message,
    details: { companyName, adPosition, adPeriod, budget },
    user_id: userId,
    ip_address: await getRequestIp(),
  });
  if (error) return { error: "문의 접수에 실패했습니다. 잠시 후 다시 시도해주세요.", success: false };

  return { error: null, success: true };
}

export async function submitPartnershipInquiry(
  _prevState: InquiryFormState,
  formData: FormData
): Promise<InquiryFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const companyName = String(formData.get("companyName") ?? "").trim();
  const websiteUrl = String(formData.get("websiteUrl") ?? "").trim();
  const cooperationType = String(formData.get("cooperationType") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  const commonError = validateCommon(name, email, message);
  if (commonError) return { error: commonError, success: false };
  if (!companyName) return { error: "회사명 또는 커뮤니티명을 입력해주세요.", success: false };

  const spamResult = await checkSpam(formData, email);
  if (spamResult === "__honeypot__") return { error: null, success: true };
  if (spamResult) return { error: spamResult, success: false };

  const userId = await currentUserId();
  const service = createServiceClient();
  const { error } = await service.from("inquiries").insert({
    type: "partnership",
    name,
    email,
    message,
    details: { companyName, websiteUrl, cooperationType },
    user_id: userId,
    ip_address: await getRequestIp(),
  });
  if (error) return { error: "문의 접수에 실패했습니다. 잠시 후 다시 시도해주세요.", success: false };

  return { error: null, success: true };
}

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user && !user.is_anonymous ? user.id : null;
}
