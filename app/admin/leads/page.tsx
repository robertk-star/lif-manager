"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type LeadStatus = "new" | "reviewing" | "ready_to_assign" | "assigned" | "closed" | "rejected" | "spam";

interface LeadRow {
  id: string;
  created_at: string;
  source: string | null;
  external_reference_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  caller_id: string | null;
  email: string | null;
  state: string | null;
  status: LeadStatus;
  assigned_partner_account_id: string | null;
  assigned_partner_name: string | null;
  billable_status: string | null;
  billing_amount_cents: number | null;
}

interface LeadDetail extends LeadRow {
  medical_summary: string | null;
  internal_review_notes: string | null;
  city: string | null;
  zip: string | null;
  benefit_type: string | null;
  application_status: string | null;
  consent_given: boolean | null;
  dbs_consent_given: boolean | null;
  dbs_report_number: string | null;
}

interface PartnerAccount { id: string; firm_name: string; status: string }

const STATUS_OPTIONS: LeadStatus[] = ["new", "reviewing", "ready_to_assign", "assigned", "closed", "rejected", "spam"];
const BILLABLE_OPTIONS = [
  { value: "", label: "— Not set —" },
  { value: "not_billable", label: "Not billable" },
  { value: "billable", label: "Billable" },
  { value: "invoiced", label: "Invoiced" },
  { value: "paid", label: "Paid" },
  { value: "waived", label: "Waived" },
];

function nameOf(lead: { first_name: string | null; last_name: string | null }) {
  const n = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim();
  return n || null;
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value != null && value !== "" ? value : <span className="italic text-slate-400">—</span>}</dd>
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
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [status, setStatus] = useState<LeadStatus>("new");
  const [assignedId, setAssignedId] = useState("");
  const [billableStatus, setBillableStatus] = useState("");
  const [billingAmountDollars, setBillingAmountDollars] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [benefitType, setBenefitType] = useState("");
  const [applicationStatus, setApplicationStatus] = useState("");
  const [medicalSummary, setMedicalSummary] = useState("");
  const [addAssignedId, setAddAssignedId] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    try {
      const res = await fetch(`/api/admin/leads?${params}`);
      if (res.status === 401) { router.push("/admin/login"); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setLoadError(data.error ?? "Failed to load leads."); return; }
      setLeads(data.data ?? []);
    } catch { setLoadError("Network error."); }
    finally { setLoading(false); }
  }, [search, statusFilter, router]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => {
    fetch("/api/admin/partners?status=active&limit=200").then((r) => r.json()).then((d) => { if (d.data) setPartners(d.data); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    fetch(`/api/admin/leads/${selectedId}`).then((r) => r.json()).then((d) => {
      if (!d.data) return;
      const full = d.data as LeadDetail;
      setDetail(full);
      setStatus(full.status);
      setAssignedId(full.assigned_partner_account_id ?? "");
      setBillableStatus(full.billable_status ?? "");
      setBillingAmountDollars(full.billing_amount_cents != null ? (full.billing_amount_cents / 100).toFixed(2) : "");
      setNotes(full.internal_review_notes ?? "");
    }).catch(() => {});
  }, [selectedId]);

  async function handleSaveDetail() {
    if (!detail) return;
    setSaving(true);
    setSaveMsg(null);
    let billing_amount_cents: number | null = null;
    const t = billingAmountDollars.trim();
    if (t !== "") {
      const dollars = Number(t);
      if (!Number.isFinite(dollars) || dollars < 0) { setSaveMsg("Invalid billing amount."); setSaving(false); return; }
      billing_amount_cents = Math.round(dollars * 100);
    }
    try {
      const res = await fetch(`/api/admin/leads/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, internal_review_notes: notes, assigned_partner_account_id: assignedId || null, billable_status: billableStatus || null, billing_amount_cents }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveMsg(data.error ?? "Save failed."); return; }
      setDetail({ ...detail, ...data.data });
      setLeads((prev) => prev.map((l) => (l.id === detail.id ? { ...l, ...data.data } : l)));
      setSaveMsg("Saved.");
    } finally { setSaving(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setAddError(null);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, phone, email, city, state, zip, benefit_type: benefitType, application_status: applicationStatus, medical_summary: medicalSummary, assigned_partner_account_id: addAssignedId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setAddError(data.error ?? "Create failed."); return; }
      setLeads((prev) => [data.data, ...prev]);
      setShowAdd(false);
    } finally { setCreating(false); }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b border-slate-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-sm font-bold text-slate-900">LIF Manager</span>
            <a href="/admin" className="text-sm text-slate-500 hover:text-slate-900">Dashboard</a>
            <a href="/admin/leads" className="text-sm font-semibold text-slate-900">Leads</a>
            <a href="/admin/partners" className="text-sm text-slate-500 hover:text-slate-900">Partners</a>
            <a href="/admin/invoices" className="text-sm text-slate-500 hover:text-slate-900">Invoices</a>
          </div>
          <button onClick={async () => { await fetch("/api/admin/logout", { method: "POST" }); router.push("/admin/login"); }} className="text-xs text-slate-400 hover:text-slate-600">Sign Out</button>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Lead Queue</h1>
            <p className="mt-1 text-sm text-slate-500">Leads from DBS, Retell (via DBS), or manual entry.</p>
          </div>
          <button type="button" onClick={() => setShowAdd(true)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">+ Add Lead</button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
          <button type="button" onClick={fetchLeads} className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Refresh</button>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loadError && <div className="border-b border-red-100 bg-red-50 px-6 py-4 text-sm text-red-600">{loadError}</div>}
          {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading leads…</div> : leads.length === 0 ? <div className="py-16 text-center text-sm text-slate-400">No leads found.</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Received</th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">State</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Partner</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{new Date(lead.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{nameOf(lead) ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{lead.state ?? "—"}</td>
                      <td className="px-4 py-3 capitalize">{lead.status.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{lead.assigned_partner_name ?? "Unassigned"}</td>
                      <td className="px-4 py-3"><button type="button" onClick={() => setSelectedId(lead.id)} className="rounded border border-slate-900 px-2 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-900 hover:text-white">View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {selectedId && detail && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">{nameOf(detail) ?? "Lead Detail"}</h2>
              <button type="button" onClick={() => setSelectedId(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">✕</button>
            </div>
            <div className="max-h-[75vh] space-y-5 overflow-y-auto px-6 py-5">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Source" value={detail.source === "disabilitybenefitsscreening" ? "DBS" : detail.source === "manual" ? "Manual" : detail.source} />
                <Field label="External Ref" value={detail.external_reference_id} />
                <Field label="Phone" value={detail.phone} />
                <Field label="Caller ID" value={detail.caller_id} />
                <Field label="Email" value={detail.email} />
                <Field label="State" value={detail.state} />
                <Field label="Benefit Type" value={detail.benefit_type} />
                <Field label="Application Status" value={detail.application_status} />
              </dl>
              {detail.medical_summary && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-slate-400">Medical Summary</p>
                  <p className="whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">{detail.medical_summary}</p>
                </div>
              )}
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">{STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select>
                <select value={assignedId} onChange={(e) => setAssignedId(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">— Unassigned —</option>{partners.filter((p) => p.status === "active").map((p) => <option key={p.id} value={p.id}>{p.firm_name}</option>)}</select>
                <select value={billableStatus} onChange={(e) => setBillableStatus(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">{BILLABLE_OPTIONS.map((o) => <option key={o.value || "empty"} value={o.value}>{o.label}</option>)}</select>
                <input type="number" min="0" step="0.01" placeholder="Billing amount USD" value={billingAmountDollars} onChange={(e) => setBillingAmountDollars(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                {saveMsg && <p className="text-xs text-slate-600">{saveMsg}</p>}
                <button type="button" onClick={handleSaveDetail} disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{saving ? "Saving…" : "Save Changes"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Add Lead</h2>
              <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">✕</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3 px-6 py-5">
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input placeholder="State" maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} className="rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase" />
                <input placeholder="ZIP" value={zip} onChange={(e) => setZip(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input placeholder="Benefit type" value={benefitType} onChange={(e) => setBenefitType(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input placeholder="Application status" value={applicationStatus} onChange={(e) => setApplicationStatus(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <textarea rows={3} placeholder="Medical summary" value={medicalSummary} onChange={(e) => setMedicalSummary(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <select value={addAssignedId} onChange={(e) => setAddAssignedId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">— Unassigned —</option>{partners.filter((p) => p.status === "active" || p.status === "pending").map((p) => <option key={p.id} value={p.id}>{p.firm_name}</option>)}</select>
              {addError && <p className="text-sm text-red-600">{addError}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={creating} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{creating ? "Creating…" : "Create Lead"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
