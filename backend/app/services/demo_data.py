"""
Sample data for the demo account and the "Load sample data" button.

A fictional Pune software company, Brightline Software Pvt Ltd, and three days of the leads,
emails and documents it might get. Every person, company, GSTIN and account number is made up.

Times are (days ago, local time). Dates inside texts use {date:N} / {iso:N}: N days from the
item's own time, written DD-MM-YYYY / YYYY-MM-DD, so the data never looks stale.
"""
DEMO_NAME = "Neha Kulkarni"
AI_MODEL = "gemini-3.5-flash-lite (Gemini)"
SIGN_OFF = "Regards,\nNeha\nCustomer Support, Brightline Software"

KNOWLEDGE = [
    ("Refund policy.md", """# Refund policy (Brightline Software)

Full refund within 30 days of purchase on any plan, no questions asked. Refunds go back to the original
payment method (card, UPI or bank transfer) within 5-7 business days after billing approves them.

After 30 days we don't refund, but we can give account credit for the unused months.

Invoices: GSTIN, company name or billing address can be corrected on invoices issued in the last 60 days.
Billing sends the revised invoice by email within 2 business days."""),
    ("Pricing 2026.md", """# Pricing 2026

Starter: Rs 1,499 per user per month, up to 10 users, email and form automation.
Growth: Rs 2,999 per user per month, unlimited workflows, HubSpot sync, priority support.
Enterprise: custom pricing for 100+ users, SSO, dedicated success manager, on-site onboarding.

All prices exclude 18% GST. Annual billing: 2 months free.
NGOs and educational institutions get 20% off any plan. Free 14-day trial on Starter and Growth."""),
    ("Support SLA.md", """# Support hours and SLA

Support hours: Monday to Saturday, 9:30 am to 7 pm IST.
P1 (product down for many users): first response within 1 hour, 24x7.
P2 (a feature broken, workaround exists): response within 8 business hours.
P3 (questions, requests): response within 2 business days.

Password reset links expire after 30 minutes. Reset emails sometimes land in Spam or Promotions;
ask the customer to check there first, then send a new link."""),
]

WORKFLOWS = [
    {
        "name": "Hot lead alert",
        "description": "Website form lead: score it. Hot leads go to Slack and a CRM approval.",
        "config": {
            "nodes": [
                {"id": "trigger", "type": "trigger", "position": {"x": 250, "y": 0},
                 "data": {"trigger": "form", "label": "Website form"}},
                {"id": "score", "type": "ai", "position": {"x": 250, "y": 110},
                 "data": {"task": "lead", "mode": "quick", "label": "Qualify lead"}},
                {"id": "hot", "type": "condition", "position": {"x": 250, "y": 230},
                 "data": {"field": "lead_score", "operator": "gte", "value": "80", "label": "Score 80+?"}},
                {"id": "slack", "type": "action", "position": {"x": 60, "y": 370},
                 "data": {"action": "slack", "label": "Alert sales",
                          "text": "Hot lead: {input.name} ({input.company}) scored {result.lead_score}. "
                                  "{result.recommended_action}"}},
                {"id": "crm", "type": "action", "position": {"x": 60, "y": 480},
                 "data": {"action": "approval", "approval_action": "crm_contact", "label": "Approve CRM contact"}},
            ],
            "edges": [
                {"id": "trigger-out-score", "source": "trigger", "target": "score", "sourceHandle": None},
                {"id": "score-out-hot", "source": "score", "target": "hot", "sourceHandle": None},
                {"id": "hot-true-slack", "source": "hot", "target": "slack", "sourceHandle": "true"},
                {"id": "slack-out-crm", "source": "slack", "target": "crm", "sourceHandle": None},
            ],
        },
    },
    {
        "name": "Support inbox triage",
        "description": "Every unread email: classify it, alert Slack if urgent, and queue the reply for approval.",
        "config": {
            "nodes": [
                {"id": "trigger", "type": "trigger", "position": {"x": 250, "y": 0},
                 "data": {"trigger": "inbox", "label": "New email"}},
                {"id": "triage", "type": "ai", "position": {"x": 250, "y": 110},
                 "data": {"task": "email", "mode": "quick", "label": "Triage email"}},
                {"id": "spam", "type": "condition", "position": {"x": 250, "y": 230},
                 "data": {"field": "category", "operator": "neq", "value": "spam", "label": "Not spam?"}},
                {"id": "urgent", "type": "condition", "position": {"x": 250, "y": 360},
                 "data": {"field": "priority", "operator": "eq", "value": "urgent", "label": "Urgent?"}},
                {"id": "alert", "type": "action", "position": {"x": 60, "y": 490},
                 "data": {"action": "slack", "label": "Alert support",
                          "text": "Urgent email from {input.from_email}: {input.subject}. {result.summary}"}},
                {"id": "reply", "type": "action", "position": {"x": 440, "y": 490},
                 "data": {"action": "approval", "approval_action": "email_reply", "label": "Approve reply"}},
                {"id": "reply2", "type": "action", "position": {"x": 60, "y": 600},
                 "data": {"action": "approval", "approval_action": "email_reply", "label": "Approve reply"}},
            ],
            "edges": [
                {"id": "trigger-out-triage", "source": "trigger", "target": "triage", "sourceHandle": None},
                {"id": "triage-out-spam", "source": "triage", "target": "spam", "sourceHandle": None},
                {"id": "spam-true-urgent", "source": "spam", "target": "urgent", "sourceHandle": "true"},
                {"id": "urgent-true-alert", "source": "urgent", "target": "alert", "sourceHandle": "true"},
                {"id": "alert-out-reply2", "source": "alert", "target": "reply2", "sourceHandle": None},
                {"id": "urgent-false-reply", "source": "urgent", "target": "reply", "sourceHandle": "false"},
            ],
        },
    },
]


def _lead(name, email, company, phone, message, breakdown, reasoning, priority, team, action, points,
          knowledge=()):
    return {
        "kind": "lead", "source": "form", "knowledge": list(knowledge),
        "input": {"name": name, "email": email, "company": company, "phone": phone, "message": message,
                  "source": "website_form"},
        "output": {"company_summary": "", "score_breakdown": dict(zip(
            ("company_size", "industry_fit", "budget", "urgency", "decision_maker", "intent"), breakdown)),
            "reasoning": reasoning, "priority": priority, "assigned_to": team, "recommended_action": action,
            "talking_points": points},
    }


def _email(sender, subject, body, summary, category, sentiment, priority, team, tags, reply,
           language="English", knowledge=(), message_id=None):
    return {
        "kind": "email", "source": "inbox", "knowledge": list(knowledge),
        "input": {"from_email": sender, "subject": subject, "body": body, "message_id": message_id},
        "output": {"summary": summary, "category": category, "sentiment": sentiment, "priority": priority,
                   "action_required": category != "spam", "assigned_team": team, "tags": tags,
                   "language": language, "draft_reply": reply},
    }


def _document(file_name, content, **output):
    return {"kind": "document", "source": "upload", "knowledge": [],
            "input": {"document_type": "auto", "file_name": file_name, "file_content": content},
            "output": output}


RUNS = [
    ((3, "10:05"), _document(
        "SGCS-2026-0387.pdf",
        """TAX INVOICE
Shree Ganesh Cloud Services Pvt Ltd
Office 604, Pentagon Tower 2, Magarpatta City, Pune 411013
GSTIN: 27AAGCS7841K1Z6

Invoice No: SGCS/2026/0387
Invoice Date: {date:-2}
Due Date: {date:28}

Bill To: Brightline Software Pvt Ltd, Baner, Pune 411045 (GSTIN 27AAHCB2290Q1Z8)

Description                                      Amount (INR)
Managed cloud hosting (4 servers)                  42,000.00
Daily backups and monitoring                        8,000.00
Sub-total                                          50,000.00
CGST @ 9%                                           4,500.00
SGST @ 9%                                           4,500.00
Total                                              59,000.00

Rupees Fifty-Nine Thousand Only
Payment terms: Net 30. HDFC Bank, A/c 50200012345678, IFSC HDFC0000123""",
        summary="Tax invoice from Shree Ganesh Cloud Services for managed hosting and backups: Rs 59,000 "
                "including 18% GST.",
        document_type="invoice", counterparty="Shree Ganesh Cloud Services Pvt Ltd",
        document_number="SGCS/2026/0387", issue_date="{iso:-2}", due_date="{iso:28}",
        line_items=[{"description": "Managed cloud hosting (4 servers)", "amount": 42000.0},
                    {"description": "Daily backups and monitoring", "amount": 8000.0}],
        tax_amount=9000.0, total_amount=59000.0, currency="INR",
        fields=[{"name": "Vendor GSTIN", "value": "27AAGCS7841K1Z6"},
                {"name": "Payment terms", "value": "Net 30"},
                {"name": "Bank", "value": "HDFC Bank, IFSC HDFC0000123"}],
        ai_notes=["CGST and SGST at 9% each, which fits a supplier in the same state (Maharashtra)"],
        next_steps=["Match against the hosting purchase order", "Schedule payment before the due date"])),

    ((3, "11:40"), _lead(
        "Rohit Khanna", "rohit@kraftwala.in", "Kraftwala", "+91 98290 41753",
        "Hi, we sell hand block-printed bedsheets and cushion covers from Jaipur on our own website and on "
        "Amazon. Team of 14. I look after operations. Just exploring tools to handle customer emails and "
        "order queries better. No budget fixed yet, maybe next year.",
        (8, 10, 0, 0, 5, 5),
        "A 14-person D2C business with a real but early need. No budget or timeline, and he is exploring "
        "rather than buying.",
        "low", "Nurture", "Add to the nurture list and send the Starter plan overview with the free trial link.",
        ["Starter plan covers up to 10 users at Rs 1,499 per user", "Free 14-day trial to test order queries"],
        knowledge=[("Pricing 2026.md", 0.58)])),

    ((3, "15:20"), _email(
        "karthik@nexgenconsulting.in", "Reseller partnership for Tamil Nadu",
        "Hi,\n\nI run NexGen Consulting in Chennai. We implement Zoho and Tally for about 60 SME clients across "
        "Tamil Nadu, and many of them ask us about automating customer emails. We'd like to explore becoming a "
        "reseller or implementation partner for Brightline.\n\nCould we set up a call with your partnerships "
        "team next week?\n\nBest,\nKarthik Subramanian\nFounder, NexGen Consulting",
        "Karthik Subramanian of NexGen Consulting, a Chennai implementation firm with about 60 SME clients, "
        "wants to discuss a reseller partnership.",
        "partnership", "positive", "medium", "Partnerships", ["reseller", "partnership", "Tamil Nadu"],
        "Hi Karthik,\n\nThank you for reaching out. A partner who already works with 60 SME clients across "
        "Tamil Nadu sounds like a good fit, and I'll pass your note to our partnerships team so they can "
        "set up a call with you next week.\n\nTo help them prepare, could you share which industries most of "
        "your clients are in and roughly how many might be interested?\n\n" + SIGN_OFF,
        message_id="<CAK3n7x-0912@mail.gmail.com>")),

    ((3, "17:55"), _document(
        "Annapurna-AC1187.jpg",
        """Annapurna Caterers
Near Balewadi High Street, Pune
Bill No: AC/1187     Date: {date:0}

Team lunch - 6 veg thalis @ 140        840.00
Total                                  840.00

Composition dealer, GST not charged. Thank you, visit again!""",
        summary="Lunch bill from Annapurna Caterers for 6 veg thalis, Rs 840.",
        document_type="receipt", counterparty="Annapurna Caterers", document_number="AC/1187",
        issue_date="{iso:0}", due_date=None,
        line_items=[{"description": "Team lunch - 6 veg thalis @ 140", "amount": 840.0}],
        tax_amount=None, total_amount=840.0, currency="INR",
        fields=[{"name": "GST", "value": "Not charged (composition dealer)"}],
        ai_notes=[], next_steps=["File under team meals expenses"])),

    ((2, "09:50"), _email(
        "accounts@sharmaandsons.co.in", "GSTIN missing on invoice INV-2026-1043",
        "Dear Sir/Madam,\n\nOur invoice INV-2026-1043 from last month does not show our GSTIN, so we can't "
        "claim input tax credit. Please issue a corrected invoice with GSTIN 27AAKFS4521M1Z3.\n\nThanks & "
        "regards,\nPooja Sharma\nAccounts, Sharma & Sons Traders, Pune",
        "Pooja Sharma from Sharma & Sons Traders needs invoice INV-2026-1043 reissued with their GSTIN to "
        "claim input tax credit.",
        "billing", "neutral", "medium", "Billing", ["invoice", "GST", "correction"],
        "Dear Pooja,\n\nThank you for pointing this out. GSTIN corrections can be made on invoices issued in "
        "the last 60 days, so INV-2026-1043 qualifies.\n\nOur billing team will issue a revised invoice "
        "showing GSTIN 27AAKFS4521M1Z3 and email it to you within 2 business days. Please let us know if the "
        "billing address also needs a change.\n\n" + SIGN_OFF,
        knowledge=[("Refund policy.md", 0.66)], message_id="<20261014094712.4471@sharmaandsons.co.in>")),

    ((2, "11:15"), _lead(
        "Meenakshi Sundaram", "meenakshi.s@sundaramtextiles.com", "Sundaram Textiles", "+91 94433 21870",
        "I'm the CFO at Sundaram Textiles, Coimbatore (about 1,100 staff across 3 spinning mills). We process "
        "around 900 supplier invoices a month and our accounts team keeps finding GST mismatches after "
        "payment. Looking for something that checks invoices before they reach me for approval. We'll evaluate "
        "2-3 tools over the next few months; budget will be decided after that.",
        (25, 15, 10, 8, 10, 10),
        "Large manufacturer with a clear invoice-checking need and the CFO as buyer. Budget isn't set and the "
        "evaluation runs over a few months, so it isn't urgent.",
        "medium", "Enterprise sales",
        "Send a short case note on pre-payment GST checks and offer a demo with their own sample invoices.",
        ["900 supplier invoices a month with GST mismatches found after payment",
         "Invoices are checked and flagged before they reach the CFO",
         "Enterprise plan for 100+ users with on-site onboarding"],
        knowledge=[("Pricing 2026.md", 0.61)])),

    ((2, "13:30"), _email(
        "offers@instaboost-pro.biz", "Get 10K Instagram followers - festive offer Rs 999 only!!!",
        "Dear Business Owner,\n\nBoost your brand this season! Get 10,000 real Instagram followers in just "
        "48 hours for only Rs 999. 100% safe, no password needed. Limited offer: pay on UPI and get 2,000 "
        "likes FREE.\n\nClick here: http://instaboost-pro.biz/offer\n\nTeam InstaBoost",
        "Unsolicited offer to buy Instagram followers.",
        "spam", "neutral", "low", "None", ["spam", "marketing"], "")),

    ((2, "16:10"), _lead(
        "Kavya Reddy", "kavya.reddy2004@gmail.com", None, None,
        "Hi, I am a final year B.Tech student at JNTU Hyderabad doing a project on AI agents. Can I get free "
        "access for my college project? Also do you have any internships?",
        (0, 0, 0, 0, 0, 2),
        "A student asking for free access and internships. No company, budget or buying intent.",
        "low", "Nurture", "Reply with the free trial link and the careers page.",
        ["Free 14-day trial is enough for a college project", "Internships are listed on the careers page"])),

    ((2, "18:25"), _document(
        "Leave-and-licence-Koramangala.pdf",
        """LEAVE AND LICENCE AGREEMENT

This agreement is made at Bengaluru on {date:-1} between Mrs. Lakshmi Narayan, residing at 14, 3rd Cross,
Jayanagar 4th Block, Bengaluru 560011 ("Licensor"), and Brightline Software Pvt Ltd, Baner, Pune 411045
("Licensee").

1. Premises: 2nd floor, No. 82, 5th Block, Koramangala, Bengaluru 560095, about 2,400 sq ft.
2. Term: 11 months starting {date:14}.
3. Licence fee: Rs 1,85,000 per month, payable by the 5th of each month.
4. Security deposit: Rs 11,10,000 (six months' fee), interest-free, refundable within 30 days of handover.
5. Lock-in: 6 months. After the lock-in either party may end the agreement with 2 months' written notice.
6. Maintenance charges of Rs 12,000 per month and electricity are payable by the Licensee.
7. The Licensee will not sublet the premises.""",
        summary="11-month leave and licence agreement for a 2,400 sq ft office in Koramangala at Rs 1,85,000 a "
                "month with a Rs 11,10,000 deposit.",
        document_type="contract", counterparty="Mrs. Lakshmi Narayan", document_number=None,
        issue_date="{iso:-1}", due_date=None, line_items=[], tax_amount=None, total_amount=185000.0,
        currency="INR",
        fields=[{"name": "Premises", "value": "2nd floor, No. 82, 5th Block, Koramangala, about 2,400 sq ft"},
                {"name": "Term", "value": "11 months from {date:14}"},
                {"name": "Licence fee", "value": "Rs 1,85,000 per month"},
                {"name": "Security deposit", "value": "Rs 11,10,000, refundable within 30 days"},
                {"name": "Lock-in", "value": "6 months, then 2 months' notice"}],
        ai_notes=["Maintenance (Rs 12,000 a month) and electricity are extra",
                  "No rent escalation clause for this term"],
        next_steps=["Legal to review the lock-in and notice clauses",
                    "Confirm stamp duty and registration with the licensor"])),

    ((1, "09:35"), _email(
        "rahul.deshpande@brightpath.co.in", "Refund for Growth plan",
        "Hi team,\n\nWe bought the Growth plan for 5 users 12 days ago (order BL-58213), but our team has "
        "decided to stay with our current tool for now. Can we get a refund? The payment was made by company "
        "credit card.\n\nRegards,\nRahul Deshpande\nBrightPath Learning, Nagpur",
        "Rahul Deshpande from BrightPath Learning wants a refund for the Growth plan bought 12 days ago.",
        "billing", "neutral", "high", "Billing", ["refund", "growth plan"],
        "Hi Rahul,\n\nThank you for letting us know. You bought the Growth plan 12 days ago, which is within "
        "our 30-day refund window, so you're eligible for a full refund.\n\nOnce our billing team approves "
        "it, the amount will go back to the same company credit card within 5-7 business days, and we'll "
        "confirm by email.\n\nIf anything didn't work for your team, we'd value a line of feedback.\n\n"
        + SIGN_OFF,
        knowledge=[("Refund policy.md", 0.74)], message_id="<CAF9r2-58213@mail.gmail.com>")),

    ((1, "10:20"), _lead(
        "Imran Qureshi", "imran@qureshicoldchain.com", "Qureshi Cold Chain", "+91 99490 66218",
        "We run cold storage and reefer trucks between Hyderabad and Vijayawada, 90 staff. Our dispatch team "
        "handles booking requests over email and it's getting messy. Want to understand pricing for around "
        "15 users. Not urgent, sometime this year.",
        (15, 10, 0, 8, 7, 10),
        "Mid-size logistics firm with a specific email-booking problem and a clear user count. No budget yet "
        "and the timeline is this year.",
        "medium", "Mid-market sales",
        "Send Growth plan pricing for 15 users with the annual billing option and offer a call.",
        ["15 users on Growth: Rs 2,999 per user per month plus GST",
         "Annual billing gives 2 months free",
         "Booking emails can be sorted and routed to dispatch automatically"],
        knowledge=[("Pricing 2026.md", 0.72)])),

    ((1, "11:05"), _email(
        "ops@vridhiretail.com", "Dashboard not loading - urgent",
        "Hello,\n\nSince 10:15 this morning our reports dashboard shows a blank screen for all store managers. "
        "We have 40 stores and the managers can't see yesterday's sales or stock levels. We've tried Chrome "
        "and Edge and cleared the cache.\n\nPlease treat this as urgent, the regional review is at 4 pm "
        "today.\n\nVikram Joshi\nIT Operations, Vridhi Retail",
        "Vikram Joshi from Vridhi Retail reports the reports dashboard is blank for all 40 stores since this "
        "morning, before a 4 pm review.",
        "support", "negative", "urgent", "Technical support", ["outage", "dashboard", "P1"],
        "Hi Vikram,\n\nSorry for the trouble, especially before your regional review. A dashboard that is "
        "down for all 40 stores is a P1 issue, so our technical team will respond within 1 hour.\n\nTo help "
        "them start straight away, please reply with your account ID and a screenshot of the blank screen "
        "(with the browser console open, if possible).\n\nWe'll keep you updated until it's fixed.\n\n"
        + SIGN_OFF,
        knowledge=[("Support SLA.md", 0.69)], message_id="<a81f-4c2e-vridhi@vridhiretail.com>")),

    ((1, "12:40"), _document(
        "Mehta-Stationers-MS2210.pdf",
        """MEHTA STATIONERS
Shop 12, Laxmi Road, Pune 411030 | GSTIN 27ABCPM6633L1ZQ
Invoice: MS-2210          Date: {date:0}

To: Brightline Software Pvt Ltd

A4 copier paper, 20 reams @ 240           4,800.00
Whiteboard markers and dusters            1,450.00
GST @ 18%                                 1,125.00
Total payable                             8,375.00""",
        summary="Stationery invoice from Mehta Stationers for copier paper and whiteboard supplies.",
        document_type="invoice", counterparty="Mehta Stationers", document_number="MS-2210",
        issue_date="{iso:0}", due_date=None,
        line_items=[{"description": "A4 copier paper, 20 reams @ 240", "amount": 4800.0},
                    {"description": "Whiteboard markers and dusters", "amount": 1450.0}],
        tax_amount=1125.0, total_amount=8375.0, currency="INR",
        fields=[{"name": "Vendor GSTIN", "value": "27ABCPM6633L1ZQ"}],
        ai_notes=["The total is Rs 1,000 more than the items plus GST"],
        next_steps=["Ask Mehta Stationers for a corrected invoice before paying"])),

    ((1, "14:15"), _email(
        "suresh.yadav@shubhlabh.in", "पासवर्ड रीसेट ईमेल नहीं मिल रहा",
        "नमस्ते,\n\nमैंने तीन बार 'Forgot password' पर क्लिक किया लेकिन रीसेट वाला ईमेल अभी तक नहीं आया। मेरा "
        "लॉगिन ईमेल suresh.yadav@shubhlabh.in है। कल सुबह हमें स्टाफ़ को रिपोर्ट भेजनी है, कृपया जल्दी मदद "
        "करें।\n\nधन्यवाद,\nसुरेश यादव\nशुभ लाभ ट्रेडर्स, कानपुर",
        "Suresh Yadav from Shubh Labh Traders hasn't received the password reset email after three tries and "
        "needs access before tomorrow morning.",
        "support", "negative", "high", "Technical support", ["password reset", "login"],
        "नमस्ते सुरेश जी,\n\nअसुविधा के लिए खेद है। कृपया अपने ईमेल के Spam और Promotions फ़ोल्डर देख लें, "
        "क्योंकि रीसेट ईमेल कभी-कभी वहाँ चला जाता है। रीसेट लिंक 30 मिनट में समाप्त हो जाता है, इसलिए नया "
        "लिंक मंगाने के बाद उसे तुरंत खोलें।\n\nअगर फिर भी ईमेल न मिले, तो इसी ईमेल का जवाब दें। हमारी टीम "
        "आपके खाते (suresh.yadav@shubhlabh.in) की जाँच करके आपकी मदद करेगी।\n\nधन्यवाद,\nनेहा\nकस्टमर "
        "सपोर्ट, ब्राइटलाइन सॉफ़्टवेयर",
        language="Hindi", knowledge=[("Support SLA.md", 0.63)], message_id="<CAJ7y-reset-0447@mail.gmail.com>")),

    ((1, "15:30"), _lead(
        "Arjun Malhotra", "arjun.malhotra@paysetu.in", "PaySetu", "+91 98450 12093",
        "I'm VP Customer Success at PaySetu (Bengaluru, ~300 people). Our support inbox gets about 4,000 "
        "emails a week, mostly refund status, KYC and failed UPI payments. We need to cut first response time "
        "before the end of the quarter. Budget is signed off and I own this project. Can your team run a "
        "pilot in the next two weeks?",
        (23, 20, 20, 15, 10, 10),
        "Fintech with a large, specific support problem, approved budget, a deadline this quarter and the "
        "project owner writing in. Strong fit on every point.",
        "urgent", "Enterprise sales",
        "Call Arjun today and propose a two-week pilot on the refund-status and failed-UPI queues.",
        ["4,000 support emails a week: refund status, KYC and failed UPI payments",
         "Pilot can start within two weeks",
         "Budget signed off and Arjun owns the project",
         "Enterprise plan includes a dedicated success manager"],
        knowledge=[("Pricing 2026.md", 0.57)])),

    ((1, "17:10"), _lead(
        "Ananya Iyer", "ananya.iyer@zentrixlogistics.in", "Zentrix Logistics", "+91 99207 38841",
        "Hi, we're a 3PL company with warehouses in Pune and Chennai, about 450 people. Our customer support "
        "team gets 1,200+ emails a day about shipment status and POD copies, and we want to automate "
        "first-level replies and route the rest. Budget is approved for this quarter. Found you on IndiaMART. "
        "I'm Head of Operations and will decide along with our CTO. Can we see a demo next week?",
        (25, 20, 20, 15, 5, 10),
        "Large logistics company with a high-volume, well-defined email problem and budget approved this "
        "quarter. The decision is shared with the CTO.",
        "high", "Enterprise sales",
        "Book a demo next week with Ananya and the CTO, using shipment-status emails as the example.",
        ["1,200+ emails a day on shipment status and POD copies",
         "Budget approved for this quarter",
         "Invite the CTO to the demo, as the decision is shared"],
        knowledge=[("Pricing 2026.md", 0.55)])),

    ((1, "19:45"), _document(
        "SwiftCabs-receipt.pdf",
        """Swift Cabs - Trip Receipt
Receipt No: SC-7741902
Date: {date:0}, 06:55 PM
Pickup: Pune Airport (PNQ)    Drop: Baner

Ride fare                     386.00
Toll and parking               40.00
GST (5%)                       21.30
Total paid                    447.30

Paid by UPI. Thank you for riding with Swift Cabs.""",
        summary="Cab receipt from Swift Cabs for an airport-to-Baner ride, Rs 447.30 paid by UPI.",
        document_type="receipt", counterparty="Swift Cabs", document_number="SC-7741902",
        issue_date="{iso:0}", due_date=None,
        line_items=[{"description": "Ride fare", "amount": 386.0},
                    {"description": "Toll and parking", "amount": 40.0}],
        tax_amount=21.3, total_amount=447.3, currency="INR",
        fields=[{"name": "Route", "value": "Pune Airport (PNQ) to Baner"},
                {"name": "Payment", "value": "UPI"}],
        ai_notes=[], next_steps=["Add to the travel expense claim"])),
]
