import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import AppShell from '@/components/shell/AppShell';

const display = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-display' });
const sans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: { default: 'FlowMancer', template: '%s · FlowMancer' },
  description: 'AI that reads your leads, emails and documents, and proposes what to do next.',
};

export const viewport: Viewport = { themeColor: '#0E0A0B' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-bone focus:px-4 focus:py-2 focus:text-noir-900">
          Skip to content
        </a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
