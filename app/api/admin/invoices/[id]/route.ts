import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const INVOICE_STATUSES = ["draft", "sent", "partially_paid", "paid", "void"] as const;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;

  const { data: invoice, error } = await supabaseAdmin
    .from("partner_billing_invoices")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const [{ data: items }, { data: partner }] = await Promise.all([
    supabaseAdmin
      .from("partner_billing_invoice_items")
      .select("id, lead_id, description, amount_cents, created_at")
      .eq("invoice_id", id)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("partner_accounts")
      .select("id, firm_name, email")
      .eq("id", (invoice as { partner_account_id: string }).partner_account_id)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      ...invoice,
      partner_firm_name: (partner as { firm_name?: string } | null)?.firm_name ?? null,
      partner_email: (partner as { email?: string } | null)?.email ?? null,
      items: items ?? [],
    },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from("partner_billing_invoices")
    .select("id, status, total_cents, amount_paid_cents")
    .eq("id", id)
    .single();

  if (currentError || !current) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  const inv = current as {
    id: string;
    status: string;
    total_cents: number;
    amount_paid_cents: number;
  };

  if (typeof body.notes === "string") {
    updates.notes = body.notes.trim() || null;
  }
  if (typeof body.payment_instructions === "string") {
    updates.payment_instructions = body.payment_instructions.trim() || null;
  }
  if (typeof body.due_date === "string" && body.due_date) {
    updates.due_date = body.due_date;
  }

  if (typeof body.status === "string") {
    const status = body.status.trim();
    if (!(INVOICE_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed: ${INVOICE_STATUSES.join(", ")}.` },
        { status: 422 }
      );
    }
    updates.status = status;

    if (status === "sent" && inv.status === "draft") {
      updates.sent_at = new Date().toISOString();
    }
    if (status === "paid") {
      updates.paid_at = new Date().toISOString();
      updates.amount_paid_cents = inv.total_cents;
      updates.balance_due_cents = 0;
    }
    if (status === "void") {
      updates.voided_at = new Date().toISOString();
      updates.balance_due_cents = 0;
    }
    if (status === "partially_paid" && typeof body.amount_paid_cents === "number") {
      const paid = Math.max(0, Math.min(body.amount_paid_cents, inv.total_cents));
      updates.amount_paid_cents = paid;
      updates.balance_due_cents = inv.total_cents - paid;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("partner_billing_invoices")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    console.error("[PATCH /api/admin/invoices/id]", error);
    return NextResponse.json({ error: "Failed to update invoice." }, { status: 500 });
  }

  if (typeof body.status === "string") {
    await supabaseAdmin.from("partner_billing_invoice_events").insert({
      invoice_id: id,
      event_type: "status_changed",
      previous_status: inv.status,
      next_status: body.status,
      amount_cents: (data as { total_cents?: number }).total_cents ?? null,
      notes: `Status updated to ${body.status}.`,
      created_by: "admin",
    });

    // When marked sent/paid, mark related leads as invoiced if still billable
    if (body.status === "sent" || body.status === "paid") {
      const { data: itemRows } = await supabaseAdmin
        .from("partner_billing_invoice_items")
        .select("lead_id")
        .eq("invoice_id", id);
      const leadIds = ((itemRows ?? []) as unknown as Array<{ lead_id: string }>)
        .map((i) => i.lead_id)
        .filter(Boolean);
      if (leadIds.length > 0) {
        await supabaseAdmin
          .from("leads")
          .update({ billable_status: "invoiced" })
          .in("id", leadIds)
          .eq("billable_status", "billable");
      }
    }
  }

  return NextResponse.json({ success: true, data });
}
