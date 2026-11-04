'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { REFUND_EMAIL, REFUND_REPLY } from '@/components/landing/content';

type State = 'pending' | 'approved' | 'rejected';

/** A working copy of the approval step. Nothing leaves the page: it shows what would happen. */
export default function ApprovalDemo() {
  const [state, setState] = useState<State>('pending');
  const [text, setText] = useState(REFUND_REPLY);
  const reset = () => { setState('pending'); setText(REFUND_REPLY); };

  return (
    <div className="overflow-hidden rounded-[20px] border border-white/[0.09] bg-[#0F0B0C]">
      <div className="flex h-12 items-center justify-between border-b border-white/[0.07] px-5 text-[13px] sm:px-6">
        <span className="font-semibold text-bone">Approvals</span>
        <span className="text-fog">{state === 'pending' ? '1 waiting' : 'Nothing waiting'}</span>
      </div>

      <div className="px-5 py-6 sm:px-6">
        <p className="text-[15px] font-semibold text-bone">Reply to {REFUND_EMAIL.from}</p>
        <p className="mt-1 text-[13px] text-fog">Re: {REFUND_EMAIL.subject} · drafted from the refund policy</p>
        <label htmlFor="approval-demo-reply" className="mt-5 block text-[12px] font-medium text-fog">
          Reply {state === 'pending' && <span className="text-ash">(you can edit this)</span>}
        </label>
        <textarea id="approval-demo-reply" value={text} onChange={(e) => setText(e.target.value)} rows={6}
          readOnly={state !== 'pending'}
          className="mt-2 w-full resize-none rounded-xl border border-white/[0.09] bg-noir-950/70 p-4 text-[14px] leading-[1.65] text-bone/90 outline-none transition-colors focus:border-blush/40 read-only:opacity-70" />
      </div>

      <div className="flex min-h-[68px] flex-wrap items-center gap-3 border-t border-white/[0.07] px-5 py-4 sm:px-6" aria-live="polite">
        {state === 'pending' && (
          <>
            <span className="text-[13px] text-fog">This is a demo. Nothing is sent.</span>
            <span className="ml-auto flex gap-2">
              <button type="button" onClick={() => setState('rejected')} className="btn-line !px-4 !py-2 !text-[13px]">Reject</button>
              <button type="button" onClick={() => setState('approved')} className="btn-solid !px-4 !py-2 !text-[13px]">Approve</button>
            </span>
          </>
        )}
        {state === 'approved' && (
          <>
            <Check className="h-4 w-4 shrink-0 text-jade" aria-hidden />
            <span className="text-[13px] text-bone">Saved to Gmail as a draft. You could also choose Send to reply straight away.</span>
            <button type="button" onClick={reset} className="ml-auto text-[13px] text-fog hover:text-bone">Start again</button>
          </>
        )}
        {state === 'rejected' && (
          <>
            <X className="h-4 w-4 shrink-0 text-coral" aria-hidden />
            <span className="text-[13px] text-bone">Rejected. Nothing was saved or sent.</span>
            <button type="button" onClick={reset} className="ml-auto text-[13px] text-fog hover:text-bone">Start again</button>
          </>
        )}
      </div>
    </div>
  );
}
