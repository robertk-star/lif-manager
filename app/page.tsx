import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-50 px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          LIF Manager
        </h1>
        <p className="mt-2 text-slate-600">
          Streamlined leads manager for Legal Intake Flow
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Running alongside the existing site — not a replacement yet
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/admin/login"
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Admin Sign In
        </Link>
        <Link
          href="/partner/login"
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Partner Login
        </Link>
      </div>
    </main>
  );
}
