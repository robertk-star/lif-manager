import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type EmailSendResult = {
  sent: boolean;
  skipped: boolean;
  notificationId: string | null;
  providerMessageId?: string | null;
  error?: string | null;
};

type SendTransactionalEmailInput = {
  to: string;
  recipientName?: string | null;
  subject: string;
  text: string;
  html: string;
  notificationType?: string;
  leadId?: string | null;
  partnerAccountId?: string | null;
  partnerUserId?: string | null;
  loginRequestId?: string | null;
  invoiceId?: string | null;
  metadata?: Record<string, unknown> | null;
};

type PartnerUserForEmail = {
  id: string;
  partner_account_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  receives_invoice_emails?: boolean | null;
};

type PartnerAccountForEmail = {
  id: string;
  firm_name: string;
  email: string;
  status: string;
};

type LeadForEmail = {
  id: string;
  external_reference_id: string | null;
  first_name: string | null;
  last_name: string | null;
  state: string | null;
  benefit_type: string | null;
  application_status: string | null;
  assigned_at: string | null;
};

type InvoiceForEmail = {
  id: string;
  invoice_number: string;
  partner_account_id: string;
  status: string;
  period_start: string | null;
  period_end: string | null;
  total_cents: number;
  amount_paid_cents: number | null;
  balance_due_cents: number;
  due_date: string | null;
  payment_instructions: string | null;
  invoice_email_count: number | null;
};

type InvoiceItemForEmail = {
  id: string;
  description: string;
  amount_cents: number;
};

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;")
    .replace(/'/g, "&#039;");
}

function displayName(firstName?: string | null, lastName?: string | null) {
  const name = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return name || null;
}

function claimantName(lead: LeadForEmail) {
  return displayName(lead.first_name, lead.last_name) ?? "New Lead";
}

function formatCurrency(cents: number | null | undefined) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    (cents ?? 0) / 100
  );
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const value = iso.includes("T") ? iso : `${iso}T00:00:00.000Z`;
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function insertNotification(input: SendTransactionalEmailInput, status = "queued") {
  const { data, error } = await supabaseAdmin
    .from("email_notifications")
    .insert({
      notification_type: input.notificationType ?? "lead_assigned",
      recipient_email: input.to.toLowerCase(),
      recipient_name: input.recipientName ?? null,
      subject: input.subject,
      status,
      provider: "resend",
      lead_id: input.leadId ?? null,
      partner_account_id: input.partnerAccountId ?? null,
      partner_user_id: input.partnerUserId ?? null,
      login_request_id: input.loginRequestId ?? null,
      invoice_id: input.invoiceId ?? null,
      metadata: input.metadata ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[emailNotifications] Failed to insert email notification:", error);
    return null;
  }

  return (data?.id as string | undefined) ?? null;
}

async function updateNotification(id: string | null, updates: Record<string, unknown>) {
  if (!id) return;
  const { error } = await supabaseAdmin.from("email_notifications").update(updates).eq("id", id);
  if (error) {
    console.error("[emailNotifications] Failed to update email notification:", error);
  }
}

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput
): Promise<EmailSendResult> {
  const notificationId = await insertNotification(input);

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LIF_EMAIL_FROM;
  const replyTo = process.env.LIF_EMAIL_REPLY_TO;

  if (!apiKey || !from) {
    const error =
      "Email provider is not configured. Set RESEND_API_KEY and LIF_EMAIL_FROM on the Vercel project and redeploy.";
    console.error("[emailNotifications]", error);
    await updateNotification(notificationId, { status: "skipped", error_message: error });
    return { sent: false, skipped: true, notificationId, error };
  }

  try {
    const payload: Record<string, unknown> = {
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    };
    if (replyTo) payload.reply_to = replyTo;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const error =
        typeof data?.message === "string" ? data.message : `Resend returned HTTP ${res.status}.`;
      console.error("[emailNotifications] Resend error:", error);
      await updateNotification(notificationId, { status: "failed", error_message: error });
      return { sent: false, skipped: false, notificationId, error };
    }

    const providerMessageId = typeof data?.id === "string" ? data.id : null;
    await updateNotification(notificationId, {
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_message_id: providerMessageId,
      error_message: null,
    });

    return { sent: true, skipped: false, notificationId, providerMessageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email delivery error.";
    console.error("[emailNotifications] send exception:", message);
    await updateNotification(notificationId, { status: "failed", error_message: message });
    return { sent: false, skipped: false, notificationId, error: message };
  }
}

export async function sendLeadAssignedNotifications(input: {
  origin: string;
  leadId: string;
  partnerAccountId: string;
  assignmentType: "manual" | "best_match" | "reassignment" | "auto_ingest" | "auto_batch";
}) {
  const { data: lead, error: leadError } = await supabaseAdmin
    .from("leads")
    .select(
      "id, external_reference_id, first_name, last_name, state, benefit_type, application_status, assigned_at"
    )
    .eq("id", input.leadId)
    .single();

  if (leadError || !lead) {
    console.error("[sendLeadAssignedNotifications] Lead lookup failed:", leadError);
    return { attempted: 0, sent: 0, skipped: 0, failed: 0, errors: ["Lead lookup failed."] };
  }

  const { data: account, error: accountError } = await supabaseAdmin
    .from("partner_accounts")
    .select("id, firm_name, email, status")
    .eq("id", input.partnerAccountId)
    .single();

  if (accountError || !account) {
    console.error("[sendLeadAssignedNotifications] Partner account lookup failed:", accountError);
    return {
      attempted: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      errors: ["Partner account lookup failed."],
    };
  }

  const { data: users, error: usersError } = await supabaseAdmin
    .from("partner_users")
    .select("id, partner_account_id, email, first_name, last_name, role, status")
    .eq("partner_account_id", input.partnerAccountId)
    .eq("status", "active")
    .in("role", ["owner", "admin", "staff"]);

  if (usersError) {
    console.error("[sendLeadAssignedNotifications] Partner users lookup failed:", usersError);
    return { attempted: 0, sent: 0, skipped: 0, failed: 0, errors: ["Partner user lookup failed."] };
  }

  const partnerUsers = ((users ?? []) as PartnerUserForEmail[]).filter((user) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)
  );

  const dedupedUsers = Array.from(
    new Map(partnerUsers.map((user) => [user.email.toLowerCase(), user])).values()
  );

  if (dedupedUsers.length === 0) {
    return {
      attempted: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      errors: ["No active owner/admin/staff partner users found."],
    };
  }

  const typedLead = lead as LeadForEmail;
  const typedAccount = account as PartnerAccountForEmail;
  const leadTitle = claimantName(typedLead);
  const leadUrl = `${input.origin}/partner/leads`;
  const subject = "New lead assigned in Legal Intake Flow";

  const summaryLines = [
    typedLead.state ? `State: ${typedLead.state}` : null,
    typedLead.benefit_type ? `Benefit Type: ${typedLead.benefit_type}` : null,
    typedLead.application_status ? `Application Status: ${typedLead.application_status}` : null,
    typedLead.external_reference_id ? `Reference: ${typedLead.external_reference_id}` : null,
  ].filter((line): line is string => Boolean(line));

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const user of dedupedUsers) {
    const name = displayName(user.first_name, user.last_name) ?? "Partner";
    const text = [
      `Hello ${name},`,
      "",
      `A new lead has been assigned to ${typedAccount.firm_name}.`,
      "",
      `Lead: ${leadTitle}`,
      ...summaryLines,
      "",
      `Review the lead here: ${leadUrl}`,
      "",
      "For privacy, medical details are not included in this email. Please log in to review the full intake packet.",
    ].join("\n");

    const html = [
      '<div style="font-family: Arial, sans-serif; color: #0d1b2e; line-height: 1.5;">',
      `<p>Hello ${escapeHtml(name)},</p>`,
      `<p>A new lead has been assigned to <strong>${escapeHtml(typedAccount.firm_name)}</strong>.</p>`,
      '<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin:16px 0;background:#f9fafb;">',
      `<p style="margin:0 0 6px 0;"><strong>Lead:</strong> ${escapeHtml(leadTitle)}</p>`,
      ...summaryLines.map(
        (line) =>
          `<p style="margin:0 0 4px 0;font-size:13px;color:#4b5563;">${escapeHtml(line)}</p>`
      ),
      "</div>",
      "<p>",
      `<a href="${escapeHtml(leadUrl)}" style="display:inline-block;background:#1a3a5c;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">`,
      "Review Assigned Lead",
      "</a>",
      "</p>",
      '<p style="font-size:13px;color:#4b5563;">For privacy, medical details are not included in this email.</p>',
      "</div>",
    ].join("\n");

    const result = await sendTransactionalEmail({
      to: user.email,
      recipientName: name,
      subject,
      text,
      html,
      notificationType: "lead_assigned",
      leadId: input.leadId,
      partnerAccountId: input.partnerAccountId,
      partnerUserId: user.id,
      metadata: {
        assignment_type: input.assignmentType,
        lead_state: typedLead.state,
        benefit_type: typedLead.benefit_type,
        application_status: typedLead.application_status,
        external_reference_id: typedLead.external_reference_id,
      },
    });

    if (result.sent) sent += 1;
    else if (result.skipped) skipped += 1;
    else {
      failed += 1;
      if (result.error) errors.push(result.error);
    }
  }

  if (sent > 0) {
    await supabaseAdmin
      .from("leads")
      .update({
        assignment_notification_sent_at: new Date().toISOString(),
        assignment_notification_count: sent,
      })
      .eq("id", input.leadId);
  }

  return { attempted: dedupedUsers.length, sent, skipped, failed, errors };
}

/** Resolve who should receive invoice emails for a partner account. */
async function getInvoiceEmailRecipients(partnerAccountId: string): Promise<PartnerUserForEmail[]> {
  // Preferred: explicit opt-in flag
  const withFlag = await supabaseAdmin
    .from("partner_users")
    .select(
      "id, partner_account_id, email, first_name, last_name, role, status, receives_invoice_emails"
    )
    .eq("partner_account_id", partnerAccountId)
    .eq("status", "active")
    .eq("receives_invoice_emails", true);

  if (!withFlag.error) {
    const users = ((withFlag.data ?? []) as PartnerUserForEmail[]).filter((user) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)
    );
    return Array.from(new Map(users.map((u) => [u.email.toLowerCase(), u])).values());
  }

  // Fallback if column not migrated: active owner/admin (previous default)
  console.warn(
    "[getInvoiceEmailRecipients] receives_invoice_emails unavailable, falling back to owner/admin:",
    withFlag.error.message
  );

  const fallback = await supabaseAdmin
    .from("partner_users")
    .select("id, partner_account_id, email, first_name, last_name, role, status")
    .eq("partner_account_id", partnerAccountId)
    .eq("status", "active")
    .in("role", ["owner", "admin"]);

  if (fallback.error) {
    console.error("[getInvoiceEmailRecipients] Partner users lookup failed:", fallback.error);
    return [];
  }

  const users = ((fallback.data ?? []) as PartnerUserForEmail[]).filter((user) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)
  );
  return Array.from(new Map(users.map((u) => [u.email.toLowerCase(), u])).values());
}

/** Notify selected partner users when an invoice is marked sent. */
export async function sendInvoiceSentNotifications(input: {
  origin: string;
  invoiceId: string;
}) {
  const { data: invoiceRow, error: invoiceError } = await supabaseAdmin
    .from("partner_billing_invoices")
    .select(
      "id, invoice_number, partner_account_id, status, period_start, period_end, total_cents, amount_paid_cents, balance_due_cents, due_date, payment_instructions, invoice_email_count"
    )
    .eq("id", input.invoiceId)
    .single();

  if (invoiceError || !invoiceRow) {
    console.error("[sendInvoiceSentNotifications] Invoice lookup failed:", invoiceError);
    return { attempted: 0, sent: 0, skipped: 0, failed: 0, errors: ["Invoice lookup failed."] };
  }

  const invoice = invoiceRow as InvoiceForEmail;

  const { data: accountRow, error: accountError } = await supabaseAdmin
    .from("partner_accounts")
    .select("id, firm_name, email, status")
    .eq("id", invoice.partner_account_id)
    .single();

  if (accountError || !accountRow) {
    console.error("[sendInvoiceSentNotifications] Partner account lookup failed:", accountError);
    return {
      attempted: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      errors: ["Partner account lookup failed."],
    };
  }

  const account = accountRow as PartnerAccountForEmail;
  const dedupedUsers = await getInvoiceEmailRecipients(invoice.partner_account_id);

  if (dedupedUsers.length === 0) {
    return {
      attempted: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      errors: [
        "No invoice email recipients configured. Open Partners → Manage → Partner Users and enable Invoice emails for at least one active user.",
      ],
    };
  }

  const { data: itemRows } = await supabaseAdmin
    .from("partner_billing_invoice_items")
    .select("id, description, amount_cents")
    .eq("invoice_id", input.invoiceId)
    .order("created_at", { ascending: true });

  const items = (itemRows ?? []) as InvoiceItemForEmail[];
  const invoiceUrl = `${input.origin}/partner/invoices/${invoice.id}`;
  const invoicesListUrl = `${input.origin}/partner/invoices`;
  const amount = formatCurrency(invoice.total_cents);
  const balance = formatCurrency(invoice.balance_due_cents);
  const paid = formatCurrency(invoice.amount_paid_cents);
  const period =
    invoice.period_start || invoice.period_end
      ? `${formatDate(invoice.period_start)} – ${formatDate(invoice.period_end)}`
      : "—";
  const dueDate = formatDate(invoice.due_date);
  const subject = `Invoice ${invoice.invoice_number} from Legal Intake Flow`;
  const itemPreview = items.slice(0, 5);
  const extraCount = Math.max(items.length - itemPreview.length, 0);

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const user of dedupedUsers) {
    const name = displayName(user.first_name, user.last_name) ?? "Partner";
    const text = [
      `Hello ${name},`,
      "",
      `A new invoice is ready for ${account.firm_name}.`,
      "",
      `Invoice: ${invoice.invoice_number}`,
      `Period: ${period}`,
      `Total: ${amount}`,
      `Amount paid: ${paid}`,
      `Balance due: ${balance}`,
      `Due date: ${dueDate}`,
      invoice.payment_instructions ? `Payment instructions: ${invoice.payment_instructions}` : null,
      "",
      `View and pay the invoice: ${invoiceUrl}`,
      `All invoices: ${invoicesListUrl}`,
      "",
      "You can download the invoice, pay by check, or pay online with Stripe from the partner portal.",
    ]
      .filter((line): line is string => line !== null)
      .join("\n");

    const html = [
      '<div style="font-family: Arial, sans-serif; color: #0d1b2e; line-height: 1.5;">',
      `<p>Hello ${escapeHtml(name)},</p>`,
      `<p>A new invoice is ready for <strong>${escapeHtml(account.firm_name)}</strong>.</p>`,
      '<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin:16px 0;background:#f9fafb;">',
      `<p style="margin:0 0 6px 0;"><strong>Invoice:</strong> ${escapeHtml(invoice.invoice_number)}</p>`,
      `<p style="margin:0 0 4px 0;font-size:13px;color:#4b5563;">Period: ${escapeHtml(period)}</p>`,
      `<p style="margin:0 0 4px 0;font-size:13px;color:#4b5563;">Total: ${escapeHtml(amount)}</p>`,
      `<p style="margin:0 0 4px 0;font-size:13px;color:#4b5563;">Amount paid: ${escapeHtml(paid)}</p>`,
      `<p style="margin:0 0 4px 0;font-size:13px;color:#4b5563;">Balance due: ${escapeHtml(balance)}</p>`,
      `<p style="margin:0;font-size:13px;color:#4b5563;">Due date: ${escapeHtml(dueDate)}</p>`,
      "</div>",
      invoice.payment_instructions
        ? `<div style="border:1px solid #bbf7d0;border-radius:8px;padding:12px;margin:16px 0;background:#f0fdf4;"><p style="font-weight:600;margin:0 0 6px 0;">Payment instructions</p><p style="margin:0;white-space:pre-wrap;">${escapeHtml(invoice.payment_instructions)}</p></div>`
        : "",
      itemPreview.length > 0
        ? `<p style="font-weight:600;margin:16px 0 8px 0;">Included items</p><ul style="padding-left:18px;margin-top:0;">${itemPreview
            .map(
              (item) =>
                `<li>${escapeHtml(item.description)} — ${escapeHtml(formatCurrency(item.amount_cents))}</li>`
            )
            .join("")}${extraCount > 0 ? `<li>${extraCount} more item${extraCount === 1 ? "" : "s"} in the portal.</li>` : ""}</ul>`
        : "",
      "<p>",
      `<a href="${escapeHtml(invoiceUrl)}" style="display:inline-block;background:#1a3a5c;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">`,
      "View Invoice",
      "</a>",
      "</p>",
      '<p style="font-size:13px;color:#4b5563;">You can download the invoice, pay by check, or pay online with Stripe from the partner portal.</p>',
      "</div>",
    ].join("\n");

    const result = await sendTransactionalEmail({
      to: user.email,
      recipientName: name,
      subject,
      text,
      html,
      notificationType: "invoice_sent",
      partnerAccountId: invoice.partner_account_id,
      partnerUserId: user.id,
      invoiceId: invoice.id,
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        total_cents: invoice.total_cents,
        balance_due_cents: invoice.balance_due_cents,
        due_date: invoice.due_date,
        period_start: invoice.period_start,
        period_end: invoice.period_end,
        item_count: items.length,
      },
    });

    if (result.sent) sent += 1;
    else if (result.skipped) skipped += 1;
    else {
      failed += 1;
      if (result.error) errors.push(result.error);
    }
  }

  if (sent > 0) {
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("partner_billing_invoices")
      .update({
        invoice_email_sent_at: now,
        invoice_email_count: Number(invoice.invoice_email_count ?? 0) + sent,
      })
      .eq("id", input.invoiceId);

    await supabaseAdmin.from("partner_billing_invoice_events").insert({
      invoice_id: input.invoiceId,
      event_type: "email_sent",
      previous_status: invoice.status,
      next_status: "sent",
      amount_cents: invoice.total_cents,
      notes: `Invoice email sent to ${sent} recipient${sent === 1 ? "" : "s"}.`,
      created_by: "admin",
    });
  }

  return { attempted: dedupedUsers.length, sent, skipped, failed, errors };
}
