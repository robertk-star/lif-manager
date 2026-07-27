"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/how-it-works", label: "How It Works" },
  { href: "/for-attorneys", label: "For Attorneys" },
  { href: "/lead-quality", label: "Lead Quality" },
  { href: "/example-reports", label: "Example Reports" },
];

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex-shrink-0" aria-label="Legal Intake Flow — Home">
          <span className="text-base font-bold tracking-tight text-[#0d1b2e] sm:text-lg">
            Legal Intake Flow
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`text-sm font-medium transition-colors hover:text-blue-600 ${
                pathname === href ? "text-blue-600" : "text-gray-700"
              }`}
            >
              {label}
            </Link>
          ))}
          <Link
            href="/partner/login"
            className="rounded-md border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-50"
          >
            Login
          </Link>
          <Link
            href="/request-access"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Request Access
          </Link>
        </nav>

        <button
          className="flex items-center justify-center rounded-md p-2 text-gray-700 hover:bg-gray-100 md:hidden"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          )}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-gray-200 bg-white px-4 pb-4 pt-2 md:hidden">
          <nav className="flex flex-col gap-3" aria-label="Mobile navigation">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-50 hover:text-blue-600 ${
                  pathname === href ? "text-blue-600" : "text-gray-700"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                {label}
              </Link>
            ))}
            <Link
              href="/partner/login"
              className="mt-1 rounded-md border border-blue-200 px-4 py-2 text-center text-sm font-semibold text-blue-700 hover:bg-blue-50"
              onClick={() => setMobileOpen(false)}
            >
              Login
            </Link>
            <Link
              href="/request-access"
              className="rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700"
              onClick={() => setMobileOpen(false)}
            >
              Request Access
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
