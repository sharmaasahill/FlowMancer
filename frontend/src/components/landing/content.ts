/*
 * Real inputs and results from the live demo (the built-in Studio examples), used on the landing page.
 * Keep them in sync with what FlowMancer actually returns, so the page never overstates the product.
 */
export const REFUND_EMAIL = {
  from: 'rahul@customer.in',
  subject: 'Refund please',
  body: 'Hi, I bought the Pro plan 12 days ago but it does not fit our needs. Can I get my money back? How long will it take?',
};

export const REFUND_POLICY =
  'Customers on any paid plan can request a full refund within 30 days of purchase. Refunds are sent to the original payment method within 5–7 business days.';

export const REFUND_REPLY =
  'Hi Rahul, thank you for reaching out. Yes, you are eligible for a full refund since you purchased the Pro plan within the last 30 days. We will process your refund to your original payment method, which typically takes 5 to 7 business days to appear in your account. Let us know if you need help with anything else.';
