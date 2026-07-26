"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PartnerRole } from "@/lib/partnerAuth";

type TeamStatus = "active" | "inactive" | "pending" | "suspended";

type TeamUser = {
  id: string;
  partner_account_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: PartnerRole;
  status: TeamStatus;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  invite_email_sent_at: string | null;
  invite_email_count: number | null;
  invited_by_partner_user_id: string | null;
};

const ROLE_OPTIONS: PartnerRole[] = ["owner", "admin", "staff", "viewer"];
const STATUS_OPTIONS: TeamStatus[] = ["active", "pending", "inactive", "suspended"];

const ROLE_LABELS: Record<PartnerRole, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
  viewer: "Viewer",
};

const STATUS_LABELS: Record<TeamStatus, string> = {
  active: "Active",
  pending: "Pending",
  inactive: "Inactive",
  suspended: "Suspended",
};

const ROLE_COLORS: Record<PartnerRole, string> = {
  owner: "bg-purple-100 text-purple-800",
  admin: "bg-indigo-100 text-indigo-800",
  staff: "bg-blue-100 text-blue-800",
  viewer: "bg-gray-100 text-gray-700",
};

const STATUS_COLORS: Record<TeamStatus, string> = {
  active: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  inactive: "bg-gray-100 text-gray-700",
  suspended: "bg-red-100 text-red-700",
};

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {label}
    </span>
  );
}

function canManage(role: PartnerRole) {
  return role === "owner" || role === "admin";
}

function allowedRoleOptions(actorRole: PartnerRole) {
  return actorRole === "owner" ? ROLE_OPTIONS : (["staff", "viewer"] as PartnerRole[]);
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#0d1b2e]">{value}</p>
    </div>
  );
}

function AddUserForm({
  actorRole,
  onAdded,
}: {
  actorRole: PartnerRole;
  onAdded: (user: TeamUser) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<PartnerRole>("staff");
  const [status, setStatus] = useState<TeamStatus>("pending");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/partner/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          role,
          status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to add team member.");
        return;
      }
      onAdded(data.data as TeamUser);
      setFirstName("");
      setLastName("");
      setEmail("");
      setRole("staff");
      setStatus("pending");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-[#0d1b2e]">Add Team Member</h2>
        <p className="mt-1 text-sm text-gray-500">
          Create a user for this firm. Generate a login link after the user is added.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="First name"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          required
        />
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Last name"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          required
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          required
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as PartnerRole)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          {allowedRoleOptions(actorRole).map((option) => (
            <option key={option} value={option}>
              {ROLE_LABELS[option]}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as TeamStatus)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {STATUS_LABELS[option]}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          disabled={saving}
          className="rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d1b2e] disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add User"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">Team member added.</p>}
      </div>
    </form>
  );
}

function EditUserModal({
  user,
  actorRole,
  currentUserId,
  onClose,
  onUpdated,
}: {
  user: TeamUser;
  actorRole: PartnerRole;
  currentUserId: string;
  onClose: () => void;
  onUpdated: (user: TeamUser) => void;
}) {
  const [firstName, setFirstName] = useState(user.first_name);
  const [lastName, setLastName] = useState(user.last_name);
  const [role, setRole] = useState<PartnerRole>(user.role);
  const [status, setStatus] = useState<TeamStatus>(user.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/partner/team/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, role, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to update team member.");
        return;
      }
      onUpdated(data.data as TeamUser);
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const roleOptions = allowedRoleOptions(actorRole);
  const isSelf = user.id === currentUserId;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#0d1b2e]">Edit Team Member</h2>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
            ✕
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">First Name</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Last Name</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as PartnerRole)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {!roleOptions.includes(user.role) && (
                  <option value={user.role}>{ROLE_LABELS[user.role]}</option>
                )}
                {roleOptions.map((option) => (
                  <option key={option} value={option}>
                    {ROLE_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TeamStatus)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {STATUS_LABELS[option]}
                  </option>
                ))}
              </select>
              {isSelf && (
                <p className="mt-1 text-xs text-gray-400">You cannot deactivate your own account.</p>
              )}
            </div>
          </div>
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-[#1a3a5c] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PartnerTeamDashboard({
  role,
  currentUserId,
}: {
  role: PartnerRole;
  currentUserId: string;
}) {
  const router = useRouter();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<TeamUser | null>(null);
  const [inviteSendingId, setInviteSendingId] = useState<string | null>(null);
  const [inviteMessages, setInviteMessages] = useState<Record<string, string>>({});
  const [manualLinks, setManualLinks] = useState<Record<string, string>>({});

  const userCanManage = canManage(role);

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/partner/team");
      if (res.status === 401) {
        router.push("/partner/login");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(data.error ?? "Failed to load team.");
        return;
      }
      setUsers(data.data ?? []);
    } catch {
      setLoadError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const counts = useMemo(
    () => ({
      total: users.length,
      active: users.filter((user) => user.status === "active").length,
      pending: users.filter((user) => user.status === "pending").length,
      owners: users.filter((user) => user.role === "owner").length,
    }),
    [users]
  );

  function upsertUser(user: TeamUser) {
    setUsers((prev) => {
      const exists = prev.some((item) => item.id === user.id);
      return exists
        ? prev.map((item) => (item.id === user.id ? user : item))
        : [...prev, user];
    });
  }

  async function sendInvite(user: TeamUser) {
    setInviteSendingId(user.id);
    setInviteMessages((prev) => ({ ...prev, [user.id]: "" }));
    setManualLinks((prev) => ({ ...prev, [user.id]: "" }));
    try {
      const res = await fetch(`/api/partner/team/${user.id}/send-invite`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInviteMessages((prev) => ({
          ...prev,
          [user.id]: data.error ?? "Failed to send invitation.",
        }));
        return;
      }
      if (data.sent) {
        setInviteMessages((prev) => ({ ...prev, [user.id]: "Invitation email sent." }));
      } else if (data.skipped) {
        setInviteMessages((prev) => ({
          ...prev,
          [user.id]: `Email skipped: ${data.error ?? "email not configured"}. Copy the link below.`,
        }));
      } else {
        setInviteMessages((prev) => ({
          ...prev,
          [user.id]: `Email failed: ${data.error ?? "unknown error"}. Copy the link below.`,
        }));
      }
      if (data.loginUrl) {
        setManualLinks((prev) => ({ ...prev, [user.id]: data.loginUrl as string }));
      }
      await fetchTeam();
    } catch {
      setInviteMessages((prev) => ({
        ...prev,
        [user.id]: "Network error. Please try again.",
      }));
    } finally {
      setInviteSendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Team Members" value={counts.total} />
        <SummaryCard label="Active" value={counts.active} />
        <SummaryCard label="Pending" value={counts.pending} />
        <SummaryCard label="Owners" value={counts.owners} />
      </div>

      {!userCanManage && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-5 py-4 text-sm text-yellow-800">
          Your role can view the team list, but only owner/admin users can add users, send
          invitations, or update roles.
        </div>
      )}

      {userCanManage && <AddUserForm actorRole={role} onAdded={upsertUser} />}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-[#0d1b2e]">Team Members</h2>
        </div>
        {loadError && (
          <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-600">
            {loadError}
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">
            Loading team…
          </div>
        ) : users.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">No team members found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Last Login</th>
                  <th className="px-4 py-3 text-left">Invitation</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {user.first_name} {user.last_name}
                      </div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                      {user.id === currentUserId && (
                        <div className="text-xs font-medium text-[#1a3a5c]">You</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={ROLE_LABELS[user.role]} color={ROLE_COLORS[user.role]} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        label={STATUS_LABELS[user.status]}
                        color={STATUS_COLORS[user.status]}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                      {formatDateTime(user.last_login_at)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      <div>Invited: {formatDateTime(user.invited_at)}</div>
                      <div>Email sent: {formatDateTime(user.invite_email_sent_at)}</div>
                      <div>Count: {user.invite_email_count ?? 0}</div>
                      {inviteMessages[user.id] && (
                        <p className="mt-1 text-xs text-[#1a3a5c]">{inviteMessages[user.id]}</p>
                      )}
                      {manualLinks[user.id] && (
                        <div className="mt-2 max-w-xs rounded-lg border border-gray-200 bg-gray-50 p-2">
                          <p className="mb-1 text-xs font-medium text-gray-500">One-time link</p>
                          <input
                            readOnly
                            value={manualLinks[user.id]}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                            onFocus={(e) => e.currentTarget.select()}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {userCanManage && (
                          <button
                            onClick={() => setSelectedUser(user)}
                            className="rounded border border-[#1a3a5c] px-2 py-1 text-xs font-semibold text-[#1a3a5c] hover:bg-[#1a3a5c] hover:text-white"
                          >
                            Edit
                          </button>
                        )}
                        {userCanManage &&
                          (user.status === "active" || user.status === "pending") && (
                            <button
                              onClick={() => sendInvite(user)}
                              disabled={inviteSendingId === user.id}
                              className="rounded bg-[#1a3a5c] px-2 py-1 text-xs font-semibold text-white hover:bg-[#0d1b2e] disabled:opacity-50"
                            >
                              {inviteSendingId === user.id ? "Sending…" : "Send Invite"}
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedUser && (
        <EditUserModal
          user={selectedUser}
          actorRole={role}
          currentUserId={currentUserId}
          onClose={() => setSelectedUser(null)}
          onUpdated={upsertUser}
        />
      )}
    </div>
  );
}
