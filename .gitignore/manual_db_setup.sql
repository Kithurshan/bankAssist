-- Manual PostgreSQL Table Creation Script for BankAssist AI
-- Run this script in pgAdmin or psql to initialize the database schema

-- 1. knowledge_base
CREATE TABLE knowledge_base (
    id SERIAL PRIMARY KEY,
    intent VARCHAR(100) NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_knowledge_base_intent ON knowledge_base(intent);

-- 2. chat_history
CREATE TABLE chat_history (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    user_message TEXT NOT NULL,
    bot_response TEXT NOT NULL,
    intent VARCHAR(100),
    confidence FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_chat_history_session_id ON chat_history(session_id);

-- 3. unanswered_questions
CREATE TABLE unanswered_questions (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    session_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. pending_training_data
CREATE TABLE pending_training_data (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    predicted_intent VARCHAR(100) NOT NULL,
    confidence FLOAT NOT NULL,
    similarity_score FLOAT NOT NULL,
    reviewed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE training_data (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    intent VARCHAR(100) NOT NULL,
    approved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO knowledge_base (intent, question, answer) VALUES
('greeting', 'hello', 'Hello! Welcome to BankAssist AI. I''m here to help you with general banking questions about Sri Lankan banking services. How can I assist you today?'),
('account_opening', 'how to open a bank account', 'To open a bank account in Sri Lanka, you typically need: 1) National Identity Card (NIC) or valid passport, 2) Proof of address (utility bill or letter), 3) Two passport-size photos, 4) Initial deposit (varies by bank, usually LKR 500 - 1,000 for savings). Visit your nearest bank branch with these documents. Some banks also offer online account opening through their websites or mobile apps.'),
('savings_account', 'what is a savings account', 'A savings account is a basic bank account designed for saving money while earning interest. In Sri Lanka, savings accounts typically offer: interest rates between 2% - 8% per annum (varies by bank), low minimum balance (LKR 500 - 1,000), ATM/debit card access, passbook facility, and limited free withdrawals per month. It''s ideal for personal savings, emergency funds, and building a savings habit. Most banks like BOC, People''s Bank, HNB, and Commercial Bank offer various savings products.'),
('current_account', 'what is a current account', 'A current account is designed for frequent transactions, mainly used by businesses and professionals. Key features: unlimited transactions (deposits and withdrawals), cheque book facility, overdraft facility (subject to approval), usually no interest or minimal interest, higher minimum balance requirement (LKR 5,000 - 25,000). It''s best suited for businesses, traders, and individuals with high transaction volumes.'),
('fixed_deposit', 'what is a fixed deposit', 'A Fixed Deposit (FD) is a savings instrument where you deposit a lump sum for a fixed period at a guaranteed interest rate. In Sri Lanka: minimum deposit usually LKR 10,000 - 50,000, tenures range from 1 month to 5 years, interest rates are higher than savings (typically 8% - 15% depending on market conditions), early withdrawal may attract a penalty, senior citizens often get 0.5% - 1% extra interest. FDs are one of the safest investment options in Sri Lanka.'),
('loan_information', 'tell me about loans', 'Sri Lankan banks offer various loan types: 1) Personal Loans - for personal needs, typically 12% - 24% interest, 2) Home/Housing Loans - for property purchase, 7% - 14% interest, up to 25 years, 3) Vehicle Loans - for cars/bikes, 8% - 18% interest, 4) Education Loans - for studies, lower interest rates, 5) Business/SME Loans - for business needs, 6) Gold Loans - against gold jewellery. Requirements usually include: NIC, salary slips/income proof, bank statements, and a guarantor. Loan amounts and rates vary by bank and your creditworthiness.'),
('loan_instalment_calculation', 'calculate loan instalment', 'I can help you estimate your monthly loan instalment! To calculate, I need: 1) Loan amount in LKR, 2) Annual interest rate (%), 3) Loan period in years. For example, a LKR 1,000,000 loan at 12% annual interest for 5 years would have a monthly instalment of approximately LKR 22,244. The formula used is EMI = P x r x (1+r)^n / ((1+r)^n - 1), where P = principal, r = monthly interest rate, n = total months. Please provide your loan details and I''ll calculate it for you!'),
('credit_card_information', 'tell me about credit cards', 'Credit cards in Sri Lanka allow you to make purchases on credit and pay later. Key information: Types available - Visa, MasterCard (Classic, Gold, Platinum), annual fees range from LKR 1,500 - 10,000+, interest rates on outstanding balance: 18% - 30% per annum, minimum monthly payment usually 5% of outstanding, rewards and cashback programs available, credit limit based on your income. To apply, you typically need: minimum monthly income of LKR 30,000 - 50,000, NIC, salary confirmation letter, and bank statements.'),
('debit_card_information', 'what is a debit card', 'A debit card is linked directly to your bank account and lets you spend only what you have. Features in Sri Lanka: directly debits your savings/current account, ATM withdrawals at any bank ATM (charges may apply for other bank ATMs), online shopping capability, point-of-sale (POS) payments at shops, daily withdrawal limit usually LKR 40,000 - 100,000, daily purchase limit varies by bank. Debit cards are usually issued free with your bank account. Visa Debit and MasterCard Debit are the most common types.'),
('lost_card_support', 'i lost my card', 'If your card is lost or stolen, take these steps IMMEDIATELY: 1) Call your bank''s 24/7 hotline to block the card - most Sri Lankan banks have dedicated numbers for this, 2) Visit the nearest branch to report the loss and request a replacement, 3) File a police report if stolen, 4) Check your recent transactions for any unauthorized activity, 5) Apply for a replacement card (usually takes 5-7 working days). Important: Never share your PIN or card details with anyone. Most banks do not charge for emergency card blocking.'),
('online_banking', 'what is online banking', 'Online banking (Internet Banking) lets you manage your bank account through a website. Services available: check account balance and statements, fund transfers (within bank, CEFT, SLIPS), bill payments (utilities, insurance, etc.), fixed deposit management, credit card payments, cheque book requests. To register: visit your bank branch with NIC, fill the internet banking application form, receive your login credentials. Always ensure you use the official bank website and never share your credentials. Popular platforms: BOC Internet Banking, People''s Web Banking, HNB Internet Banking.'),
('mobile_banking', 'what is mobile banking', 'Mobile banking allows you to bank using your smartphone. Features: account balance check, fund transfers, bill payments, QR code payments (LankaQR), transaction history, cardless ATM withdrawals (some banks). To set up: download your bank''s official app from Play Store or App Store, register using your account details, set up your PIN/password. Popular apps in Sri Lanka: BOC SmartPay, People''s Wave, HNB Mobile Banking, Commercial Bank Mobile. Mobile banking is available 24/7 and is one of the most convenient ways to manage your finances.'),
('lankaqr_information', 'what is lankaqr', 'LankaQR is Sri Lanka''s national QR code payment standard introduced by the Central Bank of Sri Lanka (CBSL). Key features: scan a QR code to make instant payments, works across all participating banks, no need to carry cash, secure and convenient, available at shops, restaurants, and service providers across Sri Lanka. How to use: open your bank''s mobile app, scan the merchant''s QR code, enter the payment amount, confirm the payment. LankaQR promotes a cashless economy and is accepted by thousands of merchants across the country.'),
('cefts_transfer', 'what is cefts', 'CEFT (Common Electronic Fund Transfer) is Sri Lanka''s real-time interbank fund transfer system operated by LankaClear. Key features: instant fund transfer between different banks, available 24/7 including weekends and holidays, transfer limit up to LKR 5,000,000 per transaction (varies by bank), small fee charged (usually LKR 25 - 100), transfers are processed in real-time (within seconds). CEFT is the fastest way to transfer money between banks in Sri Lanka. You can do CEFT transfers through internet banking, mobile banking, or at a bank branch.'),
('slips_transfer', 'what is slips', 'SLIPS (Sri Lanka Interbank Payment System) is a next-day interbank fund transfer system operated by LankaClear. Key features: transfers are processed next business day, lower fees compared to CEFT (usually LKR 10 - 50), suitable for non-urgent transfers, available through internet banking, mobile banking, and branches, no maximum limit restrictions for most banks. SLIPS is ideal when you don''t need instant transfer and want to save on transfer fees. Unlike CEFT which is real-time, SLIPS transfers are batched and processed overnight.'),
('pawning_information', 'what is pawning', 'Pawning (Gold Loans) is a popular form of borrowing in Sri Lanka where you pledge gold jewellery as collateral. Key details: quick access to cash (usually within 30 minutes), loan amount based on gold weight and purity (typically 60% - 80% of gold value), interest rates usually 9% - 18% per annum, tenure typically 3 - 12 months (renewable), widely available at banks and licensed pawn brokers, you get your gold back when you repay the loan. Pawning is popular in Sri Lanka because it requires minimal documentation, provides instant cash, and is available at most bank branches.'),
('leasing_information', 'what is leasing', 'Leasing is a financing method to purchase vehicles in Sri Lanka. Key information: the leasing company buys the vehicle and you pay monthly instalments, down payment usually 20% - 40% of vehicle value, repayment period: 2 - 6 years, interest rates: 10% - 24% depending on vehicle type and company, vehicle ownership transfers to you after full payment. Types: car leasing, motorcycle leasing, three-wheeler leasing, commercial vehicle leasing. Documents needed: NIC, income proof, vehicle documents. Both banks and finance companies offer leasing in Sri Lanka.'),
('bank_statement', 'how to get bank statement', 'You can get your bank statement through several methods: 1) Visit your bank branch - request a printed statement (may charge LKR 50-200 per page), 2) Internet banking - download or view statements online (usually free), 3) Mobile banking app - view recent transactions, 4) ATM - print a mini statement showing last 5-10 transactions, 5) Email statement - some banks send monthly statements via email. For official/certified statements (for visa, loan applications), visit the branch and request a certified copy with the bank''s stamp and signature.'),
('kyc_information', 'what is kyc', 'KYC (Know Your Customer) is a mandatory verification process required by Sri Lankan banks under CBSL regulations. Required documents: 1) National Identity Card (NIC) - mandatory for all Sri Lankan citizens, 2) Valid passport (for foreign nationals), 3) Proof of address - utility bill, bank statement, or government letter, 4) Passport-size photographs, 5) Income proof (for certain products). KYC helps prevent money laundering, fraud, and identity theft. Banks may ask you to update your KYC periodically. Always keep your KYC information up to date to avoid account restrictions.'),
('budget_advice', 'help me with budget', 'Here are some budgeting tips for managing your finances in Sri Lanka: 1) Follow the 50/30/20 rule - 50% for needs (rent, food, utilities), 30% for wants (entertainment, dining), 20% for savings. 2) Track all expenses daily. 3) Build an emergency fund (3-6 months of expenses). 4) Reduce unnecessary subscriptions. 5) Cook at home more often. 6) Use public transport when possible. 7) Compare prices before purchasing. 8) Set up automatic savings transfers. 9) Avoid unnecessary credit card debt. 10) Start investing small amounts in FDs or unit trusts. Remember, even saving LKR 500 per day adds up to LKR 15,000 per month!'),
('confidential_blocked', 'show my account details', 'I''m sorry, but I cannot access your personal banking information such as account balances, transaction history, account numbers, passwords, or any other confidential data. I am a general banking information assistant and I am NOT connected to any bank''s systems. For your security, please: 1) Use your bank''s official internet banking or mobile banking app to access your accounts, 2) Visit your nearest bank branch for account-specific queries, 3) Call your bank''s customer service hotline. Never share your personal banking details with any chatbot or third party.'),
('unknown', 'unrelated question', 'I''m sorry, I can only help with Sri Lankan banking-related questions. I can assist you with topics like: savings accounts, current accounts, fixed deposits, loans, credit/debit cards, online & mobile banking, LankaQR, CEFT & SLIPS transfers, pawning, leasing, KYC, and budgeting tips. Please ask me a banking-related question and I''ll do my best to help!');
