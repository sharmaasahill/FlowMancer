'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

/* Minimal typing for Google Identity Services (https://accounts.google.com/gsi/client) */
interface GoogleId {
  initialize: (options: Record<string, unknown>) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
}
declare global {
  interface Window { google?: { accounts?: { id?: GoogleId } } }
}

const gis = () => (typeof window === 'undefined' ? undefined : window.google?.accounts?.id);

/**
 * Google's own "Sign in with Google" button. Google shows its sign-in popup and hands back
 * an ID token (`credential`), which the backend verifies before creating a session.
 */
export default function GoogleButton({ clientId, onCredential, onError, text = 'continue_with' }: {
  clientId: string;
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
}) {
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(() => !!gis());
  const handlers = useRef({ onCredential, onError });
  handlers.current = { onCredential, onError };

  useEffect(() => {
    const id = gis();
    if (!ready || !id || !box.current) return;
    id.initialize({
      client_id: clientId,
      ux_mode: 'popup',
      context: 'signin',
      callback: (response: { credential?: string }) => {
        if (response.credential) handlers.current.onCredential(response.credential);
        else handlers.current.onError('Google did not return a sign-in token. Please try again.');
      },
    });
    box.current.innerHTML = '';
    id.renderButton(box.current, {
      type: 'standard', theme: 'filled_black', size: 'large', shape: 'pill', text, logo_alignment: 'center',
      width: Math.min(400, Math.max(220, box.current.offsetWidth)),
    });
  }, [ready, clientId, text]);

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive"
        onReady={() => setReady(true)}
        onError={() => handlers.current.onError('Could not load Google sign-in. Check your connection or ad blocker.')} />
      <div ref={box} className="flex min-h-[44px] w-full justify-center" aria-label="Sign in with Google" />
    </>
  );
}
