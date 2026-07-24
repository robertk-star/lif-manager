import { NextResponse } from "next/server";
import { rateLimitResponse } from "@/lib/rateLimit";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  createPartnerSessionToken,
  hashLoginToken,
  PARTNER_COOKIE_NAME,
  THIRTY_DAYS_SECONDS,
  type PartnerRole,
} from "@/lib/partnerAuth";

export async function POST(request: Request) {
  const limited = rateLimitResponse(request, {
    keyPrefix: "partner-verify-login-code",
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const code = String(body.code ?? "").replace(/\D/g, "");

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 422 });
  }
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "Enter the 6-digit code sent to your email." },
      { status: 422 }
    );
  }

  const { data: user, error: userError } = await supabaseAdmin
    .from("partner_users")
    .select("id, partner_account_id, email, role, status")
    .eq("email", email)
    .in("status", ["active", "pending"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (userError || !user) {
    return NextResponse.json({ error: "Invalid or expired code." }, { status: 401 });
  }

  const typedUser = user as {
    id: string;
    partner_account_id: string;
    email: string;
    role: PartnerRole;
    status: string;
  };

  const { data: account, error: accountError } = await supabaseAdmin
    .from("partner_accounts")
    .select("id, status")
    .eq("id", typedUser.partner_account_id)
    .single();

  if (
    accountError ||
    !account ||
    (account.status !== "active" && account.status !== "pending")
  ) {
    return NextResponse.json(
      { error: "Your partner account is not currently active." },
      { status: 403 }
    );
  }

  const codeHash = await hashLoginToken(code);
  const now = new Date();

  const { data: matchingCode, error: codeError } = await supabaseAdmin
    .from("partner_login_codes")
    .select("id, expires_at, used_at, attempts, partner_account_id, partner_user_id")
    .eq("partner_user_id", typedUser.id)
    .eq("code_hash", codeHash)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (codeError || !matchingCode) {
    return NextResponse.json({ error: "Invalid or expired code." }, { status: 401 });
  }

  const typedCode = matchingCode as {
    id: string;
    expires_at: string;
    attempts: number;
    partner_account_id: string;
    partner_user_id: string;
  };

  if (new Date(typedCode.expires_at) < now) {
    return NextResponse.json(
      { error: "This code has expired. Please request a new code." },
      { status: 401 }
    );
  }
  if ((typedCode.attempts ?? 0) >= 5) {
    return NextResponse.json(
      { error: "Too many attempts. Please request a new code." },
      { status: 429 }
    );
  }
  if (
    typedCode.partner_account_id !== account.id ||
    typedCode.partner_user_id !== typedUser.id
  ) {
    return NextResponse.json({ error: "Invalid or expired code." }, { status: 401 });
  }

  const timestamp = now.toISOString();
  await supabaseAdmin
    .from("partner_login_codes")
    .update({ used_at: timestamp })
    .eq("id", typedCode.id);

  await Promise.all([
    supabaseAdmin
      .from("partner_accounts")
      .update({ last_login_at: timestamp })
      .eq("id", account.id),
    supabaseAdmin
      .from("partner_users")
      .update({ last_login_at: timestamp, accepted_at: timestamp })
      .eq("id", typedUser.id),
  ]);

  let sessionToken: string;
  try {
    sessionToken = await createPartnerSessionToken(
      account.id as string,
      typedUser.id,
      typedUser.role
    );
  } catch (err) {
    console.error("[verify-login-code] session error:", err);
    return NextResponse.json(
      { error: "Server session configuration error. Contact support." },
      { status: 500 }
    );
  }

  const response = NextResponse.json({ success: true, redirectTo: "/partner/leads" });
  response.cookies.set(PARTNER_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS_SECONDS,
  });

  return response;
}
