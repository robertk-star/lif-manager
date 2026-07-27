import type { Metadata } from "next";
import { Button } from "@/components/Button";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "Learn how Legal Intake Flow delivers consent-based, structured disability benefits leads to attorneys and advocates through a five-step intake process.",
};

const STEPS = [
  {
    number: "01",
    title: "Claimants Complete a Readiness Screening",
    body: "Individuals who are preparing for disability benefits — including SSDI and SSI claims — complete a structured readiness screening. The screening captures their situation, documentation status, work history context, and overall readiness level. This information forms the foundation of the intake record.",
    detail:
      "The screening is designed to gather relevant intake information without providing legal advice or making eligibility determinations. It is informational only.",
  },
  {
    number: "02",
    title: "Consent Is Collected Before Referral",
    body: "Before any information is shared with an attorney or advocate partner, the individual provides explicit, informed consent. They are told that their information may be shared with a licensed attorney or advocate who may contact them.",
    detail:
      "No referral is made without consent. This is a core requirement of the Legal Intake Flow process and is not optional or waivable.",
  },
  {
    number: "03",
    title: "Leads Are Reviewed and Organized",
    body: "Intake submissions are reviewed before delivery to partner attorneys and advocates. Incomplete or clearly ineligible submissions are filtered. Remaining leads are organized into a consistent structured format.",
    detail:
      "This review step is designed to reduce the time your intake team spends on unqualified inquiries. Partners receive leads that have passed a basic intake review.",
  },
  {
    number: "04",
    title: "Partners Receive Structured Intake Information",
    body: "Attorney and advocate partners receive structured lead information through their preferred delivery method. Each lead record includes the individual's contact information, consent confirmation, and relevant intake data captured during the screening.",
    detail:
      "Delivery format and cadence are established during partner onboarding. Partners do not receive raw form submissions — they receive organized intake records.",
  },
  {
    number: "05",
    title: "Attorneys and Advocates Follow Up Through Their Own Process",
    body: "Once a lead is delivered, the attorney or advocate follows up through their own intake and case evaluation process. Legal Intake Flow does not manage or participate in the attorney-client relationship.",
    detail:
      "Partners are responsible for their own follow-up, case evaluation, representation decisions, and client communications. Legal Intake Flow is a lead delivery platform, not a case management system.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-[#0d1b2e] py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-400">
            The Process
          </p>
          <h1 className="mb-4 text-4xl font-bold text-white sm:text-5xl">
            How Legal Intake Flow Works
          </h1>
          <p className="text-lg text-gray-300">
            A five-step, consent-based intake workflow designed for disability attorneys and advocates.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-12">
            {STEPS.map((step, i) => (
              <div key={step.number} className="flex flex-col gap-4 sm:flex-row sm:gap-8">
                {/* Step number + connector */}
                <div className="flex flex-row items-start gap-4 sm:flex-col sm:items-center sm:gap-0">
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
                    {step.number}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="hidden sm:block w-0.5 flex-1 bg-gray-200 mt-2 min-h-[3rem]" />
                  )}
                </div>
                {/* Content */}
                <div className="flex-1 pb-4">
                  <h2 className="mb-3 text-xl font-semibold text-gray-900 sm:text-2xl">
                    {step.title}
                  </h2>
                  <p className="mb-3 text-gray-700 leading-relaxed">{step.body}</p>
                  <p className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600 leading-relaxed">
                    {step.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-50 py-16 border-t border-gray-200">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-2xl font-bold text-gray-900 sm:text-3xl">
            Ready to Join as a Partner?
          </h2>
          <p className="mb-8 text-gray-600">
            Submit a partner access request and our team will review your information and contact you shortly.
          </p>
          <Button href="/request-access" size="lg">
            Request Partner Access
          </Button>
        </div>
      </section>
    </>
  );
}
