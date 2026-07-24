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
      "id, created_at, email, first_name, last_name, role, status, last_login_at, invited_at, accepted_at"
    )
    .eq("partner_account_id", partnerAccountId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[GET /api/admin/partners/id/users]", error);
    return NextResponse.json({ error: "Failed to fetch users." }, { status: 500 });
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

  const { data, error } = await supabaseAdmin
    .from("partner_users")
    .insert({
      partner_account_id: partnerAccountId,
      email,
      first_name: firstName,
      last_name: lastName,
      role,
      status: status === "pending" ? "pending" : "active",
      invited_at: now,
      accepted_at: status === "pending" ? null : now,
    })
    .select(
      "id, created_at, email, first_name, last_name, role, status, last_login_at, invited_at, accepted_at"
    )
    .single();

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
