import { NextResponse } from "next/server";
import { getAuthenticatedPartnerSession, type PartnerRole, hashLoginToken } from "@/lib/partnerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function canManageTeam(role: PartnerRole) {
  return role === "owner" || role === "admin";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthenticatedPartnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!canManageTeam(session.role)) {
    return NextResponse.json(
      { error: "Only owner or admin users can send team invitations." },
      { status: 403 }
    );
  }

  const { id } = await params;

  const { data: user, error: userError } = await supabaseAdmin
    .from("partner_users")
    .select("id, partner_account_id, email, first_name, last_name, role, status, invite_email_count")
    .eq("id", id)
    .eq("partner_account_id", session.partnerAccountId)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: "Team member not found." }, { status: 404 });
  }

  if (user.status !== "active" && user.status !== "pending") {
    return NextResponse.json(
      { error: "Invitations can only be sent to active or pending team members." },
      { status: 422 }
    );
  }

  const rawTokenBytes = new Uint8Array(32);
  crypto.getRandomValues(rawTokenBytes);
  const rawToken = Buffer.from(rawTokenBytes).toString("base64url");
  const tokenHash = await hashLoginToken(rawToken);
  const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS).toISOString();

  const { error: insertError } = await supabaseAdmin.from("partner_login_tokens").insert({
    partner_account_id: session.partnerAccountId,
    partner_user_id: id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (insertError) {
    console.error("[POST /api/partner/team/[id]/send-invite]", insertError);
    return NextResponse.json(
      { error: `Failed to create login link: ${insertError.message}` },
      { status: 500 }
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.LIF_PUBLIC_URL?.replace(/\/$/, "") ||
    new URL(request.url).origin;

  const loginUrl = `${origin}/partner/login?token=${rawToken}`;

  const now = new Date().toISOString();
  const currentCount = Number((user as Record<string, unknown>).invite_email_count ?? 0);
  const { data: updatedUser } = await supabaseAdmin
    .from("partner_users")
    .update({
      invite_email_sent_at: now,
      invite_email_count: currentCount + 1,
      invited_at: now,
    })
    .eq("id", id)
    .eq("partner_account_id", session.partnerAccountId)
    .select("id, invite_email_sent_at, invite_email_count")
    .single();

  return NextResponse.json({
    success: true,
    sent: false,
    skipped: true,
    failed: false,
    error: "Email delivery not configured on v2; copy the one-time login link below.",
    expiresAt,
    loginUrl,
    user: updatedUser ?? null,
  });
}
