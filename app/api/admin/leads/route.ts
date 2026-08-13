import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendLeadAssignedNotifications } from "@/lib/emailNotifications";
import { sendPartnerLeadWebhook } from "@/lib/partnerIntegrations";

const BILLABLE_STATUSES = ["not_billable", "billable", "invoiced", "paid", "waived"] as const;
const LEAD_STATUSES = [
  "new",
  "reviewing",
  "ready_to_assign",
  "assigned",
  "closed",
  "rejected",
  "spam",
] as const;

function appOrigin(request: Request) {
  const fromEnv = process.env.LIF_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  try {
    return new URL(request.url).origin;
  } catch {
    return "https://v2.legalintakeflow.com";
  }
}

function str(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s.length > 0 ? s : null;
}

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const stateFilter = searchParams.get("state")?.trim().toUpperCase() ?? "";
  const statusFilter = searchParams.get("status")?.trim() ?? "";
  const assignedFilter = searchParams.get("assigned")?.trim() ?? "";
  const billableFilter = searchParams.get("billable_status")?.trim() ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 200);

  let query = supabaseAdmin
    .from("leads")
    .select(
      "id, created_at, source, external_reference_id, dbs_report_number, dbs_consent_given, " +
        "first_name, last_name, phone, email, city, state, zip, benefit_type, application_status, " +
        "status, assigned_partner_account_id, assigned_at, partner_response_status, " +
        "billable_status, billing_amount_cents, caller_id"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,` +
        `email.ilike.%${search}%,phone.ilike.%${search}%,` +
        `external_reference_id.ilike.%${search}%,dbs_report_number.ilike.%${search}%`
    );
  }

  if (stateFilter) query = query.eq("state", stateFilter);
  if (statusFilter) query = query.eq("status", statusFilter);
  if (billableFilter) query = query.eq("billable_status", billableFilter);

  if (assignedFilter === "true") {
    query = query.not("assigned_partner_account_id", "is", null);
  } else if (assignedFilter === "false") {
    query = query.is("assigned_partner_account_id", null);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[GET /api/admin/leads]", error);
    return NextResponse.json({ error: "Failed to fetch leads." }, { status: 500 });
  }

  const leads = (data ?? []) as unknown as Array<Record<string, unknown>>;
  const partnerIds = Array.from(
    new Set(
      leads
        .map((l) => l.assigned_partner_account_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );

  const partnerNames = new Map<string, string>();
  if (partnerIds.length > 0) {
    const { data: partners } = await supabaseAdmin
      .from("partner_accounts")
      .select("id, firm_name")
      .in("id", partnerIds);

    for (const p of (partners ?? []) as unknown as Array<{ id: string; firm_name: string }>) {
      partnerNames.set(p.id, p.firm_name);
    }
  }

  const enriched = leads.map((lead) => ({
    ...lead,
    assigned_partner_name:
      typeof lead.assigned_partner_account_id === "string"
        ? partnerNames.get(lead.assigned_partner_account_id) ?? null
        : null,
  }));

  return NextResponse.json({ success: true, data: enriched });
}

/** Create a manual lead from Admin. */
export async function POST(request: Request) {
  if (!(await isAdminAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const firstName = str(body.first_name);
  const lastName = str(body.last_name);
  const phone = str(body.phone);
  const email = str(body.email)?.toLowerCase() ?? null;
  const city = str(body.city);
  const stateRaw = str(body.state);
  const state = stateRaw ? stateRaw.toUpperCase() : null;
  const zip = str(body.zip);
  const benefitType = str(body.benefit_type);
  const applicationStatus = str(body.application_status);
  const medicalSummary = str(body.medical_summary);
  const additionalNotes = str(body.additional_notes);
  const internalNotes = str(body.internal_review_notes);
  const externalRef =
    str(body.external_reference_id) ?? `manual:${crypto.randomUUID()}`;

  if (!firstName && !lastName && !phone && !email) {
    return NextResponse.json(
      { error: "Provide at least a name, phone, or email." },
      { status: 422 }
    );
  }

  if (state && !/^[A-Z]{2}$/.test(state)) {
    return NextResponse.json(
      { error: "State must be a 2-letter code (e.g. TX)." },
      { status: 422 }
    );
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email is invalid." }, { status: 422 });
  }

  let status = str(body.status) ?? "new";
  if (!(LEAD_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Allowed: ${LEAD_STATUSES.join(", ")}.` },
      { status: 422 }
    );
  }

  let billableStatus: string | null = null;
  if (body.billable_status !== undefined && body.billable_status !== null && body.billable_status !== "") {
    billableStatus = String(body.billable_status).trim();
    if (!(BILLABLE_STATUSES as readonly string[]).includes(billableStatus)) {
      return NextResponse.json(
        { error: `Invalid billable_status. Allowed: ${BILLABLE_STATUSES.join(", ")}.` },
        { status: 422 }
      );
    }
  }

  let billingAmountCents: number | null = null;
  if (body.billing_amount_cents !== undefined && body.billing_amount_cents !== null) {
    if (typeof body.billing_amount_cents !== "number" || !Number.isFinite(body.billing_amount_cents)) {
      return NextResponse.json(
        { error: "billing_amount_cents must be a number (cents)." },
        { status: 422 }
      );
    }
    if (body.billing_amount_cents < 0) {
      return NextResponse.json(
        { error: "billing_amount_cents must be non-negative." },
        { status: 422 }
      );
    }
    billingAmountCents = Math.round(body.billing_amount_cents);
  }

  const assignedPartnerId = str(body.assigned_partner_account_id);
  let assignmentFields: Record<string, unknown> = {
    assigned_partner_account_id: null,
    assigned_at: null,
    partner_response_status: null,
  };

  if (assignedPartnerId) {
    const { data: partner, error: partnerError } = await supabaseAdmin
      .from("partner_accounts")
      .select("id, status, firm_name")
      .eq("id", assignedPartnerId)
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

    status = status === "new" ? "assigned" : status;
    assignmentFields = {
      assigned_partner_account_id: assignedPartnerId,
      assigned_at: new Date().toISOString(),
      partner_response_status: "new",
      partner_response_updated_at: null,
      partner_viewed_at: null,
      partner_notes: null,
    };
  }

  const insertRow: Record<string, unknown> = {
    source: "manual",
    external_reference_id: externalRef,
    first_name: firstName,
    last_name: lastName,
    phone,
    email,
    city,
    state,
    zip,
    benefit_type: benefitType,
    application_status: applicationStatus,
    medical_summary: medicalSummary,
    additional_notes: additionalNotes,
    internal_review_notes: internalNotes,
    status,
    consent_given: true,
    billable_status: billableStatus,
    billing_amount_cents: billingAmountCents,
    ...assignmentFields,
  };

  const { data, error } = await supabaseAdmin
    .from("leads")
    .insert(insertRow)
    .select("*")
    .single();

  if (error || !data) {
    console.error("[POST /api/admin/leads]", error);
    if ((error as { code?: string } | null)?.code === "23505") {
      return NextResponse.json(
        { error: "A lead with this external reference already exists." },
        { status: 409 }
      );
    }
    const errObj = error as { message?: string; code?: string; details?: string; hint?: string } | null;
    return NextResponse.json(
      {
        error: "Failed to create lead.",
        details: errObj?.message ?? null,
        code: errObj?.code ?? null,
        hint: errObj?.hint ?? null,
        dbDetails: errObj?.details ?? null,
      },
      { status: 500 }
    );
  }

  const lead = data as { id: string; assigned_partner_account_id?: string | null };
  let notificationSummary: unknown = null;

  if (assignedPartnerId) {
    const { error: eventError } = await supabaseAdmin.from("lead_assignment_events").insert({
      lead_id: lead.id,
      partner_account_id: assignedPartnerId,
      previous_partner_account_id: null,
      assignment_type: "manual",
      assigned_by: "admin",
      notes: "Manual lead created and assigned by admin.",
    });

    if (eventError) {
      console.error("[POST /api/admin/leads] Assignment event insert error:", eventError);
    }

    try {
      notificationSummary = await sendLeadAssignedNotifications({
        origin: appOrigin(request),
        leadId: lead.id,
        partnerAccountId: assignedPartnerId,
        assignmentType: "manual",
      });
    } catch (err) {
      console.error("[POST /api/admin/leads] Lead assignment email failed:", err);
      notificationSummary = {
        attempted: 0,
        sent: 0,
        skipped: 0,
        failed: 1,
        errors: [err instanceof Error ? err.message : "Email send failed."],
      };
    }

    try {
      await sendPartnerLeadWebhook({
        leadId: lead.id,
        partnerAccountId: assignedPartnerId,
        eventType: "lead.assigned",
      });
    } catch (err) {
      console.error("[POST /api/admin/leads] Partner webhook failed:", err);
    }
  }

  let assignedPartnerName: string | null = null;
  if (assignedPartnerId) {
    const { data: partner } = await supabaseAdmin
      .from("partner_accounts")
      .select("firm_name")
      .eq("id", assignedPartnerId)
      .maybeSingle();
    assignedPartnerName = (partner as { firm_name?: string } | null)?.firm_name ?? null;
  }

  return NextResponse.json(
    {
      success: true,
      data: { ...data, assigned_partner_name: assignedPartnerName },
      notifications: notificationSummary,
    },
    { status: 201 }
  );
}
