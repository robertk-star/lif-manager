import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const VALID_STATUSES = ["active", "inactive", "pending", "suspended"] as const;
const VALID_LEAD_STATUSES = ["active", "paused", "at_capacity"] as const;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;

  const { data, error } = await supabaseAdmin
    .from("partner_accounts")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Partner not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, data });
}

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

  if ("status" in body) {
    const status = typeof body.status === "string" ? body.status.trim() : "";
    if (!(VALID_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed: ${VALID_STATUSES.join(", ")}.` },
        { status: 422 }
      );
    }
    updates.status = status;
  }

  if ("lead_status" in body) {
    const leadStatus =
      body.lead_status === null || body.lead_status === ""
        ? null
        : typeof body.lead_status === "string"
          ? body.lead_status.trim()
          : null;
    if (leadStatus && !(VALID_LEAD_STATUSES as readonly string[]).includes(leadStatus)) {
      return NextResponse.json(
        { error: `Invalid lead_status. Allowed: ${VALID_LEAD_STATUSES.join(", ")}.` },
        { status: 422 }
      );
    }
    updates.lead_status = leadStatus;
  }

  if ("accepting_leads" in body) {
    updates.accepting_leads = Boolean(body.accepting_leads);
  }

  if ("internal_notes" in body) {
    updates.internal_notes =
      typeof body.internal_notes === "string" ? body.internal_notes.trim() || null : null;
  }

  if ("monthly_lead_capacity" in body) {
    updates.monthly_lead_capacity =
      typeof body.monthly_lead_capacity === "string"
        ? body.monthly_lead_capacity.trim() || null
        : null;
  }

  if ("states_served" in body) {
    updates.states_served =
      typeof body.states_served === "string" ? body.states_served.trim() || null : null;
  }

  if ("routing_scope" in body) {
    const scope =
      body.routing_scope === "united_states" ? "united_states" : "selected_states";
    updates.routing_scope = scope;
  }

  if ("routing_states" in body) {
    if (Array.isArray(body.routing_states)) {
      updates.routing_states = body.routing_states
        .map((s) => String(s).trim().toUpperCase())
        .filter((s) => /^[A-Z]{2}$/.test(s));
    } else if (body.routing_states === null) {
      updates.routing_states = null;
    }
  }

  if ("routing_excluded_states" in body) {
    if (Array.isArray(body.routing_excluded_states)) {
      updates.routing_excluded_states = body.routing_excluded_states
        .map((s) => String(s).trim().toUpperCase())
        .filter((s) => /^[A-Z]{2}$/.test(s));
    } else if (body.routing_excluded_states === null) {
      updates.routing_excluded_states = null;
    }
  }

  if ("accepts_initial_filings" in body) {
    updates.accepts_initial_filings = Boolean(body.accepts_initial_filings);
  }
  if ("accepts_appeals" in body) {
    updates.accepts_appeals = Boolean(body.accepts_appeals);
  }
  if ("accepts_hearings" in body) {
    updates.accepts_hearings = Boolean(body.accepts_hearings);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields provided." }, { status: 422 });
  }

  const { data, error } = await supabaseAdmin
    .from("partner_accounts")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("[PATCH /api/admin/partners/id]", error);
    return NextResponse.json({ error: "Failed to update partner." }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
