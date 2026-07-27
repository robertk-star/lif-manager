import type { Metadata } from "next";
import { Button } from "@/components/Button";

export const metadata: Metadata = {
  title: "For Attorneys & Advocates",
  description:
    "Legal Intake Flow partners with SSDI and SSI attorneys and disability advocates to deliver consent-based, structured leads.",
};

const PARTNER_TYPES = [
  {
    title: "For SSDI / SSI Attorneys",
    body: "Pre-screened, consent-based leads from individuals actively preparing for claims, with structured intake information — not cold inquiries.",
  },
  {
    title: "For Disability Advocates",
    body: "Non-attorney disability advocates and accredited representatives can apply for partner access with the same structured intake format.",
  },
  {
    title: "For Intake Teams",
    body: "Leads arrive in a consistent format your intake staff can process without additional qualification steps.",
  },
  {
    title: "For Firms Expanding Disability Intake",
    body: "A structured pipeline of disability-specific leads for firms adding or expanding disability practice capacity.",
  },
];

export default function ForAttorneysPage() {
  return (
    <>
      <section className="bg-[#0d1b2e] py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-400">Partner Program</p>
          <h1 className="mb-4 text-4xl font-bold text-white sm:text-5xl">For Attorneys &amp; Advocates</h1>
          <p className="text-lg text-gray-300">
            Legal Intake Flow partners with disability attorneys, advocates, and intake teams to deliver structured,
            consent-based disability benefits leads.
          </p>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Who We Partner With</h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-2">
            {PARTNER_TYPES.map((pt) => (
              <div key={pt.title} className="rounded-xl border border-gray-200 bg-gray-50 p-8">
                <h3 className="mb-3 text-lg font-semibold text-gray-900">{pt.title}</h3>
                <p className="leading-relaxed text-gray-600">{pt.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-blue-600 py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">Apply for Partner Access</h2>
          <p className="mb-8 text-lg text-blue-100">
            Submit a partner access request and our team will review your information and contact you shortly.
          </p>
          <Button href="/request-access" variant="outline" size="lg">
            Request Partner Access
          </Button>
        </div>
      </section>
    </>
  );
}
