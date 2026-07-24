"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const RESPONSE_STATUSES = [
  "new",
  "reviewing",
  "contact_attempted",
  "contacted",
  "accepted",
  "declined",
  "retained",
  "closed",
] as const;

type ResponseStatus = (typeof RESPONSE_STATUSES)[number];

interface LeadRow {
  id: string;
  created_at: string;
  assigned_at: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  benefit_type: string | null;
  application_status: string | null;
  partner_response_status: string | null;
  partner_viewed_at: string | null;
}

interface LeadDetail extends LeadRow {
  medical_summary: string | null;
  additional_notes: string | null;
  partner_notes: string | null;
  partner_response_updated_at: string | null;
}

function nameOf(l: { first_name: string | null; last_name: string | null }) {
  return `${l.first_name ?? ""} ${l.last_name ?? ""}`.trim() || "Unnamed Lead";
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function LeadModal({
  leadId,
  onClose,
  onUpdated,
}: {
  leadId: string;
  onClose: () => void;
  onUpdated: (row: Partial<LeadRow> & { id: string }) => void;
}) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ResponseStatus>("new");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/partner/leads/${leadId}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Failed to load lead.");
          return;
        }
        const full = data.data as LeadDetail;
        setLead(full);
        setStatus((full.partner_response_status as ResponseStatus) || "new");
        setNotes(full.partner_notes ?? "");
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
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/partner/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partner_response_status: status,
          partner_notes: notes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveMsg(data.error ?? "Save failed.");
        return;
      }
      const updated = data.data as LeadDetail;
      setLead(updated);
      onUpdated(updated);
      setSaveMsg("Saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">
            {lead ? nameOf(lead) : "Lead"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            ✕
          </button>
        </div>
        <div className="max-h-[75vh] space-y-5 overflow-y-auto px-6 py-5">
          {loading && <p className="py-10 text-center text-sm text-slate-400">Loading…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && lead && (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs uppercase text-slate-400">Phone</p>
                  <p>{lead.phone ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Email</p>
                  <p>{lead.email ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Location</p>
                  <p>
                    {[lead.city, lead.state, lead.zip].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Assigned</p>
                  <p>{formatDate(lead.assigned_at)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Benefit</p>
                  <p>{lead.benefit_type ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Application</p>
                  <p>{lead.application_status ?? "—"}</p>
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs uppercase text-slate-400">Medical Summary</p>
                <p className="whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {lead.medical_summary || "Not provided."}
                </p>
              </div>

              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ResponseStatus)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {RESPONSE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Notes</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                {saveMsg && <p className="text-xs text-slate-600">{saveMsg}</p>}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PartnerLeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("partner_response_status", statusFilter);

    try {
      const res = await fetch(`/api/partner/leads?${params.toString()}`);
      if (res.status === 401) {
        router.push("/partner/login");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to load leads.");
        return;
      }
      setLeads(data.data ?? []);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, router]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  async function handleLogout() {
    await fetch("/api/partner/logout", { method: "POST" });
    router.push("/partner/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b border-slate-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-sm font-bold text-slate-900">LIF Partner</span>
            <a href="/partner/leads" className="text-sm font-semibold text-slate-900">
              My Leads
            </a>
          </div>
          <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-slate-600">
            Sign Out
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Assigned Leads</h1>
          <p className="mt-1 text-sm text-slate-500">
            Leads routed to your firm. Update status as you work them.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
          <input
            type="text"
            placeholder="Search name, email, phone, state…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {RESPONSE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {error && (
            <div className="border-b border-red-100 bg-red-50 px-6 py-4 text-sm text-red-600">
              {error}
            </div>
          )}
          {loading ? (
            <div className="py-16 text-center text-sm text-slate-400">Loading leads…</div>
          ) : leads.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">No assigned leads yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Assigned</th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">State</th>
                    <th className="px-4 py-3 text-left">Benefit</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                        {formatDate(lead.assigned_at)}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{nameOf(lead)}</td>
                      <td className="px-4 py-3 text-slate-600">{lead.state ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{lead.benefit_type ?? "—"}</td>
                      <td className="px-4 py-3 capitalize text-slate-600">
                        {(lead.partner_response_status ?? "new").replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedId(lead.id)}
                          className="rounded border border-slate-900 px-2 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-900 hover:text-white"
                        >
                          Open
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
        <LeadModal
          leadId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={(updated) => {
            setLeads((prev) =>
              prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l))
            );
          }}
        />
      )}
    </div>
  );
}
