"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type InvoiceStatus = "draft" | "sent" | "partially_paid" | "paid" | "void";

interface InvoiceRow {
  id: string;
  created_at: string;
  partner_account_id: string;
  partner_firm_name: string;
  invoice_number: string;
  status: InvoiceStatus;
  period_start: string;
  period_end: string;
  subtotal_cents: number;
  total_cents: number;
  amount_paid_cents: number;
  balance_due_cents: number;
  notes: string | null;
  sent_at: string | null;
  paid_at: string | null;
  due_date: string | null;
  payment_instructions: string | null;
}

interface InvoiceItem {
  id: string;
  lead_id: string | null;
  description: string;
  amount_cents: number;
}

interface EmailNotificationRow {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string | null;
  status: string;
  sent_at: string | null;
  created_at: string;
  error_message: string | null;
  provider_message_id: string | null;
  notification_type: string | null;
}

interface InvoiceDetail extends InvoiceRow {
  partner_email: string | null;
  items: InvoiceItem[];
  emails?: EmailNotificationRow[];
}

interface PartnerOption {
  id: string;
  firm_name: string;
  status: string;
}

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-800",
  partially_paid: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  void: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  partially_paid: "Partially Paid",
  paid: "Paid",
  void: "Void",
};

function currency(cents: number | null | undefined) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    (cents ?? 0) / 100
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const value = iso.includes("T") ? iso : `${iso}T00:00:00.000Z`;
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function monthBounds() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function ClientInvoicePreview({ invoice }: { invoice: InvoiceDetail }) {
  const items = invoice.items ?? [];

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
        Client preview — this is how the partner sees the invoice after you mark it Sent.
      </div>

      <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">From</p>
          <p className="mt-1 text-lg font-bold text-[#0d1b2e]">Ardykay LLC</p>
          <p className="text-sm text-gray-600">5722 Goresseto Dr.</p>
          <p className="text-sm text-gray-600">Frisco, TX 75034</p>
          <p className="mt-2 text-xs text-gray-500">Legal Intake Flow billing</p>
        </div>
        <div className="sm:text-right">
          <p className="text-2xl font-bold text-[#0d1b2e]">INVOICE</p>
          <p className="mt-1 text-sm font-semibold text-[#0d1b2e]">{invoice.invoice_number}</p>
          <p className="mt-2 text-sm text-gray-600">Date: {formatDate(invoice.created_at)}</p>
          <p className="text-sm text-gray-600">Due: {formatDate(invoice.due_date)}</p>
          <p className="mt-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[invoice.status]}`}
            >
              {STATUS_LABELS[invoice.status] ?? invoice.status}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Bill to</p>
          <p className="mt-1 font-semibold text-[#0d1b2e]">{invoice.partner_firm_name}</p>
          {invoice.partner_email && <p className="text-sm text-gray-500">{invoice.partner_email}</p>}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Period</p>
          <p className="mt-1 text-sm text-gray-700">
            {formatDate(invoice.period_start)} – {formatDate(invoice.period_end)}
          </p>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-4">Description</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={2} className="py-6 text-center text-gray-400">
                  No line items on this invoice.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 pr-4 text-gray-800">{item.description}</td>
                  <td className="py-3 text-right font-medium">{currency(item.amount_cents)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-xs space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Total</span>
            <span className="font-semibold">{currency(invoice.total_cents)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Amount paid</span>
            <span>{currency(invoice.amount_paid_cents)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-[#0d1b2e]">
            <span>Balance due</span>
            <span>{currency(invoice.balance_due_cents)}</span>
          </div>
        </div>
      </div>

      {invoice.notes && (
        <div className="mt-8 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Notes</p>
          <p className="mt-1 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      <div className="mt-8 grid gap-6 border-t border-gray-200 pt-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Pay by check</p>
          <div className="mt-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
            <p className="font-semibold">Ardykay LLC</p>
            <p>5722 Goresseto Dr.</p>
            <p>Frisco, TX 75034</p>
            <p className="mt-2 text-xs">
              Include invoice <strong>{invoice.invoice_number}</strong> in the memo.
            </p>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Pay online</p>
          <p className="mt-2 text-sm text-gray-600">
            Partners can use <strong>Pay Online with Stripe</strong> on their invoice page to pay the
            balance by card.
          </p>
        </div>
      </div>
    </article>
  );
}

export default function AdminInvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [partnerFilter, setPartnerFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const bounds = monthBounds();
  const [createPartner, setCreatePartner] = useState("");
  const [periodStart, setPeriodStart] = useState(bounds.start);
  const [periodEnd, setPeriodEnd] = useState(bounds.end);
  const [createNotes, setCreateNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOk, setCreateOk] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (partnerFilter) params.set("partner_id", partnerFilter);

    try {
      const res = await fetch(`/api/admin/invoices?${params.toString()}`);
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(data.error ?? "Failed to load invoices.");
        return;
      }
      setInvoices(data.data?.invoices ?? []);
      setPartners(data.data?.partners ?? []);
    } catch {
      setLoadError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, partnerFilter, router]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    setCreateOk(null);
    try {
      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partner_account_id: createPartner,
          period_start: periodStart,
          period_end: periodEnd,
          notes: createNotes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const parts = [
          data.error ?? "Failed to create invoice.",
          data.details ? `Details: ${data.details}` : null,
          data.code ? `Code: ${data.code}` : null,
          data.hint ? `Hint: ${data.hint}` : null,
        ].filter(Boolean);
        setCreateError(parts.join(" · "));
        return;
      }
      const d = data.data as {
        invoice_number: string;
        item_count: number;
        period_lead_count?: number;
        prior_invoice_count?: number;
        prior_invoice_numbers?: string[];
        total_cents?: number;
      };
      const priorCount = d.prior_invoice_count ?? 0;
      const parts = [
        `Created ${d.invoice_number}`,
        `${d.period_lead_count ?? d.item_count} current lead${(d.period_lead_count ?? d.item_count) === 1 ? "" : "s"}`,
      ];
      if (priorCount > 0) {
        parts.push(
          `+ ${priorCount} prior unpaid (${(d.prior_invoice_numbers ?? []).join(", ")}) = ${currency(d.total_cents)} total due`
        );
      }
      setCreateOk(parts.join(" · ") + ".");
      setCreateNotes("");
      await fetchInvoices();
    } finally {
      setCreating(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b border-slate-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-sm font-bold text-slate-900">LIF Manager</span>
            <a href="/admin" className="text-sm text-slate-500 hover:text-slate-900">
              Dashboard
            </a>
            <a href="/admin/leads" className="text-sm text-slate-500 hover:text-slate-900">
              Leads
            </a>
            <a href="/admin/partners" className="text-sm text-slate-500 hover:text-slate-900">
              Partners
            </a>
            <a href="/admin/invoices" className="text-sm font-semibold text-slate-900">
              Invoices
            </a>
          </div>
          <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-slate-600">
            Sign Out
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create drafts from billable assigned leads. Unpaid prior invoices for the same partner are
            rolled into the new invoice automatically.
          </p>
        </div>

        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-sm font-semibold text-slate-900">Create Invoice Draft</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select
              required
              value={createPartner}
              onChange={(e) => setCreatePartner(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select partner…</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firm_name}
                </option>
              ))}
            </select>
            <input
              type="date"
              required
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="date"
              required
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={creating || !createPartner}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create Draft"}
            </button>
          </div>
          <input
            type="text"
            placeholder="Optional notes"
            value={createNotes}
            onChange={(e) => setCreateNotes(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          {createError && <p className="break-words text-sm text-red-600">{createError}</p>}
          {createOk && <p className="text-sm text-green-600">{createOk}</p>}
        </form>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="partially_paid">Partially paid</option>
              <option value="paid">Paid</option>
              <option value="void">Void</option>
            </select>
            <select
              value={partnerFilter}
              onChange={(e) => setPartnerFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All partners</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firm_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loadError && (
            <div className="border-b border-red-100 bg-red-50 px-6 py-4 text-sm text-red-600">
              {loadError}
            </div>
          )}
          {loading ? (
            <div className="py-16 text-center text-sm text-slate-400">Loading invoices…</div>
          ) : invoices.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">No invoices found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Invoice</th>
                    <th className="px-4 py-3 text-left">Partner</th>
                    <th className="px-4 py-3 text-left">Period</th>
                    <th className="px-4 py-3 text-left">Total</th>
                    <th className="px-4 py-3 text-left">Balance</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-slate-600">{inv.partner_firm_name}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                        {formatDate(inv.period_start)} – {formatDate(inv.period_end)}
                      </td>
                      <td className="px-4 py-3">{currency(inv.total_cents)}</td>
                      <td className="px-4 py-3">{currency(inv.balance_due_cents)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_COLORS[inv.status]}`}
                        >
                          {inv.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedId(inv.id)}
                          className="rounded border border-slate-900 px-2 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-900 hover:text-white"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {selectedId && (
        <InvoiceDetailModal
          invoiceId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={(updated) => {
            setInvoices((prev) =>
              prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i))
            );
          }}
          onDeleted={(id) => {
            setInvoices((prev) => prev.filter((i) => i.id !== id));
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}

function InvoiceDetailModal({
  invoiceId,
  onClose,
  onUpdated,
  onDeleted,
}: {
  invoiceId: string;
  onClose: () => void;
  onUpdated: (row: Partial<InvoiceRow> & { id: string }) => void;
  onDeleted: (id: string) => void;
}) {
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [emailConfirm, setEmailConfirm] = useState<string | null>(null);
  const [tab, setTab] = useState<"manage" | "preview">("preview");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to load invoice.");
        return;
      }
      const inv = data.data as InvoiceDetail;
      setInvoice(inv);
      setNotes(inv.notes ?? "");
      setInstructions(inv.payment_instructions ?? "");
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setActionMsg(null);
    setEmailConfirm(null);
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionMsg(data.error ?? "Update failed.");
        return;
      }
      onUpdated(data.data as InvoiceRow);

      if (body.status === "sent" && data.email) {
        const e = data.email as {
          attempted: number;
          sent: number;
          skipped: number;
          failed: number;
          errors?: string[];
          recipients?: Array<{ email: string; name: string | null; status: string; error?: string | null }>;
        };
        const lines: string[] = [];
        if (e.sent > 0) {
          lines.push(`Email accepted by provider for ${e.sent} recipient${e.sent === 1 ? "" : "s"}.`);
        } else {
          lines.push("No invoice emails were sent.");
        }
        if (e.recipients && e.recipients.length > 0) {
          for (const r of e.recipients) {
            const who = r.name ? `${r.name} <${r.email}>` : r.email;
            if (r.status === "sent") lines.push(`✓ Sent to ${who}`);
            else if (r.status === "skipped") lines.push(`⊘ Skipped ${who}${r.error ? ` — ${r.error}` : ""}`);
            else lines.push(`✗ Failed ${who}${r.error ? ` — ${r.error}` : ""}`);
          }
        }
        if (e.errors && e.errors.length > 0) {
          lines.push(...e.errors.map((err) => `Error: ${err}`));
        }
        lines.push(
          "Note: \"Sent\" means Resend accepted the message. Inbox delivery/opens are not tracked unless Resend webhooks are configured."
        );
        setEmailConfirm(lines.join("\n"));
        setTab("manage");
      } else {
        setActionMsg("Updated.");
      }

      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!invoice) return;
    if (
      !window.confirm(
        `Delete invoice ${invoice.invoice_number}?\n\nThis permanently removes the invoice and resets related leads to billable.`
      )
    )
      return;
    setSaving(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionMsg(data.error ?? "Delete failed.");
        return;
      }
      onDeleted(invoiceId);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const emails = invoice?.emails ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {invoice?.invoice_number ?? "Invoice"}
            </h2>
            {invoice && <p className="text-sm text-slate-500">{invoice.partner_firm_name}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            ✕
          </button>
        </div>

        {!loading && invoice && (
          <div className="flex gap-1 border-b border-slate-100 px-6 pt-2">
            <button
              type="button"
              onClick={() => setTab("preview")}
              className={`rounded-t-lg px-4 py-2 text-sm font-semibold ${
                tab === "preview"
                  ? "border border-b-0 border-slate-200 bg-white text-slate-900"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Client preview
            </button>
            <button
              type="button"
              onClick={() => setTab("manage")}
              className={`rounded-t-lg px-4 py-2 text-sm font-semibold ${
                tab === "manage"
                  ? "border border-b-0 border-slate-200 bg-white text-slate-900"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Manage
            </button>
          </div>
        )}

        <div className="max-h-[75vh] space-y-5 overflow-y-auto px-6 py-5">
          {loading && <p className="py-12 text-center text-sm text-slate-400">Loading…</p>}
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {!loading && invoice && tab === "preview" && <ClientInvoicePreview invoice={invoice} />}

          {!loading && invoice && tab === "manage" && (
            <>
              {emailConfirm && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 whitespace-pre-wrap">
                  {emailConfirm}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs uppercase text-slate-400">Status</p>
                  <span
                    className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_COLORS[invoice.status]}`}
                  >
                    {invoice.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Period</p>
                  <p>
                    {formatDate(invoice.period_start)} – {formatDate(invoice.period_end)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Total</p>
                  <p className="font-semibold">{currency(invoice.total_cents)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Balance Due</p>
                  <p className="font-semibold">{currency(invoice.balance_due_cents)}</p>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Email delivery log
                </h3>
                {emails.length === 0 ? (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                    No invoice emails logged yet. Click Mark Sent to notify recipients.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {emails.map((em) => (
                      <div key={em.id} className="px-3 py-2.5 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-slate-800">
                              {em.recipient_name ? `${em.recipient_name} · ` : ""}
                              {em.recipient_email}
                            </p>
                            <p className="text-xs text-slate-500">
                              {em.subject ?? "Invoice email"} · {formatDateTime(em.sent_at ?? em.created_at)}
                            </p>
                          </div>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                              em.status === "sent"
                                ? "bg-green-100 text-green-800"
                                : em.status === "failed"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {em.status}
                          </span>
                        </div>
                        {em.error_message && (
                          <p className="mt-1 text-xs text-red-600">{em.error_message}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-slate-400">
                  Status <strong>sent</strong> means Resend accepted the message for delivery. We do not
                  currently track mailbox delivery or opens.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Line Items ({invoice.items?.length ?? 0})
                </h3>
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {(invoice.items ?? []).map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="pr-4 text-slate-700">{item.description}</span>
                      <span className="shrink-0 font-medium">{currency(item.amount_cents)}</span>
                    </div>
                  ))}
                  {(invoice.items ?? []).length === 0 && (
                    <p className="px-3 py-4 text-sm text-slate-400">No items.</p>
                  )}
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
                <textarea
                  rows={2}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Payment instructions"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={saving}
                    onClick={() => patch({ notes, payment_instructions: instructions })}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Save Notes
                  </button>
                  {invoice.status === "draft" && (
                    <button
                      disabled={saving}
                      onClick={() => patch({ status: "sent" })}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Mark Sent
                    </button>
                  )}
                  {invoice.status !== "paid" && invoice.status !== "void" && (
                    <button
                      disabled={saving}
                      onClick={() => patch({ status: "paid" })}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      Mark Paid
                    </button>
                  )}
                  {invoice.status !== "void" && (
                    <button
                      disabled={saving}
                      onClick={() => patch({ status: "void" })}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Void
                    </button>
                  )}
                  <button
                    disabled={saving}
                    onClick={handleDelete}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Delete / Reset
                  </button>
                </div>
                {actionMsg && <p className="text-xs text-slate-600">{actionMsg}</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
