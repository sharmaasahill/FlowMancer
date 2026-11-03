'use client';

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { REFUND_EMAIL, REFUND_REPLY } from '@/components/landing/content';
import { cn } from '@/lib/utils';

type Key = 'email' | 'lead' | 'invoice';

const TABS: { key: Key; label: string }[] = [
  { key: 'email', label: 'Customer email' },
  { key: 'lead', label: 'Sales lead' },
  { key: 'invoice', label: 'Invoice' },
];

/* Inputs and results from the live demo's built-in examples. */
const INPUT: Record<Key, { source: string; text: string; via: string }> = {
  email: {
    source: `Email from ${REFUND_EMAIL.from}`,
    text: `Subject: ${REFUND_EMAIL.subject}\n\n${REFUND_EMAIL.body}`,
    via: 'Picked up from the Gmail inbox',
  },
  lead: {
    source: 'Website contact form',
    text: 'Name: Priya Sharma\nEmail: priya@stripe.com\nCompany: Stripe\n\nI lead sales ops. We want to automate lead routing for our 300-person sales team this quarter. Budget is approved.',
    via: 'Sent by the form on the company website',
  },
  invoice: {
    source: 'Uploaded document',
    text: 'INVOICE 77\nVendor: Paper Co\nDate 2026-09-12\n\n2 x Paper box @ 40.00 = 80.00\n1 x Toner @ 60.00 = 60.00\nTOTAL: USD 400.00',
    via: 'Uploaded as a PDF or pasted as text',
  },
};

const NEXT: Record<Key, string[]> = {
  email: ['Waits in your approvals. Once approved, it is saved as a Gmail draft.'],
  lead: ['Sales gets a Slack message straight away, because it scored 80 or more.', 'Added to HubSpot once you approve it.'],
  invoice: ['Goes to Finance, marked “needs checking”, for a person to approve or reject.'],
};

/* Lead score parts: [label, points given, points possible] */
const BREAKDOWN: [string, number, number][] = [
  ['Company size', 25, 25],
  ['Fit for the product', 20, 20],
  ['Budget', 20, 20],
  ['Timing', 15, 15],
  ['Decision maker', 10, 10],
  ['Clear need', 10, 10],
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-t border-white/[0.07] py-3 text-[14px]">
      <dt className="text-fog">{label}</dt>
      <dd className="text-right text-bone">{children}</dd>
    </div>
  );
}

function EmailOut() {
  return (
    <>
      <dl>
        <Field label="Category">Billing</Field>
        <Field label="Priority">High</Field>
        <Field label="Tone">Neutral</Field>
        <Field label="Goes to">Billing team</Field>
      </dl>
      <p className="mt-6 text-[12px] font-medium text-fog">Draft reply</p>
      <p className="mt-2 rounded-xl border border-white/[0.08] bg-noir-950/70 p-4 text-[14px] leading-[1.65] text-bone/90">{REFUND_REPLY}</p>
      <p className="mt-2 text-[12px] text-fog">The 30-day window and the 5–7 day timing come from the uploaded refund policy.</p>
    </>
  );
}

function LeadOut() {
  return (
    <>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <p className="font-display text-[64px] leading-[0.9] text-bone">100</p>
        <p className="pb-1 text-[15px] text-fog">out of 100</p>
        <p className="ml-auto pb-1 text-[14px] text-bone">High quality · Enterprise sales</p>
      </div>
      <ul className="mt-7 space-y-3">
        {BREAKDOWN.map(([name, got, max]) => (
          <li key={name} className="grid grid-cols-[118px_minmax(0,1fr)_44px] items-center gap-3 text-[13px] sm:grid-cols-[150px_minmax(0,1fr)_44px]">
            <span className="text-fog">{name}</span>
            {/* The track length shows how much each part can count for (25 points is the longest) */}
            <span className="block h-1.5 rounded-full bg-white/[0.07]" style={{ width: `${(max / 25) * 100}%` }}>
              <span className="block h-full rounded-full bg-crimson-400" style={{ width: `${(got / max) * 100}%` }} />
            </span>
            <span className="text-right font-mono text-[12px] text-bone">{got}/{max}</span>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[12px] text-fog">The AI judges each part within its limit. The total is added up by code.</p>
    </>
  );
}

function InvoiceOut() {
  const row = 'flex items-baseline justify-between gap-6 border-t border-white/[0.07] py-3 text-[14px]';
  return (
    <>
      <div className={row}><span className="text-fog">Vendor</span><span className="text-bone">Paper Co</span></div>
      <div className={row}><span className="text-fog">Paper box × 2</span><span className="font-mono text-bone">80.00</span></div>
      <div className={row}><span className="text-fog">Toner × 1</span><span className="font-mono text-bone">60.00</span></div>
      <div className={row}><span className="font-semibold text-bone">Lines add up to</span><span className="font-mono font-semibold text-bone">140.00</span></div>
      <div className={row}><span className="font-semibold text-amber">Invoice total says</span><span className="font-mono font-semibold text-amber">400.00</span></div>
      <div className="mt-5 rounded-xl border border-amber/25 bg-amber/[0.05] p-4 text-[14px] leading-relaxed">
        <p className="font-semibold text-amber">The total is 260.00 more than the lines.</p>
        <p className="mt-1 text-bone/85">Found with plain arithmetic, not by the AI. The invoice is marked &ldquo;needs checking&rdquo;.</p>
      </div>
    </>
  );
}

const OUTPUT: Record<Key, () => JSX.Element> = { email: EmailOut, lead: LeadOut, invoice: InvoiceOut };

export default function ExampleTabs() {
  const [active, setActive] = useState<Key>('email');
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const Out = OUTPUT[active];

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.key === active);
    const next = (i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
    setActive(TABS[next].key);
    tabs.current[next]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label="Examples" onKeyDown={onKey} className="flex gap-7 border-b border-white/[0.08]">
        {TABS.map((t, i) => {
          const on = t.key === active;
          return (
            <button key={t.key} ref={(el) => { tabs.current[i] = el; }} type="button" role="tab" id={`example-tab-${t.key}`}
              aria-selected={on} aria-controls="example-panel" tabIndex={on ? 0 : -1} onClick={() => setActive(t.key)}
              className={cn('relative -mb-px pb-3.5 text-[15px] font-semibold transition-colors', on ? 'text-bone' : 'text-fog hover:text-bone')}>
              {t.label}
              {on && <motion.span layoutId="example-tab-line" className="absolute inset-x-0 bottom-0 h-0.5 bg-crimson-400"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={active} id="example-panel" role="tabpanel" aria-labelledby={`example-tab-${active}`}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
          className="mt-8 grid overflow-hidden rounded-[20px] border border-white/[0.09] md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="flex flex-col border-b border-white/[0.07] bg-noir-950/50 p-6 sm:p-8 md:border-b-0 md:border-r">
            <p className="flex items-baseline gap-3 text-[13px]">
              <span className="font-semibold text-bone">In</span>
              <span className="text-fog">{INPUT[active].source}</span>
            </p>
            <pre className="mt-6 whitespace-pre-wrap font-mono text-[13px] leading-[1.75] text-bone/80">{INPUT[active].text}</pre>
            <p className="mt-8 border-t border-white/[0.07] pt-4 text-[12px] text-fog md:mt-auto">{INPUT[active].via}</p>
          </div>
          <div className="bg-[#0F0B0C] p-6 sm:p-8">
            <p className="mb-5 flex items-baseline gap-3 text-[13px]">
              <span className="font-semibold text-bone">Out</span>
              <span className="text-fog">What FlowMancer prepared</span>
            </p>
            <Out />
            <div className="mt-7 border-t border-white/[0.07] pt-5">
              <p className="text-[12px] font-medium text-fog">What happens next</p>
              <ul className="mt-2 space-y-1.5 text-[14px] leading-relaxed text-bone">
                {NEXT[active].map((n) => <li key={n}>{n}</li>)}
              </ul>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
