import Link from 'next/link';
import Orb from '@/components/Orb';

export const CONTACT_EMAIL = 'flowmancer.sahil@gmail.com';
export const GITHUB_URL = 'https://github.com/sharmaasahill/FlowMancer';

/** Layout for pages anyone can read without an account: About, Privacy, Terms. */
export default function PublicPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh]">
      <header className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-6">
        <Link href="/about" className="flex items-center gap-3">
          <Orb size={30} />
          <span className="font-display text-[26px] leading-none text-bone">Flow<em className="text-blush">mancer</em></span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm" aria-label="Site">
          <Link href="/about" className="btn-quiet hidden sm:inline-flex">About</Link>
          <Link href="/privacy" className="btn-quiet hidden sm:inline-flex">Privacy</Link>
          <Link href="/terms" className="btn-quiet hidden sm:inline-flex">Terms</Link>
          <Link href="/login" className="btn-primary !px-4 !py-2">Sign in</Link>
        </nav>
      </header>
      <main id="main" className="mx-auto max-w-5xl px-6 pb-16">{children}</main>
      <footer className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.06] px-6 py-8 text-xs text-fog">
        <span>© {new Date().getFullYear()} FlowMancer · built by Sahil Kumar Sharma</span>
        <Link href="/about" className="hover:text-bone">About</Link>
        <Link href="/privacy" className="hover:text-bone">Privacy policy</Link>
        <Link href="/terms" className="hover:text-bone">Terms of service</Link>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-bone">Source on GitHub</a>
        <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-bone">{CONTACT_EMAIL}</a>
      </footer>
    </div>
  );
}

/** Readable long-form text block for the policy pages. */
export function Prose({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="glass mx-auto max-w-3xl p-8 sm:p-10">
      <p className="eyebrow mb-3">Last updated {updated}</p>
      <h1 className="font-display text-[44px] leading-tight text-bone">{title}</h1>
      <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-bone/85 [&_a]:text-blush [&_a:hover]:underline [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-bone [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </article>
  );
}
