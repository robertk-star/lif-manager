import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashLoginToken } from "@/lib/partnerAuth";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id: partnerUserId } = await context.params;

  const { data: user, error: userError } = await supabaseAdmin
    .from("partner_users")
    .select("id, partner_account_id, email, first_name, last_name, status")
    .eq("id", partnerUserId)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: "Partner user not found." }, { status: 404 });
  }

  const { data: account } = await supabaseAdmin
    .from("partner_accounts")
    .select("id, status")
    .eq("id", (user as { partner_account_id: string }).partner_account_id)
    .single();

  if (!account) {
    return NextResponse.json({ error: "Partner account not found." }, { status: 404 });
  }

  if ((account as { status: string }).status === "suspended") {
    return NextResponse.json(
      { error: "Cannot generate a login link for a suspended account." },
      { status: 403 }
    );
  }

  const rawTokenBytes = new Uint8Array(32);
  crypto.getRandomValues(rawTokenBytes);
  const rawToken = Buffer.from(rawTokenBytes).toString("base64url");
  const tokenHash = await hashLoginToken(rawToken);
  const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS).toISOString();

  const { error: insertError } = await supabaseAdmin.from("partner_login_tokens").insert({
    partner_account_id: (user as { partner_account_id: string }).partner_account_id,
    partner_user_id: partnerUserId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (insertError) {
    console.error("[generate-login-link]", insertError);
    return NextResponse.json({ error: "Failed to generate login link." }, { status: 500 });
  }

  const origin = new URL(request.url).origin;
  const loginUrl = `${origin}/partner/login?token=${rawToken}`;

  return NextResponse.json({
    success: true,
    loginUrl,
    expiresAt,
    user: {
      id: (user as { id: string }).id,
      email: (user as { email: string }).email,
      first_name: (user as { first_name: string }).first_name,
      last_name: (user as { last_name: string }).last_name,
    },
  });
}
