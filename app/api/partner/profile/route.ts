import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedPartnerSession } from "@/lib/partnerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const PROFILE_EDIT_ROLES = ["owner", "admin"] as const;

const PROFILE_AUDIT_FIELDS = [
  "firm_name",
  "contact_first_name",
  "contact_last_name",
  "phone",
  "website",
  "states_served",
  "practice_area",
  "billing_contact_name",
  "billing_contact_email",
  "billing_contact_phone",
  "billing_address_line1",
  "billing_address_line2",
  "billing_city",
  "billing_state",
  "billing_zip",
  "billing_notes",
] as const;

type ProfileAuditField = (typeof PROFILE_AUDIT_FIELDS)[number];
type ProfileAuditRecord = Record<ProfileAuditField, string | null>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown, maxLength = 500): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}

function isValidEmail(value: string | null): boolean {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidState(value: string | null): boolean {
  if (!value) return true;
  return /^[A-Z]{2}$/.test(value);
}

function normalizeWebsite(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return withProtocol;
    if (!url.hostname || !url.hostname.includes(".")) return withProtocol;

    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    return url.toString().replace(/\/$/, "");
  } catch {
    return withProtocol;
  }
}

function isValidWebsite(value: string | null): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.hostname) &&
      url.hostname.includes(".")
    );
  } catch {
    return false;
  }
}

function auditSnapshot(row: Record<string, unknown> | null | undefined): ProfileAuditRecord {
  const snapshot = {} as ProfileAuditRecord;
  for (const field of PROFILE_AUDIT_FIELDS) {
    const value = row?.[field];
    snapshot[field] = typeof value === "string" && value.trim() ? value.trim() : null;
  }
  return snapshot;
}

function diffAuditFields(before: ProfileAuditRecord, after: ProfileAuditRecord): ProfileAuditField[] {
  return PROFILE_AUDIT_FIELDS.filter((field) => (before[field] ?? null) !== (after[field] ?? null));
}

function pickChangedValues(snapshot: ProfileAuditRecord, fields: ProfileAuditField[]) {
  const picked: Partial<ProfileAuditRecord> = {};
  for (const field of fields) {
    picked[field] = snapshot[field];
  }
  return picked;
}

/**
 * PATCH /api/partner/profile
 * Owner/admin users can update firm profile and billing contact for their account.
 */
export async function PATCH(request: NextRequest) {
  const session = await getAuthenticatedPartnerSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Please log in again." },
      { status: 401 }
    );
  }

  if (!PROFILE_EDIT_ROLES.includes(session.role as (typeof PROFILE_EDIT_ROLES)[number])) {
    return NextResponse.json(
      { success: false, error: "Only owner or admin users can update firm profile settings." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isPlainObject(body)) {
    return NextResponse.json(
      { success: false, error: "Request body must be a JSON object." },
      { status: 400 }
    );
  }

  const firmName = cleanString(body.firm_name, 200);
  const contactFirstName = cleanString(body.contact_first_name, 100);
  const contactLastName = cleanString(body.contact_last_name, 100);
  const phone = cleanString(body.phone, 50);
  const website = normalizeWebsite(cleanString(body.website, 300));
  const statesServed = cleanString(body.states_served, 500);
  const practiceArea = cleanString(body.practice_area, 300);
  const billingContactName = cleanString(body.billing_contact_name, 200);
  const billingContactEmail =
    cleanString(body.billing_contact_email, 200)?.toLowerCase() ?? null;
  const billingContactPhone = cleanString(body.billing_contact_phone, 50);
  const billingAddressLine1 = cleanString(body.billing_address_line1, 300);
  const billingAddressLine2 = cleanString(body.billing_address_line2, 300);
  const billingCity = cleanString(body.billing_city, 150);
  const billingStateRaw =
    typeof body.billing_state === "string" ? body.billing_state.trim().toUpperCase() : null;
  const billingState = billingStateRaw || null;
  const billingZip = cleanString(body.billing_zip, 20);
  const billingNotes = cleanString(body.billing_notes, 1000);

  const errors: string[] = [];
  if (!firmName) errors.push("Firm name is required.");
  if (!contactFirstName) errors.push("Contact first name is required.");
  if (!contactLastName) errors.push("Contact last name is required.");
  if (!phone) errors.push("Phone is required.");
  if (!statesServed) errors.push("States served is required.");
  if (!practiceArea) errors.push("Practice area is required.");
  if (!isValidEmail(billingContactEmail))
    errors.push("Billing contact email must be a valid email address.");
  if (!isValidState(billingState))
    errors.push("Billing state must be a two-letter state abbreviation.");
  if (!isValidWebsite(website))
    errors.push("Website must be a valid domain or URL, such as example.com or https://example.com.");

  if (errors.length > 0) {
    return NextResponse.json(
      { success: false, error: "Validation failed.", details: errors },
      { status: 422 }
    );
  }

  const { data: beforeAccount, error: beforeError } = await supabaseAdmin
    .from("partner_accounts")
    .select(PROFILE_AUDIT_FIELDS.join(", "))
    .eq("id", session.partnerAccountId)
    .single();

  if (beforeError || !beforeAccount) {
    return NextResponse.json({ success: false, error: "Partner account not found." }, { status: 404 });
  }

  const update = {
    firm_name: firmName,
    contact_first_name: contactFirstName,
    contact_last_name: contactLastName,
    phone,
    website,
    states_served: statesServed,
    practice_area: practiceArea,
    billing_contact_name: billingContactName,
    billing_contact_email: billingContactEmail,
    billing_contact_phone: billingContactPhone,
    billing_address_line1: billingAddressLine1,
    billing_address_line2: billingAddressLine2,
    billing_city: billingCity,
    billing_state: billingState,
    billing_zip: billingZip,
    billing_notes: billingNotes,
    profile_updated_at: new Date().toISOString(),
    profile_updated_by_partner_user_id: session.partnerUserId,
  };

  const { data, error } = await supabaseAdmin
    .from("partner_accounts")
    .update(update)
    .eq("id", session.partnerAccountId)
    .select(
      "id, firm_name, contact_first_name, contact_last_name, phone, website, states_served, practice_area, " +
        "billing_contact_name, billing_contact_email, billing_contact_phone, billing_address_line1, billing_address_line2, " +
        "billing_city, billing_state, billing_zip, billing_notes, profile_updated_at, profile_updated_by_partner_user_id"
    )
    .single();

  if (error || !data) {
    console.error("[PATCH /api/partner/profile] Supabase error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save firm profile settings." },
      { status: 500 }
    );
  }

  // Best-effort audit log (table may not exist on all environments)
  try {
    const beforeSnapshot = auditSnapshot(beforeAccount as unknown as Record<string, unknown>);
    const afterSnapshot = auditSnapshot(data as unknown as Record<string, unknown>);
    const changedFields = diffAuditFields(beforeSnapshot, afterSnapshot);

    if (changedFields.length > 0) {
      const billingFields = changedFields.filter((field) => field.startsWith("billing_"));
      const eventType =
        billingFields.length === changedFields.length ? "billing_contact_updated" : "profile_updated";

      const { error: eventError } = await supabaseAdmin.from("partner_account_profile_events").insert({
        partner_account_id: session.partnerAccountId,
        partner_user_id: session.partnerUserId,
        event_type: eventType,
        changed_fields: changedFields,
        previous_values: pickChangedValues(beforeSnapshot, changedFields),
        new_values: pickChangedValues(afterSnapshot, changedFields),
      });

      if (eventError) {
        console.warn("[PATCH /api/partner/profile] Profile event insert skipped:", eventError.message);
      }
    }
  } catch (auditErr) {
    console.warn("[PATCH /api/partner/profile] Audit skipped:", auditErr);
  }

  return NextResponse.json({
    success: true,
    data,
    normalized: { website },
  });
}
