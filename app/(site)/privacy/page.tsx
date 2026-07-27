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

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Overview</h2>
            <p>
              Legal Intake Flow (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) operates legalintakeflow.com, v2.legalintakeflow.com, and related services. This Privacy Policy describes how we collect, use, store, and share information when you use our platform, including when you complete an intake screening or submit a partner access request.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
            <p>We collect information you provide directly, including:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Contact information (name, email address, phone number)</li>
              <li>Professional information (firm name, practice area, state(s) served)</li>
              <li>Intake screening responses submitted through our platform</li>
              <li>Communications you send to us</li>
            </ul>
            <p className="mt-3">
              We also collect certain technical information automatically, including IP address, browser type, device type, and pages visited, through standard web server logs and analytics tools.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Process and respond to partner access requests</li>
              <li>Deliver intake lead information to authorized attorney and advocate partners</li>
              <li>Communicate with you about your request or account</li>
              <li>Improve our platform and services</li>
              <li>Comply with applicable legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Consent and Referrals</h2>
            <p>
              We do not share any individual&apos;s intake information with attorney or advocate partners without that individual&apos;s explicit consent. Consent is collected as part of the intake screening process. If an individual does not provide consent, their information is not shared.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Information Sharing</h2>
            <p>
              We do not sell personal information. We may share information with:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Attorney and advocate partners, where consent has been obtained</li>
              <li>Service providers who assist us in operating our platform (subject to confidentiality obligations)</li>
              <li>Law enforcement or regulatory authorities where required by law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Data Retention</h2>
            <p>
              We retain information for as long as necessary to fulfill the purposes described in this policy, or as required by law. Partner access request records are retained for business and compliance purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Security</h2>
            <p>
              We implement reasonable technical and organizational measures to protect the information we collect. No system is completely secure, and we cannot guarantee the absolute security of your information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Your Rights</h2>
            <p>
              Depending on your location, you may have rights regarding your personal information, including the right to access, correct, or request deletion of your data. To exercise these rights, contact us at legal@legalintakeflow.com.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will post the updated policy on this page with a revised effective date. Continued use of our platform after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Contact</h2>
            <p>
              For privacy-related questions or requests, contact us at:{" "}
              <a href="mailto:legal@legalintakeflow.com" className="text-blue-600 hover:underline">
                legal@legalintakeflow.com
              </a>
            </p>
          </section>

        </div>
      </div>
    </section>
  );
}
