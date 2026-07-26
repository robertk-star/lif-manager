import { NextResponse } from "next/server";
import { getAuthenticatedPartnerSession } from "@/lib/partnerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const EDIT_ROLES = ["owner", "admin"];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeWebhookUrl(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function isValidWebhookUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function createWebhookSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

function publicSettings(account: Record<string, unknown>) {
  return {
    api_access_enabled: account.api_access_enabled === true,
    api_key_last_four: (account.api_key_last_four as string | null) ?? null,
    api_key_created_at: (account.api_key_created_at as string | null) ?? null,
    api_key_revoked_at: (account.api_key_revoked_at as string | null) ?? null,
    webhook_enabled: account.webhook_enabled === true,
    webhook_url: (account.webhook_url as string | null) ?? "",
    webhook_secret_configured: Boolean(account.webhook_secret),
    webhook_last_sent_at: (account.webhook_last_sent_at as string | null) ?? null,
    webhook_last_status: (account.webhook_last_status as number | null) ?? null,
    webhook_last_error: (account.webhook_last_error as string | null) ?? null,
  };
}

export async function GET() {
  const session = await getAuthenticatedPartnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("partner_accounts")
    .select(
      "id, api_access_enabled, api_key_last_four, api_key_created_at, api_key_revoked_at, " +
        "webhook_enabled, webhook_url, webhook_secret, webhook_last_sent_at, webhook_last_status, webhook_last_error"
    )
    .eq("id", session.partnerAccountId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Partner account not found." }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: publicSettings(data as unknown as Record<string, unknown>),
  });
}

export async function PATCH(request: Request) {
  const session = await getAuthenticatedPartnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!EDIT_ROLES.includes(session.role)) {
    return NextResponse.json(
      { error: "Only owner and admin users can update integration settings." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!isPlainObject(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if ("api_access_enabled" in body) {
    update.api_access_enabled = body.api_access_enabled === true;
  }

  if ("webhook_enabled" in body) {
    update.webhook_enabled = body.webhook_enabled === true;
  }

  if ("webhook_url" in body) {
    const url = normalizeWebhookUrl(typeof body.webhook_url === "string" ? body.webhook_url : null);
    if (url && !isValidWebhookUrl(url)) {
      return NextResponse.json(
        { error: "Webhook URL must be a valid https:// URL." },
        { status: 422 }
      );
    }
    update.webhook_url = url;
  }

  if (body.rotate_webhook_secret === true) {
    update.webhook_secret = createWebhookSecret();
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid settings were provided." }, { status: 422 });
  }

  const { data, error } = await supabaseAdmin
    .from("partner_accounts")
    .update(update)
    .eq("id", session.partnerAccountId)
    .select(
      "id, api_access_enabled, api_key_last_four, api_key_created_at, api_key_revoked_at, " +
        "webhook_enabled, webhook_url, webhook_secret, webhook_last_sent_at, webhook_last_status, webhook_last_error"
    )
    .single();

  if (error || !data) {
    console.error("[PATCH /api/partner/integrations] Supabase error:", error);
    return NextResponse.json({ error: "Failed to save integration settings." }, { status: 500 });
  }

  const response = publicSettings(data as unknown as Record<string, unknown>);
  return NextResponse.json({
    success: true,
    data: response,
    webhook_secret:
      body.rotate_webhook_secret === true
        ? (data as unknown as Record<string, unknown>).webhook_secret
        : undefined,
  });
}
