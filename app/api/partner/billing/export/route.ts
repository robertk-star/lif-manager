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

interface ExportLeadRow {
  id: string;
  external_reference_id: string | null;
  first_name: string | null;
  last_name: string | null;
  state: string | null;
  benefit_type: string | null;
  application_status: string | null;
  assigned_at: string | null;
  partner_response_status: string | null;
  billable_status: BillingStatus | null;
  billing_amount_cents: number | null;
  billing_notes: string | null;
  billing_reviewed_at: string | null;
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

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function claimantName(lead: ExportLeadRow) {
  return `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || "Unnamed Lead";
}

function dollars(cents: number | null | undefined) {
  return ((typeof cents === "number" ? cents : 0) / 100).toFixed(2);
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
      { error: `Invalid billing status '${invalidStatus}'.` },
      { status: 422 }
    );
  }

  let query = supabaseAdmin
    .from("leads")
    .select(
      "id, external_reference_id, first_name, last_name, state, benefit_type, application_status, " +
        "assigned_at, partner_response_status, billable_status, billing_amount_cents, billing_notes, billing_reviewed_at"
    )
    .eq("assigned_partner_account_id", session.partnerAccountId)
    .gte("assigned_at", toStartOfDayIso(from))
    .lte("assigned_at", toEndOfDayIso(to))
    .order("assigned_at", { ascending: true });

  if (statuses.length > 0) query = query.in("billable_status", statuses);

  const { data, error } = await query;

  if (error) {
    console.error("[GET /api/partner/billing/export] Export error:", error);
    return NextResponse.json({ error: "Failed to export billing statement." }, { status: 500 });
  }

  const leads = (data ?? []) as unknown as ExportLeadRow[];
  const header = [
    "Period Start",
    "Period End",
    "Lead ID",
    "External Reference",
    "Claimant Name",
    "State",
    "Benefit Type",
    "Application Status",
    "Assigned Date",
    "Partner Response",
    "Billing Status",
    "Billing Amount",
    "Billing Reviewed At",
    "Billing Notes",
  ];

  const rows = leads.map((lead) => [
    from,
    to,
    lead.id,
    lead.external_reference_id,
    claimantName(lead),
    lead.state,
    lead.benefit_type,
    lead.application_status,
    lead.assigned_at,
    lead.partner_response_status,
    lead.billable_status ?? "not_reviewed",
    dollars(lead.billing_amount_cents),
    lead.billing_reviewed_at,
    lead.billing_notes,
  ]);

  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lif-partner-billing-${from}-to-${to}.csv"`,
    },
  });
}
