import { NextResponse } from "next/server";
import { getAuthenticatedPartnerSession, type PartnerRole } from "@/lib/partnerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const VALID_ROLES = ["owner", "admin", "staff", "viewer"] as const;
const VALID_STATUSES = ["active", "inactive", "pending", "suspended"] as const;

type TeamRole = (typeof VALID_ROLES)[number];
type TeamStatus = (typeof VALID_STATUSES)[number];

const TEAM_SELECT =
  "id, partner_account_id, email, first_name, last_name, role, status, " +
  "created_at, updated_at, last_login_at, invited_at, accepted_at, " +
  "invite_email_sent_at, invite_email_count, invited_by_partner_user_id";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canManageTeam(role: PartnerRole) {
  return role === "owner" || role === "admin";
}

function canSetRole(actorRole: PartnerRole, targetRole: TeamRole) {
  if (actorRole === "owner") return true;
  return targetRole === "staff" || targetRole === "viewer";
}

async function countActiveOwners(partnerAccountId: string) {
  const { count, error } = await supabaseAdmin
    .from("partner_users")
    .select("id", { count: "exact", head: true })
    .eq("partner_account_id", partnerAccountId)
    .eq("role", "owner")
    .in("status", ["active", "pending"]);

  if (error) return null;
  return count ?? 0;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthenticatedPartnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!canManageTeam(session.role)) {
    return NextResponse.json(
      { error: "Only owner or admin users can update team members." },
      { status: 403 }
    );
  }

  const { id } = await params;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("partner_users")
    .select(TEAM_SELECT)
    .eq("id", id)
    .eq("partner_account_id", session.partnerAccountId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json({ error: "Team member not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!isPlainObject(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if ("first_name" in body) {
    const firstName = String(body.first_name ?? "").trim();
    if (!firstName) return NextResponse.json({ error: "First name is required." }, { status: 422 });
    updates.first_name = firstName;
  }

  if ("last_name" in body) {
    const lastName = String(body.last_name ?? "").trim();
    if (!lastName) return NextResponse.json({ error: "Last name is required." }, { status: 422 });
    updates.last_name = lastName;
  }

  if ("role" in body) {
    const role = String(body.role ?? "").trim() as TeamRole;
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Allowed values: ${VALID_ROLES.join(", ")}.` },
        { status: 422 }
      );
    }
    if (!canSetRole(session.role, role)) {
      return NextResponse.json(
        { error: "Partner admins can only set staff or viewer roles." },
        { status: 403 }
      );
    }
    updates.role = role;
  }

  if ("status" in body) {
    const status = String(body.status ?? "").trim() as TeamStatus;
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed values: ${VALID_STATUSES.join(", ")}.` },
        { status: 422 }
      );
    }
    updates.status = status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 422 });
  }

  const existingRow = existing as unknown as { role: string; status: string };
  const existingRole = String(existingRow.role) as TeamRole;
  const nextRole = (updates.role as TeamRole | undefined) ?? existingRole;
  const existingStatus = String(existingRow.status) as TeamStatus;
  const nextStatus = (updates.status as TeamStatus | undefined) ?? existingStatus;
  const willRemainOwner =
    nextRole === "owner" && (nextStatus === "active" || nextStatus === "pending");

  if (existingRole === "owner" && !willRemainOwner) {
    const ownerCount = await countActiveOwners(session.partnerAccountId);
    if (ownerCount !== null && ownerCount <= 1) {
      return NextResponse.json(
        { error: "This account must keep at least one active or pending owner." },
        { status: 422 }
      );
    }
  }

  if (id === session.partnerUserId && (nextStatus === "inactive" || nextStatus === "suspended")) {
    return NextResponse.json(
      { error: "You cannot deactivate or suspend your own user account." },
      { status: 422 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("partner_users")
    .update(updates)
    .eq("id", id)
    .eq("partner_account_id", session.partnerAccountId)
    .select(TEAM_SELECT)
    .single();

  if (error || !data) {
    console.error("[PATCH /api/partner/team/[id]] Update error:", error);
    return NextResponse.json({ error: "Failed to update team member." }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
