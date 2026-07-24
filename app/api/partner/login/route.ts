import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  hashLoginToken,
  createPartnerSessionToken,
  PARTNER_COOKIE_NAME,
  THIRTY_DAYS_SECONDS,
  type PartnerRole,
} from "@/lib/partnerAuth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/partner/login?error=missing", request.url));
  }

  const tokenHash = await hashLoginToken(token);

  const { data: loginToken, error: tokenError } = await supabaseAdmin
    .from("partner_login_tokens")
    .select("id, partner_account_id, partner_user_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (tokenError || !loginToken) {
    return NextResponse.redirect(new URL("/partner/login?error=invalid", request.url));
  }

  if (loginToken.used_at) {
    return NextResponse.redirect(new URL("/partner/login?error=used", request.url));
  }

  if (new Date(loginToken.expires_at as string) < new Date()) {
    return NextResponse.redirect(new URL("/partner/login?error=expired", request.url));
  }

  const { data: account } = await supabaseAdmin
    .from("partner_accounts")
    .select("id, status")
    .eq("id", loginToken.partner_account_id)
    .single();

  if (!account || (account.status !== "active" && account.status !== "pending")) {
    return NextResponse.redirect(new URL("/partner/login?error=inactive", request.url));
  }

  let partnerUserId: string;
  let partnerRole: PartnerRole;

  if (loginToken.partner_user_id) {
    const { data: user } = await supabaseAdmin
      .from("partner_users")
      .select("id, partner_account_id, role, status")
      .eq("id", loginToken.partner_user_id)
      .single();

    if (!user || user.partner_account_id !== account.id) {
      return NextResponse.redirect(new URL("/partner/login?error=invalid", request.url));
    }
    if (user.status !== "active" && user.status !== "pending") {
      return NextResponse.redirect(new URL("/partner/login?error=inactive", request.url));
    }
    partnerUserId = user.id as string;
    partnerRole = user.role as PartnerRole;
  } else {
    const { data: ownerUser } = await supabaseAdmin
      .from("partner_users")
      .select("id, role, status")
      .eq("partner_account_id", account.id)
      .in("status", ["active", "pending"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!ownerUser) {
      return NextResponse.redirect(new URL("/partner/login?error=invalid", request.url));
    }
    partnerUserId = ownerUser.id as string;
    partnerRole = ownerUser.role as PartnerRole;
  }

  await supabaseAdmin
    .from("partner_login_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", loginToken.id);

  const now = new Date().toISOString();
  await Promise.all([
    supabaseAdmin.from("partner_accounts").update({ last_login_at: now }).eq("id", account.id),
    supabaseAdmin.from("partner_users").update({ last_login_at: now }).eq("id", partnerUserId),
  ]);

  const sessionToken = await createPartnerSessionToken(
    account.id as string,
    partnerUserId,
    partnerRole
  );

  const cookieStore = await cookies();
  cookieStore.set(PARTNER_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS_SECONDS,
  });

  return NextResponse.redirect(new URL("/partner/leads", request.url));
}
