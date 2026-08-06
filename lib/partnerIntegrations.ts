import { supabaseAdmin } from "@/lib/supabaseAdmin";

const LEAD_SELECT =
  "id, created_at, updated_at, source, external_reference_id, dbs_report_number, " +
  "first_name, last_name, phone, caller_id, email, city, state, zip, benefit_type, application_status, " +
  "medical_summary, additional_notes, status, assigned_partner_account_id, assigned_at, " +
  "partner_response_status, partner_response_updated_at, partner_viewed_at, partner_notes";

export interface PartnerIntegrationAccount {
  id: string;
  webhook_enabled?: boolean | null;
  webhook_url?: string | null;
  webhook_secret?: string | null;
}

async function signWebhookPayload(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Buffer.from(signature).toString("hex");
}

function isValidWebhookUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && url.hostname.includes(".");
  } catch {
    return false;
  }
}

export async function sendPartnerLeadWebhook(input: {
  leadId: string;
  partnerAccountId: string;
  eventType?: "lead.assigned" | "lead.reassigned";
}) {
  const { data: account, error: accountError } = await supabaseAdmin
    .from("partner_accounts")
    .select("id, webhook_enabled, webhook_url, webhook_secret")
    .eq("id", input.partnerAccountId)
    .single();

  if (accountError || !account) {
    return { attempted: false, reason: "Partner account not found." };
  }

  const integration = account as PartnerIntegrationAccount;
  if (!integration.webhook_enabled || !integration.webhook_url) {
    return { attempted: false, reason: "Webhook is not enabled." };
  }

  if (!isValidWebhookUrl(integration.webhook_url)) {
    return { attempted: false, reason: "Webhook URL is invalid." };
  }

  const { data: lead, error: leadError } = await supabaseAdmin
    .from("leads")
    .select(LEAD_SELECT)
    .eq("id", input.leadId)
    .eq("assigned_partner_account_id", input.partnerAccountId)
    .is("deleted_at", null)
    .single();

  if (leadError || !lead) {
    return { attempted: false, reason: "Lead not found for partner." };
  }

  const payload = JSON.stringify({
    event: input.eventType ?? "lead.assigned",
    sent_at: new Date().toISOString(),
    partner_account_id: input.partnerAccountId,
    lead,
  });

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": "LIF-Manager-Webhooks/1.0",
    "x-lif-event": input.eventType ?? "lead.assigned",
    "x-lif-partner-account-id": input.partnerAccountId,
  };

  if (integration.webhook_secret) {
    headers["x-lif-signature"] = await signWebhookPayload(payload, integration.webhook_secret);
  }

  try {
    const response = await fetch(integration.webhook_url, {
      method: "POST",
      headers,
      body: payload,
      signal: AbortSignal.timeout(8000),
    });

    await supabaseAdmin
      .from("partner_accounts")
      .update({
        webhook_last_sent_at: new Date().toISOString(),
        webhook_last_status: response.status,
        webhook_last_error: response.ok ? null : `Webhook returned HTTP ${response.status}.`,
      })
      .eq("id", input.partnerAccountId);

    return { attempted: true, ok: response.ok, status: response.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook delivery failed.";
    await supabaseAdmin
      .from("partner_accounts")
      .update({
        webhook_last_sent_at: new Date().toISOString(),
        webhook_last_status: null,
        webhook_last_error: message.slice(0, 500),
      })
      .eq("id", input.partnerAccountId);

    return { attempted: true, ok: false, error: message };
  }
}
