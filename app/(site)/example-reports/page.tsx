import type { Metadata } from "next";
import { Button } from "@/components/Button";

export const metadata: Metadata = {
  title: "Example Disability Intake Reports",
  description:
    "View redacted example readiness reports that show organized disability intake information partners may receive.",
};

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
            These examples show the type of organized information gathered before a lead is delivered to a Legal Intake
            Flow partner. Sample PDFs from production can be linked here when assets are copied to this project.
          </p>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-gray-600 leading-relaxed">
            Example report PDFs live on the original site at{" "}
            <code className="rounded bg-gray-100 px-1 text-sm">/example-reports/*.pdf</code>. After you copy{" "}
            <code className="rounded bg-gray-100 px-1 text-sm">public/example-reports</code> into this repo, download
            buttons can be restored to match production.
          </p>
          <div className="mt-8">
            <Button href="/request-access" size="lg">
              Request Partner Access
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
