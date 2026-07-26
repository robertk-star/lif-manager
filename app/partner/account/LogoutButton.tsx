"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PartnerLogoutButton() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/partner/logout", { method: "POST" });
    } finally {
      router.push("/partner/login");
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loggingOut}
      className="rounded-md border border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-gray-400 hover:text-white disabled:opacity-50"
    >
      {loggingOut ? "Signing out…" : "Sign Out"}
    </button>
  );
}
