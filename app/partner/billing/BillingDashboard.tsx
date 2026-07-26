"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type BillingStatus =
  | "not_reviewed"
  | "review_needed"
  | "not_billable"
  | "billable"
  | "invoiced"
  | "waived"
  | "disputed";

interface BillingLead {
  id: string;
  external_reference_id: string | null;
  claimant_name: string;
  state: string | null;
  benefit_type: string | null;
  application_status: string | null;
  assigned_at: string | null;
  partner_response_status: string | null;
  partner_response_updated_at: string | null;
  billable_status: BillingStatus;
  billing_amount_cents: number | null;
  billing_amount_dollars: number;
  billing_notes: string | null;
  billing_reviewed_at: string | null;
  billing_updated_at: string | null;
}

interface BillingSummary {
  total_leads: number;
  billable_count: number;
  billable_amount_dollars: number;
  invoiced_count: number;
  invoiced_amount_dollars: number;
  review_needed_count: number;
  disputed_count: number;
  status_counts: Record<string, number>;
}

interface BillingData {
  partner: { id: string; firm_name: string; status: string };
  period: { from: string; to: string };
  summary: BillingSummary;
  allowed_statuses: BillingStatus[];
  leads: BillingLead[];
  note: string;
}

const STATUS_LABELS: Record<BillingStatus, string> = {
  not_reviewed: "Not Reviewed",
  review_needed: "Review Needed",
  not_billable: "Not Billable",
  billable: "Billable",
  invoiced: "Invoiced",
  waived: "Waived",
  disputed: "Disputed",
};

const STATUS_COLORS: Record<BillingStatus, string> = {
  not_reviewed: "bg-gray-100 text-gray-700",
  review_needed: "bg-yellow-100 text-yellow-800",
  not_billable: "bg-slate-100 text-slate-700",
  billable: "bg-green-100 text-green-800",
  invoiced: "bg-blue-100 text-blue-800",
  waived: "bg-purple-100 text-purple-800",
  disputed: "bg-red-100 text-red-700",
};

const DEFAULT_STATUSES: BillingStatus[] = [
  "billable",
  "invoiced",
  "review_needed",
  "disputed",
];

function monthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

function today(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function dollars(amount: number) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ status }: { status: BillingStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#0d1b2e]">{value}</p>
      {subtext && <p className="mt-1 text-xs text-gray-400">{subtext}</p>}
    </div>
  );
}

export default function BillingDashboard() {
  const router = useRouter();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [statuses, setStatuses] = useState<BillingStatus[]>(DEFAULT_STATUSES);
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const statusParam = useMemo(() => statuses.join(","), [statuses]);

  const fetchBilling = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (statusParam) params.set("billing_statuses", statusParam);

    try {
      const res = await fetch(`/api/partner/billing?${params.toString()}`);
      if (res.status === 401) {
        router.push("/partner/login");
        return;
      }
      const response = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(response.error ?? "Failed to load billing statement.");
        return;
      }
      setData(response.data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [from, router, statusParam, to]);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  function toggleStatus(status: BillingStatus) {
    setStatuses((current) => {
      if (current.includes(status)) {
        const next = current.filter((item) => item !== status);
        return next.length ? next : current;
      }
      return [...current, status];
    });
  }

  function exportUrl() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (statusParam) params.set("billing_statuses", statusParam);
    return `/api/partner/billing/export?${params.toString()}`;
  }

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        <strong>Billing statement preview only.</strong> This page shows lead billing status and
        amounts reviewed by Legal Intake Flow admin. It is not an invoice and does not process
        payments.
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">From</label>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">To</label>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Included Billing Statuses
            </label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_LABELS) as BillingStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleStatus(status)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    statuses.includes(status)
                      ? "border-[#1a3a5c] bg-[#1a3a5c] text-white"
                      : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={fetchBilling}
              className="flex-1 rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0d1b2e]"
            >
              Refresh
            </button>
            <a
              href={exportUrl()}
              className="rounded-lg border border-[#1a3a5c] px-4 py-2 text-sm font-semibold text-[#1a3a5c] transition hover:bg-[#1a3a5c] hover:text-white"
            >
              CSV
            </a>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-400 shadow-sm">
          Loading billing statement…
        </div>
      ) : data && summary ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard
              label="Tracked Leads"
              value={summary.total_leads}
              subtext="For selected period/statuses"
            />
            <SummaryCard
              label="Billable"
              value={summary.billable_count}
              subtext={dollars(summary.billable_amount_dollars)}
            />
            <SummaryCard
              label="Invoiced"
              value={summary.invoiced_count}
              subtext={dollars(summary.invoiced_amount_dollars)}
            />
            <SummaryCard label="Needs Review" value={summary.review_needed_count} />
            <SummaryCard label="Disputed" value={summary.disputed_count} />
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-semibold text-[#0d1b2e]">Statement Leads</h2>
              <p className="mt-1 text-xs text-gray-400">
                {data.partner.firm_name} · {data.period.from} to {data.period.to}
              </p>
            </div>

            {data.leads.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="text-sm font-medium text-gray-600">
                  No billing records found for this filter.
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  Try expanding the date range or including more billing statuses.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Assigned</th>
                      <th className="px-4 py-3 text-left">Lead</th>
                      <th className="px-4 py-3 text-left">State</th>
                      <th className="px-4 py-3 text-left">Benefit</th>
                      <th className="px-4 py-3 text-left">Partner Response</th>
                      <th className="px-4 py-3 text-left">Billing Status</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-left">Reviewed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.leads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                          {formatDate(lead.assigned_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{lead.claimant_name}</div>
                          <div className="text-xs text-gray-400">
                            {lead.external_reference_id ?? "No external ref"}
                          </div>
                          {lead.billing_notes && (
                            <div className="mt-1 max-w-xs text-xs text-gray-500">
                              {lead.billing_notes}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{lead.state ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-600">{lead.benefit_type ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {lead.partner_response_status?.replace(/_/g, " ") ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={lead.billable_status} />
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {dollars(lead.billing_amount_dollars)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                          {formatDate(lead.billing_reviewed_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
