"use client";

import { useEffect, useMemo, useState } from "react";

type IntegrationSettings = {
  api_access_enabled: boolean;
  api_key_last_four: string | null;
  api_key_created_at: string | null;
  api_key_revoked_at: string | null;
  webhook_enabled: boolean;
  webhook_url: string;
  webhook_secret_configured: boolean;
  webhook_last_sent_at: string | null;
  webhook_last_status: number | null;
  webhook_last_error: string | null;
};

const EMPTY_SETTINGS: IntegrationSettings = {
  api_access_enabled: false,
  api_key_last_four: null,
  api_key_created_at: null,
  api_key_revoked_at: null,
  webhook_enabled: false,
  webhook_url: "",
  webhook_secret_configured: false,
  webhook_last_sent_at: null,
  webhook_last_status: null,
  webhook_last_error: null,
};

function formatDate(value: string | null) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString();
}

export default function IntegrationsDashboard({ role }: { role: string }) {
  const [settings, setSettings] = useState<IntegrationSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [newWebhookSecret, setNewWebhookSecret] = useState("");

  const canEdit = role === "owner" || role === "admin";
  const origin = useMemo(() => {
    if (typeof window === "undefined") return "https://v2.legalintakeflow.com";
    return window.location.origin;
  }, []);

  async function loadSettings() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/partner/integrations");
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.error || "Failed to load integration settings.");
      setSettings({ ...EMPTY_SETTINGS, ...data.data });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load integration settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function saveWebhook(rotateSecret = false) {
    setSaving(true);
    setError("");
    setSuccess("");
    setNewWebhookSecret("");
    try {
      const res = await fetch("/api/partner/integrations", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          webhook_enabled: settings.webhook_enabled,
          webhook_url: settings.webhook_url,
          rotate_webhook_secret: rotateSecret,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.error || "Failed to save webhook settings.");
      setSettings({ ...EMPTY_SETTINGS, ...data.data });
      if (data.webhook_secret) setNewWebhookSecret(data.webhook_secret);
      setSuccess(
        rotateSecret ? "Webhook secret generated. Copy it now." : "Webhook settings saved."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save webhook settings.");
    } finally {
      setSaving(false);
    }
  }

  async function generateApiKey() {
    setSaving(true);
    setError("");
    setSuccess("");
    setNewApiKey("");
    try {
      const res = await fetch("/api/partner/integrations/api-key", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to generate API key.");
      setNewApiKey(data.api_key);
      setSettings((prev) => ({
        ...prev,
        api_access_enabled: true,
        api_key_last_four: data.api_key_last_four,
        api_key_created_at: data.api_key_created_at,
        api_key_revoked_at: null,
      }));
      setSuccess("API key generated. Copy it now; the full key will not be shown again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate API key.");
    } finally {
      setSaving(false);
    }
  }

  async function revokeApiKey() {
    if (!window.confirm("Revoke this API key? Any connected system using it will stop working."))
      return;
    setSaving(true);
    setError("");
    setSuccess("");
    setNewApiKey("");
    try {
      const res = await fetch("/api/partner/integrations/api-key", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to revoke API key.");
      setSettings((prev) => ({
        ...prev,
        api_access_enabled: false,
        api_key_last_four: null,
        api_key_created_at: null,
        api_key_revoked_at: new Date().toISOString(),
      }));
      setSuccess("API key revoked.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke API key.");
    } finally {
      setSaving(false);
    }
  }

  async function copyText(value: string) {
    await navigator.clipboard.writeText(value);
    setSuccess("Copied.");
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        Loading integration settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!canEdit && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          You can view integration settings, but only owner and admin users can change them.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-700">
          {success}
        </div>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#0d1b2e]">API Access</h2>
            <p className="mt-1 text-sm text-gray-600">
              Let your firm pull assigned leads from LIF into your own CRM or database.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              settings.api_access_enabled
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {settings.api_access_enabled ? "Enabled" : "Off"}
          </span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Endpoint</p>
            <code className="mt-2 block break-all rounded-lg bg-white px-3 py-2 text-xs text-gray-800">
              GET {origin}/api/external/partner/leads
            </code>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Authentication
            </p>
            <code className="mt-2 block break-all rounded-lg bg-white px-3 py-2 text-xs text-gray-800">
              Authorization: Bearer YOUR_API_KEY
            </code>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          Current key:{" "}
          {settings.api_key_last_four
            ? `ending in ${settings.api_key_last_four}`
            : "No key generated"}
          . Created: {formatDate(settings.api_key_created_at)}.
        </div>

        {newApiKey && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">
              Copy this API key now. It will not be shown again.
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 text-xs text-gray-800">
                {newApiKey}
              </code>
              <button
                onClick={() => copyText(newApiKey)}
                className="rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-semibold text-white"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!canEdit || saving}
            onClick={generateApiKey}
            className="rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Generate New API Key
          </button>
          <button
            type="button"
            disabled={!canEdit || saving || !settings.api_key_last_four}
            onClick={revokeApiKey}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Revoke API Key
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#0d1b2e]">Lead Assignment Webhook</h2>
            <p className="mt-1 text-sm text-gray-600">
              LIF can POST a lead to your endpoint when an admin assigns a lead to your firm.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              settings.webhook_enabled
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {settings.webhook_enabled ? "Enabled" : "Off"}
          </span>
        </div>

        <div className="mt-5 space-y-4">
          <label className="flex items-center gap-3 text-sm font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={settings.webhook_enabled}
              disabled={!canEdit || saving}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, webhook_enabled: event.target.checked }))
              }
              className="h-4 w-4 rounded border-gray-300"
            />
            Enable webhook delivery
          </label>

          <label className="block text-sm font-semibold text-gray-700">
            Webhook URL
            <input
              type="url"
              value={settings.webhook_url}
              disabled={!canEdit || saving}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, webhook_url: event.target.value }))
              }
              placeholder="https://example.com/lif-webhook"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1a3a5c]"
            />
          </label>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            <p>
              <strong>Event:</strong> lead.assigned
            </p>
            <p>
              <strong>Method:</strong> POST
            </p>
            <p>
              <strong>Signature header:</strong> x-lif-signature
            </p>
            <p>
              <strong>Secret:</strong>{" "}
              {settings.webhook_secret_configured ? "Configured" : "Not generated yet"}
            </p>
            <p>
              <strong>Last delivery:</strong> {formatDate(settings.webhook_last_sent_at)}{" "}
              {settings.webhook_last_status ? `(HTTP ${settings.webhook_last_status})` : ""}
            </p>
            {settings.webhook_last_error && (
              <p className="mt-1 text-red-700">
                <strong>Last error:</strong> {settings.webhook_last_error}
              </p>
            )}
          </div>

          {newWebhookSecret && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-900">Copy this webhook secret now.</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 text-xs text-gray-800">
                  {newWebhookSecret}
                </code>
                <button
                  onClick={() => copyText(newWebhookSecret)}
                  className="rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-semibold text-white"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!canEdit || saving}
              onClick={() => saveWebhook(false)}
              className="rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save Webhook Settings
            </button>
            <button
              type="button"
              disabled={!canEdit || saving}
              onClick={() => saveWebhook(true)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Generate / Rotate Secret
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#0d1b2e]">Example API Request</h2>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-gray-950 p-4 text-xs text-gray-100">
{`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "${origin}/api/external/partner/leads?limit=25"`}
        </pre>
        <p className="mt-3 text-sm text-gray-600">
          The API only returns leads assigned to your partner account.
        </p>
      </section>
    </div>
  );
}
