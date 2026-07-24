import { NextResponse } from "next/server";

/**
 * POST /api/intake/ingest
 *
 * Receives qualified leads from Disability Benefits Screening (DBS).
 * Same contract as the existing LIF site:
 *   Header: x-lif-ingest-secret: <LIF_DBS_INGEST_SECRET>
 *
 * In this streamlined version, successful creates will auto-route
 * to the best eligible partner by default.
 *
 * Implementation coming next — this is a safe stub that rejects
 * until the full handler is wired up.
 */
export async function POST(request: Request) {
  const ingestSecret = process.env.LIF_DBS_INGEST_SECRET;

  if (!ingestSecret) {
    return NextResponse.json(
      { error: "Service unavailable." },
      { status: 503 }
    );
  }

  const provided = request.headers.get("x-lif-ingest-secret");
  if (!provided || provided !== ingestSecret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Stub response — full ingest + auto-assignment will replace this.
  return NextResponse.json(
    {
      success: false,
      error: "Ingest handler not yet implemented in lif-manager. Use the production LIF endpoint for now.",
    },
    { status: 501 }
  );
}
