import { BookOpen, CheckSquare, History, LayoutGrid, Plug, Sparkles, Workflow } from 'lucide-react';

export const NAV = [
  {
    group: 'Workspace',
    items: [
      { href: '/', label: 'Overview', icon: LayoutGrid, keywords: 'dashboard home stats' },
      { href: '/studio', label: 'Studio', icon: Sparkles, keywords: 'try run lead email document process' },
      { href: '/history', label: 'History', icon: History, keywords: 'runs past results' },
    ],
  },
  {
    group: 'Automation',
    items: [
      { href: '/workflows', label: 'Workflows', icon: Workflow, keywords: 'builder automation graph' },
      { href: '/approvals', label: 'Approvals', icon: CheckSquare, keywords: 'review queue approve reject', badge: true },
      { href: '/knowledge', label: 'Knowledge', icon: BookOpen, keywords: 'documents policy faq rag' },
    ],
  },
  {
    group: 'System',
    items: [{ href: '/integrations', label: 'Integrations', icon: Plug, keywords: 'slack hubspot inbox settings' }],
  },
];

export const isActive = (pathname: string, href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
