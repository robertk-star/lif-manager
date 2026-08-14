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
    return NextResponse.json(
      {
        error: "Failed to create invoice draft.",
        details: (invoiceError as { message?: string } | null)?.message ?? null,
      },
      { status: 500 }
    );
  }

  const newInvoiceId = (invoice as { id: string }).id;

  // Build items carefully: lead_id required when possible, positive amounts only, safe billing_status
  type ItemInsert = {
    invoice_id: string;
    lead_id?: string;
    description: string;
    amount_cents: number;
    billing_status_at_creation: string;
  };

  const items: ItemInsert[] = [];

  for (const lead of leads) {
    items.push({
      invoice_id: newInvoiceId,
      lead_id: lead.id,
      description: invoiceItemDescription(lead),
      amount_cents: lead.billing_amount_cents ?? 0,
      billing_status_at_creation: "billable",
    });
  }

  for (const prior of priorInvoices) {
    const { data: priorItemRows } = await supabaseAdmin
      .from("partner_billing_invoice_items")
      .select("lead_id, description, amount_cents, billing_status_at_creation")
      .eq("invoice_id", prior.id)
      .order("created_at", { ascending: true });

    const priorItems = (priorItemRows ?? []) as unknown as PriorItem[];
    const paid = prior.amount_paid_cents ?? 0;
    const fullyUnpaid = paid <= 0;

    if (fullyUnpaid && priorItems.length > 0) {
      // Copy each prior line item with original lead_id so details appear on the new invoice
      for (const pi of priorItems) {
        const row: ItemInsert = {
          invoice_id: newInvoiceId,
          description: `[${prior.invoice_number}] ${pi.description}`,
          amount_cents: Math.max(0, pi.amount_cents),
          billing_status_at_creation: "billable",
        };
        if (pi.lead_id) row.lead_id = pi.lead_id;
        items.push(row);
      }
    } else {
      // Partial payment or no stored items: one line for remaining balance with detail in description
      const detailParts = priorItems.map((pi) => pi.description).filter(Boolean);
      const detail =
        detailParts.length > 0
          ? ` · ${detailParts.slice(0, 8).join("; ")}${detailParts.length > 8 ? "…" : ""}`
          : "";
      const row: ItemInsert = {
        invoice_id: newInvoiceId,
        description: `Prior unpaid ${prior.invoice_number} (${prior.period_start} – ${prior.period_end})${detail}`,
        amount_cents: prior.balance_due_cents,
        billing_status_at_creation: "billable",
      };
      const anchorLeadId =
        priorItems.find((pi) => pi.lead_id)?.lead_id ?? leads[0]?.id ?? null;
      if (anchorLeadId) row.lead_id = anchorLeadId;
      items.push(row);
    }
  }

  // Drop zero-amount rows (can violate checks) except we already avoid them
  const insertItems = items.filter((i) => i.amount_cents !== 0 || leads.length === 0);

  // Ensure sum matches intended total (period + prior balances)
  const itemsSum = insertItems.reduce((s, i) => s + i.amount_cents, 0);
  if (itemsSum !== totalCents && totalCents > 0) {
    const delta = totalCents - itemsSum;
    if (delta > 0) {
      const adj: ItemInsert = {
        invoice_id: newInvoiceId,
        description: "Prior balance reconciliation",
        amount_cents: delta,
        billing_status_at_creation: "billable",
      };
      const anchor = insertItems.find((i) => i.lead_id)?.lead_id ?? leads[0]?.id;
      if (anchor) adj.lead_id = anchor;
      insertItems.push(adj);
    } else if (delta < 0 && insertItems.length > 0) {
      // Reduce the last prior-related line rather than inserting a negative amount
      const last = insertItems[insertItems.length - 1];
      last.amount_cents = Math.max(0, last.amount_cents + delta);
    }
  }

  const { error: itemsError } = await supabaseAdmin
    .from("partner_billing_invoice_items")
    .insert(insertItems);

  if (itemsError) {
    console.error("[POST /api/admin/invoices] items", itemsError);
    await supabaseAdmin.from("partner_billing_invoices").delete().eq("id", newInvoiceId);
    const errObj = itemsError as {
      message?: string;
      code?: string;
      details?: string;
      hint?: string;
    };
    return NextResponse.json(
      {
        error: "Failed to create invoice items.",
        details: errObj.message ?? null,
        code: errObj.code ?? null,
        hint: errObj.hint ?? null,
        dbDetails: errObj.details ?? null,
      },
      { status: 500 }
    );
  }

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
        item_count: insertItems.length,
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
