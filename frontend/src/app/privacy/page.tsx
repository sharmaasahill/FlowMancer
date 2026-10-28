import type { Metadata } from 'next';
import Link from 'next/link';
import PublicPage, { CONTACT_EMAIL, Prose } from '@/components/PublicPage';

export const metadata: Metadata = { title: 'Privacy policy' };

export default function PrivacyPage() {
  return (
    <PublicPage>
      <Prose title="Privacy policy" updated="28 October 2026">
        <p>
          FlowMancer (&quot;we&quot;) is a portfolio project run by Sahil Kumar Sharma at{' '}
          <Link href="/about">flowmancer.vercel.app</Link>. This page explains what data the app collects, why, and what you
          can do about it. Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li><b>Account details:</b> your name and email address, and a scrypt hash of your password if you set one. We never store the password itself.</li>
          <li><b>If you sign in with Google:</b> your name, email address, whether Google has verified that email, and your Google account ID. That&apos;s all we receive.</li>
          <li><b>What you submit:</b> the leads, emails, documents and knowledge-base text you enter, the AI results, your approvals, workflows and questions to the assistant.</li>
          <li><b>Usage records:</b> for each AI request, the model used, token counts, response time and whether it succeeded.</li>
        </ul>

        <h2>How we use Google user data</h2>
        <p>
          Data from Google sign-in is used only to create your account, recognise you when you sign in again, and show your
          name in the app. We don&apos;t request access to Gmail, Google Drive, contacts or any other Google service through
          sign-in, and we don&apos;t sell, rent or share Google user data, or use it for advertising. FlowMancer&apos;s use of
          information received from Google APIs adheres to the{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>,
          including the Limited Use requirements.
        </p>

        <h2>Who else processes your data</h2>
        <ul>
          <li><b>Google Gemini</b> analyses what you submit. On the free tier, Google may use those requests to improve its products. Don&apos;t submit real customer or personal data.</li>
          <li><b>DuckDuckGo</b> receives the company name and email domain of a lead when web research runs, and the company&apos;s public website is fetched.</li>
          <li><b>Hosting:</b> the site runs on Vercel, the server on Render, and the database on Neon.</li>
          <li><b>Integrations</b> such as Slack, HubSpot or a webhook receive data only when someone approves an action that sends it there.</li>
        </ul>

        <h2>Cookies and storage</h2>
        <p>
          FlowMancer doesn&apos;t use advertising or analytics cookies. Your sign-in token is kept in your browser&apos;s local
          storage, and the assistant conversation in session storage. Google&apos;s sign-in button may set its own cookies;
          see Google&apos;s privacy policy.
        </p>

        <h2>How long we keep data, and deleting it</h2>
        <p>
          Your data is kept while your account exists. To delete your account and everything in it, email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the address you signed up with, and it will be removed
          within 30 days. You can also remove FlowMancer&apos;s access to your Google account at any time at{' '}
          <a href="https://myaccount.google.com/connections" target="_blank" rel="noreferrer">myaccount.google.com/connections</a>.
        </p>

        <h2>Security</h2>
        <p>
          Passwords are hashed, connections use HTTPS, and each account can see only its own data. No system is perfectly
          secure, so please treat this demo accordingly.
        </p>

        <h2>Children</h2>
        <p>FlowMancer is not meant for anyone under 16.</p>

        <h2>Changes</h2>
        <p>If this policy changes, the date at the top will change too.</p>
      </Prose>
    </PublicPage>
  );
}
