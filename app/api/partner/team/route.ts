import { NextResponse } from "next/server";
import { getAuthenticatedPartnerSession, type PartnerRole } from "@/lib/partnerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const VALID_ROLES = ["owner", "admin", "staff", "viewer"] as const;
const VALID_STATUSES = ["active", "inactive", "pending", "suspended"] as const;

type TeamRole = (typeof VALID_ROLES)[number];
type TeamStatus = (typeof VALID_STATUSES)[number];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function canManageTeam(role: PartnerRole) {
  return role === "owner" || role === "admin";
}

function canCreateRole(actorRole: PartnerRole, targetRole: TeamRole) {
  if (actorRole === "owner") return true;
  return targetRole === "staff" || targetRole === "viewer";
}

const TEAM_SELECT =
  "id, partner_account_id, email, first_name, last_name, role, status, " +
  "created_at, updated_at, last_login_at, invited_at, accepted_at, " +
  "invite_email_sent_at, invite_email_count, invited_by_partner_user_id";

export async function GET() {
  const session = await getAuthenticatedPartnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: users, error } = await supabaseAdmin
    .from("partner_users")
    .select(TEAM_SELECT)
    .eq("partner_account_id", session.partnerAccountId)
    .order("role", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[GET /api/partner/team] Supabase error:", error);
    return NextResponse.json({ error: "Failed to fetch partner team." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: users ?? [],
    permissions: {
      canManage: canManageTeam(session.role),
      currentUserId: session.partnerUserId,
      currentRole: session.role,
    },
  });
}

export async function POST(request: Request) {
  const session = await getAuthenticatedPartnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!canManageTeam(session.role)) {
    return NextResponse.json(
      { error: "Only owner or admin users can add team members." },
      { status: 403 }
    );
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

  const firstName = String(body.first_name ?? "").trim();
  const lastName = String(body.last_name ?? "").trim();
  const email = normalizeEmail(body.email);
  const role = String(body.role ?? "staff").trim() as TeamRole;
  const status = String(body.status ?? "pending").trim() as TeamStatus;

  if (!firstName || !lastName || !email) {
    return NextResponse.json(
      { error: "First name, last name, and email are required." },
      { status: 422 }
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 422 });
  }

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json(
      { error: `Invalid role. Allowed values: ${VALID_ROLES.join(", ")}.` },
      { status: 422 }
    );
  }

  if (!canCreateRole(session.role, role)) {
    return NextResponse.json(
      { error: "Partner admins can only add staff or viewer users. Owners can add any role." },
      { status: 403 }
    );
  }

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Allowed values: ${VALID_STATUSES.join(", ")}.` },
      { status: 422 }
    );
  }

  const { data: existing } = await supabaseAdmin
    .from("partner_users")
    .select("id")
    .eq("partner_account_id", session.partnerAccountId)
    .eq("email", email)
    .maybeSingle();

  if (existing?.id) {
    return NextResponse.json(
      { error: "A team member with this email already exists for this partner account." },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("partner_users")
    .insert({
      partner_account_id: session.partnerAccountId,
      email,
      first_name: firstName,
      last_name: lastName,
      role,
      status,
      invited_at: now,
      invited_by_partner_user_id: session.partnerUserId,
    })
    .select(TEAM_SELECT)
    .single();

  if (error || !data) {
    console.error("[POST /api/partner/team] Insert error:", error);
    return NextResponse.json({ error: "Failed to add team member." }, { status: 500 });
  }

  return NextResponse.json({ success: true, data }, { status: 201 });
}
