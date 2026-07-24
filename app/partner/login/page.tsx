"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PartnerLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<"email" | "code" | "token">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const t = searchParams.get("token");
    if (t) {
      setToken(t);
      setStep("token");
      setInfo("Signing you in…");
      const id = window.setTimeout(() => {
        formRef.current?.submit();
      }, 50);
      return () => window.clearTimeout(id);
    }

    const err = searchParams.get("error");
    const detail = searchParams.get("detail");
    if (err === "missing") setError(detail || "Login link is missing a token.");
    if (err === "invalid")
      setError(
        detail
          ? `Login failed: ${detail}`
          : "This login link is invalid. Generate a new one from Partners → Manage."
      );
    if (err === "used")
      setError(
        detail ||
          "This login link was already used. Generate a new one from Partners → Manage."
      );
    if (err === "expired")
      setError(detail || "This login link has expired. Generate a new one.");
    if (err === "inactive")
      setError(
        detail ||
          "This partner account or user is not active. Activate them in Partners → Manage."
      );
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
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Invalid code.");
        return;
      }
      window.location.href = data.redirectTo ?? "/partner/leads";
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
        Use a one-time login link from admin, or enter your partner user email for a
        code.
      </p>

      <form
        ref={formRef}
        method="POST"
        action="/api/partner/login"
        className="hidden"
        aria-hidden
      >
        <input type="hidden" name="token" value={token} />
      </form>

      {step === "token" && (
        <div className="mt-6 space-y-3">
          {info && <p className="text-sm text-slate-600">{info}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-slate-400">
            If nothing happens, click the button below.
          </p>
          <button
            type="button"
            onClick={() => formRef.current?.submit()}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Continue to sign in
          </button>
        </div>
      )}

      {step === "email" && (
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
      )}

      {step === "code" && (
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
