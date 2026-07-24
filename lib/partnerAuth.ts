import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const PARTNER_COOKIE_NAME = "lif_partner_session";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
export const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

export type PartnerRole = "owner" | "admin" | "staff" | "viewer";

export interface PartnerSession {
  partnerAccountId: string;
  partnerUserId: string;
  role: PartnerRole;
  issuedAt: number;
  expiresAt: number;
}

function getSigningSecret(): string {
  const secret =
    process.env.LIF_PARTNER_SESSION_SECRET ??
    process.env.LIF_ADMIN_SESSION_SECRET ??
    process.env.LIF_ADMIN_PASSWORD;
  if (!secret) {
    throw new Error(
      "[partnerAuth] Missing LIF_PARTNER_SESSION_SECRET (or admin secret fallback)"
    );
  }
  return secret;
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Buffer.from(sig).toString("base64url");
}

async function hmacVerify(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const expected = await hmacSign(payload, secret);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

async function createToken(
  session: Omit<PartnerSession, "issuedAt" | "expiresAt">
): Promise<string> {
  const secret = getSigningSecret();
  const issuedAt = Date.now();
  const expiresAt = issuedAt + THIRTY_DAYS_MS;
  const dataPart = `${session.partnerAccountId}|${session.partnerUserId}|${session.role}`;
  const payload = `${dataPart}.${issuedAt}.${expiresAt}`;
  const signature = await hmacSign(payload, secret);
  return `${payload}.${signature}`;
}

async function verifyToken(token: string): Promise<PartnerSession | null> {
  const parts = token.split(".");
  if (parts.length !== 4) return null;

  const [dataPart, issuedAtStr, expiresAtStr, signature] = parts;
  const issuedAt = parseInt(issuedAtStr, 10);
  const expiresAt = parseInt(expiresAtStr, 10);
  if (!dataPart || isNaN(issuedAt) || isNaN(expiresAt)) return null;
  if (Date.now() > expiresAt) return null;

  const secret = getSigningSecret();
  const valid = await hmacVerify(
    `${dataPart}.${issuedAtStr}.${expiresAtStr}`,
    signature,
    secret
  );
  if (!valid) return null;

  const segments = dataPart.split("|");
  if (segments.length !== 3) return null;
  const [partnerAccountId, partnerUserId, role] = segments;
  if (!partnerAccountId || !partnerUserId || !role) return null;

  return {
    partnerAccountId,
    partnerUserId,
    role: role as PartnerRole,
    issuedAt,
    expiresAt,
  };
}

export async function createPartnerSessionToken(
  partnerAccountId: string,
  partnerUserId: string,
  role: PartnerRole
): Promise<string> {
  return createToken({ partnerAccountId, partnerUserId, role });
}

export async function getAuthenticatedPartnerSession(): Promise<PartnerSession | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get(PARTNER_COOKIE_NAME);
    if (!session?.value) return null;

    const verified = await verifyToken(session.value);
    if (!verified) return null;

    const { data: account, error: accountError } = await supabaseAdmin
      .from("partner_accounts")
      .select("id, status")
      .eq("id", verified.partnerAccountId)
      .single();

    if (accountError || !account) return null;
    if (account.status !== "active" && account.status !== "pending") return null;

    const { data: user, error: userError } = await supabaseAdmin
      .from("partner_users")
      .select("id, partner_account_id, role, status")
      .eq("id", verified.partnerUserId)
      .single();

    if (userError || !user) return null;
    if (user.partner_account_id !== verified.partnerAccountId) return null;
    if (user.status !== "active" && user.status !== "pending") return null;

    return {
      partnerAccountId: account.id as string,
      partnerUserId: user.id as string,
      role: user.role as PartnerRole,
      issuedAt: verified.issuedAt,
      expiresAt: verified.expiresAt,
    };
  } catch {
    return null;
  }
}

export async function hashLoginToken(rawToken: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(rawToken));
  return Buffer.from(buf).toString("hex");
}
