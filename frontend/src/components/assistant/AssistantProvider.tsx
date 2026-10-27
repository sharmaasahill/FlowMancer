'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { assistantApi, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSystem } from '@/lib/system';
import type { ChatTurn } from '@/types';

interface AssistantState {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  turns: ChatTurn[];
  busy: boolean;
  send: (text: string) => Promise<void>;
  reset: () => void;
}

const AssistantContext = createContext<AssistantState>({
  open: false, setOpen: () => {}, toggle: () => {}, turns: [], busy: false, send: async () => {}, reset: () => {},
});

const MAX_SENT = 20;

/** Conversation state for the Ask FlowMancer panel (kept for the browser session, per account). */
export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { refresh } = useSystem();
  const storageKey = user ? `flowmancer.chat.${user.id}` : null;
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const turnsRef = useRef<ChatTurn[]>([]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
      setTurns(Array.isArray(saved) ? saved : []);
    } catch {
      setTurns([]);
    }
  }, [storageKey]);

  useEffect(() => {
    turnsRef.current = turns;
    if (storageKey) sessionStorage.setItem(storageKey, JSON.stringify(turns.slice(-40)));
  }, [turns, storageKey]);

  const send = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const next: ChatTurn[] = [...turnsRef.current, { role: 'user', content }];
    setTurns(next);
    setBusy(true);
    try {
      const history = next.filter((t) => !t.error).slice(-MAX_SENT).map(({ role, content: c }) => ({ role, content: c }));
      const r = await assistantApi.chat(history);
      setTurns((t) => [...t, { role: 'assistant', content: r.reply, tools: r.tools, approvals: r.approvals }]);
      if (r.approvals.length) refresh();
    } catch (e) {
      setTurns((t) => [...t, { role: 'assistant', content: errorMessage(e), error: true }]);
    } finally {
      setBusy(false);
    }
  }, [busy, refresh]);

  const reset = useCallback(() => setTurns([]), []);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  return (
    <AssistantContext.Provider value={{ open, setOpen, toggle, turns, busy, send, reset }}>
      {children}
    </AssistantContext.Provider>
  );
}

export const useAssistant = () => useContext(AssistantContext);
