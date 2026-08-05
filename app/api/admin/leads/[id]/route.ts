import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendLeadAssignedNotifications } from "@/lib/emailNotifications";
import { sendPartnerLeadWebhook } from "@/lib/partnerIntegrations";

const BILLABLE_STATUSES = ["not_billable", "billable", "invoiced", "paid", "waived"] as const;

function appOrigin(request: Request) {
  const fromEnv = process.env.LIF_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  try {
    return new URL(request.url).origin;
  } catch {
    return "https://v2.legalintakeflow.com";
  }
}

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
    billable_status?: string | null;
    billing_amount_cents?: number | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  let assignmentEvent: {
    partnerAccountId: string;
    previousPartnerAccountId: string | null;
    assignmentType: "manual" | "reassignment";
    notes: string;
  } | null = null;

  if (typeof body.status === "string") updates.status = body.status;
  if (typeof body.internal_review_notes === "string") {
    updates.internal_review_notes = body.internal_review_notes;
  }

  if (body.billable_status !== undefined) {
    const next =
      body.billable_status === null || body.billable_status === ""
        ? null
        : String(body.billable_status).trim();
    if (next !== null && !(BILLABLE_STATUSES as readonly string[]).includes(next)) {
      return NextResponse.json(
        {
          error: `Invalid billable_status. Allowed: ${BILLABLE_STATUSES.join(", ")} or empty.`,
        },
        { status: 422 }
      );
    }
    updates.billable_status = next;
  }

  if (body.billing_amount_cents !== undefined) {
    if (body.billing_amount_cents === null) {
      updates.billing_amount_cents = null;
    } else if (typeof body.billing_amount_cents === "number") {
      if (!Number.isFinite(body.billing_amount_cents) || body.billing_amount_cents < 0) {
        return NextResponse.json(
          { error: "billing_amount_cents must be a non-negative number (cents)." },
          { status: 422 }
        );
      }
      updates.billing_amount_cents = Math.round(body.billing_amount_cents);
    } else {
      return NextResponse.json(
        { error: "billing_amount_cents must be a number or null." },
        { status: 422 }
      );
    }
  }

  if (body.assigned_partner_account_id !== undefined) {
    const { data: currentLead, error: currentLeadError } = await supabaseAdmin
      .from("leads")
      .select("id, source, assigned_partner_account_id, consent_given, dbs_consent_given")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (currentLeadError || !currentLead) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }

    const currentPartnerId =
      (currentLead as { assigned_partner_account_id?: string | null }).assigned_partner_account_id ??
      null;
    const nextId = body.assigned_partner_account_id || null;
    const isDbsLead =
      (currentLead as { source?: string | null }).source === "disabilitybenefitsscreening";
    const hasDbsConsent =
      (currentLead as { dbs_consent_given?: boolean | null }).dbs_consent_given === true ||
      (currentLead as { consent_given?: boolean | null }).consent_given === true;

    updates.assigned_partner_account_id = nextId;

    if (nextId) {
      if (isDbsLead && !hasDbsConsent) {
        return NextResponse.json(
          {
            error:
              "This DBS lead cannot be assigned because consent is missing or was not preserved in LIF.",
          },
          { status: 422 }
        );
      }

      const { data: partner, error: partnerError } = await supabaseAdmin
        .from("partner_accounts")
        .select("id, status")
        .eq("id", nextId)
        .single();

      if (partnerError || !partner) {
        return NextResponse.json({ error: "Partner account not found." }, { status: 404 });
      }

      const partnerStatus = (partner as { status?: string }).status;
      if (partnerStatus !== "active" && partnerStatus !== "pending") {
        return NextResponse.json(
          { error: "Partner account must be active or pending before assignment." },
          { status: 422 }
        );
      }

      updates.status = body.status ?? "assigned";

      if (currentPartnerId !== nextId) {
        updates.assigned_at = new Date().toISOString();
        updates.partner_response_status = "new";
        updates.partner_response_updated_at = null;
        updates.partner_viewed_at = null;
        updates.partner_notes = null;
        assignmentEvent = {
          partnerAccountId: nextId,
          previousPartnerAccountId: currentPartnerId,
          assignmentType: currentPartnerId ? "reassignment" : "manual",
          notes: currentPartnerId ? "Manual admin reassignment." : "Manual admin assignment.",
        };
      }
    } else {
      updates.assigned_at = null;
      updates.partner_response_status = null;
      updates.partner_response_updated_at = null;
      updates.partner_viewed_at = null;
      updates.partner_notes = null;
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

  let notificationSummary: unknown = null;

  if (assignmentEvent) {
    const { error: eventError } = await supabaseAdmin.from("lead_assignment_events").insert({
      lead_id: id,
      partner_account_id: assignmentEvent.partnerAccountId,
      previous_partner_account_id: assignmentEvent.previousPartnerAccountId,
      assignment_type: assignmentEvent.assignmentType,
      assigned_by: "admin",
      notes: assignmentEvent.notes,
    });

    if (eventError) {
      console.error("[PATCH /api/admin/leads/id] Assignment event insert error:", eventError);
    }

    try {
      notificationSummary = await sendLeadAssignedNotifications({
        origin: appOrigin(request),
        leadId: id,
        partnerAccountId: assignmentEvent.partnerAccountId,
        assignmentType: assignmentEvent.assignmentType,
      });
    } catch (err) {
      console.error("[PATCH /api/admin/leads/id] Lead assignment email failed:", err);
      notificationSummary = {
        attempted: 0,
        sent: 0,
        skipped: 0,
        failed: 1,
        errors: [err instanceof Error ? err.message : "Email send failed."],
      };
    }

    // Best-effort webhook; must not block assignment
    try {
      await sendPartnerLeadWebhook({
        leadId: id,
        partnerAccountId: assignmentEvent.partnerAccountId,
        eventType:
          assignmentEvent.assignmentType === "reassignment" ? "lead.reassigned" : "lead.assigned",
      });
    } catch (err) {
      console.error("[PATCH /api/admin/leads/id] Partner webhook failed:", err);
    }
  }

  return NextResponse.json({
    success: true,
    data,
    notifications: notificationSummary,
  });
}
