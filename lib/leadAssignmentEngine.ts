import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  bestEligiblePartner,
  getPartnerEligibilityForLeadId,
  type PartnerEligibilityResult,
} from "@/lib/leadRouting";
import { sendLeadAssignedNotifications } from "@/lib/emailNotifications";
import { sendPartnerLeadWebhook } from "@/lib/partnerIntegrations";

export type LeadAssignmentSettings = {
  id: string;
  auto_assignment_enabled: boolean;
  auto_assign_new_dbs_leads: boolean;
  notify_partner_on_auto_assignment: boolean;
  require_no_blockers: boolean;
  minimum_score: number;
  updated_at: string | null;
  updated_by: string | null;
  notes: string | null;
};

export type AssignmentEngineResult = {
  assigned: boolean;
  skipped?: boolean;
  reason?: string;
  leadId: string;
  partnerAccountId?: string | null;
  previousPartnerAccountId?: string | null;
  score?: number;
  assignmentType?: "manual" | "best_match" | "reassignment" | "auto_ingest" | "auto_batch";
  matchedRules?: string[];
  warnings?: string[];
  blockers?: string[];
  eventLogged?: boolean;
  notifications?: unknown;
  data?: unknown;
};

/** Streamlined defaults: auto-assignment is ON. */
const DEFAULT_SETTINGS: LeadAssignmentSettings = {
  id: "default",
  auto_assignment_enabled: true,
  auto_assign_new_dbs_leads: true,
  notify_partner_on_auto_assignment: true,
  require_no_blockers: true,
  minimum_score: 85,
  updated_at: null,
  updated_by: null,
  notes: null,
};

type CurrentLead = {
  id: string;
  assigned_partner_account_id: string | null;
  status: string | null;
  source: string | null;
  consent_given: boolean | null;
  dbs_consent_given: boolean | null;
};

function normalizeSettings(
  row: Partial<LeadAssignmentSettings> | null | undefined
): LeadAssignmentSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...row,
    id: row?.id ?? "default",
    auto_assignment_enabled: row?.auto_assignment_enabled ?? DEFAULT_SETTINGS.auto_assignment_enabled,
    auto_assign_new_dbs_leads:
      row?.auto_assign_new_dbs_leads ?? DEFAULT_SETTINGS.auto_assign_new_dbs_leads,
    notify_partner_on_auto_assignment:
      row?.notify_partner_on_auto_assignment ?? DEFAULT_SETTINGS.notify_partner_on_auto_assignment,
    require_no_blockers: row?.require_no_blockers ?? DEFAULT_SETTINGS.require_no_blockers,
    minimum_score:
      typeof row?.minimum_score === "number" ? row.minimum_score : DEFAULT_SETTINGS.minimum_score,
    updated_at: row?.updated_at ?? null,
    updated_by: row?.updated_by ?? null,
    notes: row?.notes ?? null,
  };
}

export async function getLeadAssignmentSettings(): Promise<{
  settings: LeadAssignmentSettings;
  warning: string | null;
}> {
  const { data, error } = await supabaseAdmin
    .from("lead_assignment_settings")
    .select(
      "id, auto_assignment_enabled, auto_assign_new_dbs_leads, notify_partner_on_auto_assignment, require_no_blockers, minimum_score, updated_at, updated_by, notes"
    )
    .eq("id", "default")
    .maybeSingle();

  if (error) {
    console.warn("[leadAssignmentEngine] lead_assignment_settings unavailable:", error);
    return {
      settings: DEFAULT_SETTINGS,
      warning:
        "Lead assignment settings table unavailable — using streamlined defaults (auto-assign ON).",
    };
  }

  // If no row exists yet, use streamlined defaults (auto ON).
  if (!data) {
    return { settings: DEFAULT_SETTINGS, warning: null };
  }

  return {
    settings: normalizeSettings(data as Partial<LeadAssignmentSettings>),
    warning: null,
  };
}

export function chooseBestAssignablePartner(
  results: PartnerEligibilityResult[],
  settings: Pick<LeadAssignmentSettings, "minimum_score" | "require_no_blockers">
) {
  const best = bestEligiblePartner(results);
  if (!best) return { partner: null, reason: "No eligible partner found." };
  if (settings.require_no_blockers && best.blockers.length > 0) {
    return { partner: null, reason: "Best candidate still has blockers." };
  }
  if (best.score < settings.minimum_score) {
    return {
      partner: null,
      reason: `Best candidate score ${best.score} is below minimum score ${settings.minimum_score}.`,
      candidate: best,
    };
  }
  return { partner: best, reason: null };
}

export async function assignBestMatchToLead(input: {
  leadId: string;
  origin: string;
  assignmentType: "best_match" | "auto_ingest" | "auto_batch";
  assignedBy: string;
  settings?: LeadAssignmentSettings;
  notifyPartner?: boolean;
}): Promise<AssignmentEngineResult> {
  const settings = input.settings ?? (await getLeadAssignmentSettings()).settings;

  const eligibilityResult = await getPartnerEligibilityForLeadId(input.leadId);
  if (!eligibilityResult.data) {
    return {
      assigned: false,
      skipped: true,
      leadId: input.leadId,
      reason: eligibilityResult.error ?? "Failed to evaluate partner matches.",
    };
  }

  const choice = chooseBestAssignablePartner(eligibilityResult.data.evaluated, settings);
  if (!choice.partner) {
    return {
      assigned: false,
      skipped: true,
      leadId: input.leadId,
      reason: choice.reason ?? "No assignable partner found.",
      score: choice.candidate?.score,
      blockers: choice.candidate?.blockers,
      warnings: choice.candidate?.warnings,
      matchedRules: choice.candidate?.matchedRules,
    };
  }

  const bestMatch = choice.partner;

  const { data: currentLead, error: currentLeadError } = await supabaseAdmin
    .from("leads")
    .select("id, status, source, assigned_partner_account_id, consent_given, dbs_consent_given")
    .eq("id", input.leadId)
    .is("deleted_at", null)
    .single();

  if (currentLeadError || !currentLead) {
    return { assigned: false, skipped: true, leadId: input.leadId, reason: "Lead not found." };
  }

  const lead = currentLead as CurrentLead;
  if (
    lead.source === "disabilitybenefitsscreening" &&
    !(lead.dbs_consent_given === true || lead.consent_given === true)
  ) {
    return {
      assigned: false,
      skipped: true,
      leadId: input.leadId,
      reason:
        "This DBS lead cannot be assigned because consent is missing or was not preserved in LIF.",
    };
  }

  const previousPartnerId = lead.assigned_partner_account_id;
  const bestPartnerId = bestMatch.partner.id;
  const reassigned = Boolean(previousPartnerId && previousPartnerId !== bestPartnerId);
  const samePartner = previousPartnerId === bestPartnerId;
  const assignedAt = samePartner ? undefined : new Date().toISOString();

  const updates: Record<string, unknown> = {
    assigned_partner_account_id: bestPartnerId,
    status: "assigned",
  };

  if (!samePartner) {
    updates.assigned_at = assignedAt;
    updates.partner_response_status = "new";
    updates.partner_response_updated_at = null;
    updates.partner_viewed_at = null;
    updates.partner_notes = null;
  } else {
    updates.partner_response_status = "new";
  }

  const { data: updatedLead, error: updateError } = await supabaseAdmin
    .from("leads")
    .update(updates)
    .eq("id", input.leadId)
    .is("deleted_at", null)
    .select(
      "id, status, assigned_partner_account_id, assigned_at, partner_response_status, " +
        "partner_response_updated_at, partner_viewed_at, partner_notes, updated_at"
    )
    .single();

  if (updateError || !updatedLead) {
    console.error("[assignBestMatchToLead] Update error:", updateError);
    return { assigned: false, skipped: false, leadId: input.leadId, reason: "Failed to assign best match." };
  }

  const eventAssignmentType = reassigned ? "reassignment" : input.assignmentType;

  const { error: eventError } = await supabaseAdmin.from("lead_assignment_events").insert({
    lead_id: input.leadId,
    partner_account_id: bestPartnerId,
    previous_partner_account_id: previousPartnerId,
    assignment_type: eventAssignmentType,
    score: bestMatch.score,
    matched_rules: bestMatch.matchedRules,
    blockers: bestMatch.blockers,
    warnings: bestMatch.warnings,
    assigned_by: input.assignedBy,
    notes: samePartner
      ? "Assignment engine selected the currently assigned partner."
      : `Assignment engine selected best match (${input.assignmentType}).`,
  });

  if (eventError) {
    console.error("[assignBestMatchToLead] Event insert error:", eventError);
  }

  let notificationSummary = null;
  if (!samePartner && (input.notifyPartner ?? settings.notify_partner_on_auto_assignment)) {
    notificationSummary = await sendLeadAssignedNotifications({
      origin: input.origin,
      leadId: input.leadId,
      partnerAccountId: bestPartnerId,
      assignmentType: eventAssignmentType === "reassignment" ? "reassignment" : input.assignmentType,
    });
  }

  if (!samePartner) {
    await sendPartnerLeadWebhook({
      leadId: input.leadId,
      partnerAccountId: bestPartnerId,
      eventType: eventAssignmentType === "reassignment" ? "lead.reassigned" : "lead.assigned",
    });
  }

  return {
    assigned: true,
    leadId: input.leadId,
    partnerAccountId: bestPartnerId,
    previousPartnerAccountId: previousPartnerId,
    assignmentType: eventAssignmentType,
    score: bestMatch.score,
    matchedRules: bestMatch.matchedRules,
    warnings: bestMatch.warnings,
    blockers: bestMatch.blockers,
    eventLogged: !eventError,
    notifications: notificationSummary,
    data: updatedLead,
  };
}
