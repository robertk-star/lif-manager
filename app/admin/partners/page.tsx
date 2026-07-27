"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AccountStatus = "active" | "inactive" | "pending" | "suspended";
type LeadStatus = "active" | "paused" | "at_capacity";
type UserRole = "owner" | "admin" | "staff" | "viewer";

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
}

interface PartnerUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  status: string;
  last_login_at: string | null;
  invited_at: string | null;
  receives_invoice_emails?: boolean;
}

const ACCOUNT_STATUS_OPTIONS: AccountStatus[] = [
  "active",
  "inactive",
  "pending",
  "suspended",
];
const LEAD_STATUS_OPTIONS: LeadStatus[] = ["active", "paused", "at_capacity"];
const ROLE_OPTIONS: UserRole[] = ["owner", "admin", "staff", "viewer"];

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
    return excluded.length ? `US except ${excluded.join(", ")}` : "United States";
  }
  const states = p.routing_states ?? [];
  if (states.length) return states.join(", ");
  return p.states_served || "—";
}

function PartnerUsersSection({ partnerAccountId }: { partnerAccountId: string }) {
  const [users, setUsers] = useState<PartnerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("owner");
  const [receivesInvoiceEmails, setReceivesInvoiceEmails] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toggleBusy, setToggleBusy] = useState<string | null>(null);
  const [linkByUser, setLinkByUser] = useState<
    Record<string, { url: string; expiry: string }>
  >({});
  const [linkBusy, setLinkBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/partners/${partnerAccountId}/users`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to load users.");
        return;
      }
      setUsers(data.data ?? []);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [partnerAccountId]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/admin/partners/${partnerAccountId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          role,
          status: "active",
          receives_invoice_emails: receivesInvoiceEmails,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error ?? "Failed to create user.");
        return;
      }
      setUsers((prev) => [...prev, data.data as PartnerUser]);
      setShowForm(false);
      setFirstName("");
      setLastName("");
      setEmail("");
      setRole("owner");
      setReceivesInvoiceEmails(true);
    } finally {
      setSaving(false);
    }
  }

  async function setUserStatus(userId: string, status: string) {
    const res = await fetch(`/api/admin/partner-users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.data) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...data.data } : u)));
    }
  }

  async function setInvoiceEmailPref(userId: string, enabled: boolean) {
    setToggleBusy(userId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/partner-users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receives_invoice_emails: enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to update invoice email preference.");
        return;
      }
      if (data.data) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...data.data } : u)));
      }
    } finally {
      setToggleBusy(null);
    }
  }

  async function generateLink(userId: string) {
    setLinkBusy(userId);
    try {
      const res = await fetch(`/api/admin/partner-users/${userId}/generate-login-link`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to generate link.");
        return;
      }
      setLinkByUser((prev) => ({
        ...prev,
        [userId]: { url: data.loginUrl, expiry: data.expiresAt },
      }));
    } finally {
      setLinkBusy(null);
    }
  }

  function copyLink(userId: string) {
    const link = linkByUser[userId];
    if (!link) return;
    navigator.clipboard.writeText(link.url).then(() => {
      setCopied(userId);
      setTimeout(() => setCopied(null), 2500);
    });
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Partner Users (login)
        </h3>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded border border-slate-900 px-2 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-900 hover:text-white"
          >
            + Add User
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Partners sign in with the email on a user below (code emailed) or via a one-time link you
        generate. Use <strong>Invoice emails</strong> to choose who gets a copy when you mark an
        invoice Sent.
      </p>

      {showForm && (
        <form
          onSubmit={handleAddUser}
          className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
        >
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <input
            required
            type="email"
            placeholder="Email (used to log in)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={role}
            onChange={(e) => {
              const next = e.target.value as UserRole;
              setRole(next);
              setReceivesInvoiceEmails(next === "owner" || next === "admin");
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={receivesInvoiceEmails}
              onChange={(e) => setReceivesInvoiceEmails(e.target.checked)}
            />
            Receive invoice emails
          </label>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Create User"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && <p className="text-sm text-slate-400">Loading users…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && users.length === 0 && (
        <p className="text-sm text-slate-400">
          No users yet. Add at least one so the partner can log in.
        </p>
      )}

      <div className="space-y-3">
        {users.map((user) => (
          <div key={user.id} className="rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {user.first_name} {user.last_name}
                </p>
                <p className="text-xs text-slate-500">{user.email}</p>
                <p className="mt-1 text-xs capitalize text-slate-500">
                  {user.role} · {user.status} · last login {formatDate(user.last_login_at)}
                </p>
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    disabled={toggleBusy === user.id || user.status !== "active"}
                    checked={Boolean(user.receives_invoice_emails)}
                    onChange={(e) => setInvoiceEmailPref(user.id, e.target.checked)}
                  />
                  <span className="font-medium">Invoice emails</span>
                  {toggleBusy === user.id && (
                    <span className="text-slate-400">Saving…</span>
                  )}
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {user.status !== "active" && (
                  <button
                    type="button"
                    onClick={() => setUserStatus(user.id, "active")}
                    className="rounded border border-green-600 px-2 py-1 text-xs font-semibold text-green-700"
                  >
                    Activate
                  </button>
                )}
                {user.status === "active" && (
                  <button
                    type="button"
                    onClick={() => setUserStatus(user.id, "inactive")}
                    className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600"
                  >
                    Deactivate
                  </button>
                )}
                <button
                  type="button"
                  disabled={linkBusy === user.id}
                  onClick={() => generateLink(user.id)}
                  className="rounded border border-slate-900 px-2 py-1 text-xs font-semibold text-slate-900 disabled:opacity-50"
                >
                  {linkBusy === user.id ? "Generating…" : "Generate Login Link"}
                </button>
              </div>
            </div>

            {linkByUser[user.id] && (
              <div className="mt-2 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-2">
                <p className="text-xs font-semibold text-amber-800">
                  One-time link — expires {formatDate(linkByUser[user.id].expiry)}. Send to partner
                  once.
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={linkByUser[user.id].url}
                    className="min-w-0 flex-1 truncate rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => copyLink(user.id)}
                    className="shrink-0 rounded bg-slate-900 px-2 py-1 text-xs font-semibold text-white"
                  >
                    {copied === user.id ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
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
              <PartnerUsersSection partnerAccountId={partner.id} />

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
            <a href="/admin/invoices" className="text-sm text-slate-500 hover:text-slate-900">
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
          <h1 className="text-2xl font-bold text-slate-900">Partners</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage firms, routing, login users, and who receives invoice emails.
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
