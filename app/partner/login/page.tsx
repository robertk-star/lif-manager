"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PartnerLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      window.location.href = `/api/partner/login?token=${encodeURIComponent(token)}`;
      return;
    }

    const err = searchParams.get("error");
    if (err === "missing") setError("Login link is missing a token.");
    if (err === "invalid") setError("This login link is invalid.");
    if (err === "used") setError("This login link was already used.");
    if (err === "expired") setError("This login link has expired.");
    if (err === "inactive") setError("This partner account is not active.");
  }, [searchParams]);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/partner/request-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not send code.");
        return;
      }
      setInfo("If that email is registered, a 6-digit code was sent. Check your inbox.");
      setStep("code");
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/partner/verify-login-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Invalid code.");
        return;
      }
      router.push(data.redirectTo ?? "/partner/leads");
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        LIF Manager
      </p>
      <h1 className="mt-1 text-xl font-bold text-slate-900">Partner Sign In</h1>
      <p className="mt-2 text-sm text-slate-500">
        Enter the email on your partner user account. We’ll send a one-time code.
        Or open a login link provided by admin.
      </p>

      {step === "email" ? (
        <form onSubmit={requestCode} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="you@firm.com"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !email}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send Login Code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="mt-6 space-y-4">
          {info && <p className="text-sm text-slate-600">{info}</p>}
          <div>
            <label htmlFor="code" className="mb-1 block text-sm font-medium text-slate-700">
              6-digit code
            </label>
            <input
              id="code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-widest"
              placeholder="000000"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Sign In"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
              setInfo(null);
            }}
            className="w-full text-sm text-slate-500 hover:text-slate-800"
          >
            Use a different email
          </button>
        </form>
      )}
    </div>
  );
}

export default function PartnerLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Suspense
        fallback={
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
            Loading…
          </div>
        }
      >
        <PartnerLoginForm />
      </Suspense>
    </main>
  );
}
