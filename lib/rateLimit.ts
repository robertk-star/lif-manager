import { NextResponse } from "next/server";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  keyPrefix: string;
  limit: number;
  windowMs: number;
};

const globalStore = globalThis as typeof globalThis & {
  __lifRateLimitStore?: Map<string, RateLimitBucket>;
};

const store = globalStore.__lifRateLimitStore ?? new Map<string, RateLimitBucket>();
globalStore.__lifRateLimitStore = store;

function clientIpFromRequest(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwardedFor ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

export function rateLimitResponse(request: Request, options: RateLimitOptions) {
  if (process.env.LIF_RATE_LIMIT_DISABLED?.trim().toLowerCase() === "true") {
    return null;
  }

  const now = Date.now();
  const ip = clientIpFromRequest(request);
  const key = `${options.keyPrefix}:${ip}`;
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  if (current.count >= options.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    const response = NextResponse.json(
      { error: "Too many requests. Please wait and try again." },
      { status: 429 }
    );
    response.headers.set("Retry-After", String(retryAfterSeconds));
    return response;
  }

  current.count += 1;
  store.set(key, current);
  return null;
}
