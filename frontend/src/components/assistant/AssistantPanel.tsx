'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, BookOpen, CheckSquare, FileSearch, Gauge, Mail, MessageSquare, RotateCcw, Search, X } from 'lucide-react';
import Markdown from '@/components/assistant/Markdown';
import { useAssistant } from '@/components/assistant/AssistantProvider';
import Orb from '@/components/Orb';
import { Kbd } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { ToolUse } from '@/types';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  'Which hot leads came in this week?',
  'What is waiting for my approval?',
  'Summarise the urgent emails',
  'Why was my last invoice flagged?',
];

const TOOL_LABELS: Record<string, { label: (a: Record<string, any>) => string; icon: typeof Search }> = {
  search_runs: { icon: Search, label: (a) => `Searched ${a.kind ? `${a.kind}s` : 'items'}${a.text ? ` for “${a.text}”` : ''}` },
  get_run: { icon: FileSearch, label: (a) => `Opened run #${a.run_id ?? '?'}` },
  get_stats: { icon: Gauge, label: () => 'Checked your stats' },
  list_approvals: { icon: CheckSquare, label: (a) => `Listed ${a.status || 'pending'} approvals` },
  search_knowledge: { icon: BookOpen, label: () => 'Searched the knowledge base' },
  draft_email: { icon: Mail, label: (a) => `Drafted an email${a.to ? ` to ${a.to}` : ''}` },
  draft_slack_message: { icon: MessageSquare, label: () => 'Drafted a Slack message' },
};

function ToolChips({ tools }: { tools: ToolUse[] }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="What the assistant looked at">
      {tools.map((t, i) => {
        const meta = TOOL_LABELS[t.tool];
        const Icon = meta?.icon || Search;
        return (
          <li key={i} className={cn('chip !py-0.5 !text-[11px]', !t.ok && '!border-coral/25 !text-coral')}>
            <Icon className="h-3 w-3" aria-hidden />{meta ? meta.label(t.args) : t.tool}
          </li>
        );
      })}
    </ul>
  );
}

function Thinking() {
  return (
    <div className="flex items-center gap-3 text-sm text-fog" role="status">
      <Orb size={26} state="thinking" />
      <span className="flex gap-1" aria-label="Thinking">
        {[0, 1, 2].map((i) => (
          <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-blush"
            animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }} />
        ))}
      </span>
    </div>
  );
}

export default function AssistantPanel() {
  const { open, setOpen, turns, busy, send, reset } = useAssistant();
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) requestAnimationFrame(() => input.current?.focus());
  }, [open]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const submit = (text?: string) => {
    const t = (text ?? draft).trim();
    if (!t || busy) return;
    setDraft('');
    send(t);
  };

  const first = user?.name?.split(' ')[0];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-noir-950/40 backdrop-blur-[2px] lg:hidden" onClick={() => setOpen(false)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden />
          <motion.aside role="dialog" aria-label="Ask FlowMancer"
            initial={{ x: '105%' }} animate={{ x: 0 }} exit={{ x: '105%' }} transition={{ type: 'spring', stiffness: 340, damping: 36 }}
            className="glass-strong fixed inset-y-3 right-3 z-50 flex w-[min(460px,calc(100vw-1.5rem))] flex-col overflow-hidden !rounded-[28px]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-56" aria-hidden
              style={{ background: 'radial-gradient(70% 90% at 50% 0%, rgba(155,19,19,0.35), transparent 70%)' }} />

            <header className="relative flex items-center gap-3 px-5 pb-3 pt-5">
              <Orb size={34} state={busy ? 'thinking' : 'idle'} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-2xl leading-none text-bone">Ask <em className="text-blush">FlowMancer</em></p>
                <p className="mt-1 text-xs text-fog">Answers from your own leads, emails and documents</p>
              </div>
              {turns.length > 0 && (
                <button type="button" onClick={reset} className="btn-quiet !p-2" aria-label="New conversation" title="New conversation">
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="btn-quiet !p-2" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div ref={scroller} className="relative flex-1 space-y-5 overflow-y-auto px-5 py-4" aria-live="polite">
              {turns.length === 0 && (
                <div className="pt-6 text-center">
                  <Orb size={64} className="mx-auto" />
                  <p className="mt-5 font-display text-[30px] leading-tight text-bone">
                    {first ? <>Hi {first},<br /></> : null}what do you need?
                  </p>
                  <p className="mx-auto mt-2 max-w-xs text-sm text-fog">
                    I can look things up and draft replies. Anything I draft waits in Approvals for you.
                  </p>
                  <div className="mt-7 grid gap-2">
                    {SUGGESTIONS.map((s, i) => (
                      <motion.button key={s} type="button" onClick={() => submit(s)}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
                        className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-left text-sm text-bone/90 transition hover:border-blush/30 hover:bg-crimson/10">
                        {s}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {turns.map((t, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={cn('flex', t.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {t.role === 'user' ? (
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-crimson px-4 py-2.5 text-sm text-white shadow-ember">
                      {t.content}
                    </p>
                  ) : (
                    <div className="max-w-[95%] text-sm leading-relaxed text-bone/90">
                      {!!t.tools?.length && <ToolChips tools={t.tools} />}
                      <div className={cn(t.error && 'rounded-2xl border border-coral/25 bg-coral/[0.07] px-4 py-3 text-coral')}>
                        <Markdown text={t.content} />
                      </div>
                      {!!t.approvals?.length && (
                        <div className="mt-3 space-y-2">
                          {t.approvals.map((a) => (
                            <Link key={a.id} href="/approvals" onClick={() => setOpen(false)}
                              className="flex items-center gap-3 rounded-2xl border border-crimson-400/30 bg-crimson/[0.12] p-3 transition hover:bg-crimson/20">
                              <CheckSquare className="h-4 w-4 shrink-0 text-blush" aria-hidden />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-bone">{a.title}</span>
                                <span className="text-xs text-fog">Waiting for your approval · nothing sent yet</span>
                              </span>
                              <span className="text-xs font-semibold text-blush">Review</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
              {busy && <Thinking />}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="relative border-t border-white/[0.06] p-4">
              <div className="flex items-end gap-2 rounded-2xl border border-white/[0.08] bg-noir-950/60 p-2 focus-within:border-blush/40 focus-within:ring-4 focus-within:ring-crimson/15">
                <label htmlFor="ask-input" className="sr-only">Ask FlowMancer</label>
                <textarea id="ask-input" ref={input} rows={1} value={draft} maxLength={4000}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                  placeholder="Ask about your leads, emails, invoices..."
                  className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none" />
                <button type="submit" disabled={!draft.trim() || busy} aria-label="Send"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-crimson text-white shadow-ember transition hover:bg-crimson-500 disabled:opacity-40">
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-ash">
                <Kbd>Enter</Kbd> to send · <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> new line · <Kbd>Esc</Kbd> to close
              </p>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
