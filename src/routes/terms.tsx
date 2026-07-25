import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/terms')({
  component: TermsPage,
})

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="mb-8">
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; Back
          </Link>
        </div>

        <h1 className="text-2xl font-semibold text-foreground mb-2">
          Terms of Service
        </h1>
        <p className="text-xs text-muted-foreground mb-10">
          Last updated: May 7, 2026
        </p>

        <div className="space-y-8 text-sm text-foreground/90 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">
              1. Acceptance of Terms
            </h2>
            <p>
              By creating an account or using GenZen ("Service", "we", "us"),
              you agree to these Terms of Service. If you do not agree, do not
              use the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">
              2. Description of Service
            </h2>
            <p>
              GenZen is an AI-assisted creative platform for generating,
              editing, and organizing images using third-party AI models
              provided by FAL AI.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">
              3. Eligibility
            </h2>
            <p>
              You must be at least 13 years old to use the Service. By creating
              an account, you represent that you meet this age requirement. If
              you are under 18, you represent that a parent or legal guardian
              has reviewed and agreed to these Terms on your behalf.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">
              4. User Accounts
            </h2>
            <p>
              You are responsible for maintaining the confidentiality of your
              account credentials and for all activity that occurs under your
              account. Notify us immediately at the contact address below if you
              suspect unauthorized access.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">
              5. AI-Generated Content
            </h2>
            <p>
              Subject to your compliance with these Terms, you own the outputs
              generated through your use of the Service. However, your use of AI
              models through our platform is also subject to the usage policies
              of the underlying model providers: FAL AI, OpenAI, and Google. You
              are responsible for ensuring your use of generated content
              complies with those policies and with applicable law.
            </p>
            <p>
              We do not claim ownership of your prompts or generated images. We
              store your content to operate the Service and may use anonymized,
              aggregated usage data (not your content) to improve the platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">
              6. Acceptable Use
            </h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc pl-5 space-y-1 text-foreground/80">
              <li>
                Generate content that is illegal, harmful, threatening, abusive,
                harassing, defamatory, or otherwise objectionable
              </li>
              <li>
                Generate sexual content involving minors (CSAM) — this is
                strictly prohibited and will result in immediate account
                termination and reporting to authorities
              </li>
              <li>Violate any intellectual property rights</li>
              <li>
                Attempt to circumvent rate limits, access controls, or usage
                restrictions
              </li>
              <li>
                Resell or redistribute access to the Service without prior
                written consent
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">
              7. Service Availability
            </h2>
            <p>
              The Service is provided on a best-effort basis. We do not
              guarantee any specific level of uptime, availability, or
              performance. We may modify, suspend, or discontinue the Service or
              any feature at any time with or without notice. We are not liable
              for any downtime, loss of generated content, or degraded
              performance.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">
              8. Account Termination
            </h2>
            <p>
              We may suspend or terminate your account at our discretion if you
              violate these Terms, engage in fraudulent activity, or for any
              other reason with reasonable notice. You may delete your account
              at any time through the account settings. Upon termination, your
              access to the Service ceases.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">
              9. Data Retention
            </h2>
            <p>
              Generated images are stored in your library until you delete them
              or your account is terminated. Soft-deleted items (moved to Trash)
              are retained for 30 days before permanent deletion. Generation
              history and cost records are retained for account management and
              billing purposes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">
              10. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by applicable law, GenZen and its
              operators shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages, including loss of
              data, revenue, or profits, arising from your use of or inability
              to use the Service. Our total liability to you for any claim
              arising out of or relating to these Terms or the Service shall not
              exceed the amount you paid us in the 12 months preceding the
              claim.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">
              11. Changes to Terms
            </h2>
            <p>
              We may update these Terms from time to time. We will notify you of
              material changes by posting the new Terms and updating the "Last
              updated" date. Continued use of the Service after changes take
              effect constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">
              12. Contact
            </h2>
            <p>
              For questions about these Terms, contact us at{' '}
              <a
                href="mailto:hello@genzen.ai"
                className="text-accent-brand hover:underline"
              >
                hello@genzen.ai
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex gap-4 text-xs text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <Link to="/" className="hover:text-foreground">
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
