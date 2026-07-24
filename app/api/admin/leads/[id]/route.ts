import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;

  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  let assignedPartnerName: string | null = null;
  if (data.assigned_partner_account_id) {
    const { data: partner } = await supabaseAdmin
      .from("partner_accounts")
      .select("firm_name")
      .eq("id", data.assigned_partner_account_id)
      .maybeSingle();
    assignedPartnerName = (partner as { firm_name?: string } | null)?.firm_name ?? null;
  }

  return NextResponse.json({
    success: true,
    data: { ...data, assigned_partner_name: assignedPartnerName },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;

  let body: {
    status?: string;
    internal_review_notes?: string;
    assigned_partner_account_id?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.status === "string") updates.status = body.status;
  if (typeof body.internal_review_notes === "string") {
    updates.internal_review_notes = body.internal_review_notes;
  }

  if (body.assigned_partner_account_id !== undefined) {
    const nextId = body.assigned_partner_account_id || null;
    updates.assigned_partner_account_id = nextId;

    if (nextId) {
      updates.status = body.status ?? "assigned";
      updates.assigned_at = new Date().toISOString();
      updates.partner_response_status = "new";
      updates.partner_response_updated_at = null;
      updates.partner_viewed_at = null;
      updates.partner_notes = null;
    } else {
      updates.assigned_at = null;
      updates.partner_response_status = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("leads")
    .update(updates)
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .single();

  if (error || !data) {
    console.error("[PATCH /api/admin/leads/id]", error);
    return NextResponse.json({ error: "Failed to update lead." }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
