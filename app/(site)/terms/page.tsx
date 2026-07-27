import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Legal Intake Flow Terms of Use — the terms governing your use of our platform and services.",
};

export default function TermsPage() {
  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="mb-2 text-4xl font-bold text-gray-900">Terms of Use</h1>
        <p className="mb-10 text-sm text-gray-500">Last updated: June 2025</p>
        <div className="space-y-8 leading-relaxed text-gray-700">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Legal Intake Flow sites or services, you agree to be bound by these
              Terms of Use.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">2. Platform Description</h2>
            <p>
              Legal Intake Flow is a lead delivery and intake management platform. We are not a law firm
              and do not provide legal advice or legal representation.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">3. No Attorney-Client Relationship</h2>
            <p>
              Use of this platform does not create an attorney-client relationship with Legal Intake Flow
              or any partner attorney or advocate.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">4. Contact</h2>
            <p>
              Questions:{" "}
              <a href="mailto:legal@legalintakeflow.com" className="text-blue-600 hover:underline">
                legal@legalintakeflow.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
