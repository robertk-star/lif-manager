import { NextResponse } from "next/server";
import { getAuthenticatedPartnerSession } from "@/lib/partnerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DISPUTE_REASONS = [
  "question",
  "duplicate",
  "wrong_amount",
  "not_billable",
  "lead_quality",
  "other",
] as const;
type DisputeReason = (typeof DISPUTE_REASONS)[number];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthenticatedPartnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!isPlainObject(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const reason = String(body.reason ?? "").trim() as DisputeReason;
  const details = String(body.details ?? "").trim();
  const invoiceItemId = String(body.invoice_item_id ?? "").trim() || null;

  if (!DISPUTE_REASONS.includes(reason)) {
    return NextResponse.json(
      { error: `Invalid reason. Allowed values: ${DISPUTE_REASONS.join(", ")}.` },
      { status: 422 }
    );
  }

  if (details.length < 5) {
    return NextResponse.json(
      { error: "Please provide a short explanation for the dispute." },
      { status: 422 }
    );
  }

  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from("partner_billing_invoices")
    .select("id, partner_account_id, status")
    .eq("id", id)
    .eq("partner_account_id", session.partnerAccountId)
    .single();

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  if (invoice.status === "draft" || invoice.status === "void") {
    return NextResponse.json(
      { error: "This invoice is not available for partner disputes." },
      { status: 403 }
    );
  }

  let leadId: string | null = null;

  if (invoiceItemId) {
    const { data: item, error: itemError } = await supabaseAdmin
      .from("partner_billing_invoice_items")
      .select("id, invoice_id, lead_id")
      .eq("id", invoiceItemId)
      .eq("invoice_id", id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: "Invoice item not found." }, { status: 404 });
    }

    leadId = (item as { lead_id: string | null }).lead_id ?? null;
  }

  const { data, error } = await supabaseAdmin
    .from("partner_billing_disputes")
    .insert({
      partner_account_id: session.partnerAccountId,
      partner_user_id: session.partnerUserId,
      invoice_id: id,
      invoice_item_id: invoiceItemId,
      lead_id: leadId,
      reason,
      details,
      status: "open",
    })
    .select("id, created_at, status, reason, details, invoice_id, invoice_item_id, lead_id")
    .single();

  if (error) {
    console.error("[POST /api/partner/invoices/[id]/disputes] Supabase error:", error);
    return NextResponse.json(
      { error: "Failed to create dispute. Confirm dispute tables exist." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data }, { status: 201 });
}
