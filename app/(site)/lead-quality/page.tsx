import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/Button";

export const metadata: Metadata = {
  title: "Lead Quality Process",
  description:
    "How Legal Intake Flow focuses on structured, consent-based Social Security Disability leads with guided intake and quality screening.",
};

export default function LeadQualityPage() {
  return (
    <>
      <section className="bg-[#0d1b2e] py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-blue-400">Lead Quality Process</p>
          <h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl">
            Better Disability Leads for Firms That Want Quality Over Volume
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-gray-300 sm:text-xl">
            Legal Intake Flow reduces time wasted on unfiltered inquiries with structure, consent checks, answer review,
            and confirmation before a lead is released for human review.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button href="/request-access" size="lg">
              Request Partner Access
            </Button>
            <Button href="/example-reports" variant="outline" size="lg">
              View Example Reports
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900">Not basic form-fill leads</h2>
          <p className="mt-4 leading-relaxed text-gray-600">
            Each lead goes through structured intake, AI-supported answer review, internal quality screening, and
            confirmation steps before being sent for advocate or attorney review. The full production lead-quality page
            content is available; this summary ships first so the public site routes work end-to-end on V2.
          </p>
          <p className="mt-4 leading-relaxed text-gray-600">
            Partners receive organized intake context — consent status, condition and work impact, treatment history, and
            confirmation trails — not just a name and phone number.
          </p>
          <div className="mt-8">
            <Link href="/for-attorneys" className="font-semibold text-blue-600 hover:underline">
              Learn more for attorneys and advocates →
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-blue-600 py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            A Better Intake Source for Social Security Disability Leads
          </h2>
          <div className="mt-8">
            <Button href="/request-access" variant="outline" size="lg">
              Request Partner Access
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
