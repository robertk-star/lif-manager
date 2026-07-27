"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type LeadStatus =
  | "new"
  | "reviewing"
  | "ready_to_assign"
  | "assigned"
  | "closed"
  | "rejected"
  | "spam";

interface LeadRow {
  id: string;
  created_at: string;
  source: string | null;
  external_reference_id: string | null;
  dbs_report_number: string | null;
  dbs_consent_given: boolean | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  benefit_type: string | null;
  application_status: string | null;
  status: LeadStatus;
  assigned_partner_account_id: string | null;
  assigned_partner_name: string | null;
  assigned_at: string | null;
  partner_response_status: string | null;
}

interface LeadDetail extends LeadRow {
  medical_summary: string | null;
  additional_notes: string | null;
  internal_review_notes: string | null;
  consent_given: boolean | null;
  dbs_consent_source: string | null;
  dbs_consent_timestamp: string | null;
  dbs_received_at: string | null;
  partner_notes: string | null;
  partner_viewed_at: string | null;
  raw_payload: Record<string, unknown> | null;
}

interface PartnerAccount {
  id: string;
  firm_name: string;
  status: string;
}

const STATUS_OPTIONS: LeadStatus[] = [
  "new",
  "reviewing",
  "ready_to_assign",
  "assigned",
  "closed",
  "rejected",
  "spam",
];

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: "bg-blue-100 text-blue-800",
  reviewing: "bg-yellow-100 text-yellow-800",
  ready_to_assign: "bg-purple-100 text-purple-800",
  assigned: "bg-green-100 text-green-800",
  closed: "bg-slate-100 text-slate-600",
  rejected: "bg-orange-100 text-orange-700",
  spam: "bg-red-100 text-red-700",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
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

function nameOf(lead: { first_name: string | null; last_name: string | null }) {
  const n = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim();
  return n || null;
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">
        {value != null && value !== "" ? value : <span className="italic text-slate-400">—</span>}
      </dd>
    </div>
  );
}

function LeadDetailModal({
  leadId,
  partners,
  onClose,
  onUpdated,
}: {
  leadId: string;
  partners: PartnerAccount[];
  onClose: () => void;
  onUpdated: (updated: Partial<LeadDetail> & { id: string }) => void;
}) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<LeadStatus>("new");
  const [notes, setNotes] = useState("");
  const [assignedId, setAssignedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/admin/leads/${leadId}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Failed to load lead.");
          return;
        }
        const full = data.data as LeadDetail;
        setLead(full);
        setStatus(full.status);
        setNotes(full.internal_review_notes ?? "");
        setAssignedId(full.assigned_partner_account_id ?? "");
      })
      .catch(() => {
        if (!cancelled) setError("Network error.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [leadId]);

  async function handleSave() {
    if (!lead) return;
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);

    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          internal_review_notes: notes,
          assigned_partner_account_id: assignedId || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.error ?? "Failed to save.");
        return;
      }
      const updated = { id: lead.id, ...data.data } as Partial<LeadDetail> & { id: string };
      setLead((prev) => (prev ? { ...prev, ...updated } : prev));
      onUpdated(updated);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {lead ? nameOf(lead) ?? "Unnamed Lead" : "Lead Detail"}
            </h2>
            {lead && (
              <p className="mt-0.5 text-xs text-slate-400">
                Received {formatDateTime(lead.created_at)}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[75vh] space-y-6 overflow-y-auto px-6 py-5">
          {loading && <p className="py-12 text-center text-sm text-slate-400">Loading…</p>}
          {!loading && error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {!loading && !error && lead && (
            <>
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Source
                </h3>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <Field
                    label="Source"
                    value={
                      lead.source === "disabilitybenefitsscreening" ? "DBS" : lead.source
                    }
                  />
                  <Field label="DBS Report #" value={lead.dbs_report_number} />
                  <Field label="External Ref" value={lead.external_reference_id} />
                  <Field
                    label="Consent"
                    value={
                      lead.dbs_consent_given === true || lead.consent_given === true
                        ? "Yes"
                        : "No"
                    }
                  />
                </dl>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Contact
                </h3>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <Field label="First Name" value={lead.first_name} />
                  <Field label="Last Name" value={lead.last_name} />
                  <Field label="Phone" value={lead.phone} />
                  <Field label="Email" value={lead.email} />
                  <Field label="City" value={lead.city} />
                  <Field label="State" value={lead.state} />
                  <Field label="ZIP" value={lead.zip} />
                </dl>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Benefit
                </h3>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <Field label="Benefit Type" value={lead.benefit_type} />
                  <Field label="Application Status" value={lead.application_status} />
                </dl>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Medical Summary
                </h3>
                {lead.medical_summary ? (
                  <p className="whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {lead.medical_summary}
                  </p>
                ) : (
                  <p className="text-sm italic text-slate-400">Not provided.</p>
                )}
              </section>

              <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Admin Actions
                </h3>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as LeadStatus)}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Assign Partner
                  </label>
                  <select
                    value={assignedId}
                    onChange={(e) => setAssignedId(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">— Unassigned —</option>
                    {partners
                      .filter((p) => p.status === "active")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.firm_name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Internal Notes
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="block w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="Add internal notes…"
                  />
                </div>

                {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                {saveOk && <p className="text-xs text-green-600">Saved.</p>}

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminLeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [partners, setPartners] = useState<PartnerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assignedFilter, setAssignedFilter] = useState("");

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (stateFilter) params.set("state", stateFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (assignedFilter) params.set("assigned", assignedFilter);

    try {
      const res = await fetch(`/api/admin/leads?${params.toString()}`);
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(data.error ?? "Failed to load leads.");
        return;
      }
      setLeads(data.data ?? []);
    } catch {
      setLoadError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [search, stateFilter, statusFilter, assignedFilter, router]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    fetch("/api/admin/partners?status=active&limit=200")
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setPartners(d.data);
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  function handleUpdated(updated: Partial<LeadDetail> & { id: string }) {
    setLeads((prev) =>
      prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l))
    );
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
            <a href="/admin/leads" className="text-sm font-semibold text-slate-900">
              Leads
            </a>
            <a href="/admin/partners" className="text-sm text-slate-500 hover:text-slate-900">
              Partners
            </a>
            <a href="/admin/invoices" className="text-sm text-slate-500 hover:text-slate-900">
              Invoices
            </a>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Sign Out
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lead Queue</h1>
          <p className="mt-1 text-sm text-slate-500">
            Leads from DBS. Auto-routed on ingest; you can reassign manually here.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              type="text"
              placeholder="Search name, email, phone, ref…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="State (e.g. TX)"
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value.toUpperCase())}
              maxLength={2}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <select
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All Assignments</option>
              <option value="false">Unassigned</option>
              <option value="true">Assigned</option>
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
            <div className="flex items-center justify-center py-16 text-sm text-slate-400">
              Loading leads…
            </div>
          ) : leads.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-400">
              No leads found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Received</th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">State</th>
                    <th className="px-4 py-3 text-left">Benefit</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Partner</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                        {formatDate(lead.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                        {nameOf(lead) ?? <span className="italic text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{lead.state ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{lead.benefit_type ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                            STATUS_COLORS[lead.status] ?? "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {lead.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {lead.assigned_partner_name ?? (
                          <span className="italic text-slate-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedId(lead.id)}
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

        <p className="text-center text-xs text-slate-400">
          Showing {leads.length} lead{leads.length !== 1 ? "s" : ""}.
        </p>
      </main>

      {selectedId && (
        <LeadDetailModal
          leadId={selectedId}
          partners={partners}
          onClose={() => setSelectedId(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
