import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, Bot, CheckSquare, FileText, Gauge, Mail, Users, Workflow } from 'lucide-react';
import PublicPage, { GITHUB_URL } from '@/components/PublicPage';

export const metadata: Metadata = {
  title: 'About',
  description: 'FlowMancer reads sales leads, customer emails and business documents, and proposes what to do next. A person approves before anything is sent.',
};

const STEPS = [
  { icon: Users, title: 'Leads', text: 'Scores a sales lead from 0 to 100 using live web research, names the owning team and suggests the next step.' },
  { icon: Mail, title: 'Emails', text: 'Sorts an email by category, priority and sentiment, and drafts a reply that quotes your own policies.' },
  { icon: FileText, title: 'Documents', text: 'Reads invoices and receipts, extracts the totals and checks in code that the numbers add up.' },
];

const MORE = [
  { icon: CheckSquare, title: 'You approve first', text: 'Replies, CRM contacts and sign-offs wait in an approval queue. Nothing is sent on its own.' },
  { icon: BookOpen, title: 'Your knowledge base', text: 'Upload pricing, policies or FAQs, and the AI quotes them in its answers.' },
  { icon: Workflow, title: 'Visual workflows', text: 'Connect a trigger, an AI step, conditions and actions such as Slack, HubSpot or a webhook.' },
  { icon: Bot, title: 'Ask FlowMancer', text: 'Ask questions in plain English. The assistant looks the answers up in your own data.' },
  { icon: Gauge, title: 'Usage and cost', text: 'Every AI request is counted: tokens, response time and an estimated cost.' },
];

export default function AboutPage() {
  return (
    <PublicPage>
      <section className="pb-14 pt-10 text-center">
        <p className="eyebrow mb-4">AI operations assistant</p>
        <h1 className="mx-auto max-w-3xl font-display text-[48px] leading-[1.02] tracking-tight text-bone sm:text-[68px]">
          Reads your leads, emails and documents. <em className="text-blush">Asks before it acts.</em>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-fog">
          FlowMancer turns messy business input into a structured verdict and proposes the next action. A person reviews
          and approves every reply, CRM contact or sign-off before it goes anywhere.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/login" className="btn-primary !px-6 !py-3">Try it <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="btn-ghost !px-6 !py-3">View the source</a>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="What it handles">
        {STEPS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="glass p-6">
            <Icon className="h-6 w-6 text-blush" aria-hidden />
            <h2 className="mt-4 text-lg font-semibold text-bone">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-fog">{text}</p>
          </div>
        ))}
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5" aria-label="Features">
        {MORE.map(({ icon: Icon, title, text }) => (
          <div key={title} className="glass p-5">
            <Icon className="h-5 w-5 text-blush" aria-hidden />
            <h2 className="mt-3 text-[15px] font-semibold text-bone">{title}</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-fog">{text}</p>
          </div>
        ))}
      </section>

      <section className="glass mt-10 p-6 text-sm leading-relaxed text-fog">
        <h2 className="text-[15px] font-semibold text-bone">Your data</h2>
        <p className="mt-2">
          You can sign in with an email and password or with your Google account. With Google, FlowMancer receives only your
          name, email address and Google account ID, and uses them to create and identify your account. It does not read your
          Gmail, contacts or files. Read the <Link href="/privacy" className="text-blush hover:underline">privacy policy</Link> and
          the <Link href="/terms" className="text-blush hover:underline">terms of service</Link>.
        </p>
        <p className="mt-3">
          This is a portfolio project by Sahil Kumar Sharma. The AI runs on Google Gemini, so please don&apos;t enter real
          customer or personal data in the demo.
        </p>
      </section>
    </PublicPage>
  );
}
