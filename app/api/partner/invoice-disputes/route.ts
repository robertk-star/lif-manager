import { NextResponse } from "next/server";
import { getAuthenticatedPartnerSession } from "@/lib/partnerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const session = await getAuthenticatedPartnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("partner_billing_disputes")
    .select(
      "id, created_at, updated_at, invoice_id, invoice_item_id, lead_id, reason, details, status, admin_resolution_notes, resolved_at"
    )
    .eq("partner_account_id", session.partnerAccountId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[GET /api/partner/invoice-disputes] Supabase error:", error);
    return NextResponse.json(
      { error: "Failed to load invoice disputes. Confirm dispute tables exist." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}
