export default function AdminDashboardPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
      <p className="mt-2 text-slate-600">
        Placeholder — will show lead counts, unassigned leads, and open invoices.
      </p>
      <ul className="mt-8 space-y-2 text-sm">
        <li>
          <a href="/admin/leads" className="text-blue-600 hover:underline">
            → Leads
          </a>
        </li>
        <li>
          <a href="/admin/partners" className="text-blue-600 hover:underline">
            → Partners
          </a>
        </li>
        <li>
          <a href="/admin/invoices" className="text-blue-600 hover:underline">
            → Invoices
          </a>
        </li>
      </ul>
    </main>
  );
}
