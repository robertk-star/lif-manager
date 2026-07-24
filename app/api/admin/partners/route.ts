import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const status = searchParams.get("status")?.trim() ?? "";
  const leadStatus = searchParams.get("lead_status")?.trim() ?? "";
  const accepting = searchParams.get("accepting_leads")?.trim() ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "200", 10) || 200, 500);

  let query = supabaseAdmin
    .from("partner_accounts")
    .select(
      "id, firm_name, contact_first_name, contact_last_name, email, phone, " +
        "states_served, routing_scope, routing_states, routing_excluded_states, " +
        "monthly_lead_capacity, status, accepting_leads, lead_status, " +
        "accepted_case_types, accepts_initial_filings, accepts_appeals, accepts_hearings, " +
        "last_login_at, created_at"
    )
    .order("firm_name", { ascending: true })
    .limit(limit);

  if (status) query = query.eq("status", status);
  if (leadStatus) query = query.eq("lead_status", leadStatus);
  if (accepting === "true") query = query.eq("accepting_leads", true);
  if (accepting === "false") query = query.eq("accepting_leads", false);

  if (search) {
    query = query.or(
      `firm_name.ilike.%${search}%,email.ilike.%${search}%,` +
        `contact_first_name.ilike.%${search}%,contact_last_name.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("[GET /api/admin/partners]", error);
    return NextResponse.json({ error: "Failed to fetch partners." }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}
