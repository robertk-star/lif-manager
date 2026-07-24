import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const INVOICE_STATUSES = ["draft", "sent", "partially_paid", "paid", "void"] as const;

type LeadForInvoice = {
  id: string;
  external_reference_id: string | null;
  first_name: string | null;
  last_name: string | null;
  state: string | null;
  benefit_type: string | null;
  application_status: string | null;
  billing_amount_cents: number | null;
  billable_status: string | null;
  assigned_at: string | null;
};

function todayCode() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function toStartOfDayIso(value: string) {
  return `${value}T00:00:00.000Z`;
}

function toEndOfDayIso(value: string) {
  return `${value}T23:59:59.999Z`;
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function leadName(lead: LeadForInvoice) {
  const name = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim();
  return name || "Unnamed Lead";
}

function invoiceItemDescription(lead: LeadForInvoice) {
  const parts = [leadName(lead), lead.state, lead.benefit_type, lead.application_status]
    .filter(Boolean)
    .join(" · ");
  return parts || lead.external_reference_id || lead.id;
}

async function nextInvoiceNumber() {
  const prefix = `LIF-${todayCode()}`;
  const { count } = await supabaseAdmin
    .from("partner_billing_invoices")
    .select("id", { count: "exact", head: true })
    .ilike("invoice_number", `${prefix}-%`);
  return `${prefix}-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const partnerId = searchParams.get("partner_id")?.trim() || "";
  const status = searchParams.get("status")?.trim() || "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10) || 100, 200);

  if (status && !(INVOICE_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Allowed: ${INVOICE_STATUSES.join(", ")}.` },
      { status: 422 }
    );
  }

  let query = supabaseAdmin
    .from("partner_billing_invoices")
    .select(
      "id, created_at, partner_account_id, invoice_number, status, period_start, period_end, " +
        "subtotal_cents, total_cents, amount_paid_cents, balance_due_cents, notes, sent_at, paid_at, " +
        "due_date, payment_instructions"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (partnerId) query = query.eq("partner_account_id", partnerId);
  if (status) query = query.eq("status", status);

  const [invoicesResult, partnersResult] = await Promise.all([
    query,
    supabaseAdmin
      .from("partner_accounts")
      .select("id, firm_name, status")
      .order("firm_name", { ascending: true }),
  ]);

  if (invoicesResult.error) {
    console.error("[GET /api/admin/invoices]", invoicesResult.error);
    return NextResponse.json({ error: "Failed to load invoices." }, { status: 500 });
  }

  if (partnersResult.error) {
    return NextResponse.json({ error: "Failed to load partners." }, { status: 500 });
  }

  const partners = (partnersResult.data ?? []) as unknown as Array<{
    id: string;
    firm_name: string;
    status: string;
  }>;
  const partnerMap = new Map(partners.map((p) => [p.id, p]));

  const invoices = ((invoicesResult.data ?? []) as unknown as Array<Record<string, unknown>>).map(
    (invoice) => ({
      ...invoice,
      partner_firm_name:
        partnerMap.get(String(invoice.partner_account_id))?.firm_name ?? "Unknown partner",
    })
  );

  return NextResponse.json({
    success: true,
    data: { invoices, partners, allowed_statuses: INVOICE_STATUSES },
  });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const partnerId = String(body.partner_account_id ?? "").trim();
  const periodStart = String(body.period_start ?? "").trim();
  const periodEnd = String(body.period_end ?? "").trim();
  const notes = String(body.notes ?? "").trim();

  if (!partnerId || !periodStart || !periodEnd) {
    return NextResponse.json(
      { error: "partner_account_id, period_start, and period_end are required." },
      { status: 422 }
    );
  }

  if (periodEnd < periodStart) {
    return NextResponse.json({ error: "Period end must be on or after period start." }, { status: 422 });
  }

  const { data: partner, error: partnerError } = await supabaseAdmin
    .from("partner_accounts")
    .select("id, firm_name")
    .eq("id", partnerId)
    .single();

  if (partnerError || !partner) {
    return NextResponse.json({ error: "Partner account not found." }, { status: 404 });
  }

  const { data: leadRows, error: leadsError } = await supabaseAdmin
    .from("leads")
    .select(
      "id, external_reference_id, first_name, last_name, state, benefit_type, application_status, " +
        "billing_amount_cents, billable_status, assigned_at"
    )
    .eq("assigned_partner_account_id", partnerId)
    .eq("billable_status", "billable")
    .gte("assigned_at", toStartOfDayIso(periodStart))
    .lte("assigned_at", toEndOfDayIso(periodEnd))
    .order("assigned_at", { ascending: true });

  if (leadsError) {
    console.error("[POST /api/admin/invoices] leads", leadsError);
    return NextResponse.json({ error: "Failed to load billable leads." }, { status: 500 });
  }

  const leads = (leadRows ?? []) as unknown as LeadForInvoice[];
  if (leads.length === 0) {
    return NextResponse.json(
      { error: "No billable leads found for this partner and period." },
      { status: 422 }
    );
  }

  const totalCents = leads.reduce((sum, lead) => sum + (lead.billing_amount_cents ?? 0), 0);
  const invoiceNumber = await nextInvoiceNumber();

  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from("partner_billing_invoices")
    .insert({
      partner_account_id: partnerId,
      invoice_number: invoiceNumber,
      status: "draft",
      period_start: periodStart,
      period_end: periodEnd,
      subtotal_cents: totalCents,
      total_cents: totalCents,
      amount_paid_cents: 0,
      balance_due_cents: totalCents,
      notes: notes || null,
      due_date: addDays(periodEnd, 30),
      created_by: "admin",
    })
    .select("*")
    .single();

  if (invoiceError || !invoice) {
    console.error("[POST /api/admin/invoices] invoice", invoiceError);
    return NextResponse.json({ error: "Failed to create invoice draft." }, { status: 500 });
  }

  const items = leads.map((lead) => ({
    invoice_id: (invoice as { id: string }).id,
    lead_id: lead.id,
    description: invoiceItemDescription(lead),
    amount_cents: lead.billing_amount_cents ?? 0,
    billing_status_at_creation: lead.billable_status,
  }));

  const { error: itemsError } = await supabaseAdmin
    .from("partner_billing_invoice_items")
    .insert(items);

  if (itemsError) {
    console.error("[POST /api/admin/invoices] items", itemsError);
    await supabaseAdmin
      .from("partner_billing_invoices")
      .delete()
      .eq("id", (invoice as { id: string }).id);
    return NextResponse.json({ error: "Failed to create invoice items." }, { status: 500 });
  }

  await supabaseAdmin.from("partner_billing_invoice_events").insert({
    invoice_id: (invoice as { id: string }).id,
    event_type: "created",
    next_status: "draft",
    amount_cents: totalCents,
    notes: `Draft created with ${items.length} billable lead${items.length === 1 ? "" : "s"}.`,
    created_by: "admin",
  });

  return NextResponse.json(
    {
      success: true,
      data: {
        ...invoice,
        partner_firm_name: (partner as { firm_name: string }).firm_name,
        item_count: items.length,
      },
    },
    { status: 201 }
  );
}
