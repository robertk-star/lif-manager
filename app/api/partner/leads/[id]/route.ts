import { NextResponse } from "next/server";
import { getAuthenticatedPartnerSession } from "@/lib/partnerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const VALID_STATUSES = [
  "new",
  "reviewing",
  "contact_attempted",
  "contacted",
  "accepted",
  "declined",
  "retained",
  "closed",
] as const;

const DETAIL_SELECT =
  "id, created_at, updated_at, source, external_reference_id, " +
  "first_name, last_name, phone, email, city, state, zip, " +
  "benefit_type, application_status, medical_summary, additional_notes, " +
  "status, assigned_partner_account_id, assigned_at, " +
  "partner_response_status, partner_response_updated_at, partner_viewed_at, partner_notes";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getAuthenticatedPartnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;

  const { data, error } = await supabaseAdmin
    .from("leads")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .eq("assigned_partner_account_id", session.partnerAccountId)
    .is("deleted_at", null)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  let responseData = data;
  if (!(data as { partner_viewed_at?: string | null }).partner_viewed_at) {
    const { data: updated } = await supabaseAdmin
      .from("leads")
      .update({ partner_viewed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("assigned_partner_account_id", session.partnerAccountId)
      .select(DETAIL_SELECT)
      .single();
    if (updated) responseData = updated;
  }

  return NextResponse.json({ success: true, data: responseData });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getAuthenticatedPartnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (session.role === "viewer") {
    return NextResponse.json(
      { error: "Viewer users cannot update leads." },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if ("partner_response_status" in body) {
    const status = String(body.partner_response_status ?? "").trim();
    if (!(VALID_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 422 });
    }
    updates.partner_response_status = status;
    updates.partner_response_updated_at = new Date().toISOString();
  }

  if ("partner_notes" in body) {
    const notes = String(body.partner_notes ?? "").trim();
    updates.partner_notes = notes || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields." }, { status: 422 });
  }

  const { data, error } = await supabaseAdmin
    .from("leads")
    .update(updates)
    .eq("id", id)
    .eq("assigned_partner_account_id", session.partnerAccountId)
    .is("deleted_at", null)
    .select(DETAIL_SELECT)
    .single();

  if (error || !data) {
    console.error("[PATCH /api/partner/leads/id]", error);
    return NextResponse.json({ error: "Failed to update lead." }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
