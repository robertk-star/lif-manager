import { NextResponse } from "next/server";
import { getAuthenticatedPartnerSession } from "@/lib/partnerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const EDIT_ROLES = ["owner", "admin"];

function createApiKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `lif_${Buffer.from(bytes).toString("base64url")}`;
}

async function hashKey(raw: string) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(raw));
  return Buffer.from(buf).toString("hex");
}

export async function POST() {
  const session = await getAuthenticatedPartnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!EDIT_ROLES.includes(session.role)) {
    return NextResponse.json(
      { error: "Only owner and admin users can generate API keys." },
      { status: 403 }
    );
  }

  const apiKey = createApiKey();
  const apiKeyHash = await hashKey(apiKey);
  const lastFour = apiKey.slice(-4);
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("partner_accounts")
    .update({
      api_access_enabled: true,
      api_key_hash: apiKeyHash,
      api_key_last_four: lastFour,
      api_key_created_at: now,
      api_key_revoked_at: null,
    })
    .eq("id", session.partnerAccountId);

  if (error) {
    console.error("[POST /api/partner/integrations/api-key]", error);
    return NextResponse.json({ error: "Failed to generate API key." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    api_key: apiKey,
    api_key_last_four: lastFour,
    api_key_created_at: now,
  });
}

export async function DELETE() {
  const session = await getAuthenticatedPartnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!EDIT_ROLES.includes(session.role)) {
    return NextResponse.json(
      { error: "Only owner and admin users can revoke API keys." },
      { status: 403 }
    );
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("partner_accounts")
    .update({
      api_access_enabled: false,
      api_key_hash: null,
      api_key_last_four: null,
      api_key_created_at: null,
      api_key_revoked_at: now,
    })
    .eq("id", session.partnerAccountId);

  if (error) {
    console.error("[DELETE /api/partner/integrations/api-key]", error);
    return NextResponse.json({ error: "Failed to revoke API key." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
