"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type InvoiceStatus = "sent" | "partially_paid" | "paid" | "draft" | "void";
type DisputeReason =
  | "question"
  | "duplicate"
  | "wrong_amount"
  | "not_billable"
  | "lead_quality"
  | "other";
type DisputeStatus = "open" | "in_review" | "resolved" | "declined";

interface InvoiceRow {
  id: string;
  created_at: string;
  invoice_number: string;
  status: InvoiceStatus;
  period_start: string;
  period_end: string;
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
}

interface InvoiceDispute {
  id: string;
  created_at: string;
  updated_at: string;
  invoice_id: string;
  invoice_item_id: string | null;
  lead_id: string | null;
  reason: DisputeReason;
  details: string | null;
  status: DisputeStatus;
  admin_resolution_notes: string | null;
  resolved_at: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  sent: "Sent",
  partially_paid: "Partially Paid",
  paid: "Paid",
  draft: "Draft",
  void: "Void",
};

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-blue-100 text-blue-800",
  partially_paid: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  draft: "bg-gray-100 text-gray-700",
  void: "bg-red-100 text-red-700",
};

const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  question: "General Question",
  duplicate: "Duplicate Lead",
  wrong_amount: "Wrong Amount",
  not_billable: "Not Billable",
  lead_quality: "Lead Quality Issue",
  other: "Other",
};

const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  open: "Open",
  in_review: "In Review",
  resolved: "Resolved",
  declined: "Declined",
};

const DISPUTE_STATUS_COLORS: Record<DisputeStatus, string> = {
  open: "bg-red-100 text-red-700",
  in_review: "bg-yellow-100 text-yellow-800",
  resolved: "bg-green-100 text-green-800",
  declined: "bg-gray-100 text-gray-700",
};

const DEFAULT_PAYMENT_INSTRUCTIONS = `Pay by check to:

Ardykay LLC
5722 Goresseto Dr.
Frisco, TX 75034

Please include the invoice number in the check memo.`;

function currency(cents: number | null | undefined) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    (cents ?? 0) / 100
  );
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[status] ?? STATUS_COLORS.sent}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function DisputeBadge({ status }: { status: DisputeStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${DISPUTE_STATUS_COLORS[status]}`}
    >
      {DISPUTE_STATUS_LABELS[status]}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-[#0d1b2e]">{value}</p>
    </div>
  );
}

function DisputeModal({
  invoice,
  onClose,
  onCreated,
}: {
  invoice: InvoiceRow;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [reason, setReason] = useState<DisputeReason>("question");
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitDispute() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/partner/invoices/${invoice.id}/disputes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, details }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to submit dispute.");
        return;
      }
      onCreated();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#0d1b2e]">Question or Dispute Invoice</h2>
            <p className="text-sm text-gray-500">{invoice.invoice_number}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
            ✕
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Submitting this form opens a billing review request for Legal Intake Flow admin. It does
            not automatically adjust the invoice balance.
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as DisputeReason)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {Object.entries(DISPUTE_REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Details
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Briefly explain the question or dispute…"
            />
          </div>
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={submitDispute}
              disabled={saving || details.trim().length < 5}
              className="rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Submitting…" : "Submit Review Request"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PartnerInvoicesDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [disputes, setDisputes] = useState<InvoiceDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDisputeInvoice, setSelectedDisputeInvoice] = useState<InvoiceRow | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentBanner, setPaymentBanner] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invoiceRes, disputeRes] = await Promise.all([
        fetch("/api/partner/invoices"),
        fetch("/api/partner/invoice-disputes"),
      ]);
      if (invoiceRes.status === 401 || disputeRes.status === 401) {
        router.push("/partner/login");
        return;
      }
      const invoiceData = await invoiceRes.json().catch(() => ({}));
      const disputeData = await disputeRes.json().catch(() => ({}));
      if (!invoiceRes.ok) {
        setError(invoiceData.error ?? "Failed to load invoices.");
        setLoading(false);
        return;
      }
      setInvoices(invoiceData.data?.invoices ?? []);
      setDisputes(disputeRes.ok ? disputeData.data ?? [] : []);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const payment = searchParams.get("payment");
    if (payment === "success") {
      setPaymentBanner("Payment submitted successfully. Status will update once Stripe confirms.");
    } else if (payment === "cancelled") {
      setPaymentBanner("Online payment was cancelled. You can try again or pay by check.");
    }
  }, [searchParams]);

  const disputesByInvoice = useMemo(() => {
    const map = new Map<string, InvoiceDispute[]>();
    for (const dispute of disputes) {
      const existing = map.get(dispute.invoice_id) ?? [];
      existing.push(dispute);
      map.set(dispute.invoice_id, existing);
    }
    return map;
  }, [disputes]);

  const summary = useMemo(
    () =>
      invoices.reduce(
        (acc, invoice) => {
          acc.total += invoice.total_cents ?? 0;
          acc.balance += invoice.balance_due_cents ?? 0;
          if (invoice.status === "paid") acc.paid += 1;
          if (
            invoice.due_date &&
            invoice.balance_due_cents > 0 &&
            ["sent", "partially_paid"].includes(invoice.status) &&
            invoice.due_date < new Date().toISOString().slice(0, 10)
          ) {
            acc.overdue += 1;
          }
          return acc;
        },
        { total: 0, balance: 0, paid: 0, overdue: 0 }
      ),
    [invoices]
  );

  const openDisputes = disputes.filter(
    (d) => d.status === "open" || d.status === "in_review"
  ).length;

  async function startStripeCheckout(invoice: InvoiceRow) {
    setPaymentError(null);
    setPayingInvoiceId(invoice.id);
    try {
      const res = await fetch(`/api/partner/invoices/${invoice.id}/checkout`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPaymentError(data.error ?? "Unable to start online payment.");
        return;
      }
      const url = data.data?.checkoutUrl;
      if (typeof url !== "string") {
        setPaymentError("Stripe did not return a checkout URL.");
        return;
      }
      window.location.href = url;
    } catch {
      setPaymentError("Network error while starting online payment.");
    } finally {
      setPayingInvoiceId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-800">
        Open any invoice to view details, download a CSV, pay online with Stripe, or pay by check.
        Check payments should be mailed to Ardykay LLC.
      </div>

      {paymentBanner && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">
          {paymentBanner}
        </div>
      )}

      {paymentError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {paymentError}
        </div>
      )}

      <section className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">
        <h2 className="font-semibold">Pay by check</h2>
        <p className="mt-1 whitespace-pre-wrap">{DEFAULT_PAYMENT_INSTRUCTIONS}</p>
        <p className="mt-2 text-xs text-green-700">
          You can also use <strong>Pay Online</strong> on open invoices when Stripe is configured.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        <StatCard label="Invoices" value={invoices.length} />
        <StatCard label="Paid" value={summary.paid} />
        <StatCard label="Overdue" value={summary.overdue} />
        <StatCard label="Open Disputes" value={openDisputes} />
        <StatCard label="Balance Due" value={currency(summary.balance)} />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <button
          onClick={load}
          className="rounded-lg border border-[#1a3a5c] px-4 py-2 text-sm font-semibold text-[#1a3a5c] hover:bg-[#1a3a5c] hover:text-white"
        >
          Refresh
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <p className="py-12 text-center text-sm text-gray-400">Loading invoices…</p>
        ) : invoices.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-sm font-medium text-gray-600">No invoices available.</p>
            <p className="mt-1 text-sm text-gray-400">
              Sent or paid invoice records will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Invoice</th>
                  <th className="px-4 py-3 text-left">Period</th>
                  <th className="px-4 py-3 text-left">Due</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Disputes</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((invoice) => {
                  const invoiceDisputes = disputesByInvoice.get(invoice.id) ?? [];
                  const latestDispute = invoiceDisputes[0];
                  const canPayOnline =
                    ["sent", "partially_paid"].includes(invoice.status) &&
                    invoice.balance_due_cents > 0;
                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-[#0d1b2e]">
                        <Link
                          href={`/partner/invoices/${invoice.id}`}
                          className="text-[#1a3a5c] hover:underline"
                        >
                          {invoice.invoice_number}
                        </Link>
                        <div className="text-xs font-normal text-gray-400">
                          Created {formatDate(invoice.created_at)}
                        </div>
                        {invoice.stripe_payment_status && (
                          <div className="text-xs font-normal text-purple-600">
                            Stripe: {invoice.stripe_payment_status.replace(/_/g, " ")}
                            {invoice.stripe_card_last4
                              ? ` • ${invoice.stripe_payment_method_type ?? "card"} ending ${
                                  invoice.stripe_card_last4
                                }`
                              : ""}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatDate(invoice.period_start)} – {formatDate(invoice.period_end)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatDate(invoice.due_date)}
                        {invoice.reminder_count ? (
                          <div className="text-xs text-gray-400">
                            {invoice.reminder_count} reminder
                            {invoice.reminder_count === 1 ? "" : "s"}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td className="px-4 py-3">
                        {latestDispute ? (
                          <div className="space-y-1">
                            <DisputeBadge status={latestDispute.status} />
                            <div className="text-xs text-gray-400">
                              {invoiceDisputes.length} request
                              {invoiceDisputes.length === 1 ? "" : "s"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs italic text-gray-400">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {currency(invoice.total_cents)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {currency(invoice.balance_due_cents)}
                        {invoice.payment_reference ? (
                          <div className="text-xs font-normal text-gray-400">
                            Ref: {invoice.payment_reference}
                          </div>
                        ) : null}
                      </td>
                      <td className="space-y-2 px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/partner/invoices/${invoice.id}`}
                            className="rounded border border-[#1a3a5c] bg-[#1a3a5c] px-2 py-1 text-xs font-semibold text-white hover:bg-[#0d1b2e]"
                          >
                            Open
                          </Link>
                          <a
                            href={`/api/partner/invoices/${invoice.id}/export`}
                            className="rounded border border-[#1a3a5c] px-2 py-1 text-xs font-semibold text-[#1a3a5c] hover:bg-[#1a3a5c] hover:text-white"
                          >
                            Download
                          </a>
                          {invoice.stripe_receipt_url && (
                            <a
                              href={invoice.stripe_receipt_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded border border-purple-700 px-2 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-50"
                            >
                              Receipt
                            </a>
                          )}
                          <button
                            onClick={() => setSelectedDisputeInvoice(invoice)}
                            className="rounded border border-amber-600 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                          >
                            Question
                          </button>
                          {canPayOnline && (
                            <button
                              onClick={() => startStripeCheckout(invoice)}
                              disabled={payingInvoiceId === invoice.id}
                              className="rounded border border-green-700 bg-green-700 px-2 py-1 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-50"
                            >
                              {payingInvoiceId === invoice.id ? "Opening…" : "Pay Online"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {disputes.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Recent Billing Review Requests
          </h2>
          <div className="mt-3 space-y-2">
            {disputes.slice(0, 5).map((dispute) => (
              <div key={dispute.id} className="rounded-lg border border-gray-100 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-[#0d1b2e]">
                    {DISPUTE_REASON_LABELS[dispute.reason]}
                  </div>
                  <DisputeBadge status={dispute.status} />
                </div>
                <p className="mt-1 text-gray-600">{dispute.details}</p>
                {dispute.admin_resolution_notes && (
                  <p className="mt-2 rounded bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    Admin response: {dispute.admin_resolution_notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {selectedDisputeInvoice && (
        <DisputeModal
          invoice={selectedDisputeInvoice}
          onClose={() => setSelectedDisputeInvoice(null)}
          onCreated={load}
        />
      )}
    </div>
  );
}
