import Link from "next/link";
import PartnerLogoutButton from "./account/LogoutButton";

const NAV_ITEMS = [
  { href: "/partner/dashboard", label: "Dashboard" },
  { href: "/partner/account", label: "Account" },
  { href: "/partner/leads", label: "Leads" },
  { href: "/partner/reports", label: "Reports" },
  { href: "/partner/billing", label: "Billing" },
  { href: "/partner/invoices", label: "Invoices" },
  { href: "/partner/team", label: "Team" },
  { href: "/partner/integrations", label: "Integrations" },
] as const;

export default function PartnerNav({ active }: { active: string }) {
  return (
    <header className="border-b border-gray-200 bg-[#0d1b2e]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center">
          <nav className="hidden items-center gap-4 text-sm sm:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active === item.href
                    ? "font-semibold text-white"
                    : "text-white/70 hover:text-white"
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <PartnerLogoutButton />
      </div>
    </header>
  );
}
