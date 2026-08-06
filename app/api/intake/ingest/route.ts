import { NextResponse } from "next/server";
import { rateLimitResponse } from "@/lib/rateLimit";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assignBestMatchToLead, getLeadAssignmentSettings } from "@/lib/leadAssignmentEngine";

type DbsIngestResult = "created" | "duplicate" | "rejected" | "failed" | "dry_run";
type DbsDryRunResult = "would_create" | "would_duplicate" | "would_reject" | "would_fail_validation";

type DbsIngestEventInput = {
  externalReferenceId?: string | null;
  dbsReportNumber?: string | null;
  leadId?: string | null;
  result: DbsIngestResult;
  statusCode?: number | null;
  errorMessage?: string | null;
  consentGiven?: boolean | null;
  consentSource?: string | null;
  consentTimestamp?: string | null;
  receivedAt?: string | null;
  duplicate?: boolean;
  autoAssignmentEnabled?: boolean | null;
  autoAssignNewDbsLeads?: boolean | null;
  autoAssignmentResult?: unknown;
  assignedPartnerAccountId?: string | null;
  rawPayload?: Record<string, unknown> | null;
  rawPayloadSummary?: Record<string, unknown> | null;
  responseSummary?: Record<string, unknown> | null;
  isDryRun?: boolean;
  dryRunResult?: DbsDryRunResult | null;
  dryRunCheckedAt?: string | null;
};

function str(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s.length > 0 ? s : null;
}

/** Prefer explicit Caller ID fields from Retell/DBS. */
function parseCallerId(body: Record<string, unknown>): string | null {
  return (
    str(body.caller_id) ??
    str(body.callerId) ??
    str(body.caller_number) ??
    str(body.from_number) ??
    str(body.fromNumber) ??
    str(body.retell_caller_id) ??
    str(body.retell_from_number) ??
    null
  );
}

function parseOptionalTimestamp(val: unknown): string | null | "invalid" {
  const value = str(val);
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "invalid";
  return date.toISOString();
}

function isDryRunValue(value: unknown) {
  return value === true || value === "true" || value === "1";
}

function buildPayloadSummary(body: Record<string, unknown>) {
  return {
    external_reference_id: str(body.external_reference_id),
    dbs_report_number: str(body.dbs_report_number) ?? str(body.report_number),
    consent_given: body.consent_given === true,
    consent_source: str(body.consent_source),
    consent_timestamp: str(body.consent_timestamp),
    has_first_name: Boolean(str(body.first_name)),
    has_last_name: Boolean(str(body.last_name)),
    has_phone: Boolean(str(body.phone)),
    has_caller_id: Boolean(parseCallerId(body)),
    has_email: Boolean(str(body.email)),
    state: str(body.state)?.toUpperCase() ?? null,
    benefit_type: str(body.benefit_type),
    application_status: str(body.application_status),
    has_medical_summary: Boolean(str(body.medical_summary)),
    has_additional_notes: Boolean(str(body.additional_notes)),
    dry_run: isDryRunValue(body.dry_run),
  };
}

async function logDbsIngestEvent(input: DbsIngestEventInput) {
  try {
    const { error } = await supabaseAdmin.from("dbs_ingest_events").insert({
      source: "disabilitybenefitsscreening",
      external_reference_id: input.externalReferenceId ?? null,
      dbs_report_number: input.dbsReportNumber ?? null,
      lif_lead_id: input.leadId ?? null,
      ingest_result: input.result,
      status_code: input.statusCode ?? null,
      error_message: input.errorMessage ?? null,
      consent_given: input.consentGiven ?? null,
      consent_source: input.consentSource ?? null,
      consent_timestamp: input.consentTimestamp ?? null,
      received_at: input.receivedAt ?? null,
      duplicate: input.duplicate ?? false,
      auto_assignment_enabled: input.autoAssignmentEnabled ?? null,
      auto_assign_new_dbs_leads: input.autoAssignNewDbsLeads ?? null,
      auto_assignment_result: input.autoAssignmentResult ?? null,
      assigned_partner_account_id: input.assignedPartnerAccountId ?? null,
      raw_payload: input.rawPayload ?? null,
      raw_payload_summary: input.rawPayloadSummary ?? null,
      response_summary: input.responseSummary ?? null,
      is_dry_run: input.isDryRun ?? false,
      dry_run_result: input.dryRunResult ?? null,
      dry_run_checked_at: input.dryRunCheckedAt ?? null,
    });

    if (error) {
      console.warn("[POST /api/intake/ingest] Non-blocking DBS ingest audit insert failed:", error.message);
    }
  } catch (error) {
    console.warn("[POST /api/intake/ingest] Non-blocking DBS ingest audit insert threw:", error);
  }
}

function dryRunResponse(input: {
  result: DbsDryRunResult;
  message: string;
  existingLeadId?: string;
  duplicate?: boolean;
  status?: number;
  error?: string;
}) {
  const payload = {
    success: !input.error,
    dryRun: true,
    result: input.result,
    message: input.message,
    ...(input.existingLeadId ? { existingLeadId: input.existingLeadId } : {}),
    ...(input.duplicate !== undefined ? { duplicate: input.duplicate } : {}),
    ...(input.error ? { error: input.error } : {}),
  };
  return NextResponse.json(payload, { status: input.status ?? (input.error ? 400 : 200) });
}

/**
 * POST /api/intake/ingest
 *
 * Secure DBS → LIF Manager lead ingestion.
 *
 * Auth: Header x-lif-ingest-secret must match LIF_DBS_INGEST_SECRET
 *
 * Requirements:
 *   consent_given === true
 *   external_reference_id starts with "dbs:"
 *
 * Optional Retell fields:
 *   caller_id (also accepts callerId, from_number, fromNumber, caller_number, retell_caller_id)
 *
 * On successful create: auto-routes to best eligible partner by default.
 */
export async function POST(request: Request) {
  const limited = rateLimitResponse(request, {
    keyPrefix: "dbs-ingest",
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  const ingestSecret = process.env.LIF_DBS_INGEST_SECRET;
  if (!ingestSecret) {
    console.error("[POST /api/intake/ingest] LIF_DBS_INGEST_SECRET is not set.");
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  const providedSecret = request.headers.get("x-lif-ingest-secret");
  if (!providedSecret || providedSecret !== ingestSecret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    await logDbsIngestEvent({ result: "rejected", statusCode: 400, errorMessage: "Invalid JSON body." });
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    await logDbsIngestEvent({ result: "rejected", statusCode: 400, errorMessage: "Invalid JSON body." });
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const body = raw as Record<string, unknown>;
  const dryRun = isDryRunValue(body.dry_run);
  const rawPayloadSummary = buildPayloadSummary(body);

  const externalReferenceId = str(body.external_reference_id);
  const dbsReportNumber = str(body.dbs_report_number) ?? str(body.report_number);
  const firstName = str(body.first_name);
  const lastName = str(body.last_name);
  const phone = str(body.phone);
  const callerId = parseCallerId(body);
  const email = str(body.email);
  const city = str(body.city);
  const state = str(body.state)?.toUpperCase() ?? null;
  const zip = str(body.zip);
  const benefitType = str(body.benefit_type);
  const applicationStatus = str(body.application_status);
  const medicalSummary = str(body.medical_summary);
  const additionalNotes = str(body.additional_notes);
  const consentSource = str(body.consent_source);
  const consentTimestamp = parseOptionalTimestamp(body.consent_timestamp);
  const receivedAt = new Date().toISOString();
  const dryRunCheckedAt = dryRun ? receivedAt : null;

  if (body.consent_given !== true) {
    const errorMessage = "Missing required consent confirmation.";
    await logDbsIngestEvent({
      externalReferenceId,
      dbsReportNumber,
      result: dryRun ? "dry_run" : "rejected",
      statusCode: 400,
      errorMessage,
      consentGiven: body.consent_given === true,
      consentSource,
      consentTimestamp: consentTimestamp === "invalid" ? null : consentTimestamp,
      receivedAt,
      rawPayload: dryRun ? null : body,
      rawPayloadSummary,
      isDryRun: dryRun,
      dryRunResult: dryRun ? "would_reject" : null,
      dryRunCheckedAt,
    });
    if (dryRun) {
      return dryRunResponse({ result: "would_reject", error: errorMessage, message: errorMessage });
    }
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }

  if (!externalReferenceId || !externalReferenceId.startsWith("dbs:")) {
    const errorMessage = "Missing required stable DBS external reference.";
    await logDbsIngestEvent({
      externalReferenceId,
      dbsReportNumber,
      result: dryRun ? "dry_run" : "rejected",
      statusCode: 400,
      errorMessage,
      consentGiven: true,
      consentSource,
      consentTimestamp: consentTimestamp === "invalid" ? null : consentTimestamp,
      receivedAt,
      rawPayload: dryRun ? null : body,
      rawPayloadSummary,
      isDryRun: dryRun,
      dryRunResult: dryRun ? "would_reject" : null,
      dryRunCheckedAt,
    });
    if (dryRun) {
      return dryRunResponse({ result: "would_reject", error: errorMessage, message: errorMessage });
    }
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }

  if (consentTimestamp === "invalid") {
    const errorMessage = "Invalid consent timestamp.";
    await logDbsIngestEvent({
      externalReferenceId,
      dbsReportNumber,
      result: dryRun ? "dry_run" : "rejected",
      statusCode: 400,
      errorMessage,
      consentGiven: true,
      consentSource,
      receivedAt,
      rawPayload: dryRun ? null : body,
      rawPayloadSummary,
      isDryRun: dryRun,
      dryRunResult: dryRun ? "would_reject" : null,
      dryRunCheckedAt,
    });
    if (dryRun) {
      return dryRunResponse({ result: "would_reject", error: errorMessage, message: errorMessage });
    }
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }

  const receiptMetadata: Record<string, unknown> = {
    dbs_report_number: dbsReportNumber,
    consent_given: true,
    dbs_consent_given: true,
    dbs_consent_source: consentSource,
    dbs_consent_timestamp: consentTimestamp,
    dbs_received_at: receivedAt,
    raw_payload: body,
  };

  // Update Caller ID on duplicate re-posts when DBS includes it
  if (callerId) {
    receiptMetadata.caller_id = callerId;
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("leads")
    .select("id, assigned_partner_account_id")
    .eq("source", "disabilitybenefitsscreening")
    .eq("external_reference_id", externalReferenceId)
    .maybeSingle();

  if (lookupError) {
    const errorMessage = "Failed to check for duplicate lead.";
    console.error("[POST /api/intake/ingest] Duplicate lookup error:", lookupError);
    await logDbsIngestEvent({
      externalReferenceId,
      dbsReportNumber,
      result: dryRun ? "dry_run" : "failed",
      statusCode: 500,
      errorMessage,
      consentGiven: true,
      consentSource,
      consentTimestamp,
      receivedAt,
      rawPayload: dryRun ? null : body,
      rawPayloadSummary,
      isDryRun: dryRun,
      dryRunResult: dryRun ? "would_fail_validation" : null,
      dryRunCheckedAt,
    });
    if (dryRun) {
      return dryRunResponse({
        result: "would_fail_validation",
        error: errorMessage,
        message: errorMessage,
        status: 500,
      });
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }

  if (dryRun) {
    if (existing) {
      await logDbsIngestEvent({
        externalReferenceId,
        dbsReportNumber,
        leadId: existing.id,
        result: "dry_run",
        statusCode: 200,
        consentGiven: true,
        consentSource,
        consentTimestamp,
        receivedAt,
        duplicate: true,
        assignedPartnerAccountId:
          (existing as { assigned_partner_account_id?: string | null }).assigned_partner_account_id ??
          null,
        isDryRun: true,
        dryRunResult: "would_duplicate",
        dryRunCheckedAt,
      });
      return dryRunResponse({
        result: "would_duplicate",
        existingLeadId: existing.id,
        duplicate: true,
        message:
          "A lead with this DBS reference already exists. No lead was created or updated because dry_run is true.",
      });
    }

    await logDbsIngestEvent({
      externalReferenceId,
      dbsReportNumber,
      result: "dry_run",
      statusCode: 200,
      consentGiven: true,
      consentSource,
      consentTimestamp,
      receivedAt,
      duplicate: false,
      isDryRun: true,
      dryRunResult: "would_create",
      dryRunCheckedAt,
    });
    return dryRunResponse({
      result: "would_create",
      duplicate: false,
      message: "Payload is valid. No lead was created because dry_run is true.",
    });
  }

  if (existing) {
    await supabaseAdmin.from("leads").update(receiptMetadata).eq("id", existing.id);

    await logDbsIngestEvent({
      externalReferenceId,
      dbsReportNumber,
      leadId: existing.id,
      result: "duplicate",
      statusCode: 200,
      consentGiven: true,
      consentSource,
      consentTimestamp,
      receivedAt,
      duplicate: true,
      rawPayload: body,
      rawPayloadSummary,
      assignedPartnerAccountId:
        (existing as { assigned_partner_account_id?: string | null }).assigned_partner_account_id ??
        null,
      responseSummary: { success: true, leadId: existing.id, duplicate: true },
    });

    return NextResponse.json({ success: true, leadId: existing.id, duplicate: true }, { status: 200 });
  }

  const { data, error } = await supabaseAdmin
    .from("leads")
    .insert({
      source: "disabilitybenefitsscreening",
      external_reference_id: externalReferenceId,
      dbs_report_number: dbsReportNumber,
      first_name: firstName,
      last_name: lastName,
      phone,
      caller_id: callerId,
      email,
      city,
      state,
      zip,
      benefit_type: benefitType,
      application_status: applicationStatus,
      medical_summary: medicalSummary,
      additional_notes: additionalNotes,
      status: "new",
      consent_given: true,
      dbs_consent_given: true,
      dbs_consent_source: consentSource,
      dbs_consent_timestamp: consentTimestamp,
      dbs_received_at: receivedAt,
      raw_payload: body,
      assigned_partner_account_id: null,
    })
    .select("id, assigned_partner_account_id")
    .single();

  if (error || !data) {
    const pgCode = (error as { code?: string } | null)?.code;
    if (pgCode === "23505") {
      const { data: duplicate } = await supabaseAdmin
        .from("leads")
        .select("id, assigned_partner_account_id")
        .eq("source", "disabilitybenefitsscreening")
        .eq("external_reference_id", externalReferenceId)
        .maybeSingle();

      if (duplicate) {
        await supabaseAdmin.from("leads").update(receiptMetadata).eq("id", duplicate.id);
        await logDbsIngestEvent({
          externalReferenceId,
          dbsReportNumber,
          leadId: duplicate.id,
          result: "duplicate",
          statusCode: 200,
          consentGiven: true,
          consentSource,
          consentTimestamp,
          receivedAt,
          duplicate: true,
          rawPayload: body,
          rawPayloadSummary,
          assignedPartnerAccountId:
            (duplicate as { assigned_partner_account_id?: string | null }).assigned_partner_account_id ??
            null,
        });
        return NextResponse.json(
          { success: true, leadId: duplicate.id, duplicate: true },
          { status: 200 }
        );
      }
    }

    console.error("[POST /api/intake/ingest] Supabase insert error:", error);
    await logDbsIngestEvent({
      externalReferenceId,
      dbsReportNumber,
      result: "failed",
      statusCode: 500,
      errorMessage: "Failed to store lead.",
      consentGiven: true,
      consentSource,
      consentTimestamp,
      receivedAt,
      rawPayload: body,
      rawPayloadSummary,
    });
    return NextResponse.json({ error: "Failed to store lead." }, { status: 500 });
  }

  // Auto-assign by default (streamlined behavior)
  const { settings } = await getLeadAssignmentSettings();
  let autoAssignment: unknown = null;

  if (settings.auto_assignment_enabled && settings.auto_assign_new_dbs_leads) {
    autoAssignment = await assignBestMatchToLead({
      leadId: data.id,
      origin: process.env.LIF_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin,
      assignmentType: "auto_ingest",
      assignedBy: "system:dbs_ingest",
      settings,
      notifyPartner: settings.notify_partner_on_auto_assignment,
    });
  }

  const createdResponse = { success: true, leadId: data.id, autoAssignment };

  await logDbsIngestEvent({
    externalReferenceId,
    dbsReportNumber,
    leadId: data.id,
    result: "created",
    statusCode: 201,
    consentGiven: true,
    consentSource,
    consentTimestamp,
    receivedAt,
    duplicate: false,
    autoAssignmentEnabled: settings.auto_assignment_enabled,
    autoAssignNewDbsLeads: settings.auto_assign_new_dbs_leads,
    autoAssignmentResult: autoAssignment,
    assignedPartnerAccountId:
      (autoAssignment as { partnerAccountId?: string } | null)?.partnerAccountId ?? null,
    rawPayload: body,
    rawPayloadSummary,
    responseSummary: createdResponse,
  });

  return NextResponse.json(createdResponse, { status: 201 });
}
