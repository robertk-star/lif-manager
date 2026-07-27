import { NextResponse } from "next/server";
import { getAuthenticatedPartnerSession } from "@/lib/partnerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DEFAULT_PAYMENT_INSTRUCTIONS = `Pay by check to:

Ardykay LLC
5722 Goresseto Dr.
Frisco, TX 75034

Please include the invoice number in the check memo.`;

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function centsToDollars(cents: unknown) {
  return typeof cents === "number" ? (cents / 100).toFixed(2) : "0.00";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthenticatedPartnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from("partner_billing_invoices")
    .select("*")
    .eq("id", id)
    .eq("partner_account_id", session.partnerAccountId)
    .single();

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  if (invoice.status === "draft" || invoice.status === "void") {
    return NextResponse.json(
      { error: "This invoice is not available to partner users." },
      { status: 403 }
    );
  }

  const { data: items, error: itemsError } = await supabaseAdmin
    .from("partner_billing_invoice_items")
    .select("lead_id, description, amount_cents, billing_status_at_creation")
    .eq("invoice_id", id)
    .order("created_at", { ascending: true });

  if (itemsError) {
    return NextResponse.json({ error: "Failed to load invoice items." }, { status: 500 });
  }

  const paymentInstructions =
    (invoice.payment_instructions && String(invoice.payment_instructions).trim()) ||
    DEFAULT_PAYMENT_INSTRUCTIONS;

  const rows = [
    ["Invoice Number", invoice.invoice_number],
    ["Status", invoice.status],
    ["Period Start", invoice.period_start],
    ["Period End", invoice.period_end],
    ["Due Date", invoice.due_date ?? ""],
    ["Finalized At", invoice.finalized_at ?? ""],
    ["Payment Method", invoice.payment_method ?? ""],
    ["Payment Reference", invoice.payment_reference ?? ""],
    ["Payment Received At", invoice.payment_received_at ?? ""],
    ["Stripe Payment Status", invoice.stripe_payment_status ?? ""],
    ["Stripe Checkout Session", invoice.stripe_checkout_session_id ?? ""],
    ["Stripe Payment Intent", invoice.stripe_payment_intent_id ?? ""],
    ["Stripe Paid At", invoice.stripe_paid_at ?? ""],
    ["Pay To", "Ardykay LLC"],
    ["Pay To Address", "5722 Goresseto Dr., Frisco, TX 75034"],
    ["Payment Instructions", paymentInstructions],
    ["Total", centsToDollars(invoice.total_cents)],
    ["Amount Paid", centsToDollars(invoice.amount_paid_cents)],
    ["Balance Due", centsToDollars(invoice.balance_due_cents)],
    [],
    ["Lead ID", "Description", "Billing Status At Creation", "Amount"],
    ...(
      (items ?? []) as unknown as Array<{
        lead_id: string;
        description: string;
        amount_cents: number;
        billing_status_at_creation: string | null;
      }>
    ).map((item) => [
      item.lead_id,
      item.description,
      item.billing_status_at_creation ?? "",
      centsToDollars(item.amount_cents),
    ]),
  ];

  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const safeNumber = String(invoice.invoice_number ?? "invoice").replace(/[^a-zA-Z0-9_-]/g, "-");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeNumber}.csv"`,
    },
  });
}
