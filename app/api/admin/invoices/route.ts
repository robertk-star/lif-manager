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

type PriorInvoice = {
  id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  total_cents: number;
  amount_paid_cents: number;
  balance_due_cents: number;
  status: string;
  notes: string | null;
};

type PriorItem = {
  lead_id: string | null;
  description: string;
  amount_cents: number;
  billing_status_at_creation: string | null;
};

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

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

/** Short sequential numbers for new invoices only (e.g. INV-0002). Existing LIF-… numbers are left unchanged. */
async function nextInvoiceNumber() {
  const { count } = await supabaseAdmin
    .from("partner_billing_invoices")
    .select("id", { count: "exact", head: true });
  return `INV-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated(request))) {
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
  if (!(await isAdminAuthenticated(request))) {
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

  // Prior unpaid invoices for this partner (sent / partially paid with remaining balance)
  const { data: priorRows, error: priorError } = await supabaseAdmin
    .from("partner_billing_invoices")
    .select(
      "id, invoice_number, period_start, period_end, total_cents, amount_paid_cents, balance_due_cents, status, notes"
    )
    .eq("partner_account_id", partnerId)
    .in("status", ["sent", "partially_paid"])
    .gt("balance_due_cents", 0)
    .order("period_start", { ascending: true });

  if (priorError) {
    console.error("[POST /api/admin/invoices] prior invoices", priorError);
    return NextResponse.json({ error: "Failed to load prior unpaid invoices." }, { status: 500 });
  }

  const priorInvoices = (priorRows ?? []) as unknown as PriorInvoice[];

  if (leads.length === 0 && priorInvoices.length === 0) {
    return NextResponse.json(
      { error: "No billable leads for this period and no prior unpaid balances." },
      { status: 422 }
    );
  }

  const periodCents = leads.reduce((sum, lead) => sum + (lead.billing_amount_cents ?? 0), 0);
  const priorBalanceCents = priorInvoices.reduce((sum, inv) => sum + (inv.balance_due_cents ?? 0), 0);
  const totalCents = periodCents + priorBalanceCents;
  const invoiceNumber = await nextInvoiceNumber();

  const priorNumbers = priorInvoices.map((p) => p.invoice_number).join(", ");
  const combinedNotes = [
    notes || null,
    priorInvoices.length > 0
      ? `Includes prior unpaid balance from ${priorNumbers} (${formatMoney(priorBalanceCents)}).`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

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
      notes: combinedNotes || null,
      due_date: addDays(periodEnd, 30),
      created_by: "admin",
    })
    .select("*")
    .single();

  if (invoiceError || !invoice) {
    console.error("[POST /api/admin/invoices] invoice", invoiceError);
    return NextResponse.json({ error: "Failed to create invoice draft." }, { status: 500 });
  }

  const newInvoiceId = (invoice as { id: string }).id;

  type ItemInsert = {
    invoice_id: string;
    lead_id: string | null;
    description: string;
    amount_cents: number;
    billing_status_at_creation: string | null;
  };

  const items: ItemInsert[] = [];

  // Current period lead charges
  for (const lead of leads) {
    items.push({
      invoice_id: newInvoiceId,
      lead_id: lead.id,
      description: invoiceItemDescription(lead),
      amount_cents: lead.billing_amount_cents ?? 0,
      billing_status_at_creation: lead.billable_status,
    });
  }

  // Prior unpaid invoice details (line items + payment credit if partial)
  for (const prior of priorInvoices) {
    const { data: priorItemRows } = await supabaseAdmin
      .from("partner_billing_invoice_items")
      .select("lead_id, description, amount_cents, billing_status_at_creation")
      .eq("invoice_id", prior.id)
      .order("created_at", { ascending: true });

    const priorItems = (priorItemRows ?? []) as unknown as PriorItem[];

    items.push({
      invoice_id: newInvoiceId,
      lead_id: null,
      description: `—— Prior invoice ${prior.invoice_number} (${prior.period_start} – ${prior.period_end}) · unpaid ${formatMoney(prior.balance_due_cents)} ——`,
      amount_cents: 0,
      billing_status_at_creation: "prior_section",
    });

    if (priorItems.length > 0) {
      for (const pi of priorItems) {
        items.push({
          invoice_id: newInvoiceId,
          lead_id: pi.lead_id,
          description: `[${prior.invoice_number}] ${pi.description}`,
          amount_cents: pi.amount_cents,
          billing_status_at_creation: pi.billing_status_at_creation ?? "prior_balance",
        });
      }
    } else {
      // No line items stored — still show the remaining balance as a single line
      items.push({
        invoice_id: newInvoiceId,
        lead_id: null,
        description: `[${prior.invoice_number}] Prior unpaid balance`,
        amount_cents: prior.balance_due_cents,
        billing_status_at_creation: "prior_balance",
      });
    }

    // If prior was partially paid, credit the amount already paid so total matches remaining balance
    if ((prior.amount_paid_cents ?? 0) > 0) {
      items.push({
        invoice_id: newInvoiceId,
        lead_id: null,
        description: `[${prior.invoice_number}] Less: payments already received`,
        amount_cents: -Math.abs(prior.amount_paid_cents),
        billing_status_at_creation: "prior_payment_credit",
      });
    }
  }

  // Reconcile: items may sum to period + full prior totals − payments = period + prior balances
  const itemsSum = items.reduce((s, i) => s + i.amount_cents, 0);
  if (itemsSum !== totalCents) {
    // Safety adjustment so invoice total matches intended balance due
    const delta = totalCents - itemsSum;
    if (delta !== 0) {
      items.push({
        invoice_id: newInvoiceId,
        lead_id: null,
        description: "Balance adjustment",
        amount_cents: delta,
        billing_status_at_creation: "adjustment",
      });
    }
  }

  const { error: itemsError } = await supabaseAdmin
    .from("partner_billing_invoice_items")
    .insert(items);

  if (itemsError) {
    console.error("[POST /api/admin/invoices] items", itemsError);
    await supabaseAdmin.from("partner_billing_invoices").delete().eq("id", newInvoiceId);
    return NextResponse.json(
      {
        error: "Failed to create invoice items.",
        details: (itemsError as { message?: string }).message ?? null,
      },
      { status: 500 }
    );
  }

  // Carry prior balances onto this invoice so they are not double-counted as outstanding
  for (const prior of priorInvoices) {
    const carriedNote = `Unpaid balance of ${formatMoney(prior.balance_due_cents)} carried forward to ${invoiceNumber}.`;
    const nextNotes = [prior.notes, carriedNote].filter(Boolean).join(" ");

    await supabaseAdmin
      .from("partner_billing_invoices")
      .update({
        balance_due_cents: 0,
        notes: nextNotes,
      })
      .eq("id", prior.id);

    await supabaseAdmin.from("partner_billing_invoice_events").insert({
      invoice_id: prior.id,
      event_type: "balance_carried_forward",
      previous_status: prior.status,
      next_status: prior.status,
      amount_cents: prior.balance_due_cents,
      notes: carriedNote,
      created_by: "admin",
    });
  }

  await supabaseAdmin.from("partner_billing_invoice_events").insert({
    invoice_id: newInvoiceId,
    event_type: "created",
    next_status: "draft",
    amount_cents: totalCents,
    notes:
      priorInvoices.length > 0
        ? `Draft created with ${leads.length} current lead${leads.length === 1 ? "" : "s"} and ${priorInvoices.length} prior unpaid invoice${priorInvoices.length === 1 ? "" : "s"} (${formatMoney(priorBalanceCents)} prior + ${formatMoney(periodCents)} current).`
        : `Draft created with ${leads.length} billable lead${leads.length === 1 ? "" : "s"}.`,
    created_by: "admin",
  });

  return NextResponse.json(
    {
      success: true,
      data: {
        ...invoice,
        partner_firm_name: (partner as { firm_name: string }).firm_name,
        item_count: items.length,
        period_lead_count: leads.length,
        period_cents: periodCents,
        prior_balance_cents: priorBalanceCents,
        prior_invoice_count: priorInvoices.length,
        prior_invoice_numbers: priorInvoices.map((p) => p.invoice_number),
      },
    },
    { status: 201 }
  );
}
