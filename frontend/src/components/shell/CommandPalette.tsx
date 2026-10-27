'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, CornerDownLeft, FileText, Mail, MessageCircle, Plus, Search, Upload, Users } from 'lucide-react';
import { NAV } from '@/components/shell/nav';
import { Kbd } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Command {
  id: string;
  label: string;
  group: string;
  href?: string;
  run?: 'ask';
  keywords: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ACTIONS: Command[] = [
  { id: 'a-ask', group: 'Actions', label: 'Ask FlowMancer', run: 'ask', keywords: 'assistant chat question ai help', icon: MessageCircle },
  { id: 'a-lead', group: 'Actions', label: 'Qualify a lead', href: '/studio?kind=lead', keywords: 'score sales', icon: Users },
  { id: 'a-email', group: 'Actions', label: 'Process an email', href: '/studio?kind=email', keywords: 'reply inbox', icon: Mail },
  { id: 'a-doc', group: 'Actions', label: 'Process a document', href: '/studio?kind=document', keywords: 'invoice receipt pdf', icon: FileText },
  { id: 'a-wf', group: 'Actions', label: 'New workflow', href: '/workflows?new=1', keywords: 'automation create', icon: Plus },
  { id: 'a-kb', group: 'Actions', label: 'Add to knowledge base', href: '/knowledge', keywords: 'upload policy faq', icon: Upload },
];

const PAGES: Command[] = NAV.flatMap((s) => s.items.map((i) => ({
  id: `p-${i.href}`, group: 'Go to', label: i.label, href: i.href, keywords: i.keywords, icon: i.icon,
})));

export default function CommandPalette({ open, onClose, onAsk }: { open: boolean; onClose: () => void; onAsk: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = [...ACTIONS, ...PAGES];
    return q ? all.filter((c) => `${c.label} ${c.keywords}`.toLowerCase().includes(q)) : all;
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  const run = (c: Command) => {
    onClose();
    if (c.run === 'ask') onAsk();
    else if (c.href) router.push(c.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[index]) {
      e.preventDefault();
      run(results[index]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  let lastGroup = '';
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[14vh]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-noir-950/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <motion.div role="dialog" aria-modal="true" aria-label="Command palette"
            initial={{ opacity: 0, y: -12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="glass-strong relative w-full max-w-xl overflow-hidden">
            <div className="flex items-center gap-3 border-b border-white/[0.07] px-5">
              <Search className="h-4 w-4 text-fog" aria-hidden />
              <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKeyDown}
                role="combobox" aria-expanded="true" aria-controls="palette-list"
                aria-activedescendant={results[index] ? `cmd-${results[index].id}` : undefined}
                placeholder="Search pages and actions..." aria-label="Search"
                className="h-14 flex-1 bg-transparent text-[15px] outline-none" />
              <Kbd>Esc</Kbd>
            </div>
            <ul id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
              {results.length === 0 && <li className="px-4 py-8 text-center text-sm text-fog">No matches</li>}
              {results.map((c, i) => {
                const header = c.group !== lastGroup ? c.group : null;
                lastGroup = c.group;
                const Icon = c.icon;
                return (
                  <li key={c.id} role="presentation">
                    {header && <p className="eyebrow px-3 pb-1 pt-3 !text-[10px]">{header}</p>}
                    <div id={`cmd-${c.id}`} role="option" aria-selected={i === index}
                      onMouseEnter={() => setIndex(i)} onClick={() => run(c)}
                      className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm',
                        i === index ? 'bg-crimson/20 text-bone' : 'text-fog')}>
                      <span className={cn('grid h-8 w-8 place-items-center rounded-lg border',
                        i === index ? 'border-crimson-400/40 bg-crimson/30 text-white' : 'border-white/[0.07] bg-white/[0.03]')}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 font-medium">{c.label}</span>
                      {i === index
                        ? <CornerDownLeft className="h-4 w-4 text-blush" aria-hidden />
                        : <ArrowUpRight className="h-4 w-4 opacity-0" aria-hidden />}
                    </div>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
