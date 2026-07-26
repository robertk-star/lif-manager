"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type InvoiceStatus = "sent" | "partially_paid" | "paid" | "draft" | "void";

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
  payment_instructions: string | null;
  payment_reference: string | null;
  stripe_receipt_url: string | null;
  stripe_payment_status: string | null;
  stripe_card_last4: string | null;
  stripe_payment_method_type: string | null;
}

interface InvoiceDispute {
  id: string;
  created_at: string;
  invoice_id: string;
  reason: string;
  details: string | null;
  status: string;
  admin_resolution_notes: string | null;
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

function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[status] ?? STATUS_COLORS.sent}`}
    >
      {STATUS_LABELS[status] ?? status}
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

export default function PartnerInvoicesDashboard() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [disputes, setDisputes] = useState<InvoiceDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-800">
        This page shows invoice records for your firm. Payment questions can be raised with Legal
        Intake Flow admin.
      </div>

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
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-[#0d1b2e]">
                      {invoice.invoice_number}
                      <div className="text-xs font-normal text-gray-400">
                        Created {formatDate(invoice.created_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(invoice.period_start)} – {formatDate(invoice.period_end)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(invoice.due_date)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {currency(invoice.total_cents)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {currency(invoice.balance_due_cents)}
                    </td>
                  </tr>
                ))}
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
                <div className="font-semibold capitalize text-[#0d1b2e]">
                  {dispute.reason.replace(/_/g, " ")} · {dispute.status.replace(/_/g, " ")}
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
    </div>
  );
}
