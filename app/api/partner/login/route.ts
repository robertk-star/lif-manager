import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  hashLoginToken,
  createPartnerSessionToken,
  PARTNER_COOKIE_NAME,
  THIRTY_DAYS_SECONDS,
  type PartnerRole,
} from "@/lib/partnerAuth";

function redirectWithError(request: NextRequest, code: string) {
  return NextResponse.redirect(new URL(`/partner/login?error=${code}`, request.url));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return redirectWithError(request, "missing");
    }

    const tokenHash = await hashLoginToken(token);

    const { data: loginToken, error: tokenError } = await supabaseAdmin
      .from("partner_login_tokens")
      .select("id, partner_account_id, partner_user_id, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (tokenError) {
      console.error("[partner/login] token lookup error:", tokenError);
      return redirectWithError(request, "invalid");
    }

    if (!loginToken) {
      return redirectWithError(request, "invalid");
    }

    if (loginToken.used_at) {
      return redirectWithError(request, "used");
    }

    if (new Date(loginToken.expires_at as string) < new Date()) {
      return redirectWithError(request, "expired");
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from("partner_accounts")
      .select("id, status")
      .eq("id", loginToken.partner_account_id)
      .single();

    if (accountError || !account) {
      console.error("[partner/login] account error:", accountError);
      return redirectWithError(request, "invalid");
    }

    if (account.status !== "active" && account.status !== "pending") {
      return redirectWithError(request, "inactive");
    }

    let partnerUserId: string;
    let partnerRole: PartnerRole;

    if (loginToken.partner_user_id) {
      const { data: user, error: userError } = await supabaseAdmin
        .from("partner_users")
        .select("id, partner_account_id, role, status")
        .eq("id", loginToken.partner_user_id)
        .single();

      if (userError || !user || user.partner_account_id !== account.id) {
        console.error("[partner/login] user error:", userError);
        return redirectWithError(request, "invalid");
      }
      if (user.status !== "active" && user.status !== "pending") {
        return redirectWithError(request, "inactive");
      }
      partnerUserId = user.id as string;
      partnerRole = user.role as PartnerRole;
    } else {
      const { data: anyUser } = await supabaseAdmin
        .from("partner_users")
        .select("id, role, status")
        .eq("partner_account_id", account.id)
        .in("status", ["active", "pending"])
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!anyUser) {
        return redirectWithError(request, "invalid");
      }
      partnerUserId = anyUser.id as string;
      partnerRole = anyUser.role as PartnerRole;
    }

    // Create session first; only mark token used after success
    let sessionToken: string;
    try {
      sessionToken = await createPartnerSessionToken(
        account.id as string,
        partnerUserId,
        partnerRole
      );
    } catch (err) {
      console.error("[partner/login] session token error:", err);
      return redirectWithError(request, "invalid");
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

    // Cookie MUST be set on the redirect response or browsers drop it
    const response = NextResponse.redirect(new URL("/partner/leads", request.url));
    response.cookies.set(PARTNER_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: THIRTY_DAYS_SECONDS,
    });

    return response;
  } catch (err) {
    console.error("[partner/login] unexpected error:", err);
    return redirectWithError(request, "invalid");
  }
}
