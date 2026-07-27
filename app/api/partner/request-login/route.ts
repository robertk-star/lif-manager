import { NextResponse } from "next/server";
import { rateLimitResponse } from "@/lib/rateLimit";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createPartnerLoginCode, sendPartnerLoginCodeEmail } from "@/lib/partnerLoginCodes";

type PartnerUserLookup = {
  id: string;
  partner_account_id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
};

type PartnerAccountLookup = {
  id: string;
  firm_name: string;
  email: string;
  status: string;
};

type PartnerAccountPrimaryLookup = PartnerAccountLookup & {
  contact_first_name: string | null;
  contact_last_name: string | null;
};

const ALLOWED_ACCOUNT_STATUSES = ["active", "pending"];

function normalizeStatus(status: string | null | undefined) {
  return String(status ?? "").trim().toLowerCase();
}

function accountIsAllowed(account: PartnerAccountLookup | null | undefined) {
  return ALLOWED_ACCOUNT_STATUSES.includes(normalizeStatus(account?.status));
}

async function logLoginCodeAttempt(input: {
  email: string;
  status: "skipped" | "failed";
  reason: string;
  partnerAccountId?: string | null;
  partnerUserId?: string | null;
  loginRequestId?: string | null;
}) {
  console.error("[request-login]", input.status, input.reason, {
    email: input.email,
    partnerAccountId: input.partnerAccountId,
    partnerUserId: input.partnerUserId,
  });

  const { error } = await supabaseAdmin.from("email_notifications").insert({
    notification_type: "partner_login_link",
    recipient_email: input.email.toLowerCase(),
    recipient_name: null,
    subject: "Partner login code request",
    status: input.status,
    provider: "resend",
    partner_account_id: input.partnerAccountId ?? null,
    partner_user_id: input.partnerUserId ?? null,
    login_request_id: input.loginRequestId ?? null,
    error_message: input.reason,
    metadata: {
      login_method: "email_code",
      attempt_visibility: "admin_only",
      reason: input.reason,
    },
  });

  if (error) {
    console.error("[request-login] Failed to log login-code attempt:", error);
  }
}

export async function POST(request: Request) {
  const limited = rateLimitResponse(request, {
    keyPrefix: "partner-request-login",
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (limited) return limited;

  let email: string;
  try {
    const body = await request.json();
    email = String(body.email ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 422 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;
  const userAgent = request.headers.get("user-agent") ?? null;

  const { data: matchedUsers } = await supabaseAdmin
    .from("partner_users")
    .select("id, partner_account_id, email, first_name, last_name, status, created_at")
    .eq("email", email)
    .in("status", ["active", "pending"])
    .order("created_at", { ascending: true })
    .limit(25);

  let resolvedAccountId: string | null = null;
  let resolvedUserId: string | null = null;
  let resolvedUser: PartnerUserLookup | null = null;
  let resolvedAccount: PartnerAccountLookup | null = null;
  let matchedUsersWithNoAllowedAccount = false;

  const users = (matchedUsers ?? []) as unknown as PartnerUserLookup[];

  if (users.length > 0) {
    const accountIds = Array.from(new Set(users.map((u) => u.partner_account_id).filter(Boolean)));
    const { data: accounts } = await supabaseAdmin
      .from("partner_accounts")
      .select("id, firm_name, email, status")
      .in("id", accountIds);

    const accountMap = new Map(
      ((accounts ?? []) as unknown as PartnerAccountLookup[]).map((a) => [a.id, a])
    );

    for (const user of users) {
      const account = accountMap.get(user.partner_account_id) ?? null;
      if (account && accountIsAllowed(account)) {
        resolvedUser = user;
        resolvedAccount = account;
        resolvedAccountId = account.id;
        resolvedUserId = user.id;
        break;
      }
    }

    if (!resolvedUser) {
      matchedUsersWithNoAllowedAccount = true;
      const firstMatchedUser = users[0] ?? null;
      resolvedUserId = firstMatchedUser?.id ?? null;
      resolvedAccountId = firstMatchedUser?.partner_account_id ?? null;
      resolvedAccount = resolvedAccountId ? accountMap.get(resolvedAccountId) ?? null : null;
    }
  }

  // Fallback: primary partner_accounts.email (same as production)
  if (!resolvedUser) {
    const { data: primaryAccount } = await supabaseAdmin
      .from("partner_accounts")
      .select("id, firm_name, email, status, contact_first_name, contact_last_name")
      .eq("email", email)
      .in("status", ["active", "pending"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const primary = primaryAccount as PartnerAccountPrimaryLookup | null;

    if (primary && accountIsAllowed(primary)) {
      resolvedAccount = primary;
      resolvedAccountId = primary.id;

      const { data: existingPrimaryUser } = await supabaseAdmin
        .from("partner_users")
        .select("id, partner_account_id, email, first_name, last_name, status")
        .eq("partner_account_id", primary.id)
        .eq("email", email)
        .maybeSingle();

      if (existingPrimaryUser) {
        const existing = existingPrimaryUser as PartnerUserLookup;
        if (
          normalizeStatus(existing.status) === "active" ||
          normalizeStatus(existing.status) === "pending"
        ) {
          resolvedUser = existing;
          resolvedUserId = existing.id;
        } else {
          const { data: reactivatedUser, error: reactivateError } = await supabaseAdmin
            .from("partner_users")
            .update({ status: "active" })
            .eq("id", existing.id)
            .select("id, partner_account_id, email, first_name, last_name, status")
            .single();

          if (reactivateError) {
            console.error("[request-login] Failed to reactivate primary partner user:", reactivateError);
          } else if (reactivatedUser) {
            resolvedUser = reactivatedUser as PartnerUserLookup;
            resolvedUserId = resolvedUser.id;
          }
        }
      } else {
        const { data: createdUser, error: createUserError } = await supabaseAdmin
          .from("partner_users")
          .insert({
            partner_account_id: primary.id,
            email,
            first_name: (primary.contact_first_name ?? "Partner").trim() || "Partner",
            last_name: (primary.contact_last_name ?? "User").trim() || "User",
            role: "owner",
            status: "active",
            invited_at: new Date().toISOString(),
            accepted_at: new Date().toISOString(),
          })
          .select("id, partner_account_id, email, first_name, last_name, status")
          .single();

        if (createUserError) {
          console.error("[request-login] Failed to create primary partner user:", createUserError);
        } else if (createdUser) {
          resolvedUser = createdUser as PartnerUserLookup;
          resolvedUserId = resolvedUser.id;
        }
      }
    }
  }

  const { data: loginRequest, error: insertError } = await supabaseAdmin
    .from("partner_login_requests")
    .insert({
      email,
      partner_account_id: resolvedAccountId,
      partner_user_id: resolvedUserId,
      status: "new",
      ip_address: ip,
      user_agent: userAgent,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[request-login] Insert error:", insertError);
  }

  const loginRequestId = (loginRequest?.id as string | undefined) ?? null;

  // Surface misconfigured email to server logs clearly
  if (!process.env.RESEND_API_KEY || !process.env.LIF_EMAIL_FROM) {
    console.error(
      "[request-login] RESEND_API_KEY and/or LIF_EMAIL_FROM is missing on this deployment. Codes will not be emailed."
    );
  }

  if (!resolvedUser) {
    await logLoginCodeAttempt({
      email,
      status: "skipped",
      reason: resolvedAccount
        ? "Partner account matched this email, but no active or pending partner user matched."
        : "No active or pending partner user matched this email address.",
      partnerAccountId: resolvedAccountId,
      partnerUserId: resolvedUserId,
      loginRequestId,
    });
  } else if (!resolvedAccount || !accountIsAllowed(resolvedAccount)) {
    const accountStatus = resolvedAccount?.status ?? "not found";
    await logLoginCodeAttempt({
      email,
      status: "skipped",
      reason: matchedUsersWithNoAllowedAccount
        ? `Partner user matched, but no matching user is on an active/pending account. First matched account status: ${accountStatus}.`
        : `Partner user matched, but account is not active/pending. Status: ${accountStatus}.`,
      partnerAccountId: resolvedAccountId,
      partnerUserId: resolvedUserId,
      loginRequestId,
    });
  } else {
    const codeResult = await createPartnerLoginCode({
      partnerAccountId: resolvedAccount.id,
      partnerUserId: resolvedUser.id,
      email: resolvedUser.email,
      loginRequestId,
      ipAddress: ip,
      userAgent,
    });

    if (!codeResult.code || !codeResult.expiresAt) {
      await logLoginCodeAttempt({
        email: resolvedUser.email,
        status: "failed",
        reason:
          codeResult.error ??
          "Failed to create partner login code (check partner_login_codes table).",
        partnerAccountId: resolvedAccount.id,
        partnerUserId: resolvedUser.id,
        loginRequestId,
      });
    } else {
      const recipientName =
        `${resolvedUser.first_name} ${resolvedUser.last_name}`.trim() || null;
      const emailResult = await sendPartnerLoginCodeEmail({
        partnerAccountId: resolvedAccount.id,
        partnerUserId: resolvedUser.id,
        loginRequestId,
        recipientEmail: resolvedUser.email,
        recipientName,
        firmName: resolvedAccount.firm_name,
        code: codeResult.code,
        expiresAt: codeResult.expiresAt,
      });

      if (!emailResult.sent) {
        await logLoginCodeAttempt({
          email: resolvedUser.email,
          status: emailResult.skipped ? "skipped" : "failed",
          reason:
            emailResult.error ??
            "Email was not sent. Confirm RESEND_API_KEY and LIF_EMAIL_FROM on the V2 Vercel project.",
          partnerAccountId: resolvedAccount.id,
          partnerUserId: resolvedUser.id,
          loginRequestId,
        });
      } else if (loginRequestId) {
        await supabaseAdmin
          .from("partner_login_requests")
          .update({ status: "completed" })
          .eq("id", loginRequestId);
      }
    }
  }

  // Always neutral success (anti-enumeration)
  return NextResponse.json({ success: true });
}
