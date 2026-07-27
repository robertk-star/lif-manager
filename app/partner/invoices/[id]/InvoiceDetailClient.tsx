"use client";

import { useState } from "react";

type InvoiceStatus = string;

interface InvoiceDetail {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  period_start: string;
  period_end: string;
  due_date: string | null;
  created_at: string;
  finalized_at: string | null;
  total_cents: number;
  amount_paid_cents: number;
  balance_due_cents: number;
  notes: string | null;
  payment_instructions: string;
  payment_reference: string | null;
  stripe_receipt_url: string | null;
  stripe_payment_status: string | null;
  stripe_card_last4: string | null;
  stripe_payment_method_type: string | null;
}

interface InvoiceItem {
  id: string;
  lead_id: string;
  description: string;
  amount_cents: number;
  billing_status_at_creation: string | null;
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

export default function InvoiceDetailClient({
  invoice,
  items,
  firmName,
}: {
  invoice: InvoiceDetail;
  items: InvoiceItem[];
  firmName: string;
}) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canPayOnline =
    ["sent", "partially_paid"].includes(invoice.status) && invoice.balance_due_cents > 0;

  async function startStripeCheckout() {
    setError(null);
    setPaying(true);
    try {
      const res = await fetch(`/api/partner/invoices/${invoice.id}/checkout`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Unable to start online payment.");
        return;
      }
      const url = data.data?.checkoutUrl;
      if (typeof url !== "string") {
        setError("Stripe did not return a checkout URL.");
        return;
      }
      window.location.href = url;
    } catch {
      setError("Network error while starting online payment.");
    } finally {
      setPaying(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 print:hidden">
        <a
          href={`/api/partner/invoices/${invoice.id}/export`}
          className="rounded-lg border border-[#1a3a5c] px-4 py-2 text-sm font-semibold text-[#1a3a5c] hover:bg-[#1a3a5c] hover:text-white"
        >
          Download CSV
        </a>
        <button
          onClick={handlePrint}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Print / Save PDF
        </button>
        {invoice.stripe_receipt_url && (
          <a
            href={invoice.stripe_receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-purple-700 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-50"
          >
            Stripe Receipt
          </a>
        )}
        {canPayOnline && (
          <button
            onClick={startStripeCheckout}
            disabled={paying}
            className="rounded-lg border border-green-700 bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
          >
            {paying ? "Opening Stripe…" : "Pay Online with Stripe"}
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
          {error}
        </p>
      )}

      {/* Printable invoice document */}
      <article className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
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
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[invoice.status] ?? STATUS_COLORS.sent}`}
              >
                {STATUS_LABELS[invoice.status] ?? invoice.status}
              </span>
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Bill to</p>
            <p className="mt-1 font-semibold text-[#0d1b2e]">{firmName}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Period</p>
            <p className="mt-1 text-sm text-gray-700">
              {formatDate(invoice.period_start)} – {formatDate(invoice.period_end)}
            </p>
            {invoice.finalized_at && (
              <p className="text-xs text-gray-500">Finalized {formatDate(invoice.finalized_at)}</p>
            )}
          </div>
        </div>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-4">Description</th>
                <th className="py-2 pr-4">Lead ID</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-gray-400">
                    No line items on this invoice.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 pr-4 text-gray-800">{item.description}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-gray-500">{item.lead_id}</td>
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
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Pay by check
            </p>
            <div className="mt-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
              <p className="font-semibold">Ardykay LLC</p>
              <p>5722 Goresseto Dr.</p>
              <p>Frisco, TX 75034</p>
              <p className="mt-2 text-xs">
                Include invoice <strong>{invoice.invoice_number}</strong> in the memo.
              </p>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-xs text-gray-600">
              {invoice.payment_instructions}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Pay online
            </p>
            <p className="mt-2 text-sm text-gray-600">
              Use <strong>Pay Online with Stripe</strong> above to pay the balance by card.
            </p>
            {invoice.stripe_payment_status && (
              <p className="mt-2 text-xs text-purple-700">
                Stripe status: {invoice.stripe_payment_status.replace(/_/g, " ")}
                {invoice.stripe_card_last4
                  ? ` • ${invoice.stripe_payment_method_type ?? "card"} ending ${
                      invoice.stripe_card_last4
                    }`
                  : ""}
              </p>
            )}
            {invoice.payment_reference && (
              <p className="mt-1 text-xs text-gray-500">Reference: {invoice.payment_reference}</p>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
