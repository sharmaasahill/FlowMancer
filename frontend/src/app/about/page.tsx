import type { Metadata } from 'next';
import LandingPage from '@/app/page';

// /about shows the landing page too (it is the home page registered with Google sign-in).
export const metadata: Metadata = {
  title: 'About',
  description: 'What FlowMancer is, how it works, and why a person approves every reply and CRM update.',
  alternates: { canonical: '/' },
};

export default LandingPage;
