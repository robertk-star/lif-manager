import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://v2.legalintakeflow.com"),
  title: {
    default: "Legal Intake Flow — AI Intake Systems for Disability Attorneys",
    template: "%s | Legal Intake Flow",
  },
  description:
    "Legal Intake Flow connects disability attorneys and advocates with high-intent individuals actively preparing for SSDI and SSI benefits claims.",
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
