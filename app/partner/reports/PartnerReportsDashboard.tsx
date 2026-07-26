"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface CountRow {
  label: string;
  count: number;
}

interface MonthlyTrendRow {
  month: string;
  assigned: number;
  contacted: number;
  accepted: number;
  retained: number;
  declined: number;
}

interface ReportsPayload {
  success: boolean;
  warnings: string[];
  period: { from: string; to: string };
  lead_summary: {
    total_assigned: number;
    new_count: number;
    contacted_count: number;
    accepted_count: number;
    declined_count: number;
    retained_count: number;
    closed_count: number;
    not_viewed_count: number;
    average_hours_to_view: number | null;
    average_hours_to_first_response: number | null;
    contact_rate: number;
    retention_rate: number;
  };
  breakdowns: {
    response_statuses: CountRow[];
    states: CountRow[];
    benefit_types: CountRow[];
    application_statuses: CountRow[];
    billing_statuses: CountRow[];
    invoice_statuses: CountRow[];
    dispute_statuses: CountRow[];
  };
  billing_summary: {
    billable_amount_dollars: number;
    invoiced_amount_dollars: number;
    invoice_total_dollars: number;
    invoice_paid_dollars: number;
    invoice_balance_dollars: number;
    open_invoice_count: number;
    overdue_invoice_count: number;
    open_dispute_count: number;
  };
  monthly_trend: MonthlyTrendRow[];
}

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatHours(value: number | null) {
  if (value === null) return "—";
  if (value < 1) return `${Math.round(value * 60)} min`;
  if (value < 24) return `${value.toFixed(1)} hr`;
  return `${(value / 24).toFixed(1)} days`;
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#0d1b2e]">{value}</p>
      {helper && <p className="mt-1 text-xs text-gray-500">{helper}</p>}
    </div>
  );
}

function BarList({ title, rows }: { title: string; rows: CountRow[] }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-[#0d1b2e]">{title}</h3>
      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm italic text-gray-400">No data for this period.</p>
        ) : (
          rows.map((row) => (
            <div key={row.label}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-gray-600">{titleCase(row.label)}</span>
                <span className="text-gray-400">{row.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-[#1a3a5c]"
                  style={{
                    width: `${Math.max(4, Math.round((row.count / max) * 100))}%`,
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TrendTable({ rows }: { rows: MonthlyTrendRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <h3 className="text-sm font-semibold text-[#0d1b2e]">Monthly Lead Trend</h3>
        <p className="mt-1 text-xs text-gray-500">Assigned leads and partner outcomes by month.</p>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm italic text-gray-400">
          No monthly trend data for this period.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Month</th>
                <th className="px-4 py-3 text-left">Assigned</th>
                <th className="px-4 py-3 text-left">Contacted</th>
                <th className="px-4 py-3 text-left">Accepted</th>
                <th className="px-4 py-3 text-left">Retained</th>
                <th className="px-4 py-3 text-left">Declined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.month} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.month}</td>
                  <td className="px-4 py-3 text-gray-700">{row.assigned}</td>
                  <td className="px-4 py-3 text-gray-700">{row.contacted}</td>
                  <td className="px-4 py-3 text-gray-700">{row.accepted}</td>
                  <td className="px-4 py-3 text-gray-700">{row.retained}</td>
                  <td className="px-4 py-3 text-gray-700">{row.declined}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function PartnerReportsDashboard() {
  const router = useRouter();
  const [from, setFrom] = useState(dateDaysAgo(90));
  const [to, setTo] = useState(today());
  const [data, setData] = useState<ReportsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadReport() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/partner/reports?${params.toString()}`);
      if (res.status === 401) {
        router.push("/partner/login");
        return;
      }
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error ?? "Failed to load partner reports.");
        return;
      }
      setData(payload as ReportsPayload);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = data?.lead_summary;
  const billing = data?.billing_summary;
  const responseRows = useMemo(() => data?.breakdowns.response_statuses ?? [], [data]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">From</label>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">To</label>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]"
            />
          </div>
          <div className="sm:col-span-2 sm:flex sm:items-end sm:justify-end">
            <button
              onClick={loadReport}
              disabled={loading}
              className="w-full rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0d1b2e] disabled:opacity-50 sm:w-auto"
            >
              {loading ? "Loading…" : "Refresh Reports"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {data?.warnings?.length ? (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <p className="font-semibold">Some report sections need review:</p>
          <ul className="mt-1 list-disc pl-5">
            {data.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center text-sm text-gray-400 shadow-sm">
          Loading partner performance reports…
        </div>
      ) : data && summary && billing ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Assigned Leads"
              value={summary.total_assigned}
              helper="In selected period"
            />
            <StatCard
              label="New / Not Started"
              value={summary.new_count}
              helper={`${summary.not_viewed_count} not viewed`}
            />
            <StatCard
              label="Contact Rate"
              value={formatPercent(summary.contact_rate)}
              helper={`${summary.contacted_count} contacted/contact attempted`}
            />
            <StatCard
              label="Retained"
              value={summary.retained_count}
              helper={`${formatPercent(summary.retention_rate)} retention rate`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Accepted" value={summary.accepted_count} />
            <StatCard label="Declined" value={summary.declined_count} />
            <StatCard label="Avg Time to View" value={formatHours(summary.average_hours_to_view)} />
            <StatCard
              label="Avg Time to Respond"
              value={formatHours(summary.average_hours_to_first_response)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <StatCard
              label="Open Invoice Balance"
              value={formatMoney(billing.invoice_balance_dollars)}
              helper={`${billing.open_invoice_count} open invoice(s)`}
            />
            <StatCard
              label="Overdue Invoices"
              value={billing.overdue_invoice_count}
              helper="Sent/partially paid past due"
            />
            <StatCard
              label="Open Billing Questions"
              value={billing.open_dispute_count}
              helper="Open or in review"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BarList title="Lead Response Status" rows={responseRows} />
            <BarList title="Leads by State" rows={data.breakdowns.states} />
            <BarList title="Benefit Types" rows={data.breakdowns.benefit_types} />
            <BarList title="Billing Status" rows={data.breakdowns.billing_statuses} />
          </div>

          <TrendTable rows={data.monthly_trend} />
        </>
      ) : null}
    </div>
  );
}
