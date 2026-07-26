import { redirect } from "next/navigation";
import { getAuthenticatedPartnerSession, type PartnerRole } from "@/lib/partnerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import PartnerNav from "../PartnerNav";
import PartnerTeamDashboard from "./PartnerTeamDashboard";

interface PartnerAccountHeader {
  id: string;
  firm_name: string;
}

interface PartnerUserHeader {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: PartnerRole;
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

export default async function PartnerTeamPage() {
  const session = await getAuthenticatedPartnerSession();
  if (!session) redirect("/partner/login");

  const { data: account, error: accountError } = await supabaseAdmin
    .from("partner_accounts")
    .select("id, firm_name")
    .eq("id", session.partnerAccountId)
    .single();

  if (accountError || !account) redirect("/partner/login");

  const { data: user } = await supabaseAdmin
    .from("partner_users")
    .select("id, first_name, last_name, email, role")
    .eq("id", session.partnerUserId)
    .single();

  const partnerAccount = account as PartnerAccountHeader;
  const partnerUser = user as PartnerUserHeader | null;
  const displayName = partnerUser
    ? `${partnerUser.first_name} ${partnerUser.last_name}`
    : "Partner User";

  return (
    <div className="min-h-screen bg-gray-50">
      <PartnerNav active="/partner/team" />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#1a3a5c]">Partner Team</p>
            <h1 className="mt-1 text-2xl font-bold text-[#0d1b2e]">{partnerAccount.firm_name}</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-500">
              Manage the users who can access this partner account. Owners and admins can invite team
              members and update roles.
            </p>
          </div>
          {partnerUser && (
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-right shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Signed in as</p>
              <p className="mt-0.5 text-sm font-semibold text-[#0d1b2e]">{displayName}</p>
              <p className="text-xs text-gray-500">{partnerUser.email}</p>
              <div className="mt-1.5 flex justify-end">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[session.role]}`}
                >
                  {ROLE_LABELS[session.role]}
                </span>
              </div>
            </div>
          )}
        </div>

        <PartnerTeamDashboard role={session.role} currentUserId={session.partnerUserId} />
      </main>
    </div>
  );
}
