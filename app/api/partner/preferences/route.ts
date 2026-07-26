import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedPartnerSession } from "@/lib/partnerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const VALID_LEAD_STATUSES = ["active", "paused", "at_capacity"] as const;
type LeadStatus = (typeof VALID_LEAD_STATUSES)[number];

const VALID_ROUTING_SCOPES = ["united_states", "selected_states"] as const;
type RoutingScope = (typeof VALID_ROUTING_SCOPES)[number];

const DEFAULT_CASE_TYPES = ["SSDI", "SSI"];
const DEFAULT_LANGUAGES = ["English"];

function normalizeRoutingState(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  if (!/^[A-Z]{2}$/.test(normalized)) return null;
  return normalized;
}

function normalizeRoutingStateArray(value: unknown): { states: string[]; invalidCount: number } {
  if (!Array.isArray(value)) return { states: [], invalidCount: 0 };
  const normalized = (value as unknown[])
    .map(normalizeRoutingState)
    .filter((state): state is string => Boolean(state));
  return {
    states: Array.from(new Set(normalized)),
    invalidCount: value.length - normalized.length,
  };
}

/**
 * PATCH /api/partner/preferences
 * Updates the authenticated partner's intake preferences only.
 */
export async function PATCH(request: NextRequest) {
  const session = await getAuthenticatedPartnerSession();

  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Please log in again." },
      { status: 401 }
    );
  }

  const partnerId = session.partnerAccountId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { success: false, error: "Request body must be a JSON object." },
      { status: 400 }
    );
  }

  const raw = body as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof raw.accepting_leads !== "boolean") {
    errors.push("accepting_leads must be a boolean.");
  }

  if (!VALID_LEAD_STATUSES.includes(raw.lead_status as LeadStatus)) {
    errors.push(`lead_status must be one of: ${VALID_LEAD_STATUSES.join(", ")}.`);
  }

  if (typeof raw.monthly_lead_capacity !== "string" || !raw.monthly_lead_capacity.trim()) {
    errors.push("monthly_lead_capacity must be a non-empty string.");
  }

  const routingScope: RoutingScope = VALID_ROUTING_SCOPES.includes(
    raw.routing_scope as RoutingScope
  )
    ? (raw.routing_scope as RoutingScope)
    : "selected_states";

  const routingStatesResult = normalizeRoutingStateArray(raw.routing_states);
  const excludedStatesResult = normalizeRoutingStateArray(raw.routing_excluded_states);

  if (!Array.isArray(raw.routing_states)) {
    errors.push("routing_states must be an array.");
  } else if (routingStatesResult.invalidCount > 0) {
    errors.push("routing_states must contain only two-letter state abbreviations.");
  }

  if (raw.routing_excluded_states !== undefined && !Array.isArray(raw.routing_excluded_states)) {
    errors.push("routing_excluded_states must be an array.");
  } else if (excludedStatesResult.invalidCount > 0) {
    errors.push("routing_excluded_states must contain only two-letter state abbreviations.");
  }

  if (routingScope === "selected_states" && routingStatesResult.states.length === 0) {
    errors.push("Select at least one accepted state, or choose United States coverage.");
  }

  for (const flag of [
    "accepts_initial_filings",
    "accepts_appeals",
    "accepts_hearings",
    "accepts_child_cases",
  ] as const) {
    if (typeof raw[flag] !== "boolean") {
      errors.push(`${flag} must be a boolean.`);
    }
  }

  if (raw.lead_notes !== null && raw.lead_notes !== undefined && typeof raw.lead_notes !== "string") {
    errors.push("lead_notes must be a string or null.");
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { success: false, error: "Validation failed.", details: errors },
      { status: 422 }
    );
  }

  const update = {
    accepting_leads: raw.accepting_leads as boolean,
    lead_status: raw.lead_status as LeadStatus,
    monthly_lead_capacity: (raw.monthly_lead_capacity as string).trim(),
    routing_scope: routingScope,
    routing_states: routingScope === "selected_states" ? routingStatesResult.states : [],
    routing_excluded_states: routingScope === "united_states" ? excludedStatesResult.states : [],
    accepted_case_types: DEFAULT_CASE_TYPES,
    accepted_languages: DEFAULT_LANGUAGES,
    accepts_initial_filings: raw.accepts_initial_filings as boolean,
    accepts_appeals: raw.accepts_appeals as boolean,
    accepts_hearings: raw.accepts_hearings as boolean,
    accepts_child_cases: raw.accepts_child_cases as boolean,
    lead_notes: raw.lead_notes ? (raw.lead_notes as string).trim() || null : null,
  };

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("partner_accounts")
    .update(update)
    .eq("id", partnerId)
    .select(
      "id, accepting_leads, lead_status, monthly_lead_capacity, routing_scope, routing_states, routing_excluded_states, " +
        "accepted_case_types, accepted_languages, accepts_initial_filings, accepts_appeals, " +
        "accepts_hearings, accepts_child_cases, lead_notes"
    )
    .single();

  if (updateError || !updated) {
    console.error("[PATCH /api/partner/preferences] Update error:", updateError);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to save preferences. Please try again.",
        supabaseCode: updateError?.code ?? null,
        supabaseMessage: updateError?.message ?? null,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: updated });
}
