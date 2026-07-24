import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim() ?? "active";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "200", 10) || 200, 500);

  let query = supabaseAdmin
    .from("partner_accounts")
    .select("id, firm_name, email, status, accepting_leads")
    .order("firm_name", { ascending: true })
    .limit(limit);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    console.error("[GET /api/admin/partners]", error);
    return NextResponse.json({ error: "Failed to fetch partners." }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}
