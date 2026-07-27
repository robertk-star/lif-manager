"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type EmailStatus = {
  emailConfigured: boolean;
  checks: {
    RESEND_API_KEY: string;
    LIF_EMAIL_FROM: string;
    LIF_EMAIL_FROM_preview: string | null;
    LIF_EMAIL_REPLY_TO: string;
  };
  note: string;
  deployment: { hostHint: string | null; env: string | null };
  recentNotifications: Array<{
    id: string;
    notification_type: string;
    recipient_email: string;
    status: string;
    error_message: string | null;
    created_at: string;
  }>;
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/leads?limit=1").then((res) => {
      if (res.status === 401) router.replace("/admin/login");
    });

    fetch("/api/admin/email-status")
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/admin/login");
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setEmailError(data.error ?? "Failed to load email status");
          return;
        }
        setEmailStatus(data.data as EmailStatus);
      })
      .catch(() => setEmailError("Network error loading email status"));
  }, [router]);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b border-slate-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-sm font-bold text-slate-900">LIF Manager</span>
            <a href="/admin" className="text-sm font-semibold text-slate-900">
              Dashboard
            </a>
            <a href="/admin/leads" className="text-sm text-slate-500 hover:text-slate-900">
              Leads
            </a>
            <a href="/admin/partners" className="text-sm text-slate-500 hover:text-slate-900">
              Partners
            </a>
            <a href="/admin/invoices" className="text-sm text-slate-500 hover:text-slate-900">
              Invoices
            </a>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Sign Out
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-12">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="mt-2 text-slate-600">
            Streamlined leads manager: route leads, manage partners, create invoices.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <a
            href="/admin/leads"
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300"
          >
            <h2 className="font-semibold text-slate-900">Lead Queue</h2>
            <p className="mt-1 text-sm text-slate-500">
              View DBS leads, filters, detail, and manual reassignment.
            </p>
          </a>
          <a
            href="/admin/partners"
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300"
          >
            <h2 className="font-semibold text-slate-900">Partners</h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage who receives leads and routing preferences.
            </p>
          </a>
          <a
            href="/admin/invoices"
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300"
          >
            <h2 className="font-semibold text-slate-900">Invoices</h2>
            <p className="mt-1 text-sm text-slate-500">
              Create drafts from billable leads; mark sent or paid.
            </p>
          </a>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Partner login email (this V2 deploy)</h2>
          <p className="mt-1 text-xs text-slate-500">
            Runtime check of what <strong>v2.legalintakeflow.com</strong> actually has — not the
            original site.
          </p>

          {emailError && <p className="mt-3 text-sm text-red-600">{emailError}</p>}

          {!emailStatus && !emailError && (
            <p className="mt-3 text-sm text-slate-400">Checking email config…</p>
          )}

          {emailStatus && (
            <div className="mt-4 space-y-3">
              <div
                className={`rounded-lg border px-4 py-3 text-sm ${
                  emailStatus.emailConfigured
                    ? "border-green-200 bg-green-50 text-green-800"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                {emailStatus.emailConfigured
                  ? "Email is configured on this deployment."
                  : "Email is NOT configured on this deployment."}
              </div>

              <ul className="space-y-1 text-sm text-slate-700">
                <li>
                  <span className="font-medium">RESEND_API_KEY:</span>{" "}
                  {emailStatus.checks.RESEND_API_KEY}
                </li>
                <li>
                  <span className="font-medium">LIF_EMAIL_FROM:</span>{" "}
                  {emailStatus.checks.LIF_EMAIL_FROM}
                  {emailStatus.checks.LIF_EMAIL_FROM_preview
                    ? ` (${emailStatus.checks.LIF_EMAIL_FROM_preview})`
                    : ""}
                </li>
                <li>
                  <span className="font-medium">LIF_EMAIL_REPLY_TO:</span>{" "}
                  {emailStatus.checks.LIF_EMAIL_REPLY_TO}
                </li>
                <li className="text-xs text-slate-400">
                  Deploy: {emailStatus.deployment.env ?? "—"} /{" "}
                  {emailStatus.deployment.hostHint ?? "—"}
                </li>
              </ul>

              <p className="text-sm text-slate-600">{emailStatus.note}</p>

              {emailStatus.recentNotifications.length > 0 && (
                <div className="overflow-x-auto">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Recent email attempts
                  </p>
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="py-1 pr-3">When</th>
                        <th className="py-1 pr-3">To</th>
                        <th className="py-1 pr-3">Status</th>
                        <th className="py-1">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {emailStatus.recentNotifications.map((n) => (
                        <tr key={n.id}>
                          <td className="py-1.5 pr-3 whitespace-nowrap text-slate-500">
                            {new Date(n.created_at).toLocaleString()}
                          </td>
                          <td className="py-1.5 pr-3">{n.recipient_email}</td>
                          <td className="py-1.5 pr-3 font-medium">{n.status}</td>
                          <td className="py-1.5 text-slate-500">{n.error_message ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
