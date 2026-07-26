"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { PartnerRole } from "@/lib/partnerAuth";

export interface PartnerProfileSettings {
  firm_name: string;
  contact_first_name: string;
  contact_last_name: string;
  phone: string;
  website: string | null;
  states_served: string;
  practice_area: string;
  billing_contact_name: string | null;
  billing_contact_email: string | null;
  billing_contact_phone: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
  billing_notes: string | null;
  profile_updated_at: string | null;
}

function Field({
  label,
  children,
  required = false,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
        {required ? " *" : ""}
      </label>
      {children}
    </div>
  );
}

function inputClass(canEdit: boolean) {
  return `block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
    canEdit ? "" : "cursor-not-allowed bg-gray-100 text-gray-500"
  }`;
}

export default function PartnerProfileForm({
  initialProfile,
  role,
}: {
  initialProfile: PartnerProfileSettings;
  role: PartnerRole;
}) {
  const canEdit = role === "owner" || role === "admin";
  const [profile, setProfile] = useState<PartnerProfileSettings>(initialProfile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  function setField<K extends keyof PartnerProfileSettings>(
    field: K,
    value: PartnerProfileSettings[K]
  ) {
    setProfile((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    setDetails([]);
    setSuccess(false);

    try {
      const res = await fetch("/api/partner/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save firm profile.");
        setDetails(Array.isArray(data.details) ? data.details : []);
        return;
      }
      setProfile((prev) => ({ ...prev, ...(data.data ?? {}) }));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="text-base font-semibold text-[#0d1b2e]">Firm Profile & Billing Contact</h2>
        <p className="mt-1 text-sm text-gray-500">
          Owners and admins can keep firm contact and billing details up to date. Billing contact
          information is for statement and invoice administration only.
        </p>
      </div>

      <div className="space-y-6 px-6 py-5">
        {!canEdit && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            Your role can view these settings but cannot edit them. Ask an owner or admin user to make
            changes.
          </div>
        )}

        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Firm Details
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Firm Name" required>
              <input
                disabled={!canEdit}
                value={profile.firm_name}
                onChange={(e) => setField("firm_name", e.target.value)}
                className={inputClass(canEdit)}
              />
            </Field>
            <Field label="Website">
              <input
                disabled={!canEdit}
                value={profile.website ?? ""}
                onChange={(e) => setField("website", e.target.value || null)}
                placeholder="example.com or https://example.com"
                className={inputClass(canEdit)}
              />
              <p className="mt-1 text-xs text-gray-400">
                You can enter a domain only; https:// will be added automatically.
              </p>
            </Field>
            <Field label="Contact First Name" required>
              <input
                disabled={!canEdit}
                value={profile.contact_first_name}
                onChange={(e) => setField("contact_first_name", e.target.value)}
                className={inputClass(canEdit)}
              />
            </Field>
            <Field label="Contact Last Name" required>
              <input
                disabled={!canEdit}
                value={profile.contact_last_name}
                onChange={(e) => setField("contact_last_name", e.target.value)}
                className={inputClass(canEdit)}
              />
            </Field>
            <Field label="Phone" required>
              <input
                disabled={!canEdit}
                value={profile.phone}
                onChange={(e) => setField("phone", e.target.value)}
                className={inputClass(canEdit)}
              />
            </Field>
            <Field label="Practice Area" required>
              <input
                disabled={!canEdit}
                value={profile.practice_area}
                onChange={(e) => setField("practice_area", e.target.value)}
                className={inputClass(canEdit)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="States Served" required>
                <input
                  disabled={!canEdit}
                  value={profile.states_served}
                  onChange={(e) => setField("states_served", e.target.value)}
                  placeholder="TX, FL, GA"
                  className={inputClass(canEdit)}
                />
              </Field>
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Billing Contact
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Billing Contact Name">
              <input
                disabled={!canEdit}
                value={profile.billing_contact_name ?? ""}
                onChange={(e) => setField("billing_contact_name", e.target.value || null)}
                className={inputClass(canEdit)}
              />
            </Field>
            <Field label="Billing Contact Email">
              <input
                disabled={!canEdit}
                type="email"
                value={profile.billing_contact_email ?? ""}
                onChange={(e) => setField("billing_contact_email", e.target.value || null)}
                className={inputClass(canEdit)}
              />
            </Field>
            <Field label="Billing Contact Phone">
              <input
                disabled={!canEdit}
                value={profile.billing_contact_phone ?? ""}
                onChange={(e) => setField("billing_contact_phone", e.target.value || null)}
                className={inputClass(canEdit)}
              />
            </Field>
            <Field label="Billing Address Line 1">
              <input
                disabled={!canEdit}
                value={profile.billing_address_line1 ?? ""}
                onChange={(e) => setField("billing_address_line1", e.target.value || null)}
                className={inputClass(canEdit)}
              />
            </Field>
            <Field label="Billing Address Line 2">
              <input
                disabled={!canEdit}
                value={profile.billing_address_line2 ?? ""}
                onChange={(e) => setField("billing_address_line2", e.target.value || null)}
                className={inputClass(canEdit)}
              />
            </Field>
            <Field label="Billing City">
              <input
                disabled={!canEdit}
                value={profile.billing_city ?? ""}
                onChange={(e) => setField("billing_city", e.target.value || null)}
                className={inputClass(canEdit)}
              />
            </Field>
            <Field label="Billing State">
              <input
                disabled={!canEdit}
                value={profile.billing_state ?? ""}
                onChange={(e) => setField("billing_state", e.target.value.toUpperCase() || null)}
                maxLength={2}
                placeholder="TX"
                className={inputClass(canEdit)}
              />
            </Field>
            <Field label="Billing ZIP">
              <input
                disabled={!canEdit}
                value={profile.billing_zip ?? ""}
                onChange={(e) => setField("billing_zip", e.target.value || null)}
                className={inputClass(canEdit)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Billing Notes">
                <textarea
                  disabled={!canEdit}
                  rows={3}
                  value={profile.billing_notes ?? ""}
                  onChange={(e) => setField("billing_notes", e.target.value || null)}
                  placeholder="Optional billing instructions or contact preferences."
                  className={`${inputClass(canEdit)} resize-y`}
                />
              </Field>
            </div>
          </div>
        </section>

        {profile.profile_updated_at && (
          <p className="text-xs text-gray-400">
            Last profile update: {new Date(profile.profile_updated_at).toLocaleString("en-US")}
          </p>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p>{error}</p>
            {details.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                {details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {success && (
          <p className="text-sm text-green-600">
            Firm profile saved successfully. Website/domain formatting is normalized automatically.
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={!canEdit || saving}
          className="rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d1b2e] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Firm Profile"}
        </button>
      </div>
    </div>
  );
}
