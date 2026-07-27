import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const VALID_ROLES = ["owner", "admin", "staff", "viewer"] as const;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id: partnerAccountId } = await context.params;

  const { data: account } = await supabaseAdmin
    .from("partner_accounts")
    .select("id")
    .eq("id", partnerAccountId)
    .single();

  if (!account) {
    return NextResponse.json({ error: "Partner account not found." }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("partner_users")
    .select(
      "id, created_at, email, first_name, last_name, role, status, last_login_at, invited_at, accepted_at, receives_invoice_emails"
    )
    .eq("partner_account_id", partnerAccountId)
    .order("created_at", { ascending: true });

  if (error) {
    // Column may not exist yet — fall back without it
    console.warn("[GET /api/admin/partners/id/users] retry without receives_invoice_emails:", error.message);
    const fallback = await supabaseAdmin
      .from("partner_users")
      .select(
        "id, created_at, email, first_name, last_name, role, status, last_login_at, invited_at, accepted_at"
      )
      .eq("partner_account_id", partnerAccountId)
      .order("created_at", { ascending: true });

    if (fallback.error) {
      console.error("[GET /api/admin/partners/id/users]", fallback.error);
      return NextResponse.json({ error: "Failed to fetch users." }, { status: 500 });
    }

    const rows = (fallback.data ?? []).map((u) => ({
      ...u,
      receives_invoice_emails:
        (u as { role?: string }).role === "owner" || (u as { role?: string }).role === "admin",
    }));
    return NextResponse.json({ success: true, data: rows });
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id: partnerAccountId } = await context.params;

  const { data: account } = await supabaseAdmin
    .from("partner_accounts")
    .select("id")
    .eq("id", partnerAccountId)
    .single();

  if (!account) {
    return NextResponse.json({ error: "Partner account not found." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const firstName = String(body.first_name ?? "").trim();
  const lastName = String(body.last_name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const role = String(body.role ?? "owner").trim();
  const status = String(body.status ?? "active").trim();
  const receivesInvoiceEmails =
    typeof body.receives_invoice_emails === "boolean"
      ? body.receives_invoice_emails
      : role === "owner" || role === "admin";

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "First and last name are required." }, { status: 422 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 422 });
  }
  if (!(VALID_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json(
      { error: `Invalid role. Allowed: ${VALID_ROLES.join(", ")}.` },
      { status: 422 }
    );
  }

  const now = new Date().toISOString();

  const insertPayload: Record<string, unknown> = {
    partner_account_id: partnerAccountId,
    email,
    first_name: firstName,
    last_name: lastName,
    role,
    status: status === "pending" ? "pending" : "active",
    invited_at: now,
    accepted_at: status === "pending" ? null : now,
    receives_invoice_emails: receivesInvoiceEmails,
  };

  let { data, error } = await supabaseAdmin
    .from("partner_users")
    .insert(insertPayload)
    .select(
      "id, created_at, email, first_name, last_name, role, status, last_login_at, invited_at, accepted_at, receives_invoice_emails"
    )
    .single();

  if (error && /receives_invoice_emails/i.test(error.message ?? "")) {
    delete insertPayload.receives_invoice_emails;
    const retry = await supabaseAdmin
      .from("partner_users")
      .insert(insertPayload)
      .select(
        "id, created_at, email, first_name, last_name, role, status, last_login_at, invited_at, accepted_at"
      )
      .single();
    data = retry.data
      ? ({ ...retry.data, receives_invoice_emails: receivesInvoiceEmails } as typeof data)
      : null;
    error = retry.error;
  }

  if (error) {
    console.error("[POST /api/admin/partners/id/users]", error);
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A user with this email already exists for this partner." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to create user." }, { status: 500 });
  }

  return NextResponse.json({ success: true, data }, { status: 201 });
}
