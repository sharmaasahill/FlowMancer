import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { PrimaryCta, TryDemo } from '@/components/landing/AccountLinks';
import ApprovalDemo from '@/components/landing/ApprovalDemo';
import ExampleTabs from '@/components/landing/ExampleTabs';
import HeroDemo from '@/components/landing/HeroDemo';
import PublicPage, { GITHUB_URL, WRAP } from '@/components/PublicPage';

export const metadata: Metadata = {
  title: { absolute: 'FlowMancer: AI that reads your leads, emails and invoices, and asks before it acts' },
  description:
    'FlowMancer reads sales leads, customer emails and invoices, works out what each one needs, and drafts the next step. Replies and CRM updates wait for a person to approve them.',
  alternates: { canonical: '/' },
};

/* ---------- copy ---------- */
const JOBS = [
  {
    when: 'A new lead fills in your contact form',
    today: 'Someone looks the company up, guesses whether it is worth a call and forwards it. Good leads go cold while they wait.',
    after: 'Scored out of 100 with the reasons, sent to the right sales team, and sales hears about strong leads on Slack.',
  },
  {
    when: 'A customer asks for a refund',
    today: 'Someone finds the refund rules, checks the dates and writes a careful reply.',
    after: 'A reply that quotes your refund policy is waiting for your approval, ready to become a Gmail draft.',
  },
  {
    when: 'An invoice arrives',
    today: 'Someone adds up the lines, works out who sent it and chases a sign-off.',
    after: 'Totals recalculated, mismatches flagged, and the invoice sent to Finance for approval.',
  },
];

const STEPS = [
  { title: 'Something arrives', text: 'A form on your website, a new email in Gmail, or a file you upload. In the demo you paste it in.' },
  { title: 'FlowMancer reads it', text: 'It works out what the item is and what it needs. It looks up the company behind a lead and checks your own policies for an email.' },
  { title: 'It drafts the next step', text: 'A score and the right salesperson, a reply, or a checked invoice, each with the reasons behind it.' },
  { title: 'You approve it', text: 'Edit anything, then approve. Only then does the reply become a Gmail draft (or go out, if you choose Send) or the contact go into your CRM.' },
];

const TOOLKIT = [
  { title: 'Company research', text: 'For each lead it searches the web and reads the company’s own site, and keeps the links so you can check them.' },
  { title: 'Your policies, quoted', text: 'Upload price lists, refund rules or FAQs. Replies use their exact terms instead of guessing.' },
  { title: 'Replies in their language', text: 'An email in Hindi, Spanish or Hinglish gets its reply in the same language. The summary stays in English for your team.' },
  { title: 'Your own connections', text: 'Each account connects its own Slack, HubSpot and Gmail. Keys are tested first, then stored encrypted.' },
  { title: 'Automations without code', text: 'Connect steps on a canvas. For example: score each website lead, and tell sales on Slack when it scores 80 or more.' },
  { title: 'Quick or thorough', text: 'One fast pass in a few seconds, or four specialist AI agents taking turns for a closer read.' },
  { title: 'Progress you can follow', text: 'Each step appears as it happens, with how long it took.' },
  { title: 'Costs you can see', text: 'Every AI request is counted. A typical email costs about $0.0005 on a paid AI plan, and nothing on the free one.' },
  { title: 'A complete history', text: 'Every lead, email and invoice is kept with its input, its result and the sources it used.' },
  { title: 'Private accounts', text: 'Each account sees only its own work. Passwords are stored hashed, never as plain text.' },
];

const SAFEGUARDS = [
  { title: 'Nothing goes out unapproved', text: 'An approved reply becomes a Gmail draft by default. Teams that trust it can choose Send for a reply as they approve it.' },
  { title: 'Code does the maths', text: 'Lead scores are added up, invoice totals recalculated and approval rules applied by ordinary code, not by the AI.' },
  { title: 'It shows its working', text: 'Every result lists its reasons, the web pages it read and the part of your policy it used, so a person can check it quickly.' },
];

const QUESTIONS: { q: string; a: string; link?: { href: string; label: string } }[] = [
  {
    q: 'Who is it for?',
    a: 'Small businesses and teams that handle sales leads, customer emails or invoices every day and want the first pass done for them.',
  },
  {
    q: 'Do I need to be technical?',
    a: 'No. In the demo you paste text or upload a file and read the result. Automations are built by connecting steps on a canvas, starting from templates.',
  },
  {
    q: 'Will it do anything without asking?',
    a: 'Nothing goes out without approval. Approved replies become Gmail drafts unless you choose Send for that reply, and CRM updates wait for approval too. The one automatic action is a Slack heads-up when a strong lead or an urgent email comes in. If you build your own automation, you choose which steps need approval.',
  },
  {
    q: 'Can it get things wrong?',
    a: 'Yes. That is why it shows its reasons and sources, leaves all arithmetic to ordinary code, and waits for a person before anything goes out.',
  },
  {
    q: 'What does the AI part actually do?',
    a: 'It uses Google’s Gemini model to read each item and fill in a fixed form: category, priority, score and a draft reply. FlowMancer’s own code then checks the answers and applies your rules.',
  },
  {
    q: 'Is it free, and is my data private?',
    a: 'The demo is free and runs on Google’s free AI plan, which has daily limits. Each account sees only its own data. On the free plan Google may use requests to improve its products, so please don’t enter real customer data.',
    link: { href: '/privacy', label: 'Privacy policy' },
  },
  {
    q: 'Why is the first visit sometimes slow?',
    a: 'The demo runs on a free server that sleeps when nobody is using it. The first request wakes it up, which can take up to a minute.',
  },
  {
    q: 'Who built it?',
    a: 'Sahil Kumar Sharma, as a portfolio project. The full source code is public.',
    link: { href: GITHUB_URL, label: 'Source code on GitHub' },
  },
];

/* ---------- layout pieces ---------- */
function Section({ id, index, label, title, intro, children }: {
  id: string; index: string; label: string; title: string; intro?: string; children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-16 border-t border-white/[0.08] py-20 sm:py-24">
      <div className="grid gap-y-8 lg:grid-cols-12 lg:gap-x-10">
        <div className="lg:col-span-3">
          <p className="flex items-baseline gap-3 text-[13px] lg:sticky lg:top-24">
            <span className="font-mono text-blush">{index}</span>
            <span className="text-fog">{label}</span>
          </p>
        </div>
        <div className="lg:col-span-9">
          <h2 id={`${id}-title`} className="max-w-[20ch] font-display text-[40px] leading-[1.04] tracking-[-0.01em] text-bone sm:text-[54px]">{title}</h2>
          {intro && <p className="mt-5 max-w-[58ch] text-[17px] leading-[1.65] text-fog">{intro}</p>}
          <div className="mt-10 sm:mt-12">{children}</div>
        </div>
      </div>
    </section>
  );
}

function ChatMock() {
  return (
    <figure>
      <div aria-hidden className="rounded-[20px] border border-white/[0.09] bg-[#0F0B0C] p-5 sm:p-6">
        <div className="flex justify-end">
          <p className="max-w-[80%] rounded-2xl rounded-br-md bg-crimson px-4 py-2.5 text-[14px] text-white">Which hot leads came in today?</p>
        </div>
        <p className="mt-5 flex flex-wrap gap-1.5 text-[11px] text-fog">
          <span className="rounded-md border border-white/10 px-2 py-0.5">Searched leads</span>
          <span className="rounded-md border border-white/10 px-2 py-0.5">Opened run #1</span>
          <span className="rounded-md border border-white/10 px-2 py-0.5">Opened run #4</span>
        </p>
        <div className="mt-3 text-[14px] leading-[1.65] text-bone/90">
          <p>Two leads scored 80 or more today:</p>
          <ul className="mt-2 space-y-1.5">
            <li><span className="font-semibold text-bone">Priya Sharma</span>, Stripe · 100/100 · <span className="text-blush underline underline-offset-2">run #1</span></li>
            <li><span className="font-semibold text-bone">Elena Garcia</span>, Notion · 90/100 · <span className="text-blush underline underline-offset-2">run #4</span></li>
          </ul>
          <p className="mt-3">Both are waiting for your approval to be added to HubSpot. Priya&rsquo;s team has budget approved for this quarter, so I&rsquo;d start there.</p>
        </div>
      </div>
      <figcaption className="sr-only">
        A user asks which hot leads came in today. The assistant searches the leads and answers with two names and links to each one.
      </figcaption>
    </figure>
  );
}

/* ---------- page ---------- */
export default function LandingPage() {
  return (
    <PublicPage>
      {/* Hero */}
      <section className={`${WRAP} pb-16 pt-16 sm:pb-24 sm:pt-24`}>
        <h1 className="max-w-[15ch] font-display text-[52px] leading-[0.98] tracking-[-0.02em] text-bone sm:text-[80px] lg:text-[96px]">
          Reads your leads, emails and invoices. <span className="text-fog">Asks before it acts.</span>
        </h1>
        <div className="mt-10 grid gap-10 lg:grid-cols-12">
          <p className="max-w-[56ch] text-[18px] leading-[1.65] text-fog lg:col-span-7">
            FlowMancer is an AI assistant for small teams. It reads each new sales lead, customer email and invoice, works out
            what it needs and drafts the next step. Replies and CRM updates wait for your approval.
          </p>
          <div className="flex flex-col items-start gap-4 lg:col-span-5 lg:items-end lg:justify-end">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <PrimaryCta />
              <TryDemo />
              <Link href="#examples" className="link-arrow">See real examples <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            </div>
            <p className="text-[13px] text-fog">Free to try. No card needed.</p>
          </div>
        </div>
        <div className="mt-16 sm:mt-20">
          <HeroDemo />
        </div>
      </section>

      <div className={WRAP}>
        {/* Integrations */}
        <div className="flex flex-col gap-4 border-t border-white/[0.08] py-8 sm:flex-row sm:items-center sm:gap-12">
          <p className="shrink-0 text-[13px] text-fog">Connects to</p>
          <ul className="flex flex-wrap gap-x-10 gap-y-2 text-[17px] font-semibold tracking-[-0.01em] text-bone/60" aria-label="Integrations">
            {['Gmail', 'Slack', 'HubSpot', 'Zapier', 'Make', 'n8n'].map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>

        {/* 01 Why */}
        <Section id="why" index="01" label="Why it exists" title="Three jobs that fill every morning."
          intro="Small teams handle the same things every day. Each one needs reading, checking and a careful answer, and each one waits until someone has time.">
          <div className="border-b border-white/[0.08]">
            <div className="hidden grid-cols-12 gap-8 pb-4 text-[13px] text-fog md:grid">
              <span className="col-span-4">When</span>
              <span className="col-span-4">Today</span>
              <span className="col-span-4">With FlowMancer</span>
            </div>
            {JOBS.map((j) => (
              <div key={j.when} className="grid gap-3 border-t border-white/[0.08] py-7 md:grid-cols-12 md:gap-8">
                <p className="text-[17px] font-semibold leading-snug text-bone md:col-span-4">{j.when}</p>
                <p className="text-[15px] leading-[1.65] text-fog md:col-span-4">
                  <span className="mr-2 text-[12px] font-semibold text-ash md:hidden">Today</span>{j.today}
                </p>
                <p className="text-[15px] leading-[1.65] text-bone/90 md:col-span-4">
                  <span className="mr-2 text-[12px] font-semibold text-blush md:hidden">With FlowMancer</span>{j.after}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* 02 How it works */}
        <Section id="how-it-works" index="02" label="How it works" title="It prepares the work. You approve it."
          intro="FlowMancer does the reading and the first draft in a few seconds. The decision stays with a person.">
          <ol className="grid gap-x-8 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="border-t border-white/[0.12] pt-5">
                <p className={`font-mono text-[13px] ${i === STEPS.length - 1 ? 'text-blush' : 'text-fog'}`}>{i + 1}</p>
                <h3 className="mt-3 text-[17px] font-semibold text-bone">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-[1.65] text-fog">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-16 grid gap-8 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-4">
              <h3 className="text-[17px] font-semibold text-bone">Try the last step</h3>
              <p className="mt-2 text-[15px] leading-[1.65] text-fog">
                This is the approval screen with the refund reply from above. Change the wording if you like, then approve or reject it.
              </p>
            </div>
            <div className="lg:col-span-8">
              <ApprovalDemo />
            </div>
          </div>
        </Section>

        {/* 03 Examples */}
        <Section id="examples" index="03" label="Examples" title="What goes in, and what comes out."
          intro="Three items from the live demo, with the results FlowMancer returned for them.">
          <ExampleTabs />
        </Section>

        {/* 04 Toolkit */}
        <Section id="toolkit" index="04" label="What else it does" title="Ask about your work in plain English."
          intro="The assistant looks things up in your own leads, emails and invoices, and links to what it used. It can write a reply for you, but only as a draft for approval.">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-7">
              <ChatMock />
            </div>
            <div className="lg:col-span-5 lg:pt-1">
              <h3 className="text-[15px] font-semibold text-bone">Things you can ask</h3>
              <ul className="mt-2 text-[15px] leading-[1.6] text-fog">
                {['Which hot leads came in today?', 'Write a reply to the refund email.', 'How many invoices need approval?',
                  'What does our policy say about refunds after 30 days?'].map((q) => (
                  <li key={q} className="border-b border-white/[0.07] py-3">&ldquo;{q}&rdquo;</li>
                ))}
              </ul>
            </div>
          </div>
          <dl className="mt-20 grid gap-x-10 sm:grid-cols-2">
            {TOOLKIT.map((t) => (
              <div key={t.title} className="border-t border-white/[0.08] py-6">
                <dt className="text-[16px] font-semibold text-bone">{t.title}</dt>
                <dd className="mt-1.5 text-[15px] leading-[1.65] text-fog">{t.text}</dd>
              </div>
            ))}
          </dl>
        </Section>

        {/* 05 Safeguards */}
        <Section id="safeguards" index="05" label="Safeguards" title="Built for the times AI gets it wrong."
          intro="AI models make mistakes. FlowMancer is designed around that instead of hiding it.">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="font-display text-[96px] leading-[0.9] tracking-[-0.02em] text-bone">100<span className="text-fog">/100</span></p>
              <p className="mt-4 max-w-[30ch] text-[15px] leading-[1.65] text-fog">
                labelled test cases answered correctly. The same test runs automatically every Monday and fails if fewer than 90 pass.
              </p>
            </div>
            <dl className="lg:col-span-8">
              {SAFEGUARDS.map((s) => (
                <div key={s.title} className="grid gap-2 border-t border-white/[0.08] py-6 sm:grid-cols-8 sm:gap-8">
                  <dt className="text-[16px] font-semibold text-bone sm:col-span-3">{s.title}</dt>
                  <dd className="text-[15px] leading-[1.65] text-fog sm:col-span-5">{s.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Section>

        {/* 06 Questions */}
        <Section id="questions" index="06" label="Questions" title="Things people ask.">
          <dl className="border-b border-white/[0.08]">
            {QUESTIONS.map(({ q, a, link }) => (
              <div key={q} className="grid gap-2 border-t border-white/[0.08] py-6 md:grid-cols-12 md:gap-8">
                <dt className="text-[16px] font-semibold text-bone md:col-span-5">{q}</dt>
                <dd className="text-[15px] leading-[1.65] text-fog md:col-span-7">
                  {a}
                  {link && (
                    <span className="mt-2 block">
                      {link.href.startsWith('http')
                        ? <a href={link.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-bone underline-offset-4 hover:underline">{link.label}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></a>
                        : <Link href={link.href} className="text-bone underline-offset-4 hover:underline">{link.label}</Link>}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Section>

        {/* Closing */}
        <section className="border-t border-white/[0.08] py-24 sm:py-32">
          <h2 className="max-w-[17ch] font-display text-[44px] leading-[1.02] tracking-[-0.015em] text-bone sm:text-[68px]">
            Give it a messy email and see what comes back.
          </h2>
          <p className="mt-6 max-w-[52ch] text-[17px] leading-[1.65] text-fog">
            Create a free account, open the Studio and pick an example such as &ldquo;Refund request&rdquo;. It takes about a minute.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
            <PrimaryCta label="Create a free account" />
            <TryDemo />
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="link-arrow">Read the source code <ArrowUpRight className="h-4 w-4" aria-hidden /></a>
          </div>
        </section>
      </div>
    </PublicPage>
  );
}
