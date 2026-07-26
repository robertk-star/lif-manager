"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PartnerRole } from "@/lib/partnerAuth";

type PartnerResponseStatus =
  | "new"
  | "reviewing"
  | "contact_attempted"
  | "contacted"
  | "accepted"
  | "declined"
  | "retained"
  | "closed";

interface LeadRow {
  id: string;
  created_at: string;
  updated_at: string;
  source: string;
  external_reference_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  benefit_type: string | null;
  application_status: string | null;
  medical_summary: string | null;
  additional_notes: string | null;
  status: string;
  assigned_partner_account_id: string;
  assigned_at: string | null;
  partner_response_status: PartnerResponseStatus | null;
  partner_response_updated_at: string | null;
  partner_viewed_at: string | null;
}

interface LeadDetail extends LeadRow {
  partner_notes: string | null;
}

const RESPONSE_STATUS_OPTIONS: PartnerResponseStatus[] = [
  "new",
  "reviewing",
  "contact_attempted",
  "contacted",
  "accepted",
  "declined",
  "retained",
  "closed",
];

const RESPONSE_STATUS_LABELS: Record<PartnerResponseStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  contact_attempted: "Contact Attempted",
  contacted: "Contacted",
  accepted: "Accepted",
  declined: "Declined",
  retained: "Retained",
  closed: "Closed",
};

const RESPONSE_STATUS_COLORS: Record<PartnerResponseStatus, string> = {
  new: "bg-blue-100 text-blue-800",
  reviewing: "bg-yellow-100 text-yellow-800",
  contact_attempted: "bg-orange-100 text-orange-800",
  contacted: "bg-indigo-100 text-indigo-800",
  accepted: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-800",
  retained: "bg-emerald-100 text-emerald-800",
  closed: "bg-gray-100 text-gray-700",
};

function normalizeResponseStatus(status: PartnerResponseStatus | null | undefined): PartnerResponseStatus {
  return status ?? "new";
}

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

function leadName(lead: Pick<LeadRow, "first_name" | "last_name">) {
  const name = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim();
  return name || "Unnamed Lead";
}

function StatusBadge({ status }: { status: PartnerResponseStatus | null | undefined }) {
  const normalized = normalizeResponseStatus(status);
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${RESPONSE_STATUS_COLORS[normalized]}`}>
      {RESPONSE_STATUS_LABELS[normalized]}
    </span>
  );
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm text-gray-800">
        {value ? value : <span className="italic text-gray-400">—</span>}
      </dd>
    </div>
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type ListedSection = {
  label: string | null;
  items: string[];
};

const DETAIL_LABELS = [
  "Primary condition",
  "Additional conditions",
  "Condition changes",
  "Condition duration",
  "Duration of condition",
  "Reported work impact",
  "Impact on daily work",
  "Current work status",
  "Currently working",
  "Monthly earnings range",
  "Last worked",
  "Reduced hours due to condition",
  "Medical condition",
  "Application status",
  "Readiness status",
  "Ability to lift / carry",
  "Ability to sit / stand",
  "Sitting limit",
  "Standing limit",
  "Walking limit",
  "Lifting limit",
  "Has treating doctor",
  "Recent doctor visit",
  "Visit recency",
  "Specialist care",
  "Hospital / ER visits",
  "Prescribed medication",
  "Medication side effects noted",
  "Medication side effects",
  "Assistive devices",
  "Medical records history",
  "Medical records",
  "Treatment and documentation highlights",
  "Job duties affected",
  "Focus / memory issues",
  "Attendance issues",
  "Needs rest breaks",
  "Daily living limitations",
  "Household tasks",
  "Errands",
  "Sleep",
  "Personal care",
  "Transportation",
  "Social/routine",
  "Has advocate",
  "Advocate contact consent",
].sort((a, b) => b.length - a.length);

function normalizeDetailText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[•▪◦]/g, "\n")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanDetailValue(value: string) {
  return normalizeDetailText(value)
    .replace(/^[-–—*]\s*/, "")
    .replace(/^[:\s]+/, "")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+$/g, "")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .trim();
}

function titleCaseLabel(label: string) {
  return label
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/DBS/g, "DBS")
    .replace(/SSDI/g, "SSDI")
    .replace(/SSI/g, "SSI");
}

function splitValueIntoListItems(value: string) {
  const cleaned = cleanDetailValue(value);
  if (!cleaned) return [];

  if (cleaned.length < 120) return [cleaned];

  return cleaned
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map(cleanDetailValue)
    .filter(Boolean);
}

function parseTreatmentHighlights(value: string) {
  const cleaned = cleanDetailValue(value);
  if (!cleaned) return [];

  const patterns: Array<[string, RegExp]> = [
    ["Treating doctor", /\btreating doctor\s+(yes|no|not sure|unknown)/i],
    ["Recent doctor visit", /\brecent doctor visit\s+(yes|no|not sure|unknown)/i],
    ["Visit recency", /\bvisit recency\s+([a-z0-9_\-/ ]+?)(?=\s+specialist care|\s+prescribed medication|\s+records history|\s+documentation|$)/i],
    ["Specialist care", /\bspecialist care\s+(yes|no|not sure|unknown)/i],
    ["Prescribed medication", /\bprescribed medication\s+(yes|no|not sure|unknown)/i],
    ["Records history", /\brecords history\s+([a-z0-9_\-/ ]+?)(?=\s+documentation|$)/i],
    ["Documentation", /\bdocumentation\s+(yes|no|not sure|unknown)/i],
  ];

  const parsed = patterns
    .map(([label, regex]) => {
      const match = cleaned.match(regex);
      if (!match?.[1]) return null;
      return `${label}: ${cleanDetailValue(match[1])}`;
    })
    .filter((item): item is string => Boolean(item));

  return parsed.length > 0 ? parsed : [cleaned];
}

function parseTextSections(value: string | null | undefined): ListedSection[] {
  if (!value || !value.trim()) return [];

  const labelPattern = new RegExp(`\\s*(?=(${DETAIL_LABELS.map(escapeRegExp).join("|")}):)`, "gi");
  const normalized = normalizeDetailText(value)
    .replace(labelPattern, "\n")
    .trim();

  const rawLines = normalized
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const sections: ListedSection[] = [];

  for (const rawLine of rawLines) {
    const line = rawLine.replace(/^[-–—*]\s*/, "").trim();
    const match = line.match(/^([^:]{2,80}):\s*(.*)$/);

    if (!match) {
      const items = splitValueIntoListItems(line);
      if (items.length > 0) sections.push({ label: null, items });
      continue;
    }

    const label = titleCaseLabel(match[1].trim());
    const rest = match[2] ?? "";
    const items = label.toLowerCase().includes("treatment and documentation")
      ? parseTreatmentHighlights(rest)
      : splitValueIntoListItems(rest);

    sections.push({ label, items: items.length > 0 ? items : ["Not provided"] });
  }

  const combined: ListedSection[] = [];
  for (const section of sections) {
    const previous = combined[combined.length - 1];
    if (previous && previous.label === section.label) {
      previous.items.push(...section.items);
    } else {
      combined.push({ label: section.label, items: [...section.items] });
    }
  }

  return combined.map((section) => ({
    ...section,
    items: Array.from(new Set(section.items.map(cleanDetailValue).filter(Boolean))),
  })).filter((section) => section.items.length > 0);
}

function ListedTextBlock({ value }: { value: string | null | undefined }) {
  const sections = parseTextSections(value);

  if (sections.length === 0) {
    return <p className="text-sm italic text-gray-400">Not provided.</p>;
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700">
      {sections.map((section, sectionIndex) => (
        <div key={`${section.label ?? "details"}-${sectionIndex}`} className="space-y-1.5">
          {section.label && (
            <p className="font-semibold text-[#0d1b2e]">{section.label}</p>
          )}
          <ul className="ml-1 space-y-1.5">
            {section.items.map((item, index) => (
              <li key={`${sectionIndex}-${index}-${item.slice(0, 24)}`} className="flex gap-2 leading-relaxed">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1a3a5c]" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function LeadDetailModal({
  leadId,
  role,
  onClose,
  onUpdated,
}: {
  leadId: string;
  role: PartnerRole;
  onClose: () => void;
  onUpdated: (lead: LeadDetail) => void;
}) {
  const router = useRouter();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [responseStatus, setResponseStatus] = useState<PartnerResponseStatus>("new");
  const [partnerNotes, setPartnerNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const canEdit = role !== "viewer";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    fetch(`/api/partner/leads/${leadId}`)
      .then(async (res) => {
        if (res.status === 401) {
          router.push("/partner/login");
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(data.error ?? "Failed to load lead details.");
          return;
        }
        const fullLead = data.data as LeadDetail;
        setLead(fullLead);
        setResponseStatus(normalizeResponseStatus(fullLead.partner_response_status));
        setPartnerNotes(fullLead.partner_notes ?? "");
        onUpdated(fullLead);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Network error. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [leadId, onUpdated, router]);

  async function handleSave() {
    if (!lead || !canEdit) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/partner/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partner_response_status: responseStatus,
          partner_notes: partnerNotes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.error ?? "Failed to save lead update.");
        return;
      }
      const updatedLead = data.data as LeadDetail;
      setLead(updatedLead);
      onUpdated(updatedLead);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#0d1b2e]">
              {lead ? leadName(lead) : "Lead Detail"}
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">
              Assigned {lead ? formatDateTime(lead.assigned_at) : "—"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[75vh] space-y-6 overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex items-center justify-center py-12 text-sm text-gray-400">
              Loading lead details…
            </div>
          )}

          {!loading && loadError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {loadError}
            </div>
          )}

          {!loading && !loadError && lead && (
            <>
              <section>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={lead.partner_response_status} />
                  {lead.partner_viewed_at && (
                    <span className="text-xs text-gray-400">
                      Viewed {formatDateTime(lead.partner_viewed_at)}
                    </span>
                  )}
                  {lead.partner_response_updated_at && (
                    <span className="text-xs text-gray-400">
                      Updated {formatDateTime(lead.partner_response_updated_at)}
                    </span>
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Contact Information</h3>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                  <DetailField label="First Name" value={lead.first_name} />
                  <DetailField label="Last Name" value={lead.last_name} />
                  <DetailField label="Phone" value={lead.phone} />
                  <DetailField label="Email" value={lead.email} />
                  <DetailField label="City" value={lead.city} />
                  <DetailField label="State" value={lead.state} />
                  <DetailField label="ZIP" value={lead.zip} />
                </dl>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Benefit Information</h3>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                  <DetailField label="Benefit Type" value={lead.benefit_type} />
                  <DetailField label="Application Status" value={lead.application_status} />
                  <DetailField label="Source" value={lead.source} />
                  <DetailField label="External Reference" value={lead.external_reference_id} />
                </dl>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Medical Details</h3>
                <ListedTextBlock value={lead.medical_summary} />
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Additional Notes</h3>
                <ListedTextBlock value={lead.additional_notes} />
              </section>

              <section className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Partner Response</h3>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Response Status</label>
                  <select
                    value={responseStatus}
                    onChange={(e) => setResponseStatus(e.target.value as PartnerResponseStatus)}
                    disabled={!canEdit}
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                  >
                    {RESPONSE_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>{RESPONSE_STATUS_LABELS[status]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Partner Notes</label>
                  <textarea
                    rows={4}
                    value={partnerNotes}
                    onChange={(e) => setPartnerNotes(e.target.value)}
                    disabled={!canEdit}
                    className="block w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                    placeholder="Add notes about outreach, qualification, acceptance, decline reason, or retention status…"
                  />
                </div>

                {!canEdit && (
                  <p className="text-xs text-yellow-700">Viewer users cannot update partner lead status or notes.</p>
                )}
                {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                {saveSuccess && <p className="text-xs text-green-600">Lead update saved.</p>}

                <button
                  onClick={handleSave}
                  disabled={saving || !canEdit}
                  className="rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0d1b2e] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save Lead Update"}
                </button>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PartnerLeadsDashboard({ role }: { role: PartnerRole }) {
  const router = useRouter();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

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
        setLoadError(data.error ?? "Failed to load assigned leads.");
        return;
      }
      setLeads(data.data ?? []);
    } catch {
      setLoadError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [router, search, statusFilter]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleUpdated = useCallback((updated: LeadDetail) => {
    setLeads((prev) =>
      prev.map((lead) => (lead.id === updated.id ? { ...lead, ...updated } : lead))
    );
  }, []);

  const counts = useMemo(() => {
    const summary: Record<PartnerResponseStatus, number> = {
      new: 0,
      reviewing: 0,
      contact_attempted: 0,
      contacted: 0,
      accepted: 0,
      declined: 0,
      retained: 0,
      closed: 0,
    };
    for (const lead of leads) {
      summary[normalizeResponseStatus(lead.partner_response_status)] += 1;
    }
    return summary;
  }, [leads]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="New" value={counts.new} />
        <SummaryCard label="Reviewing" value={counts.reviewing} />
        <SummaryCard label="Contacted" value={counts.contacted + counts.contact_attempted} />
        <SummaryCard label="Retained" value={counts.retained} />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input
            type="text"
            placeholder="Search name, email, phone, state, ref…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] sm:col-span-2"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]"
          >
            <option value="">All Response Statuses</option>
            {RESPONSE_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{RESPONSE_STATUS_LABELS[status]}</option>
            ))}
          </select>
          <button
            onClick={fetchLeads}
            className="rounded-lg border border-[#1a3a5c] px-4 py-2 text-sm font-semibold text-[#1a3a5c] transition hover:bg-[#1a3a5c] hover:text-white"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loadError && (
          <div className="border-b border-red-100 bg-red-50 px-6 py-4 text-sm text-red-600">
            {loadError}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">
            Loading assigned leads…
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <p className="text-sm font-medium text-gray-600">No assigned leads found.</p>
            <p className="mt-1 max-w-md text-sm text-gray-400">
              Assigned DBS leads will appear here after they are routed to your firm.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Assigned</th>
                  <th className="px-4 py-3 text-left">Claimant</th>
                  <th className="px-4 py-3 text-left">State</th>
                  <th className="px-4 py-3 text-left">Benefit</th>
                  <th className="px-4 py-3 text-left">Application Status</th>
                  <th className="px-4 py-3 text-left">Response</th>
                  <th className="px-4 py-3 text-left">Viewed</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                      {formatDate(lead.assigned_at ?? lead.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{leadName(lead)}</div>
                      <div className="text-xs text-gray-400">{lead.external_reference_id ?? "No external ref"}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {lead.state ?? <span className="italic text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {lead.benefit_type ?? <span className="italic text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {lead.application_status ?? <span className="italic text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={lead.partner_response_status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {lead.partner_viewed_at ? formatDate(lead.partner_viewed_at) : <span className="italic text-gray-400">Not yet</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedLeadId(lead.id)}
                        className="rounded border border-[#1a3a5c] px-2 py-1 text-xs font-semibold text-[#1a3a5c] transition hover:bg-[#1a3a5c] hover:text-white"
                      >
                        View Lead
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-gray-400">
        Showing {leads.length} assigned lead{leads.length !== 1 ? "s" : ""}.
      </p>

      {selectedLeadId && (
        <LeadDetailModal
          leadId={selectedLeadId}
          role={role}
          onClose={() => setSelectedLeadId(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#0d1b2e]">{value}</p>
    </div>
  );
}
