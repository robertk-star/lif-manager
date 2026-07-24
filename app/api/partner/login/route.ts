import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  hashLoginToken,
  createPartnerSessionToken,
  PARTNER_COOKIE_NAME,
  THIRTY_DAYS_SECONDS,
  type PartnerRole,
} from "@/lib/partnerAuth";

function errorRedirect(request: NextRequest, code: string, detail?: string) {
  const url = new URL("/partner/login", request.url);
  url.searchParams.set("error", code);
  if (detail) url.searchParams.set("detail", detail.slice(0, 160));
  return NextResponse.redirect(url);
}

function successRedirect(request: NextRequest, sessionToken: string) {
  const response = NextResponse.redirect(new URL("/partner/leads", request.url));
  response.cookies.set({
    name: PARTNER_COOKIE_NAME,
    value: sessionToken,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS_SECONDS,
  });
  return response;
}

async function consumeToken(rawToken: string, request: NextRequest) {
  if (!rawToken) {
    return errorRedirect(request, "missing", "No token provided");
  }

  let tokenHash: string;
  try {
    tokenHash = await hashLoginToken(rawToken);
  } catch (err) {
    console.error("[partner/login] hash error:", err);
    return errorRedirect(request, "invalid", "Could not hash token");
  }

  const { data: loginToken, error: tokenError } = await supabaseAdmin
    .from("partner_login_tokens")
    .select("id, partner_account_id, partner_user_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (tokenError) {
    console.error("[partner/login] token lookup:", tokenError);
    return errorRedirect(
      request,
      "invalid",
      tokenError.message || "Token lookup failed"
    );
  }

  if (!loginToken) {
    return errorRedirect(
      request,
      "invalid",
      "Token not found — generate a new link"
    );
  }

  if (loginToken.used_at) {
    return errorRedirect(request, "used", "This link was already used");
  }

  if (new Date(loginToken.expires_at as string) < new Date()) {
    return errorRedirect(request, "expired", "Link expired (7 day limit)");
  }

  const { data: account, error: accountError } = await supabaseAdmin
    .from("partner_accounts")
    .select("id, status")
    .eq("id", loginToken.partner_account_id)
    .single();

  if (accountError || !account) {
    console.error("[partner/login] account:", accountError);
    return errorRedirect(request, "invalid", "Partner account not found");
  }

  if (account.status !== "active" && account.status !== "pending") {
    return errorRedirect(
      request,
      "inactive",
      `Account status is ${account.status}`
    );
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
      console.error("[partner/login] user:", userError);
      return errorRedirect(request, "invalid", "Partner user not found");
    }
    if (user.status !== "active" && user.status !== "pending") {
      return errorRedirect(
        request,
        "inactive",
        `User status is ${user.status}`
      );
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
      return errorRedirect(request, "invalid", "No active user on account");
    }
    partnerUserId = anyUser.id as string;
    partnerRole = anyUser.role as PartnerRole;
  }

  let sessionToken: string;
  try {
    sessionToken = await createPartnerSessionToken(
      account.id as string,
      partnerUserId,
      partnerRole
    );
  } catch (err) {
    console.error("[partner/login] session create:", err);
    return errorRedirect(
      request,
      "invalid",
      "Session secret missing — set LIF_ADMIN_PASSWORD or LIF_PARTNER_SESSION_SECRET in Vercel"
    );
  }

  const { error: markError } = await supabaseAdmin
    .from("partner_login_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", loginToken.id);

  if (markError) {
    console.error("[partner/login] mark used:", markError);
  }

  const now = new Date().toISOString();
  await Promise.all([
    supabaseAdmin.from("partner_accounts").update({ last_login_at: now }).eq("id", account.id),
    supabaseAdmin.from("partner_users").update({ last_login_at: now }).eq("id", partnerUserId),
  ]);

  return successRedirect(request, sessionToken);
}

export async function GET(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    return await consumeToken(token, request);
  } catch (err) {
    console.error("[partner/login] GET unexpected:", err);
    return errorRedirect(request, "invalid", "Unexpected server error");
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let token = "";

    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      token = String((body as { token?: string }).token ?? "");
    } else {
      const form = await request.formData().catch(() => null);
      token = String(form?.get("token") ?? "");
    }

    return await consumeToken(token, request);
  } catch (err) {
    console.error("[partner/login] POST unexpected:", err);
    return errorRedirect(request, "invalid", "Unexpected server error");
  }
}
