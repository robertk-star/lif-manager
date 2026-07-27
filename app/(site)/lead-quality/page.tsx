import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/Button";

export const metadata: Metadata = {
  title: "Lead Quality Process | Legal Intake Flow",
  description:
    "Learn how Legal Intake Flow focuses on structured, consent-based Social Security Disability leads with guided intake, AI-supported review, confirmation, and internal quality screening.",
};

const INTAKE_FIELDS = [
  "Medical condition or symptoms",
  "How long the condition has lasted",
  "How the condition affects work",
  "Current work status",
  "Monthly earnings, when applicable",
  "Reduced hours or stopped work",
  "Job duties affected",
  "Daily limitations",
  "Treating doctor or healthcare provider",
  "Recent doctor visits",
  "Medication and side effects",
  "Medical records and documentation",
  "Application status",
  "Prior denial or appeal stage",
  "Advocate or representative status",
  "Contact consent",
];

const ANSWER_REVIEW_EXAMPLES = [
  "I don’t know",
  "I’m lazy",
  "Nothing wrong",
  "This is a scam",
  "random words",
  "unrelated or incomplete answers",
];

const ROUTING_SIGNALS = [
  "Advocate or representative contact consent",
  "Usable contact information",
  "A real condition, symptom, or limitation described",
  "Answers related to disability preparation",
  "Work or daily-life limitations",
  "Medical treatment or a clear explanation about treatment",
  "Spam, joke, test, or unrelated answers",
  "Contradictions or missing details needing manual review",
];

const CATEGORIES = [
  {
    title: "Ready for Advocate Review",
    body: "The person appears to be a fit for review, provided usable information, and requested advocate or attorney help. These leads have passed the internal checks needed to move forward.",
  },
  {
    title: "Needs Review",
    body: "The lead may still be useful, but should be reviewed manually first because something is unclear, incomplete, unusual, or inconsistent.",
  },
  {
    title: "Blocked / Not Sendable",
    body: "The lead should not be released because it lacks consent, appears to be a test or junk submission, is missing required contact information, or does not appear related to disability help.",
  },
];

const CONFIRMATION_BENEFITS = [
  "The person used a real email address",
  "The person confirmed they want contact",
  "The person confirmed the best phone number to use",
  "The original phone number is preserved",
  "The confirmed contact number is stored separately",
  "The lead has a clearer confirmation trail",
];

const RELEASE_CHECKS = [
  "Completed intake information",
  "Advocate or representative contact consent",
  "Email confirmation",
  "Confirmed phone number",
  "Internal routing review",
  "No blocked status",
  "No test submission",
  "Proper practice area: Social Security Disability",
];

const TEAM_RECEIVES = [
  "Name",
  "Email",
  "Confirmed phone number",
  "State",
  "Age range",
  "Primary condition",
  "Application status",
  "Denial or appeal information",
  "Work status",
  "Monthly earnings, when applicable",
  "Work limitations",
  "Daily limitations",
  "Treatment history",
  "Medication status",
  "Medical documentation level",
  "Advocate contact consent status",
  "Confirmed contact status",
  "Internal routing status",
  "Notes and review flags",
];

const PROCESS_STEPS = [
  "Guided intake",
  "AI-supported answer review",
  "Required-field validation",
  "Post-submission AI-assisted routing review",
  "Consent screening",
  "Email confirmation",
  "Confirmed phone collection",
  "Internal review safeguards",
];

function CheckList({ items, dark = false }: { items: string[]; dark?: boolean }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li
          key={item}
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm leading-relaxed ${
            dark
              ? "border-gray-700 bg-gray-800/60 text-gray-200"
              : "border-gray-200 bg-white text-gray-700"
          }`}
        >
          <span className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${dark ? "bg-blue-500/20 text-blue-300" : "bg-blue-50 text-blue-600"}`}>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function LeadQualityPage() {
  return (
    <>
      <section className="bg-[#0d1b2e] py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-blue-400">
            Lead Quality Process
          </p>
          <h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
            Better Disability Leads for Firms That Want Quality Over Volume
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-gray-300 sm:text-xl">
            Legal Intake Flow is built to reduce time wasted on unfiltered disability inquiries by adding structure, consent checks, answer review, and confirmation before a lead is released for human review.
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
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
              Why it matters
            </p>
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Stop wasting time on unfiltered disability inquiries.
            </h2>
            <p className="mt-5 leading-relaxed text-gray-600">
              Most disability lead sources focus on volume. They send names, phone numbers, and a short note. Then your team has to figure out whether the person has a real disability issue, whether they are working, whether they have treatment, whether they were denied, whether they have deadlines, and whether they actually want help.
            </p>
            <p className="mt-4 leading-relaxed text-gray-600">
              Our process is different. We focus on people who are actively looking for help with Social Security Disability preparation and who have provided enough information to make an initial review more meaningful.
            </p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-8 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-900">Not basic form-fill leads</h3>
            <p className="mt-4 leading-relaxed text-gray-700">
              Each lead goes through structured intake, AI-supported answer review, internal quality screening, and confirmation steps before being sent for advocate or attorney review.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {PROCESS_STEPS.slice(0, 4).map((step, index) => (
                <div key={step} className="rounded-lg bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Step {index + 1}</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 max-w-3xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">1. Detailed intake first</p>
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">The person gives useful information before the lead is sent.</h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              The intake asks questions that matter in a Social Security Disability review. This helps separate casual browsers from people who are seriously trying to organize their disability-related information.
            </p>
          </div>
          <CheckList items={INTAKE_FIELDS} />
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">2. Answer quality review</p>
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">AI reviews typed answers while the person is filling out the form.</h2>
            <p className="mt-4 leading-relaxed text-gray-600">
              A common problem with online leads is poor-quality form data. Important text answers can be reviewed while the person is completing the intake. If an answer appears unrelated, unclear, or not useful for the question being asked, the person can be prompted to review it before continuing.
            </p>
            <p className="mt-4 leading-relaxed text-gray-600">
              The person is not blocked unfairly. They can still continue if they meant what they wrote, but the system gives them a chance to correct low-quality answers before they become part of the lead record.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8">
            <h3 className="text-lg font-semibold text-gray-900">Examples of answers that may need review</h3>
            <div className="mt-5 flex flex-wrap gap-3">
              {ANSWER_REVIEW_EXAMPLES.map((item) => (
                <span key={item} className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#0d1b2e] py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 max-w-3xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-400">3. Post-submission review</p>
            <h2 className="text-3xl font-bold text-white sm:text-4xl">AI-assisted routing review after submission.</h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-300">
              This review does not predict approval, decide eligibility, or tell the person they have a case. It reviews whether the lead appears ready for human review based on practical intake quality signals.
            </p>
          </div>
          <CheckList items={ROUTING_SIGNALS} dark />
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Internal Lead Categories</h2>
            <p className="mx-auto mt-4 max-w-3xl text-lg text-gray-600">
              Not every form submission is released. Leads are organized into internal categories so your team receives a cleaner handoff.
            </p>
          </div>
          <div className="grid gap-8 lg:grid-cols-3">
            {CATEGORIES.map((category) => (
              <div key={category.title} className="rounded-xl border border-gray-200 bg-gray-50 p-8">
                <h3 className="text-xl font-semibold text-gray-900">{category.title}</h3>
                <p className="mt-4 leading-relaxed text-gray-600">{category.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-20">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">4. Confirmation before release</p>
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Advocate contact is confirmed before release.</h2>
            <p className="mt-4 leading-relaxed text-gray-600">
              If the person asks for advocate help, the process does not rely only on the form checkbox. The person can be asked to confirm that they still want to be contacted and to provide the best phone number for the advocate or firm to use.
            </p>
          </div>
          <CheckList items={CONFIRMATION_BENEFITS} />
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 max-w-3xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">5. Right-fit release</p>
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">The lead is routed only when the person is the right fit and requests help.</h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              A lead is not released just because someone filled out a form. Before a lead is sent for review, the system checks for the required quality and consent signals.
            </p>
          </div>
          <CheckList items={RELEASE_CHECKS} />
        </div>
      </section>

      <section className="bg-[#0d1b2e] py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">What Your Team Receives</h2>
            <p className="mx-auto mt-4 max-w-3xl text-lg text-gray-300">
              For qualified leads, your team can receive a structured lead summary with more context before the first call.
            </p>
          </div>
          <CheckList items={TEAM_RECEIVES} dark />
          <p className="mt-6 text-center text-sm text-gray-500">
            Exact fields may vary based on screening completion, consent status, and partner delivery configuration.
          </p>
        </div>
      </section>

      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">Quality over volume</p>
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Built for disability firms that value intake time.</h2>
              <p className="mt-5 leading-relaxed text-gray-600">
                Your intake team’s time is valuable. Every poor-quality lead costs time. Every fake phone number wastes effort. Every unclear form submission slows your team down. Every person who never asked to be contacted creates risk and frustration.
              </p>
              <p className="mt-4 leading-relaxed text-gray-600">
                Legal Intake Flow is designed to reduce that problem by adding structure before the lead reaches you.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <h3 className="text-xl font-semibold text-gray-900">Review safeguards before delivery</h3>
              <ol className="mt-6 space-y-3">
                {PROCESS_STEPS.map((step, index) => (
                  <li key={step} className="flex gap-4 rounded-lg bg-gray-50 p-4">
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-800">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-blue-600 py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            A Better Intake Source for Social Security Disability Leads
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-blue-100">
            If your firm wants disability leads with more context, better screening, and stronger contact confirmation, this system was built for that.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button href="/request-access" variant="outline" size="lg">
              Request Partner Access
            </Button>
            <Link href="/for-attorneys" className="text-sm font-semibold text-blue-100 hover:text-white hover:underline">
              Learn more for attorneys and advocates →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
