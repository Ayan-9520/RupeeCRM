"""Academy quizzes. Answers stay on the server; the client only gets questions and options.

Course slugs, titles, badges and points mirror src/lib/courses.ts.
"""

from __future__ import annotations

PASS_PERCENT = 70

# (question, options, correct_index, explanation)
Q = tuple[str, list[str], int, str]

QUIZZES: dict[str, dict] = {
    "personal-loan-pro": {
        "title": "Personal Loan Pro",
        "badge": "PL Certified",
        "points": 250,
        "questions": [
            ("What is the range of a CIBIL score?", ["0 – 100", "100 – 500", "300 – 900", "500 – 1000"], 2,
             "CIBIL scores range from 300 to 900. Higher is better."),
            ("For an unsecured personal loan, most lenders prefer a CIBIL score of:", ["550 or above", "650 or above", "750 or above", "Any score works"], 2,
             "750+ usually gets the best approval odds and rates. Some lenders accept lower scores at higher rates."),
            ("FOIR stands for:", ["Fixed Obligation to Income Ratio", "Final Offer Interest Rate", "Floating Obligation Insurance Rate", "Fixed Offer Income Return"], 0,
             "FOIR is the share of monthly income already going to EMIs and other fixed obligations."),
            ("A customer earns ₹50,000/month and already pays ₹10,000 EMI. If the lender's FOIR cap is 50%, what is the maximum new EMI?",
             ["₹10,000", "₹15,000", "₹25,000", "₹35,000"], 1,
             "50% of ₹50,000 is ₹25,000. Minus the existing ₹10,000 EMI leaves ₹15,000 for the new loan."),
            ("A personal loan is usually:", ["Secured against property", "Secured against gold", "Unsecured", "Secured against a fixed deposit"], 2,
             "Personal loans don't need collateral, which is why lenders look closely at income and credit score."),
            ("The standard income proof for a salaried applicant is:", ["Electricity bill", "Last 3 months' salary slips and bank statement", "PAN card only", "Rent agreement"], 1,
             "Salary slips plus the salary-credit bank statement prove income and stability."),
            ("What happens if a customer applies to many lenders in a short time?", ["Score improves", "Nothing changes", "Multiple hard enquiries can lower the score", "Loan is approved faster"], 2,
             "Each application triggers a hard enquiry. Many in a short span signal credit hunger and can lower the score."),
            ("A customer asks why their rate is high. The best response is:", ["Promise the lowest rate in India", "Explain that rate depends on credit profile, income and employer, and compare offers",
             "Tell them all lenders charge the same", "Ask them to apply again tomorrow"], 1,
             "Be honest about what drives pricing and show comparable offers. Never promise guaranteed rates."),
            ("Processing fee on a personal loan is usually charged as:", ["A fixed ₹99", "A percentage of the loan amount plus GST", "Only on prepayment", "Never charged"], 1,
             "Lenders typically charge a percentage of the loan amount, plus GST, deducted at disbursal."),
            ("Under RBI digital lending rules, before signing a loan the borrower must receive:", ["A free gift", "A Key Fact Statement (KFS)", "A credit card", "An insurance policy"], 1,
             "The KFS shows APR, fees and repayment schedule in a standard format before the borrower accepts."),
        ],
    },
    "business-loan-mastery": {
        "title": "Business Loan Mastery",
        "badge": "BL Certified",
        "points": 300,
        "questions": [
            ("GSTR-3B is:", ["An annual income tax return", "A monthly summary GST return of sales and tax paid", "A bank statement format", "A company incorporation form"], 1,
             "GSTR-3B is the summary GST return that shows outward supplies and tax paid, useful to verify turnover."),
            ("Udyam Registration is meant for:", ["Salaried employees", "Micro, small and medium enterprises", "Only exporters", "Only startups"], 1,
             "Udyam is the government registration for MSMEs and is needed for many MSME schemes."),
            ("MSME classification is based on:", ["Number of employees only", "Investment in plant & machinery and annual turnover", "Owner's age", "City of operation"], 1,
             "Enterprises are classified as micro, small or medium by investment and turnover limits."),
            ("A DSCR below 1 means:", ["The business is highly profitable", "Business cash flow is not enough to cover its debt payments", "The loan is fully secured", "GST is not filed"], 1,
             "DSCR = cash available for debt service / debt payments. Below 1 means a shortfall."),
            ("CGTMSE provides:", ["Subsidy on interest", "Credit guarantee for collateral-free loans to micro and small enterprises", "Free insurance", "Export licences"], 1,
             "CGTMSE guarantees lenders against default so MSEs can borrow without collateral."),
            ("On a cash credit or overdraft limit, interest is charged on:", ["The full sanctioned limit", "Only the amount actually used", "Turnover", "Nothing"], 1,
             "Revolving limits charge interest only on the utilised balance."),
            ("For buying a new machine, the best-fit product is usually:", ["Overdraft", "Term loan / machinery loan", "Credit card", "Invoice discounting"], 1,
             "Long-life assets should be funded by term loans that match the asset's useful life."),
            ("Most lenders ask for how many months of business bank statements?", ["1 month", "6–12 months", "5 years", "None"], 1,
             "6–12 months shows cash flow, average balance and bounce history."),
            ("The maximum Mudra loan (Tarun Plus) is:", ["₹5 lakh", "₹10 lakh", "₹20 lakh", "₹1 crore"], 2,
             "The Tarun Plus category raised the Mudra ceiling to ₹20 lakh for borrowers who repaid earlier Tarun loans."),
            ("Repeated EMI or cheque bounces in a bank statement indicate:", ["Strong cash flow", "Weak repayment discipline — a negative for credit", "Tax savings", "High turnover"], 1,
             "Bounces are a red flag for underwriters and often lead to rejection or higher pricing."),
        ],
    },
    "home-loan-expert": {
        "title": "Home Loan Expert",
        "badge": "HL Certified",
        "points": 400,
        "questions": [
            ("As per RBI, the maximum LTV for a home loan up to ₹30 lakh is:", ["60%", "75%", "80%", "90%"], 3,
             "RBI caps LTV at 90% up to ₹30 lakh, 80% for ₹30–75 lakh and 75% above ₹75 lakh."),
            ("A home loan balance transfer means:", ["Selling the house", "Moving the outstanding loan to another lender for better terms", "Adding a co-owner", "Closing the loan"], 1,
             "Balance transfer shifts the outstanding principal to a new lender, usually for a lower rate."),
            ("A top-up loan is:", ["A new home loan for another house", "An additional loan on top of an existing home loan", "A credit card limit", "A tax refund"], 1,
             "Top-ups give extra funds to existing borrowers, often at near home-loan rates."),
            ("Pre-EMI refers to:", ["Full EMI before disbursal", "Interest-only payments on the amount disbursed during construction", "Processing fee", "Penalty for late payment"], 1,
             "In under-construction cases, borrowers pay interest on the disbursed portion until full disbursal."),
            ("For floating-rate home loans taken by individuals, foreclosure or prepayment charges are:", ["2% of outstanding", "Not allowed by RBI", "Always 5%", "Decided by the builder"], 1,
             "RBI bars foreclosure/prepayment charges on floating-rate term loans to individual borrowers."),
            ("Legal verification of a property mainly checks:", ["Paint quality", "Clear and marketable title", "Distance from the metro", "Builder's brand"], 1,
             "Lawyers verify the title chain and that the property can be legally mortgaged."),
            ("Technical valuation determines:", ["The borrower's salary", "The property's market value and construction status", "The CIBIL score", "Stamp duty rate"], 1,
             "The valuer's report drives the LTV calculation and sanction amount."),
            ("Under the old tax regime, interest deduction on a self-occupied home loan (Sec 24(b)) is up to:", ["₹50,000", "₹1.5 lakh", "₹2 lakh", "No limit"], 2,
             "Section 24(b) allows up to ₹2 lakh a year on interest for self-occupied property."),
            ("Adding an earning co-applicant usually:", ["Reduces eligibility", "Increases eligibility by combining incomes", "Has no effect", "Doubles the interest rate"], 1,
             "Combined income raises repayment capacity, so lenders can sanction more."),
            ("New floating-rate retail home loans are linked to:", ["Gold prices", "An external benchmark such as the repo rate", "The Sensex", "Fixed deposit rates only"], 1,
             "Since 2019, RBI requires floating retail loans to be linked to an external benchmark (EBLR)."),
        ],
    },
    "lap-specialist": {
        "title": "LAP Specialist",
        "badge": "LAP Certified",
        "points": 350,
        "questions": [
            ("Loan Against Property is:", ["An unsecured loan", "A secured loan against residential or commercial property", "A credit card", "A gold loan"], 1,
             "The property is mortgaged to the lender as security."),
            ("Typical LTV for LAP on residential property is about:", ["10–20%", "50–70% of market value", "100%", "120%"], 1,
             "Lenders keep a buffer and usually fund 50–70% of the property's value."),
            ("Which property is hardest to fund?", ["Freehold flat with clear title", "Property with unclear or disputed title", "Self-occupied house", "Commercial shop with approvals"], 1,
             "Title issues block the mortgage, so lenders reject or delay such cases."),
            ("Compared with an unsecured business loan, LAP usually offers:", ["Higher rate and shorter tenure", "Lower rate and longer tenure, but needs property", "No documentation", "Instant disbursal in minutes"], 1,
             "Security lets lenders price lower and lend for longer."),
            ("Key LAP documents include:", ["Only PAN", "Title deed chain and approved building plan", "Gym membership", "Passport only"], 1,
             "Lenders need the full chain of title and approvals to create a valid mortgage."),
            ("LTV on commercial property is generally:", ["Higher than residential", "Lower than residential", "Always 100%", "Not allowed"], 1,
             "Commercial and industrial properties are less liquid, so lenders fund a smaller share."),
            ("An encumbrance certificate shows:", ["Electricity usage", "Whether the property has existing loans or charges", "Owner's income", "Market rent"], 1,
             "It lists registered transactions and charges on the property."),
            ("If a LAP borrower stops paying, the lender can:", ["Do nothing", "Enforce the security under law, e.g. SARFAESI", "Seize the borrower's salary directly", "Cancel GST registration"], 1,
             "Secured lenders can take possession and sell the property through legal processes."),
            ("Property value ₹1 crore at 60% LTV gives a maximum loan of:", ["₹40 lakh", "₹60 lakh", "₹1 crore", "₹1.6 crore"], 1,
             "60% of ₹1 crore = ₹60 lakh, subject to income eligibility."),
            ("Before pitching LAP, you should first check:", ["Customer's favourite bank", "Ownership, title and income to service the EMI", "Car model", "Social media followers"], 1,
             "Clear ownership and repayment capacity decide whether the case is viable."),
        ],
    },
    "health-insurance-advisor": {
        "title": "Health Insurance Advisor",
        "badge": "Health Certified",
        "points": 280,
        "questions": [
            ("Since 2024, IRDAI's maximum waiting period for pre-existing diseases is:", ["1 year", "3 years", "5 years", "10 years"], 1,
             "IRDAI reduced the maximum PED waiting period from 4 years to 3 years."),
            ("A family floater policy means:", ["Each member has a separate sum insured", "One sum insured shared by the whole family", "Only children are covered", "Cover only abroad"], 1,
             "All members draw from one shared sum insured."),
            ("Co-pay means:", ["Insurer pays twice", "Policyholder pays a fixed share of each claim", "Free hospital stay", "Premium refund"], 1,
             "With 20% co-pay, the policyholder pays 20% of an admissible claim."),
            ("No Claim Bonus is:", ["A penalty", "An increase in sum insured (or discount) for a claim-free year", "A tax", "A hospital fee"], 1,
             "Insurers reward claim-free years, usually by increasing the sum insured."),
            ("A cashless claim means:", ["The patient pays and claims later", "The network hospital settles the bill directly with the insurer", "No cover", "Only OPD cover"], 1,
             "At network hospitals, the insurer pays the hospital directly for admissible expenses."),
            ("If the room chosen exceeds the policy's room-rent limit:", ["Nothing happens", "Other charges may be paid proportionately less", "Policy is cancelled", "Premium doubles"], 1,
             "Proportionate deduction can reduce many associated charges, not just room rent."),
            ("A super top-up policy:", ["Replaces base cover", "Pays expenses above a deductible, counted across the year", "Covers only accidents", "Is a life policy"], 1,
             "Super top-ups add high cover cheaply once total claims cross the deductible."),
            ("The free-look period for health insurance is:", ["7 days", "15 days", "30 days", "90 days"], 2,
             "IRDAI's 2024 rules give policyholders 30 days to review and cancel a new policy."),
            ("A customer has diabetes. The advisor should:", ["Hide it to get a lower premium", "Disclose it in the proposal form", "Tell them to buy later", "Skip the medical section"], 1,
             "Non-disclosure can lead to claim rejection. Always disclose pre-existing conditions."),
            ("Under Section 80D, deduction for self and family (below 60 years) is up to:", ["₹10,000", "₹25,000", "₹1 lakh", "₹1.5 lakh"], 1,
             "₹25,000 for self/family below 60; more if parents or senior citizens are covered."),
        ],
    },
    "credit-card-closer": {
        "title": "Credit Card Closer",
        "badge": "Card Certified",
        "points": 200,
        "questions": [
            ("The interest-free period on a credit card applies when:", ["Minimum due is paid", "Total due is paid in full by the due date", "Card is used abroad", "Always"], 1,
             "Paying the full statement balance on time keeps purchases interest-free."),
            ("If only the minimum due is paid:", ["No interest is charged", "Interest is charged on the outstanding balance", "Card is closed", "Limit doubles"], 1,
             "Interest applies on the unpaid balance, often at a high annual rate."),
            ("Healthy credit utilisation is generally:", ["Below about 30% of the limit", "Exactly 100%", "Above 90%", "Utilisation doesn't matter"], 0,
             "Low utilisation signals responsible usage and supports a good score."),
            ("Cash withdrawal on a credit card usually:", ["Is free", "Attracts a fee and interest from day one", "Earns double rewards", "Has a 50-day free period"], 1,
             "Cash advances have no interest-free period and carry a fee."),
            ("Per RBI, if a new card is not activated within 30 days, the issuer must:", ["Activate it automatically", "Seek OTP consent to activate, or close it", "Charge a penalty", "Increase the limit"], 1,
             "Cards can't be activated without the customer's consent."),
            ("A lifetime free card has:", ["No joining or annual fee", "No credit limit", "No interest ever", "No rewards"], 0,
             "LTF means no joining or annual fee; interest and other charges still apply."),
            ("A secured credit card is useful for:", ["Customers with no credit history", "Only high-income customers", "Businesses only", "NRIs only"], 0,
             "Issued against a fixed deposit, it helps new-to-credit customers build history."),
            ("The most useful pre-screening question before applying is:", ["Favourite colour", "Monthly income, existing cards and credit score", "Phone brand", "Vacation plans"], 1,
             "Income and credit profile predict approval and help pick the right card."),
            ("RBI rules let cardholders:", ["Never change billing cycle", "Change the billing cycle at least once", "Skip KYC", "Avoid all fees"], 1,
             "Cardholders can request a billing-cycle change at least once."),
            ("A fuel surcharge waiver means:", ["Free fuel", "The surcharge on eligible fuel transactions is refunded, within limits", "Cashback on groceries", "No GST"], 1,
             "Waivers apply within a transaction range and a monthly cap."),
        ],
    },
    "compliance-fairlending": {
        "title": "Compliance & Fair Lending",
        "badge": "Compliance Verified",
        "points": 150,
        "questions": [
            ("Promotional calls to numbers registered on DND / NCPR are:", ["Allowed anytime", "Not allowed under TRAI rules", "Allowed on Sundays", "Allowed if the call is short"], 1,
             "TRAI's commercial communication rules prohibit unsolicited promotional calls to DND numbers."),
            ("When storing a customer's Aadhaar copy you should:", ["Share it on WhatsApp groups", "Collect only if needed and mask the first 8 digits", "Print extra copies", "Post it online"], 1,
             "Collect minimum data and mask Aadhaar numbers to protect the customer."),
            ("A DSA asking the customer for an upfront fee to 'guarantee' approval is:", ["Good practice", "Mis-selling and not allowed", "Required by RBI", "Optional"], 1,
             "No one can guarantee approval, and upfront fees from customers are a classic fraud signal."),
            ("RBI guidelines restrict recovery agents' calls to:", ["Any time", "8 am – 7 pm", "Midnight only", "Weekends only"], 1,
             "Recovery calls must be made between 8 am and 7 pm."),
            ("Telling a customer 'approval is 100% guaranteed' is:", ["Accurate", "Mis-selling", "Required", "A compliance best practice"], 1,
             "Only the lender decides approval. Guarantees mislead customers."),
            ("Under the DPDP Act, customer data may be used:", ["For any purpose", "Only with consent and for the stated purpose", "If it's in a spreadsheet", "Only by the IT team"], 1,
             "Personal data must be processed for the purpose the customer consented to."),
            ("Collecting cash from a customer to 'speed up' a loan is:", ["Allowed", "Not allowed", "Allowed below ₹1,000", "Allowed with a receipt"], 1,
             "Partners must never take money from customers for approvals."),
            ("A Key Fact Statement must show:", ["Only the EMI", "The all-in annual cost (APR), fees and repayment schedule", "The DSA's commission", "Nothing"], 1,
             "The KFS discloses the full cost of credit in a standard format."),
            ("If a customer's complaint is not resolved by the lender in 30 days, they can approach:", ["Police only", "RBI Integrated Ombudsman", "A DSA", "Social media only"], 1,
             "The RBI Integrated Ombudsman Scheme handles unresolved complaints against regulated entities."),
            ("If you suspect a customer's documents are fake you should:", ["Process anyway", "Stop and report it to the lender / RupeeDial", "Edit them", "Ask for a fee"], 1,
             "Never process suspected forgeries; report immediately."),
        ],
    },
    "sales-fundamentals": {
        "title": "Sales Fundamentals",
        "badge": "Sales Pro",
        "points": 180,
        "questions": [
            ("The first thing to do on a cold call is:", ["Start with rates", "Introduce yourself, your company and the purpose, and ask if it's a good time", "Ask for documents", "Hang up quickly"], 1,
             "A clear, polite opening builds trust and permission to continue."),
            ("A good 3-touch follow-up is:", ["Three calls in one hour", "Call, WhatsApp summary, then a call at the agreed time", "Email only", "Wait a month"], 1,
             "Mixing channels at agreed times keeps you helpful, not pushy."),
            ("The best way to handle an objection is:", ["Argue", "Listen, acknowledge, clarify, then respond", "Ignore it", "Offer a discount immediately"], 1,
             "Understanding the real concern lets you answer it properly."),
            ("To find the leaky stage in your funnel, you should:", ["Count total calls", "Compare conversion rates between each stage", "Check social media likes", "Guess"], 1,
             "The stage with the biggest drop-off is where to focus."),
            ("Which is an open-ended question?", ["Do you need a loan?", "What are you planning to use the funds for?", "Is your salary above ₹30,000?", "Yes or no?"], 1,
             "Open questions get customers talking and reveal real needs."),
            ("Updating the CRM after every call helps because:", ["It's optional", "Follow-ups and status stay accurate for you and the team", "It increases rates", "It deletes leads"], 1,
             "Accurate status and next steps prevent missed follow-ups."),
            ("'Speed to lead' means:", ["Talking fast", "Contacting new leads within minutes", "Calling only in the evening", "Closing in one call"], 1,
             "Fast first contact significantly improves conversion."),
            ("A customer says 'send details on WhatsApp'. You should:", ["End the call", "Send a short summary and fix a callback time", "Send nothing", "Send 20 messages"], 1,
             "A summary plus a fixed callback keeps the conversation moving."),
            ("The best measure of sales quality is:", ["Number of calls made", "Leads converted to disbursal", "Talk time", "Messages sent"], 1,
             "Disbursals are what create value for the customer and the business."),
            ("Every call should end with:", ["Small talk", "A confirmed next step and time", "A discount", "No plan"], 1,
             "Clear next steps turn interest into action."),
        ],
    },
}


def get_quiz(slug: str) -> dict | None:
    return QUIZZES.get(slug)


def public_questions(slug: str) -> list[dict]:
    quiz = QUIZZES[slug]
    return [{"index": i, "question": q[0], "options": q[1]} for i, q in enumerate(quiz["questions"])]


def grade(slug: str, answers: list[int]) -> dict:
    quiz = QUIZZES[slug]
    questions: list[Q] = quiz["questions"]
    correct = sum(1 for i, q in enumerate(questions) if i < len(answers) and answers[i] == q[2])
    total = len(questions)
    score = round(correct * 100 / total) if total else 0
    review = [
        {
            "question": q[0],
            "options": q[1],
            "correct_index": q[2],
            "your_index": answers[i] if i < len(answers) else None,
            "explanation": q[3],
        }
        for i, q in enumerate(questions)
    ]
    return {"correct": correct, "total": total, "score_percent": score, "passed": score >= PASS_PERCENT, "review": review}
