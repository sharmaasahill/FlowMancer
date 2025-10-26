import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Zap, LayoutDashboard, Workflow, FileText } from 'lucide-react';
import Link from 'next/link';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FlowMancer - AI-Powered Automation Platform',
  description: 'Intelligent workflow orchestration with multi-agent AI systems',
};

function Sidebar() {
  const navItems = [
    { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/workflows', icon: Workflow, label: 'Workflows' },
    { href: '/use-cases', icon: FileText, label: 'Use Cases' },
  ];

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen p-6">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <Zap className="w-8 h-8 text-blue-400" />
        <span className="text-2xl font-bold">FlowMancer</span>
      </div>

      {/* Navigation */}
      <nav className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition"
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-6 left-6 right-6">
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-sm font-semibold mb-1">AI-Powered</p>
          <p className="text-xs text-gray-400">
            Multi-agent workflow automation
          </p>
        </div>
      </div>
    </aside>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex">
          <Sidebar />
          <main className="flex-1 bg-gray-50 p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

