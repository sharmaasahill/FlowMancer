import type { Kind } from '@/types';

export interface Example {
  label: string;
  values: Record<string, string>;
}

/** Ready-made inputs for demos. Values match the Studio form fields. */
export const EXAMPLES: Record<Kind, Example[]> = {
  lead: [
    {
      label: 'Enterprise, budget approved',
      values: {
        name: 'Priya Sharma', email: 'priya@stripe.com', company: 'Stripe', phone: '',
        message: 'I lead sales ops. We want to automate lead routing for our 300-person sales team this quarter. Budget is approved.',
      },
    },
    {
      label: 'Small agency, exploring',
      values: {
        name: 'Arjun Mehta', email: 'arjun@brightpixel.io', company: 'BrightPixel', phone: '',
        message: 'We are a 25-person design agency. Thinking about automating our client inbox sometime this year. What does it cost?',
      },
    },
    {
      label: 'Just browsing',
      values: { name: 'Sam', email: 'sam1990@gmail.com', company: '', phone: '', message: 'just looking around, maybe later' },
    },
  ],
  email: [
    {
      label: 'Refund request',
      values: {
        from_email: 'rahul@customer.in', subject: 'Refund please',
        body: 'Hi, I bought the Pro plan 12 days ago but it does not fit our needs. Can I get my money back? How long will it take?',
      },
    },
    {
      label: 'Production outage',
      values: {
        from_email: 'ops@bigclient.com', subject: 'Production down!',
        body: 'Your dashboard has returned 500 errors for the last hour. Our whole team is blocked. Urgent.',
      },
    },
    {
      label: 'Obvious spam',
      values: {
        from_email: 'seo@rankfast.biz', subject: 'Get 1st page Google ranking!!!',
        body: 'Dear Sir, we offer guaranteed backlinks and SEO. 90% discount today only. Click here to buy now.',
      },
    },
  ],
  document: [
    {
      label: 'Invoice with GST',
      values: {
        document_type: 'auto',
        file_content: 'INVOICE #INV-2026-118\nFrom: Acme Cloud Services Pvt Ltd\nTo: FlowMancer Inc\nDate: 2026-10-01\nDue: 2026-10-31\n\n3 x Server licence @ 1,500.00 = 4,500.00\nSupport plan = 500.00\nSubtotal 5,000.00\nGST 18% 900.00\nTOTAL DUE: INR 5,900.00',
      },
    },
    {
      label: "Total doesn't add up",
      values: {
        document_type: 'auto',
        file_content: 'INVOICE 77\nVendor: Paper Co\nDate 2026-09-12\n2 x Paper box @ 40.00 = 80.00\n1 x Toner @ 60.00 = 60.00\nTOTAL: USD 400.00',
      },
    },
    {
      label: 'Coffee receipt',
      values: {
        document_type: 'auto',
        file_content: 'Starbucks Store 4411\n2026-10-15 08:12\nLatte 4.50\nMuffin 3.25\nTotal 7.75 USD\nPaid VISA ****1234',
      },
    },
  ],
};

export const EMPTY_VALUES: Record<Kind, Record<string, string>> = {
  lead: { name: '', email: '', company: '', phone: '', message: '' },
  email: { from_email: '', subject: '', body: '' },
  document: { document_type: 'auto', file_content: '' },
};
