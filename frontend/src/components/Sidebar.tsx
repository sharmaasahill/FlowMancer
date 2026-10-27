'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, CheckSquare, History, LayoutDashboard, PlayCircle, Plug, Workflow, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/use-cases', icon: PlayCircle, label: 'Try it' },
  { href: '/workflows', icon: Workflow, label: 'Workflows' },
  { href: '/approvals', icon: CheckSquare, label: 'Approvals' },
  { href: '/history', icon: History, label: 'History' },
  { href: '/knowledge', icon: BookOpen, label: 'Knowledge' },
  { href: '/integrations', icon: Plug, label: 'Integrations' },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-gray-900 p-5 text-white">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <Zap className="h-7 w-7 text-blue-400" aria-hidden />
        <span className="text-xl font-bold">FlowMancer</span>
      </Link>
      <nav aria-label="Main" className="space-y-1">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                active ? 'bg-gray-800 font-semibold text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white',
              )}>
              <Icon className="h-5 w-5" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <p className="mt-auto rounded-lg bg-gray-800 p-3 text-xs text-gray-400">
        Multi-agent AI automation. Runs locally with Ollama.
      </p>
    </aside>
  );
}
