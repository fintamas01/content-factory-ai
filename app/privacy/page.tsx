import type { Metadata } from "next";
import { LegalPageShell } from "@/app/components/legal/LegalPageShell";
import { PLATFORM_DISPLAY_NAME } from "@/lib/platform/config";

export const metadata: Metadata = {
  title: `Privacy Policy — ${PLATFORM_DISPLAY_NAME}`,
  description: `How ${PLATFORM_DISPLAY_NAME} collects, uses, and protects personal data and AI-related information.`,
};

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      effectiveLabel="Effective date: April 2, 2026 · Last updated: April 2, 2026"
    >
      <p>
        This Privacy Policy describes how {PLATFORM_DISPLAY_NAME} (“we”, “us”, “our”) handles personal
        information when you use our websites, applications, and related services (collectively, the
        “Service”). It applies to visitors, registered users, and subscribers. By using the Service, you
        acknowledge this Policy.
      </p>

      <h2>1. Who is responsible for your information?</h2>
      <p>
        The data controller for personal data processed through the Service is the legal entity that
        operates {PLATFORM_DISPLAY_NAME}. Where applicable privacy laws require a designated contact, you
        may reach us through the in-product support or account-related communication channels we make
        available to you.
      </p>

      <h2>2. What we collect</h2>
      <p>Depending on how you use the Service, we may process the following categories of information:</p>
      <ul>
        <li>
          <strong>Account and profile data:</strong> such as name, email address, authentication
          identifiers, workspace or organization identifiers, and preferences you save in the product.
        </li>
        <li>
          <strong>Billing and subscription data:</strong> plan selection, subscription status, and payment
          transaction references. Payment card details are handled by our payment processor (for example,
          Stripe); we do not store full card numbers on our servers.
        </li>
        <li>
          <strong>Content and prompts you submit:</strong> text, files, URLs, brand inputs, product data,
          and other materials you upload or enter so the Service can generate or transform outputs for you.
        </li>
        <li>
          <strong>Generated outputs:</strong> AI-generated text and assets produced at your request, along
          with associated metadata needed to display history, exports, or collaboration features.
        </li>
        <li>
          <strong>Usage and technical data:</strong> log and diagnostic information such as IP address,
          device and browser type, approximate location derived from IP, timestamps, pages or features
          accessed, error logs, and security signals. We may use cookies or similar technologies for
          session management, security, analytics, and product improvement.
        </li>
        <li>
          <strong>Communications:</strong> messages you send to us (for example, support requests) and
          related metadata.
        </li>
      </ul>

      <h2>3. How we use information</h2>
      <p>We use personal information for purposes including to:</p>
      <ul>
        <li>Provide, operate, secure, and improve the Service;</li>
        <li>Create and manage your account and workspace;</li>
        <li>Authenticate users and prevent fraud, abuse, and security incidents;</li>
        <li>
          Process subscriptions, invoices, taxes where applicable, and communicate about billing changes;
        </li>
        <li>
          Run AI features you invoke—this includes sending relevant inputs to model providers to generate
          outputs, enforcing usage limits tied to your plan, and storing results for your continued access;
        </li>
        <li>Analyze aggregated or de-identified usage to understand feature adoption and reliability;</li>
        <li>Comply with legal obligations and enforce our Terms of Service.</li>
      </ul>

      <h2>4. AI processing</h2>
      <p>
        {PLATFORM_DISPLAY_NAME} includes features that use artificial intelligence and large language
        models. When you submit prompts or content, we process that information to produce outputs you
        request. Outputs may be incorrect, incomplete, or unsuitable for a particular use case; you remain
        responsible for reviewing material before relying on it, especially in regulated or high-risk
        contexts.
      </p>
      <p>
        Unless we expressly notify you otherwise and obtain any consent required by law, we do not use your
        private prompts or account data to train third-party foundation models “for our own model
        training” in a way that associates outputs with you as an identifiable individual beyond what is
        necessary to provide and secure the Service. Third-party AI providers may process inputs under
        their own terms and safeguards as sub-processors.
      </p>

      <h2>5. Legal bases (EEA, UK, and similar regions)</h2>
      <p>Where GDPR or comparable laws apply, we rely on one or more of the following bases:</p>
      <ul>
        <li>
          <strong>Performance of a contract</strong> — to deliver the Service you sign up for;
        </li>
        <li>
          <strong>Legitimate interests</strong> — for example securing the product, analytics in
          aggregate form, and improving features, balanced against your rights;
        </li>
        <li>
          <strong>Consent</strong> — where required for specific cookies or marketing communications;
        </li>
        <li>
          <strong>Legal obligation</strong> — where we must retain or disclose information to comply with
          law.
        </li>
      </ul>

      <h2>6. Sharing and sub-processors</h2>
      <p>
        We share personal information only as needed to run the Service, including with infrastructure and
        hosting providers, authentication services, payment processors (such as Stripe), email or
        notification delivery providers, analytics tools, customer support tooling, and AI inference
        providers. We require service providers to protect information appropriately and use it only for the
        purposes we specify.
      </p>
      <p>
        We may disclose information if required by law, court order, or governmental request, or to protect
        the rights, safety, and integrity of our users, the public, or {PLATFORM_DISPLAY_NAME}.
      </p>
      <p>
        If we are involved in a merger, acquisition, or asset sale, personal information may be transferred as
        part of that transaction, subject to safeguards and notice consistent with applicable law.
      </p>

      <h2>7. International transfers</h2>
      <p>
        We may process and store information in countries other than your own. Where we transfer personal
        data from the EEA, UK, or Switzerland to countries not deemed adequate, we implement appropriate
        safeguards such as Standard Contractual Clauses or other mechanisms recognized by applicable law.
      </p>

      <h2>8. Retention</h2>
      <p>
        We retain personal information for as long as your account is active, as needed to provide the
        Service, and as required for legitimate business or legal purposes (for example, tax, accounting,
        dispute resolution, and security). Retention periods may differ by data category. You may request
        deletion of your account subject to legal exceptions; some information may persist in backups for a
        limited period before secure deletion.
      </p>

      <h2>9. Security</h2>
      <p>
        We implement technical and organizational measures designed to protect personal information against
        unauthorized access, loss, or alteration. No method of transmission or storage is completely
        secure; we encourage strong passwords and safeguarding your login credentials.
      </p>

      <h2>10. Your rights</h2>
      <p>
        Depending on your location, you may have rights to access, correct, delete, or export your personal
        information; restrict or object to certain processing; withdraw consent where processing is
        consent-based; and lodge a complaint with a supervisory authority. To exercise rights, contact us
        through the channels provided in the Service. We may need to verify your identity before fulfilling
        a request.
      </p>

      <h2>11. Children</h2>
      <p>
        The Service is not directed to children under 16 (or the minimum age required in your jurisdiction).
        We do not knowingly collect personal information from children. If you believe we have collected
        such information, contact us so we can delete it.
      </p>

      <h2>12. Changes to this Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will post the revised version with an
        updated effective date and, where required by law, provide additional notice. Continued use of the
        Service after changes constitutes acceptance of the updated Policy.
      </p>

      <h2>13. Contact</h2>
      <p>
        For privacy-related questions or requests, use the support or account contact options available
        inside {PLATFORM_DISPLAY_NAME}. Please include enough detail for us to evaluate and respond to your
        request.
      </p>
    </LegalPageShell>
  );
}
