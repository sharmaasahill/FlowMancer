import type { Metadata } from 'next';

// The link carries a one-time token, so don't pass the address on to other sites or search engines
export const metadata: Metadata = {
  title: 'Choose a new password',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
