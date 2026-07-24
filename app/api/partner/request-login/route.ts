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

  const users = (matchedUsers ?? []) as unknown as PartnerUserLookup[];
  let resolvedUser: PartnerUserLookup | null = null;
  let resolvedAccount: PartnerAccountLookup | null = null;

  if (users.length > 0) {
    const accountIds = Array.from(new Set(users.map((u) => u.partner_account_id)));
    const { data: accounts } = await supabaseAdmin
      .from("partner_accounts")
      .select("id, firm_name, email, status")
      .in("id", accountIds);

    const accountMap = new Map(
      ((accounts ?? []) as unknown as PartnerAccountLookup[]).map((a) => [a.id, a])
    );

    for (const user of users) {
      const account = accountMap.get(user.partner_account_id);
      if (account && (account.status === "active" || account.status === "pending")) {
        resolvedUser = user;
        resolvedAccount = account;
        break;
      }
    }
  }

  // Always return success to avoid email enumeration
  if (resolvedUser && resolvedAccount) {
    const codeResult = await createPartnerLoginCode({
      partnerAccountId: resolvedAccount.id,
      partnerUserId: resolvedUser.id,
      email: resolvedUser.email,
      ipAddress: ip,
      userAgent,
    });

    if (codeResult.code && codeResult.expiresAt) {
      const recipientName =
        `${resolvedUser.first_name} ${resolvedUser.last_name}`.trim() || null;
      await sendPartnerLoginCodeEmail({
        partnerAccountId: resolvedAccount.id,
        partnerUserId: resolvedUser.id,
        recipientEmail: resolvedUser.email,
        recipientName,
        firmName: resolvedAccount.firm_name,
        code: codeResult.code,
        expiresAt: codeResult.expiresAt,
      });
    }
  }

  return NextResponse.json({ success: true });
}
