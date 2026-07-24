import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const VALID_ROLES = ["owner", "admin", "staff", "viewer"] as const;
const VALID_STATUSES = ["active", "inactive", "pending", "suspended"] as const;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.first_name === "string") updates.first_name = body.first_name.trim();
  if (typeof body.last_name === "string") updates.last_name = body.last_name.trim();
  if (typeof body.role === "string") {
    if (!(VALID_ROLES as readonly string[]).includes(body.role)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 422 });
    }
    updates.role = body.role;
  }
  if (typeof body.status === "string") {
    if (!(VALID_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 422 });
    }
    updates.status = body.status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("partner_users")
    .update(updates)
    .eq("id", id)
    .select(
      "id, created_at, email, first_name, last_name, role, status, last_login_at, invited_at, accepted_at"
    )
    .single();

  if (error || !data) {
    console.error("[PATCH /api/admin/partner-users/id]", error);
    return NextResponse.json({ error: "Failed to update user." }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
