import { NextResponse } from "next/server";
import { rateLimitResponse } from "@/lib/rateLimit";
import {
  ADMIN_COOKIE_NAME,
  EIGHT_HOURS_SECONDS,
  createAdminSessionToken,
} from "@/lib/adminAuth";

export async function POST(request: Request) {
  const limited = rateLimitResponse(request, {
    keyPrefix: "admin-login",
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  let body: { password?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }

  const adminPassword = process.env.LIF_ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error("[admin/login] LIF_ADMIN_PASSWORD is not set.");
    return NextResponse.json(
      { success: false, error: "Admin login is not configured." },
      { status: 500 }
    );
  }

  if (!body.password || body.password !== adminPassword) {
    return NextResponse.json({ success: false, error: "Invalid password." }, { status: 401 });
  }

  const token = await createAdminSessionToken();
  const response = NextResponse.json({ success: true });

  response.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: EIGHT_HOURS_SECONDS,
  });

  return response;
}
