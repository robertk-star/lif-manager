import { NextResponse } from "next/server";
import { rateLimitResponse } from "@/lib/rateLimit";
import { getAuthenticatedPartnerSession } from "@/lib/partnerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { appUrlFromRequest, createStripeCheckoutSession } from "@/lib/stripePayments";

const PAYABLE_STATUSES = ["sent", "partially_paid"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimitResponse(request, {
    keyPrefix: "partner-stripe-checkout",
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const session = await getAuthenticatedPartnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from("partner_billing_invoices")
    .select(
      "id, partner_account_id, invoice_number, status, total_cents, amount_paid_cents, balance_due_cents, " +
        "stripe_checkout_session_id, stripe_payment_status"
    )
    .eq("id", id)
    .eq("partner_account_id", session.partnerAccountId)
    .single();

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const invoiceRow = invoice as unknown as {
    id: string;
    partner_account_id: string;
    invoice_number: string;
    status: string;
    total_cents: number;
    amount_paid_cents: number;
    balance_due_cents: number;
  };

  if (!PAYABLE_STATUSES.includes(invoiceRow.status)) {
    return NextResponse.json(
      { error: "Only sent or partially paid invoices with a balance due can be paid online." },
      { status: 422 }
    );
  }

  if ((invoiceRow.balance_due_cents ?? 0) <= 0) {
    return NextResponse.json({ error: "This invoice has no balance due." }, { status: 422 });
  }

  const [{ data: partner }, { data: user }] = await Promise.all([
    supabaseAdmin
      .from("partner_accounts")
      .select("id, firm_name, email")
      .eq("id", session.partnerAccountId)
      .single(),
    supabaseAdmin
      .from("partner_users")
      .select("id, email")
      .eq("id", session.partnerUserId)
      .single(),
  ]);

  const partnerRow = partner as { id: string; firm_name: string; email: string | null } | null;
  const userRow = user as { id: string; email: string | null } | null;

  const result = await createStripeCheckoutSession({
    invoiceId: invoiceRow.id,
    invoiceNumber: invoiceRow.invoice_number,
    partnerAccountId: invoiceRow.partner_account_id,
    partnerFirmName: partnerRow?.firm_name ?? "Partner Account",
    amountCents: invoiceRow.balance_due_cents,
    customerEmail: userRow?.email ?? partnerRow?.email ?? null,
    appUrl: appUrlFromRequest(request.url),
  });

  if (result.error || !result.data) {
    return NextResponse.json(
      { error: result.error ?? "Failed to create Stripe Checkout session." },
      { status: 500 }
    );
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from("partner_billing_invoices")
    .update({
      stripe_checkout_session_id: result.data.id,
      stripe_checkout_url: result.data.url,
      stripe_payment_status: result.data.paymentStatus ?? "checkout_created",
      stripe_customer_email: userRow?.email ?? partnerRow?.email ?? null,
      stripe_last_event_at: now,
    })
    .eq("id", invoiceRow.id)
    .eq("partner_account_id", session.partnerAccountId);

  if (updateError) {
    console.error("[POST /api/partner/invoices/[id]/checkout] Invoice update error:", updateError);
    return NextResponse.json(
      {
        error:
          "Checkout session was created, but invoice tracking could not be updated. Please contact admin.",
      },
      { status: 500 }
    );
  }

  await supabaseAdmin.from("partner_billing_invoice_events").insert({
    invoice_id: invoiceRow.id,
    event_type: "stripe_checkout_created",
    previous_status: invoiceRow.status,
    next_status: invoiceRow.status,
    amount_cents: invoiceRow.balance_due_cents,
    notes: `Stripe Checkout session created: ${result.data.id}.`,
    created_by: "partner",
  });

  return NextResponse.json({
    success: true,
    data: { checkoutUrl: result.data.url, sessionId: result.data.id },
  });
}
