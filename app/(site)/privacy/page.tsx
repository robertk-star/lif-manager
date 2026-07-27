import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Legal Intake Flow Privacy Policy — how we collect, use, and protect your information.",
};

export default function PrivacyPage() {
  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="mb-2 text-4xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="mb-10 text-sm text-gray-500">Last updated: June 2025</p>
        <div className="space-y-8 leading-relaxed text-gray-700">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">1. Overview</h2>
            <p>
              Legal Intake Flow operates legalintakeflow.com, v2.legalintakeflow.com, and related
              services. This Privacy Policy describes how we collect, use, store, and share
              information when you use our platform.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">2. Information We Collect</h2>
            <p>We collect information you provide directly, including contact and professional details, intake screening responses, and communications you send to us.</p>
          </section>
          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">3. Consent and Referrals</h2>
            <p>
              We do not share any individual&apos;s intake information with attorney or advocate partners
              without that individual&apos;s explicit consent.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">4. Contact</h2>
            <p>
              For privacy-related questions, contact{" "}
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
