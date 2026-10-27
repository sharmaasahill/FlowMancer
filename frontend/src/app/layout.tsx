import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FlowMancer - AI-Powered Automation Platform',
  description: 'Intelligent workflow orchestration with multi-agent AI systems',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
          Skip to content
        </a>
        <div className="flex min-h-screen">
          <Sidebar />
          <main id="main" className="min-w-0 flex-1 bg-gray-50 p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
