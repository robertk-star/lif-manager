"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AccountStatus = "active" | "inactive" | "pending" | "suspended";
type LeadStatus = "active" | "paused" | "at_capacity";

interface PartnerAccount {
  id: string;
  firm_name: string;
  contact_first_name: string | null;
  contact_last_name: string | null;
  email: string;
  phone: string | null;
  states_served: string | null;
  routing_scope: string | null;
  routing_states: string[] | null;
  routing_excluded_states: string[] | null;
  monthly_lead_capacity: string | null;
  status: AccountStatus;
  accepting_leads: boolean | null;
  lead_status: LeadStatus | null;
  accepted_case_types: string[] | null;
  accepts_initial_filings: boolean | null;
  accepts_appeals: boolean | null;
  accepts_hearings: boolean | null;
  last_login_at: string | null;
  created_at: string;
  internal_notes?: string | null;
  lead_notes?: string | null;
}

const ACCOUNT_STATUS_OPTIONS: AccountStatus[] = [
  "active",
  "inactive",
  "pending",
  "suspended",
];
const LEAD_STATUS_OPTIONS: LeadStatus[] = ["active", "paused", "at_capacity"];

const ACCOUNT_STATUS_COLORS: Record<AccountStatus, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-slate-100 text-slate-700",
  pending: "bg-yellow-100 text-yellow-800",
  suspended: "bg-red-100 text-red-800",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function coverageLabel(p: PartnerAccount) {
  if (p.routing_scope === "united_states") {
    const excluded = p.routing_excluded_states ?? [];
    return excluded.length
      ? `US except ${excluded.join(", ")}`
      : "United States";
  }
  const states = p.routing_states ?? [];
  if (states.length) return states.join(", ");
  return p.states_served || "—";
}

function PartnerDetailModal({
  partnerId,
  onClose,
  onUpdated,
}: {
  partnerId: string;
  onClose: () => void;
  onUpdated: (p: PartnerAccount) => void;
}) {
  const [partner, setPartner] = useState<PartnerAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<AccountStatus>("active");
  const [leadStatus, setLeadStatus] = useState<LeadStatus | "">("");
  const [accepting, setAccepting] = useState(true);
  const [capacity, setCapacity] = useState("");
  const [statesServed, setStatesServed] = useState("");
  const [routingScope, setRoutingScope] = useState("selected_states");
  const [routingStates, setRoutingStates] = useState("");
  const [excludedStates, setExcludedStates] = useState("");
  const [initial, setInitial] = useState(true);
  const [appeals, setAppeals] = useState(true);
  const [hearings, setHearings] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/partners/${partnerId}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Failed to load partner.");
          return;
        }
        const p = data.data as PartnerAccount;
        setPartner(p);
        setStatus(p.status);
        setLeadStatus(p.lead_status ?? "");
        setAccepting(p.accepting_leads !== false);
        setCapacity(p.monthly_lead_capacity ?? "");
        setStatesServed(p.states_served ?? "");
        setRoutingScope(p.routing_scope === "united_states" ? "united_states" : "selected_states");
        setRoutingStates((p.routing_states ?? []).join(", "));
        setExcludedStates((p.routing_excluded_states ?? []).join(", "));
        setInitial(p.accepts_initial_filings !== false);
        setAppeals(p.accepts_appeals !== false);
        setHearings(p.accepts_hearings !== false);
        setNotes(p.internal_notes ?? "");
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
  }, [partnerId]);

  function parseStates(value: string) {
    return value
      .split(/[,;\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => /^[A-Z]{2}$/.test(s));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      const res = await fetch(`/api/admin/partners/${partnerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          lead_status: leadStatus || null,
          accepting_leads: accepting,
          monthly_lead_capacity: capacity,
          states_served: statesServed,
          routing_scope: routingScope,
          routing_states: parseStates(routingStates),
          routing_excluded_states: parseStates(excludedStates),
          accepts_initial_filings: initial,
          accepts_appeals: appeals,
          accepts_hearings: hearings,
          internal_notes: notes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.error ?? "Failed to save.");
        return;
      }
      const updated = data.data as PartnerAccount;
      setPartner(updated);
      onUpdated(updated);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {partner?.firm_name ?? "Partner"}
            </h2>
            {partner && (
              <p className="text-sm text-slate-500">
                {[partner.contact_first_name, partner.contact_last_name]
                  .filter(Boolean)
                  .join(" ") || partner.email}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
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

          {!loading && !error && partner && (
            <>
              <section className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-medium uppercase text-slate-400">Email</p>
                  <p className="text-slate-800">{partner.email}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-400">Phone</p>
                  <p className="text-slate-800">{partner.phone ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-400">Created</p>
                  <p className="text-slate-800">{formatDate(partner.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-400">Last Login</p>
                  <p className="text-slate-800">{formatDate(partner.last_login_at)}</p>
                </div>
              </section>

              <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Routing & Status
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Account Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as AccountStatus)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      {ACCOUNT_STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Lead Status
                    </label>
                    <select
                      value={leadStatus}
                      onChange={(e) => setLeadStatus(e.target.value as LeadStatus | "")}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">—</option>
                      {LEAD_STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={accepting}
                    onChange={(e) => setAccepting(e.target.checked)}
                  />
                  Accepting leads
                </label>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Monthly Capacity
                  </label>
                  <input
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    placeholder="e.g. 25"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Routing Scope
                  </label>
                  <select
                    value={routingScope}
                    onChange={(e) => setRoutingScope(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="selected_states">Selected states</option>
                    <option value="united_states">United States</option>
                  </select>
                </div>

                {routingScope === "selected_states" ? (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Routing States (comma-separated)
                    </label>
                    <input
                      value={routingStates}
                      onChange={(e) => setRoutingStates(e.target.value.toUpperCase())}
                      placeholder="TX, FL, CA"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm uppercase"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Excluded States
                    </label>
                    <input
                      value={excludedStates}
                      onChange={(e) => setExcludedStates(e.target.value.toUpperCase())}
                      placeholder="optional"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm uppercase"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    States Served (legacy text)
                  </label>
                  <input
                    value={statesServed}
                    onChange={(e) => setStatesServed(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={initial}
                      onChange={(e) => setInitial(e.target.checked)}
                    />
                    Initial filings
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={appeals}
                      onChange={(e) => setAppeals(e.target.checked)}
                    />
                    Appeals
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={hearings}
                      onChange={(e) => setHearings(e.target.checked)}
                    />
                    Hearings
                  </label>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Internal Notes
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
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

export default function AdminPartnersPage() {
  const router = useRouter();
  const [partners, setPartners] = useState<PartnerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [leadStatusFilter, setLeadStatusFilter] = useState("");
  const [acceptingFilter, setAcceptingFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (leadStatusFilter) params.set("lead_status", leadStatusFilter);
    if (acceptingFilter) params.set("accepting_leads", acceptingFilter);

    try {
      const res = await fetch(`/api/admin/partners?${params.toString()}`);
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(data.error ?? "Failed to load partners.");
        return;
      }
      setPartners(data.data ?? []);
    } catch {
      setLoadError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, leadStatusFilter, acceptingFilter, router]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

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
            <a href="/admin/partners" className="text-sm font-semibold text-slate-900">
              Partners
            </a>
          </div>
          <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-slate-600">
            Sign Out
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Partners</h1>
          <p className="mt-1 text-sm text-slate-500">
            Who can receive leads and their routing preferences.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              type="text"
              placeholder="Search firm, name, email…"
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
              {ACCOUNT_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={leadStatusFilter}
              onChange={(e) => setLeadStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All lead statuses</option>
              {LEAD_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <select
              value={acceptingFilter}
              onChange={(e) => setAcceptingFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Accepting: All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
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
            <div className="py-16 text-center text-sm text-slate-400">Loading partners…</div>
          ) : partners.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">No partners found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Firm</th>
                    <th className="px-4 py-3 text-left">Contact</th>
                    <th className="px-4 py-3 text-left">Coverage</th>
                    <th className="px-4 py-3 text-left">Capacity</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Accepting</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {partners.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{p.firm_name}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {[p.contact_first_name, p.contact_last_name].filter(Boolean).join(" ") ||
                          p.email}
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3 text-slate-600">
                        {coverageLabel(p)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.monthly_lead_capacity ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                            ACCOUNT_STATUS_COLORS[p.status] ?? "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {p.accepting_leads === false ? (
                          <span className="text-slate-500">No</span>
                        ) : (
                          <span className="font-medium text-green-700">Yes</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedId(p.id)}
                          className="rounded border border-slate-900 px-2 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-900 hover:text-white"
                        >
                          Manage
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
          Showing {partners.length} partner{partners.length !== 1 ? "s" : ""}.
        </p>
      </main>

      {selectedId && (
        <PartnerDetailModal
          partnerId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={(updated) => {
            setPartners((prev) =>
              prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
            );
          }}
        />
      )}
    </div>
  );
}
