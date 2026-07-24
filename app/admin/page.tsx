"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/admin/leads?limit=1").then((res) => {
      if (res.status === 401) router.replace("/admin/login");
    });
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

      <main className="mx-auto max-w-5xl px-4 py-12">
        <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="mt-2 text-slate-600">
          Streamlined leads manager: route leads, manage partners, create invoices.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
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
      </main>
    </div>
  );
}
