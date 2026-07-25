import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
})

function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p className="text-xs text-muted-foreground mb-10">
          Last updated: May 7, 2026
        </p>

        <div className="space-y-8 text-sm text-foreground/90 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">
              1. Information We Collect
            </h2>
            <p>We collect the following types of information:</p>
            <ul className="list-disc pl-5 space-y-1 text-foreground/80">
              <li>
                <strong>Account information:</strong> Email address and password
                (hashed) when you create an account.
              </li>
              <li>
                <strong>Content you create:</strong> Prompts, generated images,
                and any images you upload to the Service.
              </li>
              <li>
                <strong>Usage data:</strong> Generation history, model usage,
                credit consumption, timestamps, and error logs. This is used for
                billing, service improvement, and debugging.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">
              2. How We Use Your Information
            </h2>
            <ul className="list-disc pl-5 space-y-1 text-foreground/80">
              <li>To operate, maintain, and improve the Service</li>
              <li>To process payments and manage your credit balance</li>
              <li>
                To send transactional emails (account confirmation, password
                reset)
              </li>
              <li>
                To detect and prevent fraud, abuse, and violations of our Terms
                of Service
              </li>
              <li>To respond to support requests</li>
            </ul>
            <p>
              We do not sell your personal information. We do not use your
              prompts or generated content to train AI models.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">
              3. Third-Party AI Providers
            </h2>
            <p>
              When you generate content, your prompts and parameters are
              transmitted to third-party AI providers (FAL AI, OpenAI, Google)
              to produce the output. These providers have their own privacy
              policies and usage terms. We encourage you to review them. We do
              not share your account identity with these providers — requests
              are made server-side using platform credentials.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">
              4. Data Storage and Security
            </h2>
            <p>
              Your data is stored in the United States using Supabase
              (PostgreSQL database) and Cloudflare R2 (image files). We use
              industry-standard security practices including encrypted
              connections (TLS), hashed passwords, and access controls. No
              system is perfectly secure; we cannot guarantee absolute security
              of your data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">
              5. Data Retention
            </h2>
            <p>
              Your generated images are retained until you delete them or your
              account is closed. Soft-deleted items are held for 30 days before
              permanent deletion. Account and billing records are retained for
              legal and tax compliance purposes after account closure.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">
              6. Your Rights
            </h2>
            <p>You may:</p>
            <ul className="list-disc pl-5 space-y-1 text-foreground/80">
              <li>
                Access and download your content through the Service at any time
              </li>
              <li>
                Delete individual images or your entire library through the
                Service
              </li>
              <li>
                Request deletion of your account by contacting us — we will
                delete your account and associated personal data within 30 days,
                subject to legal retention requirements
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">
              7. Children's Privacy
            </h2>
            <p>
              The Service is not directed to children under 13. We do not
              knowingly collect personal information from children under 13. If
              we learn we have collected such information, we will delete it
              promptly. If you believe a child under 13 has provided us with
              personal information, contact us at the address below.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">
              8. Cookies and Tracking
            </h2>
            <p>
              We use session cookies necessary to maintain your authenticated
              session. We do not use third-party advertising or tracking
              cookies. We use Vercel Analytics for anonymized, aggregate traffic
              measurement — no personal identifiers are collected.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">
              9. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of material changes by updating the "Last updated" date
              and, where appropriate, by email. Continued use of the Service
              after changes take effect constitutes acceptance of the revised
              policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">
              10. Contact
            </h2>
            <p>
              For privacy questions or data deletion requests, contact us at{' '}
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
          <Link to="/terms" className="hover:text-foreground">
            Terms of Service
          </Link>
          <Link to="/" className="hover:text-foreground">
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
