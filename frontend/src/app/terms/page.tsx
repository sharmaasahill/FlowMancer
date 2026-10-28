import type { Metadata } from 'next';
import Link from 'next/link';
import PublicPage, { CONTACT_EMAIL, GITHUB_URL, Prose } from '@/components/PublicPage';

export const metadata: Metadata = { title: 'Terms of service' };

export default function TermsPage() {
  return (
    <PublicPage>
      <Prose title="Terms of service" updated="28 October 2026">
        <p>
          These terms apply to the FlowMancer demo at <Link href="/about">flowmancer.vercel.app</Link>, a portfolio project
          run by Sahil Kumar Sharma. By creating an account or signing in, you agree to them.
        </p>

        <h2>What FlowMancer is</h2>
        <p>
          A demonstration of an AI assistant that analyses leads, emails and documents and proposes actions for a person to
          approve. It&apos;s offered free of charge, for evaluation only, and may change, go offline or be reset at any time.
        </p>

        <h2>Your responsibilities</h2>
        <ul>
          <li>Don&apos;t submit real customer data, personal data about others, passwords or confidential information.</li>
          <li>Don&apos;t use the service for anything illegal, to send spam, or to harm or overload it.</li>
          <li>Keep your sign-in details to yourself. You&apos;re responsible for what happens in your account.</li>
        </ul>

        <h2>AI output</h2>
        <p>
          Scores, summaries, extracted totals and draft replies are produced by an AI model and can be wrong. Check them
          before acting. That&apos;s why FlowMancer asks for approval before anything is sent.
        </p>

        <h2>Your content</h2>
        <p>
          You keep ownership of what you submit. You allow FlowMancer to store and process it to provide the service, as
          described in the <Link href="/privacy">privacy policy</Link>.
        </p>

        <h2>Accounts</h2>
        <p>
          Accounts that break these terms may be suspended or deleted. You can ask for your account to be deleted at any
          time by emailing <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <h2>No warranty</h2>
        <p>
          The service is provided &quot;as is&quot;, without warranties of any kind. To the extent the law allows, the author
          isn&apos;t liable for any loss arising from its use.
        </p>

        <h2>Source code</h2>
        <p>
          The code is open source under the MIT licence on <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>.
        </p>

        <h2>Changes and contact</h2>
        <p>
          If these terms change, the date at the top will change too. Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </Prose>
    </PublicPage>
  );
}
