import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type LeadRoutingRecord = {
  id: string;
  state: string | null;
  benefit_type: string | null;
  application_status: string | null;
};

export type PartnerRoutingRecord = {
  id: string;
  firm_name: string;
  email: string;
  status: string | null;
  accepting_leads: boolean | null;
  lead_status: string | null;
  monthly_lead_capacity: string | null;
  states_served: string | null;
  routing_scope: string | null;
  routing_states: string[] | null;
  routing_excluded_states: string[] | null;
  accepted_case_types: string[] | null;
  accepts_initial_filings: boolean | null;
  accepts_appeals: boolean | null;
  accepts_hearings: boolean | null;
  accepts_child_cases: boolean | null;
  accepted_languages: string[] | null;
  lead_notes: string | null;
};

export type AssignedLeadCountRow = {
  assigned_partner_account_id: string | null;
};

export type PartnerEligibilityResult = {
  partner: {
    id: string;
    firm_name: string;
    email: string;
    status: string | null;
    accepting_leads: boolean | null;
    lead_status: string | null;
    routing_scope: string | null;
    routing_states: string[];
    routing_excluded_states: string[];
    accepted_case_types: string[];
    monthly_lead_capacity: string | null;
    monthly_assigned_count: number;
    lead_notes: string | null;
  };
  eligible: boolean;
  score: number;
  matchedRules: string[];
  blockers: string[];
  warnings: string[];
};

const BENEFIT_VALUES = ["SSDI", "SSI"] as const;

function normalizeState(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function parseStates(statesServed: string | null | undefined, routingStates: string[] | null | undefined): string[] {
  const source =
    routingStates && routingStates.length > 0
      ? routingStates
      : (statesServed ?? "").split(/[,;\n|/\s]+/);

  return Array.from(
    new Set(
      source
        .map((state) => normalizeState(state))
        .filter((state): state is string => Boolean(state))
    )
  );
}

function normalizeStateList(values: string[] | null | undefined): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((state) => normalizeState(state))
        .filter((state): state is string => Boolean(state))
    )
  );
}

function requiredBenefits(benefitType: string | null | undefined): string[] {
  const value = (benefitType ?? "").toLowerCase();
  if (!value || value.includes("not sure") || value.includes("unknown")) return [];
  if (value.includes("both")) return ["SSDI", "SSI"];
  return BENEFIT_VALUES.filter((benefit) => value.includes(benefit.toLowerCase()));
}

function requiredStage(
  applicationStatus: string | null | undefined
): "initial" | "appeals" | "hearings" | null {
  const value = (applicationStatus ?? "").toLowerCase();
  if (!value || value.includes("not sure") || value.includes("unknown")) return null;
  if (value.includes("hearing")) return "hearings";
  if (value.includes("denied") || value.includes("appeal")) return "appeals";
  if (value.includes("not applied") || value.includes("pending") || value.includes("initial")) {
    return "initial";
  }
  return null;
}

function parseCapacity(value: string | null | undefined): number | null {
  if (!value) return null;
  const numbers = value.match(/\d+/g)?.map(Number) ?? [];
  if (numbers.length === 0) return null;
  return Math.max(...numbers);
}

export function evaluatePartnerEligibility(
  lead: LeadRoutingRecord,
  partner: PartnerRoutingRecord,
  monthlyAssignedCount: number
): PartnerEligibilityResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const matchedRules: string[] = [];
  let score = 0;

  if (partner.status !== "active") {
    blockers.push("Account is not active.");
  } else {
    matchedRules.push("Account active");
    score += 20;
  }

  if (partner.accepting_leads === false) {
    blockers.push("Partner is not accepting leads.");
  } else {
    matchedRules.push("Accepting leads");
    score += 20;
  }

  if (partner.lead_status && partner.lead_status !== "active") {
    blockers.push(`Lead status is ${partner.lead_status.replace(/_/g, " ")}.`);
  } else {
    matchedRules.push("Lead status active");
    score += 15;
  }

  const leadState = normalizeState(lead.state);
  const routingScope = partner.routing_scope === "united_states" ? "united_states" : "selected_states";
  const partnerStates = parseStates(partner.states_served, partner.routing_states);
  const excludedStates = normalizeStateList(partner.routing_excluded_states);

  if (leadState) {
    if (routingScope === "united_states") {
      if (excludedStates.includes(leadState)) {
        blockers.push(`${leadState} is excluded from nationwide coverage.`);
      } else {
        matchedRules.push(`Nationwide coverage includes ${leadState}`);
        score += 25;
      }
    } else if (partnerStates.length === 0) {
      blockers.push("No routing states configured.");
    } else if (!partnerStates.includes(leadState)) {
      blockers.push(`Does not serve ${leadState}.`);
    } else {
      matchedRules.push(`Serves ${leadState}`);
      score += 25;
    }
  } else {
    warnings.push("Lead state is missing or not a two-letter state abbreviation.");
  }

  const benefits = requiredBenefits(lead.benefit_type);
  const partnerBenefits =
    partner.accepted_case_types && partner.accepted_case_types.length > 0
      ? partner.accepted_case_types
      : ["SSDI", "SSI"];

  if (benefits.length > 0) {
    const missing = benefits.filter((benefit) => !partnerBenefits.includes(benefit));
    if (missing.length > 0) {
      blockers.push(`Does not accept ${missing.join("/")} leads.`);
    } else {
      matchedRules.push("Accepts Social Security Disability leads");
      score += 20;
    }
  } else {
    matchedRules.push("Social Security Disability program accepted");
    score += 10;
  }

  const stage = requiredStage(lead.application_status);
  if (stage === "initial") {
    if (!partner.accepts_initial_filings) blockers.push("Does not accept initial filings.");
    else {
      matchedRules.push("Accepts initial filings");
      score += 10;
    }
  } else if (stage === "appeals") {
    if (!partner.accepts_appeals) blockers.push("Does not accept appeals/denials.");
    else {
      matchedRules.push("Accepts appeals/denials");
      score += 10;
    }
  } else if (stage === "hearings") {
    if (!partner.accepts_hearings) blockers.push("Does not accept hearings.");
    else {
      matchedRules.push("Accepts hearings");
      score += 10;
    }
  } else {
    warnings.push("Application stage is missing or not specific.");
  }

  const capacity = parseCapacity(partner.monthly_lead_capacity);
  if (capacity !== null) {
    if (monthlyAssignedCount >= capacity) {
      blockers.push(`Monthly capacity reached (${monthlyAssignedCount}/${capacity}).`);
    } else {
      matchedRules.push(`Capacity available (${monthlyAssignedCount}/${capacity})`);
      score += 10;
    }
  } else {
    warnings.push("Monthly capacity is not numeric.");
  }

  return {
    partner: {
      id: partner.id,
      firm_name: partner.firm_name,
      email: partner.email,
      status: partner.status,
      accepting_leads: partner.accepting_leads,
      lead_status: partner.lead_status,
      routing_scope: routingScope,
      routing_states: partnerStates,
      routing_excluded_states: excludedStates,
      accepted_case_types: partnerBenefits,
      monthly_lead_capacity: partner.monthly_lead_capacity,
      monthly_assigned_count: monthlyAssignedCount,
      lead_notes: partner.lead_notes,
    },
    eligible: blockers.length === 0,
    score,
    matchedRules,
    blockers,
    warnings,
  };
}

export async function getPartnerEligibilityForLeadId(leadId: string) {
  const { data: lead, error: leadError } = await supabaseAdmin
    .from("leads")
    .select("id, state, benefit_type, application_status")
    .eq("id", leadId)
    .is("deleted_at", null)
    .single();

  if (leadError || !lead) {
    return { data: null, error: "Lead not found.", status: 404 as const };
  }

  const { data: partners, error: partnersError } = await supabaseAdmin
    .from("partner_accounts")
    .select(
      "id, firm_name, email, status, accepting_leads, lead_status, monthly_lead_capacity, " +
        "states_served, routing_scope, routing_states, routing_excluded_states, accepted_case_types, " +
        "accepts_initial_filings, accepts_appeals, accepts_hearings, accepts_child_cases, " +
        "accepted_languages, lead_notes"
    )
    .order("firm_name", { ascending: true });

  if (partnersError) {
    console.error("[leadRouting] Partner query error:", partnersError);
    return { data: null, error: "Failed to fetch partner eligibility.", status: 500 as const };
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { data: assignedRows } = await supabaseAdmin
    .from("leads")
    .select("assigned_partner_account_id")
    .not("assigned_partner_account_id", "is", null)
    .is("deleted_at", null)
    .gte("assigned_at", monthStart.toISOString())
    .in("status", ["assigned", "reviewing", "ready_to_assign", "new"]);

  const counts = new Map<string, number>();
  for (const row of (assignedRows ?? []) as AssignedLeadCountRow[]) {
    if (!row.assigned_partner_account_id) continue;
    counts.set(
      row.assigned_partner_account_id,
      (counts.get(row.assigned_partner_account_id) ?? 0) + 1
    );
  }

  const evaluated = ((partners ?? []) as unknown as PartnerRoutingRecord[])
    .map((partner) =>
      evaluatePartnerEligibility(lead as LeadRoutingRecord, partner, counts.get(partner.id) ?? 0)
    )
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      if (b.score !== a.score) return b.score - a.score;
      return a.partner.firm_name.localeCompare(b.partner.firm_name);
    });

  return {
    data: {
      lead: lead as LeadRoutingRecord,
      evaluated,
      eligible: evaluated.filter((item) => item.eligible),
    },
    error: null,
    status: 200 as const,
  };
}

export function bestEligiblePartner(results: PartnerEligibilityResult[]) {
  return results.find((item) => item.eligible) ?? null;
}
