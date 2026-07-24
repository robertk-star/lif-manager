import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const stateFilter = searchParams.get("state")?.trim().toUpperCase() ?? "";
  const statusFilter = searchParams.get("status")?.trim() ?? "";
  const assignedFilter = searchParams.get("assigned")?.trim() ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 200);

  let query = supabaseAdmin
    .from("leads")
    .select(
      "id, created_at, source, external_reference_id, dbs_report_number, dbs_consent_given, " +
        "first_name, last_name, phone, email, city, state, zip, benefit_type, application_status, " +
        "status, assigned_partner_account_id, assigned_at, partner_response_status"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,` +
        `email.ilike.%${search}%,phone.ilike.%${search}%,` +
        `external_reference_id.ilike.%${search}%,dbs_report_number.ilike.%${search}%`
    );
  }

  if (stateFilter) query = query.eq("state", stateFilter);
  if (statusFilter) query = query.eq("status", statusFilter);

  if (assignedFilter === "true") {
    query = query.not("assigned_partner_account_id", "is", null);
  } else if (assignedFilter === "false") {
    query = query.is("assigned_partner_account_id", null);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[GET /api/admin/leads]", error);
    return NextResponse.json({ error: "Failed to fetch leads." }, { status: 500 });
  }

  const leads = (data ?? []) as Array<Record<string, unknown>>;
  const partnerIds = Array.from(
    new Set(
      leads
        .map((l) => l.assigned_partner_account_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );

  const partnerNames = new Map<string, string>();
  if (partnerIds.length > 0) {
    const { data: partners } = await supabaseAdmin
      .from("partner_accounts")
      .select("id, firm_name")
      .in("id", partnerIds);

    for (const p of partners ?? []) {
      partnerNames.set(
        (p as { id: string }).id,
        (p as { firm_name: string }).firm_name
      );
    }
  }

  const enriched = leads.map((lead) => ({
    ...lead,
    assigned_partner_name:
      typeof lead.assigned_partner_account_id === "string"
        ? partnerNames.get(lead.assigned_partner_account_id) ?? null
        : null,
  }));

  return NextResponse.json({ success: true, data: enriched });
}
