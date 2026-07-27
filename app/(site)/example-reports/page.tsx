import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/Button";

export const metadata: Metadata = {
  title: "Example Disability Intake Reports",
  description:
    "View redacted example readiness reports that show the type of organized disability intake information Legal Intake Flow can make available to attorney and advocate partners.",
};

const REPORTS = [
  {
    title: "Example Report 1",
    condition: "Mental health conditions with work and daily activity impact",
    checklist: "93% checklist progress",
    highlights: [
      "Application denied",
      "Work impact and attendance notes",
      "Treatment, medication, and daily living details",
    ],
    href: "/example-reports/redacted-readiness-report-1.pdf",
  },
  {
    title: "Example Report 2",
    condition: "Mobility limitations and walker use",
    checklist: "93% checklist progress",
    highlights: [
      "Pending application status",
      "Assistive device information",
      "Daily activity and transportation limitations",
    ],
    href: "/example-reports/redacted-readiness-report-2.pdf",
  },
  {
    title: "Example Report 3",
    condition: "COPD and breathing limitations",
    checklist: "87% checklist progress",
    highlights: [
      "Oxygen use and walking limitations",
      "Work history and last worked information",
      "Treatment and medication context",
    ],
    href: "/example-reports/redacted-readiness-report-3.pdf",
  },
  {
    title: "Example Report 4",
    condition: "Diabetes, anxiety, back problems, vision loss, and neuropathy",
    checklist: "93% checklist progress",
    highlights: [
      "Application denied",
      "Rest break and focus limitations",
      "Medication side effects and assistive device use",
    ],
    href: "/example-reports/redacted-readiness-report-4.pdf",
  },
];

const DATA_POINTS = [
  "Contact information and state/age range when provided",
  "Attorney contact consent",
  "Medical condition and symptom history",
  "Application status and denial/appeal context",
  "Work impact, attendance, and rest-break details",
  "Treatment, medication, specialist, and ER/hospital history",
  "Daily living limitations and support needs",
  "Preparation checklist progress and missing information",
];

export default function ExampleReportsPage() {
  return (
    <>
      <section className="bg-[#0d1b2e] py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-400">
            Redacted Intake Examples
          </p>
          <h1 className="mb-5 text-4xl font-bold text-white sm:text-5xl">
            Example Disability Readiness Reports
          </h1>
          <p className="mx-auto max-w-3xl text-lg leading-relaxed text-gray-300">
            These redacted examples show the type of organized information gathered before a lead is delivered to a Legal Intake Flow partner. They are designed to help attorneys and advocates understand the level of intake context available for review.
          </p>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">What these reports demonstrate</h2>
              <p className="mt-4 text-gray-600 leading-relaxed">
                Legal Intake Flow is built around structured, consent-based disability intake. These example reports show how claimant-provided screening responses can be organized into a consistent format for attorney or advocate review.
              </p>
              <p className="mt-4 text-sm text-gray-500 leading-relaxed">
                The examples are redacted. They are for demonstration only and do not represent legal advice, eligibility determinations, approval predictions, or a promise that a matter will be accepted by any attorney or advocate.
              </p>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-6">
              <h3 className="text-base font-semibold text-blue-950">Information partners may review</h3>
              <ul className="mt-4 space-y-3">
                {DATA_POINTS.map((point) => (
                  <li key={point} className="flex gap-3 text-sm text-blue-900">
                    <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-600" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold text-gray-900">View Redacted Sample Reports</h2>
            <p className="mx-auto mt-4 max-w-3xl text-gray-600">
              Each PDF opens in a new tab. Names, emails, phone numbers, and other identifying details have been redacted from these examples.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {REPORTS.map((report) => (
              <article key={report.href} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{report.title}</h3>
                    <p className="mt-1 text-sm text-gray-500">{report.checklist}</p>
                  </div>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                    PDF
                  </span>
                </div>
                <p className="mt-4 text-sm font-medium text-gray-800">{report.condition}</p>
                <ul className="mt-4 space-y-2">
                  {report.highlights.map((highlight) => (
                    <li key={highlight} className="flex gap-2 text-sm text-gray-600">
                      <span className="text-blue-600">•</span>
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={report.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                  >
                    Open Report
                  </Link>
                  <Link
                    href={report.href}
                    download
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Download PDF
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900">Want to review structured disability intake leads?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-600">
            Apply for partner access to learn how Legal Intake Flow can deliver organized, consent-based disability intake information to your firm or advocacy organization.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button href="/request-access" size="lg">
              Request Partner Access
            </Button>
            <Button href="/for-attorneys" variant="secondary" size="lg">
              For Attorneys
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
