import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendInvoiceSentNotifications } from "@/lib/emailNotifications";

const INVOICE_STATUSES = ["draft", "sent", "partially_paid", "paid", "void"] as const;

function appOrigin(request: Request) {
  const fromEnv = process.env.LIF_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  try {
    return new URL(request.url).origin;
  } catch {
    return "https://v2.legalintakeflow.com";
  }
}

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

  let emailResult: {
    attempted: number;
    sent: number;
    skipped: number;
    failed: number;
    errors: string[];
  } | null = null;

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

    // Email partners when draft → sent
    if (body.status === "sent" && inv.status === "draft") {
      try {
        emailResult = await sendInvoiceSentNotifications({
          origin: appOrigin(request),
          invoiceId: id,
        });
      } catch (err) {
        console.error("[PATCH /api/admin/invoices/id] invoice email failed:", err);
        emailResult = {
          attempted: 0,
          sent: 0,
          skipped: 0,
          failed: 1,
          errors: [err instanceof Error ? err.message : "Email send failed."],
        };
      }
    }
  }

  return NextResponse.json({
    success: true,
    data,
    email: emailResult,
  });
}

/** Hard-delete an invoice so it can be regenerated. Resets related leads from invoiced → billable. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;

  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from("partner_billing_invoices")
    .select("id, invoice_number, status")
    .eq("id", id)
    .single();

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const inv = invoice as { id: string; invoice_number: string; status: string };

  const { data: itemRows } = await supabaseAdmin
    .from("partner_billing_invoice_items")
    .select("lead_id")
    .eq("invoice_id", id);

  const leadIds = ((itemRows ?? []) as unknown as Array<{ lead_id: string | null }>)
    .map((i) => i.lead_id)
    .filter((leadId): leadId is string => Boolean(leadId));

  await supabaseAdmin.from("partner_billing_invoice_items").delete().eq("invoice_id", id);
  await supabaseAdmin.from("partner_billing_invoice_events").delete().eq("invoice_id", id);
  await supabaseAdmin.from("partner_billing_disputes").delete().eq("invoice_id", id);

  const { error: deleteError } = await supabaseAdmin
    .from("partner_billing_invoices")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("[DELETE /api/admin/invoices/id]", deleteError);
    return NextResponse.json({ error: "Failed to delete invoice." }, { status: 500 });
  }

  if (leadIds.length > 0) {
    await supabaseAdmin
      .from("leads")
      .update({ billable_status: "billable" })
      .in("id", leadIds)
      .eq("billable_status", "invoiced");
  }

  return NextResponse.json({
    success: true,
    data: {
      deleted_id: inv.id,
      invoice_number: inv.invoice_number,
      leads_reset: leadIds.length,
    },
  });
}
