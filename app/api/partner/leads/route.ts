import { NextResponse } from "next/server";
import { getAuthenticatedPartnerSession } from "@/lib/partnerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const VALID_STATUSES = [
  "new",
  "reviewing",
  "contact_attempted",
  "contacted",
  "accepted",
  "declined",
  "retained",
  "closed",
] as const;

export async function GET(request: Request) {
  const session = await getAuthenticatedPartnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const statusFilter = searchParams.get("partner_response_status")?.trim() ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10) || 100, 200);

  let query = supabaseAdmin
    .from("leads")
    .select(
      "id, created_at, assigned_at, first_name, last_name, phone, email, city, state, zip, " +
        "benefit_type, application_status, partner_response_status, partner_viewed_at"
    )
    .eq("assigned_partner_account_id", session.partnerAccountId)
    .is("deleted_at", null)
    .order("assigned_at", { ascending: false })
    .limit(limit);

  if (statusFilter) {
    if (!(VALID_STATUSES as readonly string[]).includes(statusFilter)) {
      return NextResponse.json({ error: "Invalid status filter." }, { status: 422 });
    }
    if (statusFilter === "new") {
      query = query.or("partner_response_status.is.null,partner_response_status.eq.new");
    } else {
      query = query.eq("partner_response_status", statusFilter);
    }
  }

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,` +
        `email.ilike.%${search}%,phone.ilike.%${search}%,state.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("[GET /api/partner/leads]", error);
    return NextResponse.json({ error: "Failed to fetch leads." }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}
