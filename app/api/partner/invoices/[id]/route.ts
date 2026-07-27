import { NextResponse } from "next/server";
import { getAuthenticatedPartnerSession } from "@/lib/partnerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DEFAULT_PAYMENT_INSTRUCTIONS = `Pay by check to:

Ardykay LLC
5722 Goresseto Dr.
Frisco, TX 75034

Please include the invoice number in the check memo.`;

type PartnerInvoiceRow = {
  id: string;
  created_at: string;
  updated_at: string | null;
  invoice_number: string;
  status: string;
  period_start: string;
  period_end: string;
  subtotal_cents: number | null;
  total_cents: number;
  amount_paid_cents: number;
  balance_due_cents: number;
  notes: string | null;
  sent_at: string | null;
  paid_at: string | null;
  due_date: string | null;
  reminder_sent_at: string | null;
  reminder_count: number | null;
  overdue_marked_at: string | null;
  finalized_at: string | null;
  payment_instructions: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  payment_received_at: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_receipt_url: string | null;
  stripe_payment_method_type: string | null;
  stripe_card_last4: string | null;
  stripe_payment_status: string | null;
  stripe_paid_at: string | null;
  stripe_customer_email: string | null;
  stripe_last_event_at: string | null;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthenticatedPartnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  const { data: invoiceData, error: invoiceError } = await supabaseAdmin
    .from("partner_billing_invoices")
    .select(
      "id, created_at, updated_at, invoice_number, status, period_start, period_end, " +
        "subtotal_cents, total_cents, amount_paid_cents, balance_due_cents, notes, sent_at, paid_at, due_date, " +
        "reminder_sent_at, reminder_count, overdue_marked_at, finalized_at, payment_instructions, payment_method, " +
        "payment_reference, payment_received_at, stripe_checkout_session_id, stripe_payment_intent_id, " +
        "stripe_charge_id, stripe_receipt_url, stripe_payment_method_type, stripe_card_last4, " +
        "stripe_payment_status, stripe_paid_at, stripe_customer_email, stripe_last_event_at"
    )
    .eq("id", id)
    .eq("partner_account_id", session.partnerAccountId)
    .single();

  if (invoiceError || !invoiceData) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const invoice = invoiceData as unknown as PartnerInvoiceRow;

  if (invoice.status === "draft" || invoice.status === "void") {
    return NextResponse.json(
      { error: "This invoice is not available to partner users." },
      { status: 403 }
    );
  }

  const [{ data: items }, { data: partner }] = await Promise.all([
    supabaseAdmin
      .from("partner_billing_invoice_items")
      .select("id, lead_id, description, amount_cents, billing_status_at_creation, created_at")
      .eq("invoice_id", id)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("partner_accounts")
      .select("id, firm_name, email")
      .eq("id", session.partnerAccountId)
      .single(),
  ]);

  const paymentInstructions =
    (invoice.payment_instructions && String(invoice.payment_instructions).trim()) ||
    DEFAULT_PAYMENT_INSTRUCTIONS;

  return NextResponse.json({
    success: true,
    data: {
      invoice: {
        ...invoice,
        payment_instructions: paymentInstructions,
      },
      items: items ?? [],
      partner: partner ?? null,
      payTo: {
        name: "Ardykay LLC",
        addressLine1: "5722 Goresseto Dr.",
        addressLine2: "Frisco, TX 75034",
      },
    },
  });
}
