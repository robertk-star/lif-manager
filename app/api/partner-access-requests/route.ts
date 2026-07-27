import { NextResponse } from "next/server";
import { partnerAccessSchema } from "@/lib/validation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  const parsed = partnerAccessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Please complete all required fields." },
      { status: 422 }
    );
  }

  const input = parsed.data;

  if (input.companyWebsite && input.companyWebsite.trim().length > 0) {
    return NextResponse.json({ success: true, requestId: null });
  }

  const record = {
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    firm_name: input.firmName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    website: input.website?.trim() || null,
    states_served: input.statesServed.trim(),
    practice_area: input.practiceArea,
    monthly_lead_capacity: input.monthlyLeadCapacity,
    message: input.message?.trim() || null,
    status: "new",
    source: "v2.legalintakeflow.com",
  };

  const { data, error } = await supabaseAdmin
    .from("partner_access_requests")
    .insert(record)
    .select("id")
    .single();

  if (error) {
    console.error("[partner-access-requests] insert error:", error.message);
    return NextResponse.json(
      { success: false, error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, requestId: data.id });
}
