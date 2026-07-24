import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "lif_admin_session";
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
export const EIGHT_HOURS_SECONDS = 8 * 60 * 60;

function getSigningSecret(): string {
  const secret =
    process.env.LIF_ADMIN_SESSION_SECRET ?? process.env.LIF_ADMIN_PASSWORD;

  if (!secret) {
    throw new Error(
      "[adminAuth] Missing LIF_ADMIN_SESSION_SECRET or LIF_ADMIN_PASSWORD"
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

async function createToken(): Promise<string> {
  const secret = getSigningSecret();
  const issuedAt = Date.now();
  const expiresAt = issuedAt + EIGHT_HOURS_MS;
  const payload = `${issuedAt}.${expiresAt}`;
  const signature = await hmacSign(payload, secret);
  return `${payload}.${signature}`;
}

async function verifyToken(token: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [issuedAtStr, expiresAtStr, signature] = parts;
  const issuedAt = parseInt(issuedAtStr, 10);
  const expiresAt = parseInt(expiresAtStr, 10);

  if (isNaN(issuedAt) || isNaN(expiresAt)) return false;
  if (Date.now() > expiresAt) return false;

  const secret = getSigningSecret();
  return hmacVerify(`${issuedAtStr}.${expiresAtStr}`, signature, secret);
}

export async function createAdminSessionToken(): Promise<string> {
  return createToken();
}

export async function isAdminAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get(ADMIN_COOKIE_NAME);
    if (!session?.value) return false;
    return verifyToken(session.value);
  } catch {
    return false;
  }
}
