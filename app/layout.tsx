import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LIF Manager",
  description: "Leads manager for Legal Intake Flow — DBS intake, auto-routing, invoices",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
