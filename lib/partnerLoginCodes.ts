import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashLoginToken } from "@/lib/partnerAuth";
import { sendTransactionalEmail } from "@/lib/emailNotifications";

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;")
    .replace(/'/g, "&#039;");
}

export async function createPartnerLoginCode(input: {
  partnerAccountId: string;
  partnerUserId: string;
  email: string;
  loginRequestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await hashLoginToken(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("partner_login_codes")
    .insert({
      partner_account_id: input.partnerAccountId,
      partner_user_id: input.partnerUserId,
      login_request_id: input.loginRequestId ?? null,
      email: input.email.toLowerCase(),
      code_hash: codeHash,
      expires_at: expiresAt,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    })
    .select("id, expires_at")
    .single();

  if (error || !data) {
    console.error("[partnerLoginCodes] create failed:", error);
    return {
      code: null,
      codeId: null,
      expiresAt: null,
      error: error?.message ?? "Failed to create login code.",
    };
  }

  return {
    code,
    codeId: data.id as string,
    expiresAt: data.expires_at as string,
    error: null,
  };
}

export async function sendPartnerLoginCodeEmail(input: {
  partnerAccountId: string;
  partnerUserId: string;
  loginRequestId?: string | null;
  recipientEmail: string;
  recipientName?: string | null;
  firmName: string;
  code: string;
  expiresAt: string;
}) {
  const recipientName = input.recipientName ?? "Partner";
  const subject = "Your Legal Intake Flow login code";
  const expiresText = new Date(input.expiresAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const text = [
    `Hello ${recipientName},`,
    "",
    `Your Legal Intake Flow login code is: ${input.code}`,
    "",
    `This code expires at ${expiresText}.`,
    "",
    `Firm: ${input.firmName}`,
    "",
    "If you did not request this code, you can ignore this email.",
  ].join("\n");

  const html = [
    '<div style="font-family: Arial, sans-serif; color: #0d1b2e; line-height: 1.5;">',
    `<p>Hello ${escapeHtml(recipientName)},</p>`,
    "<p>Your Legal Intake Flow login code is:</p>",
    `<div style="font-size: 28px; letter-spacing: 6px; font-weight: 700; padding: 14px 18px; border: 1px solid #dbe4f0; border-radius: 10px; background: #f8fafc; display: inline-block;">${escapeHtml(input.code)}</div>`,
    `<p style="margin-top:16px;">This code expires at <strong>${escapeHtml(expiresText)}</strong>.</p>`,
    `<p style="font-size:13px;color:#4b5563;">Firm: ${escapeHtml(input.firmName)}</p>`,
    '<p style="font-size:13px;color:#4b5563;">If you did not request this code, you can ignore this email.</p>',
    "</div>",
  ].join("\n");

  return sendTransactionalEmail({
    to: input.recipientEmail,
    recipientName,
    subject,
    text,
    html,
    partnerAccountId: input.partnerAccountId,
    partnerUserId: input.partnerUserId,
    metadata: {
      login_method: "email_code",
      expires_at: input.expiresAt,
      login_request_id: input.loginRequestId ?? null,
    },
  });
}
