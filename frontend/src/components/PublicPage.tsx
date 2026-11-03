import Link from 'next/link';
import { HeaderAccount, WakeServer } from '@/components/landing/AccountLinks';
import Orb from '@/components/Orb';

export const CONTACT_EMAIL = 'flowmancer.sahil@gmail.com';
export const GITHUB_URL = 'https://github.com/sharmaasahill/FlowMancer';
export const LINKEDIN_URL = 'https://linkedin.com/in/sharmaasahill';

/** Page width used by every public section. */
export const WRAP = 'mx-auto w-full max-w-[1200px] px-6 sm:px-8';

const NAV = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#examples', label: 'Examples' },
  { href: '/#questions', label: 'Questions' },
];

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="FlowMancer home">
      <Orb size={22} />
      <span className="font-display text-[24px] leading-none text-bone">Flow<em className="text-blush">mancer</em></span>
    </Link>
  );
}

/** Layout for pages anyone can read without an account: the landing page, Privacy, Terms. */
export default function PublicPage({ children }: { children: React.ReactNode }) {
  const year = new Date().getFullYear();
  return (
    // Solid surface: covers the app's glowing backdrop, which suits the app but not a reading page
    <div className="relative min-h-[100dvh] bg-noir-950">
      <WakeServer />
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-noir-950">
        <div className={`${WRAP} flex h-16 items-center gap-8`}>
          <Wordmark />
          <nav className="hidden items-center gap-7 md:flex" aria-label="Sections">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-[14px] text-fog transition-colors hover:text-bone">{n.label}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <HeaderAccount />
          </div>
        </div>
      </header>

      <main id="main">{children}</main>

      <footer className="border-t border-white/[0.06]">
        <div className={`${WRAP} grid gap-12 py-16 md:grid-cols-12`}>
          <div className="md:col-span-5">
            <Wordmark />
            <p className="mt-4 max-w-[34ch] text-[14px] leading-relaxed text-fog">
              An AI assistant that reads leads, emails and invoices, and drafts the next step for a person to approve.
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-8 text-[14px] sm:grid-cols-3 md:col-span-7" aria-label="Footer">
            <div>
              <p className="font-semibold text-bone">Product</p>
              <ul className="mt-4 space-y-3 text-fog">
                {NAV.map((n) => <li key={n.href}><Link href={n.href} className="hover:text-bone">{n.label}</Link></li>)}
                <li><Link href="/login" className="hover:text-bone">Sign in</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-bone">Project</p>
              <ul className="mt-4 space-y-3 text-fog">
                <li><a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-bone">Source code</a></li>
                <li><a href={LINKEDIN_URL} target="_blank" rel="noreferrer" className="hover:text-bone">Sahil on LinkedIn</a></li>
                <li><a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-bone">Contact</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-bone">Legal</p>
              <ul className="mt-4 space-y-3 text-fog">
                <li><Link href="/privacy" className="hover:text-bone">Privacy policy</Link></li>
                <li><Link href="/terms" className="hover:text-bone">Terms of service</Link></li>
              </ul>
            </div>
          </nav>
        </div>
        <div className="border-t border-white/[0.06]">
          <p className={`${WRAP} py-6 text-[13px] text-ash`}>
            © {year} FlowMancer, a portfolio project by Sahil Kumar Sharma. Free demo, not for real customer data.
          </p>
        </div>
      </footer>
    </div>
  );
}

/** Readable long-form text for the policy pages. */
export function Prose({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto w-full max-w-[720px] px-6 py-16 sm:px-8 sm:py-24">
      <h1 className="font-display text-[48px] leading-[1.05] tracking-[-0.01em] text-bone">{title}</h1>
      <p className="mt-3 text-[14px] text-fog">Last updated {updated}</p>
      <div className="mt-10 space-y-5 border-t border-white/[0.08] pt-10 text-[16px] leading-[1.7] text-bone/85 [&_a]:text-blush [&_a]:underline-offset-4 [&_a:hover]:underline [&_h2]:pt-6 [&_h2]:text-[18px] [&_h2]:font-semibold [&_h2]:text-bone [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
        {children}
      </div>
    </article>
  );
}
