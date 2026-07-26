import { NextResponse } from "next/server";
import { getAuthenticatedPartnerSession } from "@/lib/partnerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BILLING_STATUSES = [
  "not_reviewed",
  "review_needed",
  "not_billable",
  "billable",
  "invoiced",
  "waived",
  "disputed",
] as const;

type BillingStatus = (typeof BILLING_STATUSES)[number];

interface PartnerBillingLeadRow {
  id: string;
  created_at: string;
  external_reference_id: string | null;
  first_name: string | null;
  last_name: string | null;
  state: string | null;
  benefit_type: string | null;
  application_status: string | null;
  assigned_at: string | null;
  partner_response_status: string | null;
  partner_response_updated_at: string | null;
  billable_status: BillingStatus | null;
  billing_amount_cents: number | null;
  billing_notes: string | null;
  billing_reviewed_at: string | null;
  billing_updated_at: string | null;
}

function monthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

function today(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function toStartOfDayIso(value: string | null) {
  return `${value || monthStart()}T00:00:00.000Z`;
}

function toEndOfDayIso(value: string | null) {
  return `${value || today()}T23:59:59.999Z`;
}

function leadName(lead: PartnerBillingLeadRow) {
  const name = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim();
  return name || "Unnamed Lead";
}

function centsToDollars(cents: number | null | undefined) {
  return typeof cents === "number" ? cents / 100 : 0;
}

function summarize(leads: PartnerBillingLeadRow[]) {
  const statusCounts: Record<string, number> = {};
  let billableAmountCents = 0;
  let invoicedAmountCents = 0;
  let reviewNeededCount = 0;
  let disputedCount = 0;
  let billableCount = 0;
  let invoicedCount = 0;

  for (const lead of leads) {
    const status = lead.billable_status ?? "not_reviewed";
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;

    if (status === "billable") {
      billableCount += 1;
      billableAmountCents += lead.billing_amount_cents ?? 0;
    }
    if (status === "invoiced") {
      invoicedCount += 1;
      invoicedAmountCents += lead.billing_amount_cents ?? 0;
    }
    if (status === "review_needed") reviewNeededCount += 1;
    if (status === "disputed") disputedCount += 1;
  }

  return {
    total_leads: leads.length,
    billable_count: billableCount,
    billable_amount_dollars: centsToDollars(billableAmountCents),
    invoiced_count: invoicedCount,
    invoiced_amount_dollars: centsToDollars(invoicedAmountCents),
    review_needed_count: reviewNeededCount,
    disputed_count: disputedCount,
    status_counts: statusCounts,
  };
}

export async function GET(request: Request) {
  const session = await getAuthenticatedPartnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || monthStart();
  const to = searchParams.get("to") || today();
  const statuses = (searchParams.get("billing_statuses") || "billable,invoiced,review_needed,disputed")
    .split(",")
    .map((status) => status.trim())
    .filter(Boolean);

  const invalidStatus = statuses.find(
    (status) => !BILLING_STATUSES.includes(status as BillingStatus)
  );
  if (invalidStatus) {
    return NextResponse.json(
      {
        error: `Invalid billing status '${invalidStatus}'. Allowed values: ${BILLING_STATUSES.join(", ")}.`,
      },
      { status: 422 }
    );
  }

  let query = supabaseAdmin
    .from("leads")
    .select(
      "id, created_at, external_reference_id, first_name, last_name, state, benefit_type, " +
        "application_status, assigned_at, partner_response_status, partner_response_updated_at, " +
        "billable_status, billing_amount_cents, billing_notes, billing_reviewed_at, billing_updated_at"
    )
    .eq("assigned_partner_account_id", session.partnerAccountId)
    .gte("assigned_at", toStartOfDayIso(from))
    .lte("assigned_at", toEndOfDayIso(to))
    .order("assigned_at", { ascending: false });

  if (statuses.length > 0) query = query.in("billable_status", statuses);

  const [{ data: leadsData, error: leadsError }, { data: partnerData, error: partnerError }] =
    await Promise.all([
      query,
      supabaseAdmin
        .from("partner_accounts")
        .select("id, firm_name, status")
        .eq("id", session.partnerAccountId)
        .single(),
    ]);

  if (leadsError) {
    console.error("[GET /api/partner/billing] Leads error:", leadsError);
    return NextResponse.json(
      {
        error:
          "Failed to load billing statement data. Confirm billing columns exist on leads.",
      },
      { status: 500 }
    );
  }

  if (partnerError || !partnerData) {
    return NextResponse.json({ error: "Partner account not found." }, { status: 404 });
  }

  const leads = (leadsData ?? []) as unknown as PartnerBillingLeadRow[];
  const decoratedLeads = leads.map((lead) => ({
    ...lead,
    claimant_name: leadName(lead),
    billable_status: lead.billable_status ?? "not_reviewed",
    billing_amount_dollars: centsToDollars(lead.billing_amount_cents),
  }));

  return NextResponse.json({
    success: true,
    data: {
      partner: partnerData,
      period: { from, to },
      summary: summarize(leads),
      allowed_statuses: BILLING_STATUSES,
      leads: decoratedLeads,
      note: "This is a billing statement preview only. It is not an invoice and does not process payment.",
    },
  });
}
