import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * GET /api/admin/email-status
 * Shows whether this Vercel deployment can send email (no secrets exposed).
 */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const hasResendKey = Boolean(process.env.RESEND_API_KEY?.trim());
  const hasFrom = Boolean(process.env.LIF_EMAIL_FROM?.trim());
  const fromPreview = process.env.LIF_EMAIL_FROM?.trim()
    ? process.env.LIF_EMAIL_FROM.trim().replace(/(.{0,3}).*(@.*)/, "$1…$2")
    : null;

  const { data: recent, error } = await supabaseAdmin
    .from("email_notifications")
    .select("id, notification_type, recipient_email, status, error_message, created_at, sent_at")
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    success: true,
    data: {
      deployment: {
        hostHint: process.env.VERCEL_URL ?? null,
        env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
      },
      emailConfigured: hasResendKey && hasFrom,
      checks: {
        RESEND_API_KEY: hasResendKey ? "set" : "MISSING",
        LIF_EMAIL_FROM: hasFrom ? "set" : "MISSING",
        LIF_EMAIL_FROM_preview: fromPreview,
        LIF_EMAIL_REPLY_TO: process.env.LIF_EMAIL_REPLY_TO?.trim() ? "set" : "not set",
      },
      note:
        hasResendKey && hasFrom
          ? "This deployment can call Resend. If codes still fail, check recent notifications below and Vercel function logs."
          : "This deployment cannot send email. legalintakeflow.com and v2.legalintakeflow.com are different Vercel projects — env vars do not transfer automatically. Copy RESEND_API_KEY and LIF_EMAIL_FROM from the production LIF project into the lif-manager project, then redeploy.",
      recentNotifications: error ? [] : recent ?? [],
      recentNotificationsError: error?.message ?? null,
    },
  });
}
