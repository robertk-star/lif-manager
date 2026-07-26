import { redirect } from "next/navigation";
import {
  getAuthenticatedPartnerSession,
  type PartnerRole,
} from "@/lib/partnerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import PartnerNav from "../PartnerNav";
import LeadPreferencesForm, { type LeadPreferences } from "./LeadPreferencesForm";
import PartnerProfileForm, { type PartnerProfileSettings } from "./PartnerProfileForm";

interface PartnerAccount {
  id: string;
  firm_name: string;
  contact_first_name: string;
  contact_last_name: string;
  email: string;
  phone: string;
  website: string | null;
  states_served: string;
  practice_area: string;
  monthly_lead_capacity: string;
  routing_scope: string | null;
  routing_states: string[] | null;
  routing_excluded_states: string[] | null;
  status: string;
  last_login_at: string | null;
  created_at: string;
  accepting_leads: boolean | null;
  lead_status: string | null;
  accepted_case_types: string[] | null;
  accepted_languages: string[] | null;
  accepts_initial_filings: boolean | null;
  accepts_appeals: boolean | null;
  accepts_hearings: boolean | null;
  accepts_child_cases: boolean | null;
  lead_notes: string | null;
  profile_updated_at: string | null;
  billing_contact_name: string | null;
  billing_contact_email: string | null;
  billing_contact_phone: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
  billing_notes: string | null;
}

interface PartnerUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: PartnerRole;
  status: string;
  last_login_at: string | null;
}

const ROLE_COLORS: Record<PartnerRole, string> = {
  owner: "bg-purple-100 text-purple-800",
  admin: "bg-indigo-100 text-indigo-800",
  staff: "bg-blue-100 text-blue-800",
  viewer: "bg-gray-100 text-gray-700",
};

const ROLE_LABELS: Record<PartnerRole, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
  viewer: "Viewer",
};

export default async function PartnerAccountPage() {
  const session = await getAuthenticatedPartnerSession();

  if (!session) {
    redirect("/partner/login");
  }

  const { partnerAccountId, partnerUserId, role } = session;

  const { data: account, error: accountError } = await supabaseAdmin
    .from("partner_accounts")
    .select(
      "id, firm_name, contact_first_name, contact_last_name, email, phone, website, " +
        "states_served, practice_area, monthly_lead_capacity, routing_scope, routing_states, routing_excluded_states, status, last_login_at, created_at, " +
        "profile_updated_at, billing_contact_name, billing_contact_email, billing_contact_phone, " +
        "billing_address_line1, billing_address_line2, billing_city, billing_state, billing_zip, billing_notes, " +
        "accepting_leads, lead_status, accepted_case_types, accepted_languages, " +
        "accepts_initial_filings, accepts_appeals, accepts_hearings, accepts_child_cases, lead_notes"
    )
    .eq("id", partnerAccountId)
    .single();

  if (accountError || !account) {
    redirect("/partner/login");
  }

  const partner = account as unknown as PartnerAccount;

  const { data: partnerUser } = await supabaseAdmin
    .from("partner_users")
    .select("id, first_name, last_name, email, role, status, last_login_at")
    .eq("id", partnerUserId)
    .single();

  const user = partnerUser as PartnerUser | null;

  const initialPreferences: LeadPreferences = {
    accepting_leads: partner.accepting_leads ?? true,
    lead_status: (partner.lead_status as LeadPreferences["lead_status"]) ?? "active",
    monthly_lead_capacity: partner.monthly_lead_capacity ?? "",
    routing_scope: (partner.routing_scope as LeadPreferences["routing_scope"]) ?? "selected_states",
    routing_states: partner.routing_states ?? [],
    routing_excluded_states: partner.routing_excluded_states ?? [],
    accepted_case_types: partner.accepted_case_types ?? [],
    accepted_languages: partner.accepted_languages ?? [],
    accepts_initial_filings: partner.accepts_initial_filings ?? true,
    accepts_appeals: partner.accepts_appeals ?? false,
    accepts_hearings: partner.accepts_hearings ?? false,
    accepts_child_cases: partner.accepts_child_cases ?? false,
    lead_notes: partner.lead_notes ?? null,
  };

  const initialProfile: PartnerProfileSettings = {
    firm_name: partner.firm_name,
    contact_first_name: partner.contact_first_name,
    contact_last_name: partner.contact_last_name,
    phone: partner.phone,
    website: partner.website,
    states_served: partner.states_served,
    practice_area: partner.practice_area,
    billing_contact_name: partner.billing_contact_name,
    billing_contact_email: partner.billing_contact_email,
    billing_contact_phone: partner.billing_contact_phone,
    billing_address_line1: partner.billing_address_line1,
    billing_address_line2: partner.billing_address_line2,
    billing_city: partner.billing_city,
    billing_state: partner.billing_state,
    billing_zip: partner.billing_zip,
    billing_notes: partner.billing_notes,
    profile_updated_at: partner.profile_updated_at,
  };

  const displayFirstName = user?.first_name ?? partner.contact_first_name;
  const displayFullName = user
    ? `${user.first_name} ${user.last_name}`
    : `${partner.contact_first_name} ${partner.contact_last_name}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <PartnerNav active="/partner/account" />

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0d1b2e]">Partner Account</h1>
            <p className="mt-1 text-sm text-gray-500">Welcome back, {displayFirstName}.</p>
          </div>

          {user && (
            <div className="shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-3 text-right shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Signed in as</p>
              <p className="mt-0.5 text-sm font-semibold text-[#0d1b2e]">{displayFullName}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
              <div className="mt-1.5 flex justify-end">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    ROLE_COLORS[role] ?? "bg-gray-100 text-gray-700"
                  }`}
                >
                  {ROLE_LABELS[role] ?? role}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
            <p className="text-sm text-blue-800">
              <strong>Lead dashboard is available.</strong> Review leads assigned to your firm.{" "}
              <a
                href="/partner/leads"
                className="ml-1 font-semibold underline underline-offset-2 hover:text-blue-900"
              >
                View assigned leads
              </a>
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-sm text-amber-900">
              <strong>Billing statement preview is available.</strong> Review admin-marked billing
              status.{" "}
              <a
                href="/partner/billing"
                className="ml-1 font-semibold underline underline-offset-2 hover:text-amber-950"
              >
                View billing statement
              </a>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-base font-semibold text-[#0d1b2e]">Profile Information</h2>
          </div>

          <div className="px-6 py-5">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
              <ProfileField label="Firm Name" value={partner.firm_name} />
              <ProfileField
                label="Contact Name"
                value={`${partner.contact_first_name} ${partner.contact_last_name}`}
              />
              <ProfileField label="Email" value={partner.email} />
              <ProfileField label="Phone" value={partner.phone} />
              {partner.website && (
                <ProfileField
                  label="Website"
                  value={
                    <a
                      href={partner.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-blue-600 hover:underline"
                    >
                      {partner.website}
                    </a>
                  }
                />
              )}
              <ProfileField label="States Served" value={partner.states_served} />
              <ProfileField label="Practice Area" value={partner.practice_area} />
              <ProfileField label="Monthly Lead Capacity" value={partner.monthly_lead_capacity} />
              <ProfileField
                label="Account Status"
                value={
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                      partner.status === "active"
                        ? "bg-green-100 text-green-800"
                        : partner.status === "pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {partner.status}
                  </span>
                }
              />
              {partner.last_login_at && (
                <ProfileField
                  label="Last Login"
                  value={new Date(partner.last_login_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                />
              )}
            </dl>
          </div>
        </div>

        <PartnerProfileForm initialProfile={initialProfile} role={role} />

        <LeadPreferencesForm initialPreferences={initialPreferences} />
      </main>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm text-gray-800">
        {value ?? <span className="italic text-gray-400">—</span>}
      </dd>
    </div>
  );
}
