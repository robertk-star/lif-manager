"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Partner login — production-style UI.
 * Magic link: redirect GET /api/partner/login?token=… (same as original LIF).
 * Email code: request-login + verify-login-code.
 */

const ERROR_MESSAGES: Record<string, string> = {
  missing:
    "No login token was provided. Enter your email below and we will send a login code.",
  invalid:
    "This login link is invalid. Enter your email below and we will send a login code.",
  used:
    "This login link has already been used. Enter your email below and we will send a new login code.",
  expired:
    "This login link has expired. Enter your email below and we will send a new login code.",
  inactive:
    "Your partner account is not currently active. Please contact your Legal Intake Flow administrator.",
};

function PartnerLoginInner() {
  const searchParams = useSearchParams();

  const token = searchParams.get("token");
  const error = searchParams.get("error");
  const detail = searchParams.get("detail");

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Match production: GET consume on /api/partner/login (not form POST)
  useEffect(() => {
    if (token) {
      window.location.replace(`/api/partner/login?token=${encodeURIComponent(token)}`);
    }
  }, [token]);

  if (token) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Legal Intake Flow</p>
            <h1 className="mt-1 text-xl font-bold text-[#0d1b2e]">Partner Login</h1>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-8 shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
              <svg className="h-6 w-6 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">Verifying your login link…</p>
            <a
              href={`/api/partner/login?token=${encodeURIComponent(token)}`}
              className="mt-4 inline-block text-xs font-medium text-blue-600 hover:underline"
            >
              Click here if nothing happens
            </a>
          </div>
        </div>
      </div>
    );
  }

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setNotice(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/partner/request-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFormError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setEmail(trimmedEmail);
      setCodeSent(true);
      setCode("");
      setNotice(
        "If your email matches an active partner user, a 6-digit login code has been emailed to you."
      );
    } catch {
      setFormError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setNotice(null);

    const trimmedEmail = email.trim().toLowerCase();
    const cleanCode = code.replace(/\D/g, "");

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError("Please enter a valid email address.");
      return;
    }
    if (!/^\d{6}$/.test(cleanCode)) {
      setFormError("Enter the 6-digit code sent to your email.");
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch("/api/partner/verify-login-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, code: cleanCode }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setFormError(data.error ?? "Invalid or expired code.");
        return;
      }

      window.location.href = data.redirectTo ?? "/partner/leads";
    } catch {
      setFormError("Network error. Please check your connection and try again.");
    } finally {
      setVerifying(false);
    }
  }

  const errorMessage = error
    ? detail
      ? `${ERROR_MESSAGES[error] ?? "This login link is invalid or expired."} (${detail})`
      : ERROR_MESSAGES[error] ??
        "This login link is invalid or expired. Enter your email below and we will send a login code."
    : null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Legal Intake Flow</p>
          <h1 className="mt-1 text-xl font-bold text-[#0d1b2e]">Partner Login</h1>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-sm text-amber-800">{errorMessage}</p>
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white px-6 py-8 shadow-sm">
          <h2 className="text-lg font-bold text-[#0d1b2e]">Sign in to your partner account</h2>
          <p className="mt-1 text-sm text-gray-500">
            Enter your email address. We will email a 6-digit code that you can enter here to access your account.
          </p>

          {!codeSent ? (
            <form onSubmit={handleRequestCode} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  placeholder="you@yourfirm.com"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-[#1a3a5c] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0d1b2e] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Sending code…" : "Email Login Code"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="mt-6 space-y-4" noValidate>
              {notice && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  {notice}
                </div>
              )}

              <div>
                <label htmlFor="email-code" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  id="email-code"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={verifying}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>

              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700">
                  6-Digit Login Code
                </label>
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  maxLength={6}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={verifying}
                  placeholder="123456"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-3 text-center text-2xl font-semibold tracking-[0.35em] shadow-sm placeholder:text-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                />
                <p className="mt-2 text-xs text-gray-500">Codes expire after 10 minutes.</p>
              </div>

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <button
                type="submit"
                disabled={verifying}
                className="w-full rounded-lg bg-[#1a3a5c] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0d1b2e] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {verifying ? "Verifying…" : "Verify Code & Log In"}
              </button>

              <button
                type="button"
                disabled={submitting || verifying}
                onClick={(e) => handleRequestCode(e as unknown as React.FormEvent)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Sending…" : "Send New Code"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setCodeSent(false);
                  setCode("");
                  setFormError(null);
                  setNotice(null);
                }}
                className="w-full text-sm font-medium text-blue-600 hover:underline"
              >
                Use a different email address
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400">
          Need help?{" "}
          <a href="mailto:support@legalintakeflow.com" className="text-blue-600 hover:underline">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}

export default function PartnerLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-400">
          Loading…
        </div>
      }
    >
      <PartnerLoginInner />
    </Suspense>
  );
}
