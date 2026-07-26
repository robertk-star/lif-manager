"use client";

import { useState } from "react";

export type RoutingScope = "united_states" | "selected_states";

export interface LeadPreferences {
  accepting_leads: boolean;
  lead_status: "active" | "paused" | "at_capacity";
  monthly_lead_capacity: string;
  routing_scope: RoutingScope;
  routing_states: string[];
  routing_excluded_states: string[];
  accepted_case_types: string[];
  accepted_languages: string[];
  accepts_initial_filings: boolean;
  accepts_appeals: boolean;
  accepts_hearings: boolean;
  accepts_child_cases: boolean;
  lead_notes: string | null;
}

const LEAD_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "at_capacity", label: "At Capacity" },
] as const;

const STATE_OPTIONS = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "DC", label: "District of Columbia" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
] as const;

const LEAD_PROGRAMS = ["SSDI", "SSI"];
const LEAD_LANGUAGES = ["English"];

function normalizeStateArray(values: string[] | null | undefined): string[] {
  const allowed = new Set<string>(STATE_OPTIONS.map((state) => state.value));
  return Array.from(
    new Set((values ?? []).map((value) => value.trim().toUpperCase()).filter((value) => allowed.has(value)))
  );
}

function toggleStateValue(current: string[], value: string) {
  const normalized = normalizeStateArray(current);
  return normalized.includes(value)
    ? normalized.filter((state) => state !== value)
    : [...normalized, value].sort();
}

function StateCheckboxGroup({
  label,
  values,
  onChange,
  emptyLabel,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  emptyLabel: string;
}) {
  const normalized = normalizeStateArray(values);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-gray-600">{label}</p>
        {normalized.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs font-semibold text-[#1a3a8f] hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="max-h-64 overflow-y-auto rounded-md border border-gray-300 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {STATE_OPTIONS.map((state) => (
            <label key={state.value} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={normalized.includes(state.value)}
                onChange={() => onChange(toggleStateValue(normalized, state.value))}
                className="h-4 w-4 rounded border-gray-300 text-[#1a3a8f] focus:ring-[#1a3a8f]"
              />
              <span className="text-sm text-gray-700">
                {state.value} — {state.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      <p className="mt-1.5 text-xs text-gray-500">
        {normalized.length > 0 ? `${normalized.length} selected: ${normalized.join(", ")}` : emptyLabel}
      </p>
    </div>
  );
}

export default function LeadPreferencesForm({
  initialPreferences,
}: {
  initialPreferences: LeadPreferences;
}) {
  const initialScope: RoutingScope =
    initialPreferences.routing_scope === "united_states" ? "united_states" : "selected_states";

  const [prefs, setPrefs] = useState<LeadPreferences>({
    ...initialPreferences,
    routing_scope: initialScope,
    routing_states: normalizeStateArray(initialPreferences.routing_states),
    routing_excluded_states: normalizeStateArray(initialPreferences.routing_excluded_states),
    accepted_case_types: LEAD_PROGRAMS,
    accepted_languages: LEAD_LANGUAGES,
    lead_notes: initialPreferences.lead_notes ?? "",
  });

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof LeadPreferences>(key: K, value: LeadPreferences[K]) {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setSuccess(false);
  }

  async function handleSave() {
    setSaving(true);
    setSuccess(false);
    setError(null);

    try {
      const routingStates =
        prefs.routing_scope === "selected_states" ? normalizeStateArray(prefs.routing_states) : [];
      const routingExcludedStates =
        prefs.routing_scope === "united_states"
          ? normalizeStateArray(prefs.routing_excluded_states)
          : [];

      const res = await fetch("/api/partner/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...prefs,
          routing_states: routingStates,
          routing_excluded_states: routingExcludedStates,
          accepted_case_types: LEAD_PROGRAMS,
          accepted_languages: LEAD_LANGUAGES,
          lead_notes: prefs.lead_notes?.trim() || null,
        }),
      });

      let data: { success: boolean; error?: string; details?: string[] };
      try {
        data = await res.json();
      } catch {
        setError(`Server returned an unexpected response (HTTP ${res.status}).`);
        return;
      }

      if (data.success) {
        setSuccess(true);
      } else {
        const detail = data.details?.join(" ") ?? "";
        setError(data.error ? `${data.error}${detail ? " " + detail : ""}` : "Failed to save preferences.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const selectedRoutingStates = normalizeStateArray(prefs.routing_states);
  const selectedExcludedStates = normalizeStateArray(prefs.routing_excluded_states);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="text-base font-semibold text-[#0d1b2e]">Lead Preferences</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Configure where and when your firm accepts Social Security Disability leads.
        </p>
      </div>

      <div className="space-y-8 px-6 py-6">
        <fieldset>
          <legend className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Lead Status
          </legend>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 sm:col-span-3">
              <div>
                <p className="text-sm font-medium text-gray-800">Accepting New Leads</p>
                <p className="mt-0.5 text-xs text-gray-500">Turn off to pause all new lead delivery.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs.accepting_leads}
                onClick={() => setField("accepting_leads", !prefs.accepting_leads)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[#1a3a8f] focus:ring-offset-2 ${
                  prefs.accepting_leads ? "bg-green-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                    prefs.accepting_leads ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="lead_status" className="mb-1.5 block text-xs font-medium text-gray-600">
                Lead Status
              </label>
              <select
                id="lead_status"
                value={prefs.lead_status}
                onChange={(e) => setField("lead_status", e.target.value as LeadPreferences["lead_status"])}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-[#1a3a8f] focus:outline-none focus:ring-1 focus:ring-[#1a3a8f]"
              >
                {LEAD_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="monthly_lead_capacity" className="mb-1.5 block text-xs font-medium text-gray-600">
                Monthly Lead Capacity
              </label>
              <input
                id="monthly_lead_capacity"
                type="text"
                value={prefs.monthly_lead_capacity}
                onChange={(e) => setField("monthly_lead_capacity", e.target.value)}
                placeholder="e.g. 20"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-[#1a3a8f] focus:outline-none focus:ring-1 focus:ring-[#1a3a8f]"
              />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
            States Accepted for Routing
          </legend>
          <p className="mb-4 text-xs text-gray-500">
            Choose all United States coverage with optional exclusions, or select only the states your firm accepts.
          </p>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div>
              <label htmlFor="routing_scope" className="mb-1.5 block text-xs font-medium text-gray-600">
                Coverage Type
              </label>
              <select
                id="routing_scope"
                value={prefs.routing_scope}
                onChange={(e) => {
                  const nextScope = e.target.value as RoutingScope;
                  setPrefs((prev) => ({
                    ...prev,
                    routing_scope: nextScope,
                    routing_states: nextScope === "united_states" ? [] : prev.routing_states,
                    routing_excluded_states:
                      nextScope === "selected_states" ? [] : prev.routing_excluded_states,
                  }));
                  setSuccess(false);
                }}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-[#1a3a8f] focus:outline-none focus:ring-1 focus:ring-[#1a3a8f]"
              >
                <option value="united_states">United States</option>
                <option value="selected_states">Only selected states</option>
              </select>
              <p className="mt-1.5 text-xs text-gray-500">
                {prefs.routing_scope === "united_states"
                  ? "Your firm accepts leads nationwide except the excluded states listed to the right."
                  : "Your firm accepts leads only from the states selected to the right."}
              </p>
            </div>

            {prefs.routing_scope === "selected_states" ? (
              <StateCheckboxGroup
                label="Select Accepted States"
                values={selectedRoutingStates}
                onChange={(values) => setField("routing_states", values)}
                emptyLabel="No states selected yet."
              />
            ) : (
              <StateCheckboxGroup
                label="Excluded States"
                values={selectedExcludedStates}
                onChange={(values) => setField("routing_excluded_states", values)}
                emptyLabel="No states excluded."
              />
            )}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Case Stages Accepted
          </legend>
          <p className="mb-4 text-xs text-gray-500">
            Select the stages of the Social Security Disability process you handle.
          </p>
          <div className="space-y-2.5">
            <label className="flex cursor-pointer items-center gap-3 group">
              <input
                type="checkbox"
                checked={prefs.accepts_initial_filings}
                onChange={() => setField("accepts_initial_filings", !prefs.accepts_initial_filings)}
                className="h-4 w-4 rounded border-gray-300 text-[#1a3a8f] focus:ring-[#1a3a8f]"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">Initial Filings</span>
            </label>

            <label className="flex cursor-pointer items-center gap-3 group">
              <input
                type="checkbox"
                checked={prefs.accepts_appeals}
                onChange={() => setField("accepts_appeals", !prefs.accepts_appeals)}
                className="h-4 w-4 rounded border-gray-300 text-[#1a3a8f] focus:ring-[#1a3a8f]"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">Appeals / Denials</span>
            </label>

            <label className="flex cursor-pointer items-center gap-3 group">
              <input
                type="checkbox"
                checked={prefs.accepts_hearings}
                onChange={() => setField("accepts_hearings", !prefs.accepts_hearings)}
                className="h-4 w-4 rounded border-gray-300 text-[#1a3a8f] focus:ring-[#1a3a8f]"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">Hearings</span>
            </label>

            <label className="flex cursor-pointer items-center gap-3 group">
              <input
                type="checkbox"
                checked={prefs.accepts_child_cases}
                onChange={() => setField("accepts_child_cases", !prefs.accepts_child_cases)}
                className="h-4 w-4 rounded border-gray-300 text-[#1a3a8f] focus:ring-[#1a3a8f]"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">Child Disability Cases</span>
            </label>
          </div>
        </fieldset>

        <div>
          <label
            htmlFor="lead_notes"
            className="mb-4 block text-xs font-semibold uppercase tracking-wider text-gray-400"
          >
            Lead Notes
          </label>
          <textarea
            id="lead_notes"
            rows={4}
            value={prefs.lead_notes ?? ""}
            onChange={(e) => setField("lead_notes", e.target.value)}
            placeholder="e.g. Appeals preferred. Only send leads with complete phone numbers."
            className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-800 shadow-sm placeholder:text-gray-400 focus:border-[#1a3a8f] focus:outline-none focus:ring-1 focus:ring-[#1a3a8f]"
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Internal use only. Used for routing preferences and admin review.
          </p>
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-[#1a3a8f] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#162e75] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Preferences"}
          </button>

          {success && (
            <p className="text-sm font-medium text-green-700">Preferences saved successfully.</p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
