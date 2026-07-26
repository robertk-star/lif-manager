import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getAuthenticatedPartnerSession,
  type PartnerRole,
} from "@/lib/partnerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import PartnerNav from "../PartnerNav";

interface PartnerAccountDashboard {
  id: string;
  firm_name: string;
  contact_first_name: string;
  contact_last_name: string;
  email: string;
  phone: string | null;
  website: string | null;
  states_served: string | null;
  practice_area: string | null;
  monthly_lead_capacity: string | null;
  status: string;
  accepting_leads: boolean | null;
  lead_status: string | null;
  accepted_case_types: string[] | null;
  accepted_languages: string[] | null;
  accepts_initial_filings: boolean | null;
  accepts_appeals: boolean | null;
  accepts_hearings: boolean | null;
  accepts_child_cases: boolean | null;
  lead_notes: string | null;
  routing_scope: string | null;
  routing_states: string[] | null;
  routing_excluded_states: string[] | null;
  billing_contact_name: string | null;
  billing_contact_email: string | null;
  billing_address_line1: string | null;
}

interface PartnerUserDashboard {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: PartnerRole;
  status: string;
}

interface CountResult {
  count: number;
}

const ROLE_LABELS: Record<PartnerRole, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
  viewer: "Viewer",
};

const ROLE_COLORS: Record<PartnerRole, string> = {
  owner: "bg-purple-100 text-purple-800",
  admin: "bg-indigo-100 text-indigo-800",
  staff: "bg-blue-100 text-blue-800",
  viewer: "bg-gray-100 text-gray-700",
};

function isFilled(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function isPositiveNumberText(value: string | null | undefined) {
  if (!value) return false;
  const number = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(number) && number > 0;
}

function statusLabel(value: string | null | undefined) {
  if (!value) return "Not set";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

async function getCount(
  query: PromiseLike<{ count: number | null; error: unknown }>
): Promise<CountResult> {
  try {
    const result = await query;
    return { count: result.error ? 0 : (result.count ?? 0) };
  } catch {
    return { count: 0 };
  }
}

export default async function PartnerDashboardPage() {
  const session = await getAuthenticatedPartnerSession();

  if (!session) {
    redirect("/partner/login");
  }

  const { data: account, error: accountError } = await supabaseAdmin
    .from("partner_accounts")
    .select(
      "id, firm_name, contact_first_name, contact_last_name, email, phone, website, states_served, practice_area, " +
        "monthly_lead_capacity, status, accepting_leads, lead_status, accepted_case_types, accepted_languages, " +
        "accepts_initial_filings, accepts_appeals, accepts_hearings, accepts_child_cases, lead_notes, routing_scope, routing_states, routing_excluded_states, " +
        "billing_contact_name, billing_contact_email, billing_address_line1"
    )
    .eq("id", session.partnerAccountId)
    .single();

  if (accountError || !account) {
    redirect("/partner/login");
  }

  const { data: user } = await supabaseAdmin
    .from("partner_users")
    .select("id, first_name, last_name, email, role, status")
    .eq("id", session.partnerUserId)
    .single();

  const partner = account as unknown as PartnerAccountDashboard;
  const partnerUser = user as PartnerUserDashboard | null;
  const displayName = partnerUser
    ? `${partnerUser.first_name} ${partnerUser.last_name}`
    : `${partner.contact_first_name} ${partner.contact_last_name}`;

  const [assignedLeads, newLeads, openInvoices, openDisputes, activeUsers, pendingUsers] =
    await Promise.all([
      getCount(
        supabaseAdmin
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("assigned_partner_account_id", session.partnerAccountId)
          .is("deleted_at", null)
      ),
      getCount(
        supabaseAdmin
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("assigned_partner_account_id", session.partnerAccountId)
          .is("deleted_at", null)
          .or("partner_response_status.is.null,partner_response_status.eq.new")
      ),
      getCount(
        supabaseAdmin
          .from("partner_billing_invoices")
          .select("id", { count: "exact", head: true })
          .eq("partner_account_id", session.partnerAccountId)
          .in("status", ["sent", "partially_paid"])
      ),
      getCount(
        supabaseAdmin
          .from("partner_billing_disputes")
          .select("id", { count: "exact", head: true })
          .eq("partner_account_id", session.partnerAccountId)
          .in("status", ["open", "in_review"])
      ),
      getCount(
        supabaseAdmin
          .from("partner_users")
          .select("id", { count: "exact", head: true })
          .eq("partner_account_id", session.partnerAccountId)
          .eq("status", "active")
      ),
      getCount(
        supabaseAdmin
          .from("partner_users")
          .select("id", { count: "exact", head: true })
          .eq("partner_account_id", session.partnerAccountId)
          .eq("status", "pending")
      ),
    ]);

  const profileChecks = [
    isFilled(partner.firm_name),
    isFilled(partner.phone),
    isFilled(partner.practice_area),
    isFilled(partner.states_served),
    isFilled(partner.website),
  ];
  const routingChecks = [
    partner.accepting_leads === true,
    partner.lead_status === "active",
    partner.routing_scope === "united_states" || (partner.routing_states ?? []).length > 0,
    true,
    partner.accepts_initial_filings ||
      partner.accepts_appeals ||
      partner.accepts_hearings ||
      partner.accepts_child_cases,
    isPositiveNumberText(partner.monthly_lead_capacity),
  ];
  const billingChecks = [
    isFilled(partner.billing_contact_name),
    isFilled(partner.billing_contact_email),
    isFilled(partner.billing_address_line1),
  ];
  const teamChecks = [activeUsers.count > 0, activeUsers.count + pendingUsers.count > 1];

  const completedChecks = [
    ...profileChecks,
    ...routingChecks,
    ...billingChecks,
    ...teamChecks,
  ].filter(Boolean).length;
  const totalChecks =
    profileChecks.length + routingChecks.length + billingChecks.length + teamChecks.length;
  const setupPercent = percent(completedChecks, totalChecks);

  const checklistItems = [
    {
      title: "Complete firm profile",
      description:
        "Add firm details, website, contact information, practice area, and states served.",
      href: "/partner/account",
      complete: profileChecks.every(Boolean),
      action: "Update profile",
    },
    {
      title: "Confirm routing preferences",
      description:
        "Set accepted routing states, benefit programs, case stages, lead status, and monthly capacity.",
      href: "/partner/account",
      complete: routingChecks.every(Boolean),
      action: "Review preferences",
    },
    {
      title: "Add billing contact details",
      description:
        "Add billing contact and address details so statements and invoices are clear.",
      href: "/partner/account",
      complete: billingChecks.every(Boolean),
      action: "Update billing contact",
    },
    {
      title: "Invite team members",
      description:
        "Add attorneys, intake coordinators, paralegals, or office managers who need account access.",
      href: "/partner/team",
      complete: teamChecks.every(Boolean),
      action: "Manage team",
    },
  ];

  const readinessNotes = [
    partner.accepting_leads === true ? "Accepting new leads" : "Not currently accepting leads",
    `Lead status: ${statusLabel(partner.lead_status)}`,
    partner.routing_scope === "united_states"
      ? `Routing coverage: United States${
          (partner.routing_excluded_states ?? []).length
            ? ` except ${(partner.routing_excluded_states ?? []).join(", ")}`
            : ""
        }`
      : (partner.routing_states ?? []).length > 0
        ? `Routing states: ${(partner.routing_states ?? []).join(", ")}`
        : "Routing states not set",
    "Program: Social Security Disability",
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <PartnerNav active="/partner/dashboard" />

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#1a3a5c]">
              Partner Dashboard
            </p>
            <h1 className="mt-1 text-2xl font-bold text-[#0d1b2e]">
              Welcome back, {partnerUser?.first_name ?? partner.contact_first_name}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-500">
              Use this dashboard to keep {partner.firm_name} ready for lead assignments, team
              access, billing review, and referral follow-up.
            </p>
          </div>

          {partnerUser && (
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm sm:text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Signed in as</p>
              <p className="mt-0.5 text-sm font-semibold text-[#0d1b2e]">{displayName}</p>
              <p className="text-xs text-gray-500">{partnerUser.email}</p>
              <div className="mt-1.5 flex sm:justify-end">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[session.role]}`}
                >
                  {ROLE_LABELS[session.role]}
                </span>
              </div>
            </div>
          )}
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#0d1b2e]">Setup Readiness</h2>
              <p className="mt-1 text-sm text-gray-500">
                Complete these items so your firm is ready for accurate lead matching and smooth
                billing operations.
              </p>
            </div>
            <div className="min-w-[180px] rounded-xl bg-gray-50 px-5 py-4 text-center">
              <p className="text-3xl font-bold text-[#0d1b2e]">{setupPercent}%</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                {completedChecks} of {totalChecks} checks complete
              </p>
            </div>
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-[#1a3a5c] transition-all"
              style={{ width: `${setupPercent}%` }}
            />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <SummaryCard label="Assigned Leads" value={assignedLeads.count} href="/partner/leads" />
          <SummaryCard label="New Leads" value={newLeads.count} href="/partner/leads" />
          <SummaryCard label="Open Invoices" value={openInvoices.count} href="/partner/invoices" />
          <SummaryCard label="Open Disputes" value={openDisputes.count} href="/partner/invoices" />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-[#0d1b2e]">Onboarding Checklist</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {checklistItems.map((item) => (
                <div
                  key={item.title}
                  className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex gap-3">
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        item.complete
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {item.complete ? "✓" : "!"}
                    </span>
                    <div>
                      <p className="font-semibold text-[#0d1b2e]">{item.title}</p>
                      <p className="mt-1 text-sm text-gray-500">{item.description}</p>
                    </div>
                  </div>
                  <Link
                    href={item.href}
                    className="shrink-0 rounded-lg border border-[#1a3a5c] px-3 py-2 text-center text-xs font-semibold text-[#1a3a5c] hover:bg-[#1a3a5c] hover:text-white"
                  >
                    {item.action}
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-[#0d1b2e]">Routing Readiness</h2>
              <ul className="mt-4 space-y-3">
                {readinessNotes.map((note) => (
                  <li key={note} className="flex gap-2 text-sm text-gray-600">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#1a3a5c]" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/partner/account"
                className="mt-5 inline-flex rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d1b2e]"
              >
                Update Preferences
              </Link>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-[#0d1b2e]">Team Access</h2>
              <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Active Users
                  </dt>
                  <dd className="mt-1 text-2xl font-bold text-[#0d1b2e]">{activeUsers.count}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Pending Users
                  </dt>
                  <dd className="mt-1 text-2xl font-bold text-[#0d1b2e]">{pendingUsers.count}</dd>
                </div>
              </dl>
              {session.role === "owner" || session.role === "admin" ? (
                <Link
                  href="/partner/team"
                  className="mt-5 inline-flex rounded-lg border border-[#1a3a5c] px-4 py-2 text-sm font-semibold text-[#1a3a5c] hover:bg-[#1a3a5c] hover:text-white"
                >
                  Manage Team
                </Link>
              ) : (
                <p className="mt-4 text-sm text-gray-500">
                  Your role can view team members, but cannot manage invitations.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-blue-200 bg-blue-50 px-6 py-5">
          <h2 className="text-base font-semibold text-blue-900">Next best actions</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <QuickLink
              href="/partner/leads"
              title="Review assigned leads"
              description="Open new referrals and update response notes."
            />
            <QuickLink
              href="/partner/invoices"
              title="Check invoices"
              description="Review statement details, due dates, and questions."
            />
            <QuickLink
              href="/partner/team"
              title="Invite your team"
              description="Give staff access with the correct role."
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-[#1a3a5c] hover:shadow-md"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-[#0d1b2e]">{value}</p>
    </Link>
  );
}

function QuickLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-blue-200 bg-white/80 p-4 transition hover:bg-white"
    >
      <p className="text-sm font-semibold text-blue-900">{title}</p>
      <p className="mt-1 text-xs text-blue-700">{description}</p>
    </Link>
  );
}
