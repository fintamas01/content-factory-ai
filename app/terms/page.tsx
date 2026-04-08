import type { Metadata } from "next";
import { LegalPageShell } from "@/app/components/legal/LegalPageShell";
import { PLATFORM_DISPLAY_NAME } from "@/lib/platform/config";

export const metadata: Metadata = {
  title: `Terms of Service — ${PLATFORM_DISPLAY_NAME}`,
  description: `Terms governing use of ${PLATFORM_DISPLAY_NAME}, including accounts, subscriptions, billing, and AI-generated content.`,
};

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Terms of Service"
      effectiveLabel="Effective date: April 2, 2026 · Last updated: April 8, 2026"
    >
      <p>
        These Terms of Service (“Terms”) govern your access to and use of {PLATFORM_DISPLAY_NAME} and any
        related websites, applications, APIs, and services we offer (collectively, the “Service”). By
        creating an account, clicking to accept, or using the Service, you agree to these Terms. If you use
        the Service on behalf of an organization, you represent that you have authority to bind that
        organization, and “you” includes that entity.
      </p>

      <h2>1. The Service</h2>
      <p>
        {PLATFORM_DISPLAY_NAME} provides software tools for content creation, product copy, audits, and
        related workflows, including features that use artificial intelligence to generate or transform text
        and other outputs based on your inputs. We may add, modify, or discontinue features to improve the
        product, security, or compliance with law.
      </p>

      <h2>2. Eligibility and accounts</h2>
      <p>
        You must provide accurate registration information and keep your credentials confidential. You are
        responsible for all activity under your account and for promptly notifying us of unauthorized use.
        We may suspend or terminate accounts that violate these Terms or pose risk to the Service or other
        users.
      </p>

      <h2>3. Subscriptions, billing, and taxes</h2>
      <p>
        Certain features require a paid subscription. We offer plan tiers such as Free, Basic, Pro, and
        Elite. Fees, renewal cycles, and usage limits are described at checkout or in the product and may
        vary by plan. Unless stated otherwise, subscriptions renew automatically until cancelled. You
        authorize us and our payment processors (such as Stripe) to charge your payment method for
        applicable fees and taxes.
      </p>
      <p>
        You may cancel renewal through the billing or subscription management interface we provide. If you
        cancel, you typically retain access until the end of the current billing period unless we state
        otherwise. Refunds are provided only where required by law or expressly offered in writing at the
        time of purchase.
      </p>
      <p>
        You are responsible for any taxes associated with your purchase other than taxes based on our net
        income. If we are required to collect sales, VAT, GST, or similar taxes, they may appear as
        separate line items.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Violate applicable laws or infringe third-party intellectual property, privacy, or publicity rights;</li>
        <li>
          Use the Service to generate or distribute malware, spam, deceptive content, hate speech, or
          unlawful harassment;
        </li>
        <li>
          Attempt to probe, scan, or test the vulnerability of the Service, bypass security or usage limits,
          or access data or systems without authorization;
        </li>
        <li>
          Reverse engineer, decompile, or attempt to extract the underlying models except where permitted by
          mandatory law;
        </li>
        <li>
          Use the Service in a manner that could damage, disable, overburden, or impair our infrastructure
          or other users’ experience.
        </li>
      </ul>
      <p>
        We may investigate suspected abuse and cooperate with law enforcement or regulators as required.
      </p>

      <h2>5. Your content and license to us</h2>
      <p>
        You retain ownership of inputs you submit and outputs you lawfully obtain, subject to third-party
        rights and these Terms. To operate the Service, you grant us a worldwide, non-exclusive license to
        host, process, transmit, display, and store your content as reasonably necessary to provide,
        secure, and improve the Service for you (including backups and support). This license ends when
        you delete content or close your account, except where retention is required by law or legitimate
        business needs.
      </p>

      <h2>6. AI-generated outputs</h2>
      <p>
        Outputs may be produced using third-party AI systems. Such outputs may be inaccurate, incomplete, or
        similar to material generated for other users. You are solely responsible for reviewing outputs
        before use, including for compliance with advertising standards, industry regulations, and
        platform-specific rules.
      </p>
      <p>
        The Service does not provide legal, medical, financial, or other professional advice. Do not rely on
        outputs as a substitute for qualified professionals. You assume all risk arising from your use or
        distribution of generated content.
      </p>

      <h2>7. Our intellectual property</h2>
      <p>
        The Service, including software, branding, documentation, and design, is owned by us or our
        licensors and is protected by intellectual property laws. Except for the limited rights expressly
        granted in these Terms, no rights are transferred to you.
      </p>

      <h2>8. Third-party services</h2>
      <p>
        The Service may integrate with third-party services (including hosting, authentication, payments,
        and AI providers). The Service may also integrate with third-party social media platforms (for
        example Meta services for Facebook/Instagram, or LinkedIn). Your use of those services may be
        subject to separate terms and privacy policies. We are not responsible for third-party services we
        do not control.
      </p>
      <p>
        If you choose to connect a third-party social account, you authorize the Service to access that
        account as permitted by you through the connection flow and to perform actions you request (for
        example publishing content to a connected Page/account). You are responsible for complying with
        the platform’s policies and ensuring you have the rights and permissions needed to post.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE
        DISCLAIM ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING MERCHANTABILITY, FITNESS
        FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE
        UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER WE NOR OUR AFFILIATES, SUPPLIERS, OR LICENSORS WILL
        BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR
        ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING OUT OF OR RELATED TO THESE TERMS OR THE
        SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
      </p>
      <p>
        OUR TOTAL LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE IN ANY
        TWELVE-MONTH PERIOD IS LIMITED TO THE GREATER OF (A) THE AMOUNTS YOU PAID US FOR THE SERVICE IN THAT
        PERIOD OR (B) ONE HUNDRED U.S. DOLLARS (USD $100), EXCEPT WHERE LIABILITY CANNOT BE LIMITED UNDER
        APPLICABLE LAW (FOR EXAMPLE, FOR DEATH OR PERSONAL INJURY CAUSED BY GROSS NEGLIGENCE OR WILLFUL
        MISCONDUCT WHERE SUCH LAW APPLIES).
      </p>

      <h2>11. Indemnity</h2>
      <p>
        You will defend, indemnify, and hold harmless us and our affiliates, officers, directors,
        employees, and agents from any claims, damages, losses, and expenses (including reasonable
        attorneys’ fees) arising from your content, your use of the Service, or your violation of these
        Terms or applicable law.
      </p>

      <h2>12. Termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend or terminate access if you breach these
        Terms, create risk or legal exposure, or if we discontinue the Service in whole or in part. Provisions
        that by their nature should survive (including intellectual property, disclaimers, limitations of
        liability, and governing law) will survive termination.
      </p>

      <h2>13. Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of the jurisdiction in which the operator of {PLATFORM_DISPLAY_NAME}{" "}
        is established, without regard to conflict-of-law principles that would require applying another
        jurisdiction’s laws. Courts in that jurisdiction (or another agreed venue where required by
        mandatory consumer law) have exclusive jurisdiction over disputes, except where you have a
        non-waivable right to bring claims in your home courts under applicable law.
      </p>
      <p>
        If you are a consumer in the EEA or UK, you may also have the right to use an out-of-court dispute
        resolution body where applicable.
      </p>

      <h2>14. Changes to these Terms</h2>
      <p>
        We may modify these Terms from time to time. We will post the updated Terms and indicate the
        effective date. For material changes, we may provide additional notice (for example, by email or
        in-product notification). Your continued use after the effective date constitutes acceptance of the
        revised Terms. If you do not agree, you must stop using the Service.
      </p>

      <h2>15. Miscellaneous</h2>
      <p>
        These Terms constitute the entire agreement between you and us regarding the Service and supersede
        prior agreements on the same subject. If any provision is unenforceable, the remaining provisions
        remain in effect. Our failure to enforce a provision is not a waiver. You may not assign these
        Terms without our consent; we may assign them in connection with a merger, acquisition, or sale of
        assets.
      </p>

      <h2>16. Contact</h2>
      <p>
        For questions about these Terms, contact us through the support or billing communication channels
        made available within {PLATFORM_DISPLAY_NAME}.
      </p>
    </LegalPageShell>
  );
}
