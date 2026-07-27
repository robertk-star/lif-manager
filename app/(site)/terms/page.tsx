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

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using legalintakeflow.com, v2.legalintakeflow.com, or any related services operated by Legal Intake Flow (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;), you agree to be bound by these Terms of Use. If you do not agree, do not use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Platform Description</h2>
            <p>
              Legal Intake Flow is a lead delivery and intake management platform that connects individuals preparing for disability benefits claims with licensed attorneys and accredited advocates. We are not a law firm and do not provide legal advice, legal representation, or legal services of any kind.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. No Attorney-Client Relationship</h2>
            <p>
              Use of this platform does not create an attorney-client relationship between you and Legal Intake Flow or between you and any attorney or advocate partner. An attorney-client relationship is only formed through a separate, direct agreement between you and a licensed attorney.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Partner Access Requests</h2>
            <p>
              Submission of a partner access request does not guarantee approval, lead delivery, or any specific volume of leads. We reserve the right to approve or decline partner access requests at our sole discretion. Approved partners are subject to a separate partner agreement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. No Guarantees</h2>
            <p>
              We do not guarantee any specific number of leads, lead quality, case conversion rates, retained clients, or revenue outcomes. Lead delivery is subject to intake volume, screening completion rates, and consent rates, which vary and are not within our control.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Partner Responsibilities</h2>
            <p>
              Attorney and advocate partners are solely responsible for their own intake processes, case evaluations, representation decisions, client communications, and compliance with applicable professional responsibility rules and regulations. Legal Intake Flow does not supervise, direct, or participate in partner legal work.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Use the platform for any unlawful purpose</li>
              <li>Submit false or misleading information in a partner access request</li>
              <li>Attempt to access systems or data you are not authorized to access</li>
              <li>Interfere with the operation of the platform</li>
              <li>Use lead information for any purpose other than legitimate legal intake and representation</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Intellectual Property</h2>
            <p>
              All content on this platform, including text, graphics, logos, and software, is the property of Legal Intake Flow or its licensors and is protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works without our written permission.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Disclaimer of Warranties</h2>
            <p>
              The platform is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, express or implied. We do not warrant that the platform will be uninterrupted, error-free, or free of harmful components.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, Legal Intake Flow shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the platform or any lead information delivered through it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Governing Law</h2>
            <p>
              These Terms of Use are governed by the laws of the applicable governing jurisdiction in which Legal Intake Flow is incorporated, without regard to conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Changes to These Terms</h2>
            <p>
              We may update these Terms of Use from time to time. Continued use of the platform after changes are posted constitutes your acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Contact</h2>
            <p>
              For questions about these Terms of Use, contact us at:{" "}
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
