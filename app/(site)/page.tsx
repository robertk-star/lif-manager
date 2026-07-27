import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/Button";

export const metadata: Metadata = {
  title: "Legal Intake Flow — AI Intake Systems for Disability Attorneys",
  description:
    "Connect with high-intent individuals actively preparing for disability benefits who may be seeking legal or advocate support.",
};

const HOW_STEPS = [
  {
    number: "01",
    title: "Claimants Complete a Readiness Screening",
    body: "Individuals preparing for disability benefits complete a structured intake screening that captures their situation, documentation status, and readiness level.",
  },
  {
    number: "02",
    title: "Consent Is Collected Before Referral",
    body: "Each individual provides explicit consent before their information is shared with any attorney or advocate partner. No referral occurs without consent.",
  },
  {
    number: "03",
    title: "Leads Are Reviewed and Organized",
    body: "Intake information is reviewed and structured before delivery. Partners receive organized, consistent lead data — not raw form submissions.",
  },
  {
    number: "04",
    title: "Partners Receive Structured Intake Information",
    body: "Attorney and advocate partners receive structured lead information through their preferred delivery method, ready for intake review.",
  },
];

const WHY_ITEMS = [
  {
    title: "Consent-Based Referrals",
    body: "Every lead has explicitly consented to be contacted by an attorney or advocate. No cold outreach. No unqualified inquiries.",
  },
  {
    title: "Structured Intake Data",
    body: "Leads arrive with organized intake information — not raw contact forms. Your team spends less time qualifying and more time converting.",
  },
  {
    title: "Disability-Focused Pipeline",
    body: "Legal Intake Flow is built specifically for SSDI, SSI, and disability-related intake. Every lead is relevant to your practice area.",
  },
  {
    title: "Scalable for Your Firm",
    body: "Whether you handle 10 cases or 100 per month, the intake workflow scales with your capacity and team size.",
  },
];

const STANDARDS = [
  { label: "Explicit Consent", desc: "Collected before any referral is made" },
  { label: "Structured Data", desc: "Consistent fields across all leads" },
  { label: "Disability-Specific", desc: "SSDI and SSI focused screening" },
  { label: "Reviewed Before Delivery", desc: "Intake reviewed prior to partner delivery" },
];

const PRINCIPLES = [
  {
    title: "Consent First",
    body: "We do not share any individual's information without their explicit consent. This is a core requirement of our intake process, not an afterthought.",
  },
  {
    title: "Accuracy Over Volume",
    body: "We prioritize delivering structured, reviewed intake information over maximizing lead volume. Quality intake data serves your firm better than unqualified bulk leads.",
  },
  {
    title: "Attorney-Facing Design",
    body: "Legal Intake Flow is built for attorneys, advocates, and intake teams — not for claimants. Every workflow decision is made with your practice in mind.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="bg-[#0d1b2e] py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-blue-400">
            AI Intake Systems for Disability Attorneys
          </p>
          <h1 className="mb-6 text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
            High-Intent Disability Benefits Leads for Attorneys &amp; Advocates
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-300 sm:text-xl">
            Connect with individuals actively preparing for disability benefits who may be seeking
            legal or advocate support.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button href="/request-access" size="lg">
              Request Access
            </Button>
            <Button href="/how-it-works" variant="outline" size="lg">
              How It Works
            </Button>
            <Link
              href="/lead-quality"
              className="text-sm font-semibold text-blue-200 hover:text-white hover:underline"
            >
              See our lead quality process →
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              How Legal Intake Flow Works
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              A structured, consent-based intake workflow designed for disability attorneys and
              advocates.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2">
            {HOW_STEPS.map((step) => (
              <div key={step.number} className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
                <p className="mb-3 text-3xl font-bold text-blue-600">{step.number}</p>
                <h3 className="mb-3 text-lg font-semibold text-gray-900">{step.title}</h3>
                <p className="leading-relaxed text-gray-600">{step.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-8">
            <Link href="/how-it-works" className="font-medium text-blue-600 hover:underline">
              View the full process →
            </Link>
            <Link href="/lead-quality" className="font-medium text-blue-600 hover:underline">
              See how lead quality is reviewed →
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-8 text-center shadow-sm">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-700">
              See the Intake Format
            </p>
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Review Redacted Example Reports
            </h2>
            <p className="mx-auto mt-4 max-w-3xl leading-relaxed text-gray-700">
              See examples of the organized readiness information partners may receive, including
              screening responses, consent context, treatment history, daily limitation details, and
              preparation checklist progress.
            </p>
            <div className="mt-8">
              <Button href="/example-reports" size="lg">
                View Example Reports
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Why Attorneys Join Legal Intake Flow
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Built specifically for disability law firms and advocacy organizations.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {WHY_ITEMS.map((item) => (
              <div key={item.title} className="flex flex-col gap-3">
                <div className="h-1 w-12 rounded bg-blue-600" />
                <h3 className="text-base font-semibold text-gray-900">{item.title}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0d1b2e] py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Intake Standards</h2>
            <p className="mt-4 text-lg text-gray-300">
              Every lead delivered through Legal Intake Flow meets these baseline requirements.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STANDARDS.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-gray-700 bg-gray-800/50 p-6 text-center"
              >
                <p className="mb-2 text-base font-semibold text-white">{s.label}</p>
                <p className="text-sm text-gray-400">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button href="/lead-quality" variant="outline" size="md">
              View Lead Quality Process
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Built for Disability Intake Teams
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Our platform principles guide every decision we make.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
                <h3 className="mb-3 text-lg font-semibold text-gray-900">{p.title}</h3>
                <p className="leading-relaxed text-gray-600">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-blue-600 py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
            Ready to Expand Your Disability Intake?
          </h2>
          <p className="mb-8 text-lg text-blue-100">
            Submit a partner access request and our team will review your information and contact you
            shortly.
          </p>
          <Button href="/request-access" variant="outline" size="lg">
            Request Partner Access
          </Button>
        </div>
      </section>
    </>
  );
}
