import { NextResponse } from "next/server";
import { getAuthenticatedPartnerSession } from "@/lib/partnerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface LeadReportRow {
  id: string;
  created_at: string;
  assigned_at: string | null;
  partner_response_status: string | null;
  partner_viewed_at: string | null;
  partner_response_updated_at: string | null;
  state: string | null;
  benefit_type: string | null;
  application_status: string | null;
  billable_status: string | null;
  billing_amount_cents: number | null;
}

interface InvoiceReportRow {
  id: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  paid_at: string | null;
  due_date: string | null;
  total_cents: number | null;
  amount_paid_cents: number | null;
  balance_due_cents: number | null;
}

interface DisputeReportRow {
  id: string;
  status: string;
  created_at: string;
}

const PARTNER_RESPONSE_STATUSES = [
  "new",
  "reviewing",
  "contact_attempted",
  "contacted",
  "accepted",
  "declined",
  "retained",
  "closed",
] as const;

const BILLING_STATUSES = [
  "not_reviewed",
  "review_needed",
  "not_billable",
  "billable",
  "invoiced",
  "waived",
  "disputed",
] as const;

function defaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() - 90);
  return date.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toStartOfDayIso(value: string | null) {
  return `${value || defaultStartDate()}T00:00:00.000Z`;
}

function toEndOfDayIso(value: string | null) {
  return `${value || today()}T23:59:59.999Z`;
}

function normalizeStatus(value: string | null | undefined) {
  return value || "new";
}

function centsToDollars(cents: number | null | undefined) {
  return typeof cents === "number" ? cents / 100 : 0;
}

function diffHours(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return null;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  return (endMs - startMs) / (1000 * 60 * 60);
}

function average(values: Array<number | null>) {
  const valid = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function increment(map: Record<string, number>, key: string | null | undefined) {
  const normalized = key && key.trim() ? key.trim() : "Unspecified";
  map[normalized] = (map[normalized] ?? 0) + 1;
}

function mapToRows(map: Record<string, number>) {
  return Object.entries(map)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function monthKey(value: string | null | undefined) {
  if (!value) return "Unspecified";
  return value.slice(0, 7);
}

export async function GET(request: Request) {
  const session = await getAuthenticatedPartnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || defaultStartDate();
  const to = searchParams.get("to") || today();
  const fromIso = toStartOfDayIso(from);
  const toIso = toEndOfDayIso(to);

  const leadsQuery = supabaseAdmin
    .from("leads")
    .select(
      "id, created_at, assigned_at, partner_response_status, partner_viewed_at, " +
        "partner_response_updated_at, state, benefit_type, application_status, " +
        "billable_status, billing_amount_cents"
    )
    .eq("assigned_partner_account_id", session.partnerAccountId)
    .gte("assigned_at", fromIso)
    .lte("assigned_at", toIso)
    .order("assigned_at", { ascending: false });

  const invoicesQuery = supabaseAdmin
    .from("partner_billing_invoices")
    .select(
      "id, status, created_at, sent_at, paid_at, due_date, total_cents, amount_paid_cents, balance_due_cents"
    )
    .eq("partner_account_id", session.partnerAccountId)
    .gte("created_at", fromIso)
    .lte("created_at", toIso)
    .order("created_at", { ascending: false });

  const disputesQuery = supabaseAdmin
    .from("partner_billing_disputes")
    .select("id, status, created_at")
    .eq("partner_account_id", session.partnerAccountId)
    .gte("created_at", fromIso)
    .lte("created_at", toIso)
    .order("created_at", { ascending: false });

  const [leadsResult, invoicesResult, disputesResult] = await Promise.all([
    leadsQuery,
    invoicesQuery,
    disputesQuery,
  ]);

  if (leadsResult.error) {
    console.error("[GET /api/partner/reports] Lead report error:", leadsResult.error);
    return NextResponse.json({ error: "Failed to load partner lead report data." }, { status: 500 });
  }

  const warnings: string[] = [];
  if (invoicesResult.error)
    warnings.push("Invoice report data is unavailable. Confirm billing invoice SQL has been run.");
  if (disputesResult.error)
    warnings.push("Dispute report data is unavailable. Confirm invoice dispute SQL has been run.");

  const leads = (leadsResult.data ?? []) as unknown as LeadReportRow[];
  const invoices = (invoicesResult.data ?? []) as unknown as InvoiceReportRow[];
  const disputes = (disputesResult.data ?? []) as unknown as DisputeReportRow[];

  const responseCounts: Record<string, number> = {};
  for (const status of PARTNER_RESPONSE_STATUSES) responseCounts[status] = 0;

  const stateCounts: Record<string, number> = {};
  const benefitCounts: Record<string, number> = {};
  const applicationCounts: Record<string, number> = {};
  const billingCounts: Record<string, number> = {};
  for (const status of BILLING_STATUSES) billingCounts[status] = 0;

  const monthlyTrend: Record<
    string,
    { assigned: number; contacted: number; accepted: number; retained: number; declined: number }
  > = {};

  let contactedCount = 0;
  let acceptedCount = 0;
  let declinedCount = 0;
  let retainedCount = 0;
  let closedCount = 0;
  let notViewedCount = 0;
  let totalBillableCents = 0;
  let totalInvoicedCents = 0;

  for (const lead of leads) {
    const status = normalizeStatus(lead.partner_response_status);
    responseCounts[status] = (responseCounts[status] ?? 0) + 1;
    increment(stateCounts, lead.state);
    increment(benefitCounts, lead.benefit_type);
    increment(applicationCounts, lead.application_status);
    const billingStatus = lead.billable_status || "not_reviewed";
    billingCounts[billingStatus] = (billingCounts[billingStatus] ?? 0) + 1;

    if (!lead.partner_viewed_at) notViewedCount += 1;
    if (status === "contact_attempted" || status === "contacted") contactedCount += 1;
    if (status === "accepted") acceptedCount += 1;
    if (status === "declined") declinedCount += 1;
    if (status === "retained") retainedCount += 1;
    if (status === "closed") closedCount += 1;
    if (billingStatus === "billable") totalBillableCents += lead.billing_amount_cents ?? 0;
    if (billingStatus === "invoiced") totalInvoicedCents += lead.billing_amount_cents ?? 0;

    const key = monthKey(lead.assigned_at ?? lead.created_at);
    monthlyTrend[key] ??= { assigned: 0, contacted: 0, accepted: 0, retained: 0, declined: 0 };
    monthlyTrend[key].assigned += 1;
    if (status === "contact_attempted" || status === "contacted") monthlyTrend[key].contacted += 1;
    if (status === "accepted") monthlyTrend[key].accepted += 1;
    if (status === "retained") monthlyTrend[key].retained += 1;
    if (status === "declined") monthlyTrend[key].declined += 1;
  }

  const avgHoursToView = average(
    leads.map((lead) => diffHours(lead.assigned_at ?? lead.created_at, lead.partner_viewed_at))
  );
  const avgHoursToRespond = average(
    leads.map((lead) =>
      diffHours(lead.assigned_at ?? lead.created_at, lead.partner_response_updated_at)
    )
  );

  let invoiceTotalCents = 0;
  let invoicePaidCents = 0;
  let invoiceBalanceCents = 0;
  let openInvoiceCount = 0;
  let overdueInvoiceCount = 0;
  const now = new Date();
  const invoiceStatusCounts: Record<string, number> = {};

  for (const invoice of invoices) {
    invoiceStatusCounts[invoice.status] = (invoiceStatusCounts[invoice.status] ?? 0) + 1;
    invoiceTotalCents += invoice.total_cents ?? 0;
    invoicePaidCents += invoice.amount_paid_cents ?? 0;
    invoiceBalanceCents += invoice.balance_due_cents ?? 0;
    if (invoice.status === "sent" || invoice.status === "partially_paid") openInvoiceCount += 1;
    if (
      (invoice.status === "sent" || invoice.status === "partially_paid") &&
      invoice.due_date &&
      new Date(invoice.due_date).getTime() < now.getTime() &&
      (invoice.balance_due_cents ?? 0) > 0
    ) {
      overdueInvoiceCount += 1;
    }
  }

  const disputeStatusCounts: Record<string, number> = {};
  for (const dispute of disputes) {
    disputeStatusCounts[dispute.status] = (disputeStatusCounts[dispute.status] ?? 0) + 1;
  }

  return NextResponse.json({
    success: true,
    warnings,
    period: { from, to },
    lead_summary: {
      total_assigned: leads.length,
      new_count: responseCounts.new ?? 0,
      contacted_count: contactedCount,
      accepted_count: acceptedCount,
      declined_count: declinedCount,
      retained_count: retainedCount,
      closed_count: closedCount,
      not_viewed_count: notViewedCount,
      average_hours_to_view: avgHoursToView,
      average_hours_to_first_response: avgHoursToRespond,
      contact_rate: leads.length > 0 ? contactedCount / leads.length : 0,
      retention_rate: leads.length > 0 ? retainedCount / leads.length : 0,
    },
    breakdowns: {
      response_statuses: mapToRows(responseCounts),
      states: mapToRows(stateCounts).slice(0, 12),
      benefit_types: mapToRows(benefitCounts),
      application_statuses: mapToRows(applicationCounts),
      billing_statuses: mapToRows(billingCounts),
      invoice_statuses: mapToRows(invoiceStatusCounts),
      dispute_statuses: mapToRows(disputeStatusCounts),
    },
    billing_summary: {
      billable_amount_dollars: centsToDollars(totalBillableCents),
      invoiced_amount_dollars: centsToDollars(totalInvoicedCents),
      invoice_total_dollars: centsToDollars(invoiceTotalCents),
      invoice_paid_dollars: centsToDollars(invoicePaidCents),
      invoice_balance_dollars: centsToDollars(invoiceBalanceCents),
      open_invoice_count: openInvoiceCount,
      overdue_invoice_count: overdueInvoiceCount,
      open_dispute_count: disputes.filter(
        (dispute) => dispute.status === "open" || dispute.status === "in_review"
      ).length,
    },
    monthly_trend: Object.entries(monthlyTrend)
      .map(([month, values]) => ({ month, ...values }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  });
}
