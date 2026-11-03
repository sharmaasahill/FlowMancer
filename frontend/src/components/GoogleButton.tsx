'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

/* Minimal typing for the OAuth part of Google Identity Services (https://accounts.google.com/gsi/client) */
interface TokenResponse { access_token?: string; error?: string; error_description?: string }
interface TokenClient { requestAccessToken: (override?: Record<string, unknown>) => void }
declare global {
  interface Window {
    google?: { accounts?: { oauth2?: { initTokenClient: (config: Record<string, unknown>) => TokenClient } } };
  }
}

/** Google's standard four-colour "G" (it must not be recoloured). */
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * "Sign in with Google" drawn by FlowMancer, so it matches the page instead of Google's iframe
 * (which can't be restyled and switches to a white personalised button). It follows Google's
 * dark-theme rules: fill #131314, 1px #8E918F outline, #E3E3E3 text, the standard colour "G".
 * Clicking opens Google's own sign-in popup; the backend checks the token with Google.
 */
export default function GoogleButton({ clientId, onAccessToken, onError, label = 'Continue with Google', disabled }: {
  clientId: string;
  onAccessToken: (accessToken: string) => void;
  onError: (message: string) => void;
  label?: string;
  disabled?: boolean;
}) {
  const client = useRef<TokenClient | null>(null);
  const [ready, setReady] = useState(false);
  const handlers = useRef({ onAccessToken, onError });
  handlers.current = { onAccessToken, onError };

  useEffect(() => {
    const oauth2 = window.google?.accounts?.oauth2;
    if (!ready || !oauth2) return;
    client.current = oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      callback: (r: TokenResponse) => {
        if (r.access_token) handlers.current.onAccessToken(r.access_token);
        else if (r.error !== 'access_denied') handlers.current.onError(r.error_description || 'Google sign-in failed. Please try again.');
      },
      error_callback: (e: { type?: string }) => {
        if (e?.type === 'popup_closed') return; // the person closed Google's window
        handlers.current.onError(e?.type === 'popup_failed_to_open'
          ? 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.'
          : 'Google sign-in failed. Please try again.');
      },
    });
  }, [ready, clientId]);

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive"
        onReady={() => setReady(true)}
        onError={() => handlers.current.onError('Could not load Google sign-in. Check your connection or ad blocker.')} />
      <button type="button" disabled={disabled || !ready}
        onClick={() => client.current?.requestAccessToken({ prompt: 'select_account' })}
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-[#8E918F] bg-[#131314] px-5 text-[14px] font-medium leading-5 text-[#E3E3E3] transition-colors duration-150 hover:bg-[#1F1F21] disabled:cursor-default disabled:opacity-60"
        style={{ fontFamily: "'Google Sans', Roboto, var(--font-sans), sans-serif" }}>
        <GoogleLogo />
        <span>{label}</span>
      </button>
    </>
  );
}
