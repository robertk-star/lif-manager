import type { Metadata } from "next";
import { Button } from "@/components/Button";

export const metadata: Metadata = {
  title: "For Attorneys & Advocates",
  description:
    "Legal Intake Flow partners with SSDI and SSI attorneys, disability advocates, and intake teams to deliver consent-based, structured disability benefits leads.",
};

const PARTNER_TYPES = [
  {
    title: "For SSDI / SSI Attorneys",
    body: "If your practice focuses on Social Security Disability Insurance or Supplemental Security Income claims, Legal Intake Flow delivers pre-screened, consent-based leads from individuals actively preparing for their claims. You receive structured intake information — not cold inquiries.",
  },
  {
    title: "For Disability Advocates",
    body: "Non-attorney disability advocates and accredited representatives can apply for partner access. Leads are delivered with the same structured intake format used for attorney partners.",
  },
  {
    title: "For Intake Teams",
    body: "If your firm has a dedicated intake team, Legal Intake Flow is designed to fit your workflow. Leads arrive in a consistent format that your intake staff can process without additional qualification steps.",
  },
  {
    title: "For Firms Expanding Disability Intake",
    body: "If you are a general practice firm adding disability intake capacity, or a personal injury firm expanding into disability law, Legal Intake Flow provides a structured pipeline of disability-specific leads.",
  },
];

const WHAT_PARTNERS_RECEIVE = [
  "Contact information (name, phone, email)",
  "Consent confirmation and timestamp",
  "State of residence",
  "Disability type and claim status context",
  "Documentation readiness indicators",
  "Intake screening responses",
];

const WHY_ORGANIZED_INTAKE = [
  {
    title: "Reduce Intake Overhead",
    body: "Unstructured lead sources require your team to re-qualify every inquiry. Structured intake data reduces the time spent on initial screening.",
  },
  {
    title: "Consistent Lead Format",
    body: "Every lead delivered through Legal Intake Flow uses the same data structure. Your intake team does not need to adapt to different formats from different sources.",
  },
  {
    title: "Consent Documentation",
    body: "Each lead record includes consent confirmation. You have documentation that the individual agreed to be contacted before your team reaches out.",
  },
  {
    title: "Disability-Specific Screening",
    body: "The intake screening is designed for disability benefits claimants. The data captured is relevant to SSDI and SSI intake — not generic legal inquiries.",
  },
];

export default function ForAttorneysPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-[#0d1b2e] py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-400">
            Partner Program
          </p>
          <h1 className="mb-4 text-4xl font-bold text-white sm:text-5xl">
            For Attorneys &amp; Advocates
          </h1>
          <p className="text-lg text-gray-300">
            Legal Intake Flow partners with disability attorneys, advocates, and intake teams to deliver structured, consent-based disability benefits leads.
          </p>
        </div>
      </section>

      {/* Partner types */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Who We Partner With
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Legal Intake Flow is designed for professionals who handle disability benefits cases.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2">
            {PARTNER_TYPES.map((pt) => (
              <div key={pt.title} className="rounded-xl border border-gray-200 bg-gray-50 p-8">
                <h3 className="mb-3 text-lg font-semibold text-gray-900">{pt.title}</h3>
                <p className="text-gray-600 leading-relaxed">{pt.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What partners receive */}
      <section className="bg-[#0d1b2e] py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              What Partners Receive
            </h2>
            <p className="mt-4 text-lg text-gray-300">
              Each lead record delivered through Legal Intake Flow includes the following structured intake information.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {WHAT_PARTNERS_RECEIVE.map((item) => (
              <li key={item} className="flex items-start gap-3 rounded-lg border border-gray-700 bg-gray-800/50 px-5 py-4">
                <span className="mt-0.5 flex-shrink-0 text-blue-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </span>
                <span className="text-gray-200 text-sm">{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-center text-sm text-gray-500">
            Exact data fields may vary based on screening completion and partner delivery configuration.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button href="/lead-quality" variant="outline" size="lg">
              View Lead Quality Process
            </Button>
            <Button href="/example-reports" variant="outline" size="lg">
              View Redacted Example Reports
            </Button>
          </div>
        </div>
      </section>

      {/* Why organized intake matters */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Why Organized Intake Matters
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Structured intake data reduces overhead and improves your firm&apos;s ability to evaluate and convert leads.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2">
            {WHY_ORGANIZED_INTAKE.map((item) => (
              <div key={item.title} className="flex flex-col gap-3">
                <div className="h-1 w-12 rounded bg-blue-600" />
                <h3 className="text-base font-semibold text-gray-900">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
            Apply for Partner Access
          </h2>
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
