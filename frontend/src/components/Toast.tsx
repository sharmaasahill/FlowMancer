'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  tone: Tone;
  title: string;
  detail?: string;
}

const ToastContext = createContext<(t: Omit<Toast, 'id'>) => void>(() => {});

const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info };
const TONES = { success: 'text-jade', error: 'text-coral', info: 'text-blush' };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts.slice(-3), { ...t, id }]);
    setTimeout(() => dismiss(id), 5000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex w-[min(380px,calc(100vw-3rem))] flex-col gap-2"
        role="status" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const Icon = ICONS[t.tone];
            return (
              <motion.div key={t.id} layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="glass-strong pointer-events-auto flex items-start gap-3 rounded-2xl p-4">
                <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', TONES[t.tone])} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-bone">{t.title}</p>
                  {t.detail && <p className="mt-0.5 text-sm text-fog">{t.detail}</p>}
                </div>
                <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss"
                  className="rounded-full p-1 text-fog hover:bg-white/10 hover:text-bone">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
