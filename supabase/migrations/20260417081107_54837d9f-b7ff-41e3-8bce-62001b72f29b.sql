-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'dsa', 'caller', 'coordinator', 'lender', 'affiliate', 'customer');
CREATE TYPE public.lead_score AS ENUM ('cold', 'warm', 'hot');
CREATE TYPE public.lead_status AS ENUM ('available', 'sold', 'archived');
CREATE TYPE public.loan_type AS ENUM ('personal', 'home', 'business', 'credit_card', 'insurance', 'mutual_fund');
CREATE TYPE public.txn_type AS ENUM ('credit', 'debit');

-- updated_at trigger fn
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT, phone TEXT, city TEXT, company_name TEXT, avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_primary_role(_user_id UUID)
RETURNS app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'admin' THEN 1 WHEN 'dsa' THEN 2 WHEN 'lender' THEN 3
    WHEN 'coordinator' THEN 4 WHEN 'caller' THEN 5
    WHEN 'affiliate' THEN 6 WHEN 'customer' THEN 7 END
  LIMIT 1
$$;

-- WALLETS
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_recharged NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_spent NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- WALLET TRANSACTIONS
CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type txn_type NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  reference_id UUID,
  balance_after NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wallet_txn_user ON public.wallet_transactions(user_id, created_at DESC);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- LEADS
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_name TEXT NOT NULL,
  full_phone TEXT NOT NULL,
  masked_phone TEXT NOT NULL,
  email TEXT, city TEXT NOT NULL,
  loan_type loan_type NOT NULL,
  loan_amount NUMERIC(12,2) NOT NULL,
  monthly_income NUMERIC(12,2),
  score lead_score NOT NULL DEFAULT 'warm',
  price NUMERIC(10,2) NOT NULL DEFAULT 99,
  status lead_status NOT NULL DEFAULT 'available',
  source TEXT, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_city ON public.leads(city);
CREATE INDEX idx_leads_loan_type ON public.leads(loan_type);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- LEAD PURCHASES
CREATE TABLE public.lead_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  dsa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price_paid NUMERIC(10,2) NOT NULL,
  pipeline_stage TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lead_id)
);
CREATE INDEX idx_lp_dsa ON public.lead_purchases(dsa_id, created_at DESC);
ALTER TABLE public.lead_purchases ENABLE ROW LEVEL SECURITY;

-- POLICIES (now that all tables exist)
CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own wallet" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all wallets" ON public.wallets FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own transactions" ON public.wallet_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Authenticated can view available leads" ON public.leads FOR SELECT TO authenticated
  USING (
    status = 'available'
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.lead_purchases lp WHERE lp.lead_id = leads.id AND lp.dsa_id = auth.uid())
  );
CREATE POLICY "Admins manage leads" ON public.leads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "DSAs view own purchases" ON public.lead_purchases FOR SELECT TO authenticated USING (auth.uid() = dsa_id);
CREATE POLICY "Admins view all purchases" ON public.lead_purchases FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- PURCHASE LEAD (atomic)
CREATE OR REPLACE FUNCTION public.purchase_lead(_lead_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user UUID := auth.uid(); _lead RECORD; _wallet RECORD; _new_balance NUMERIC;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _lead FROM public.leads WHERE id = _lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;
  IF _lead.status <> 'available' THEN RAISE EXCEPTION 'Lead is no longer available'; END IF;
  SELECT * INTO _wallet FROM public.wallets WHERE user_id = _user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  IF _wallet.balance < _lead.price THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;
  _new_balance := _wallet.balance - _lead.price;
  UPDATE public.wallets SET balance = _new_balance, total_spent = total_spent + _lead.price WHERE user_id = _user;
  UPDATE public.leads SET status = 'sold' WHERE id = _lead_id;
  INSERT INTO public.lead_purchases (lead_id, dsa_id, price_paid) VALUES (_lead_id, _user, _lead.price);
  INSERT INTO public.wallet_transactions (user_id, type, amount, description, reference_id, balance_after)
  VALUES (_user, 'debit', _lead.price, 'Lead purchase: ' || _lead.applicant_name, _lead_id, _new_balance);
  RETURN jsonb_build_object('success', true, 'lead_id', _lead_id, 'full_phone', _lead.full_phone, 'new_balance', _new_balance);
END; $$;

-- RECHARGE WALLET (mock)
CREATE OR REPLACE FUNCTION public.recharge_wallet(_amount NUMERIC)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user UUID := auth.uid(); _new_balance NUMERIC;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount <= 0 OR _amount > 100000 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  UPDATE public.wallets SET balance = balance + _amount, total_recharged = total_recharged + _amount
  WHERE user_id = _user RETURNING balance INTO _new_balance;
  INSERT INTO public.wallet_transactions (user_id, type, amount, description, balance_after)
  VALUES (_user, 'credit', _amount, 'Wallet recharge', _new_balance);
  RETURN jsonb_build_object('success', true, 'new_balance', _new_balance);
END; $$;

-- AUTO-SETUP NEW USER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''), COALESCE(NEW.raw_user_meta_data ->> 'phone', ''));
  INSERT INTO public.wallets (user_id, balance, total_recharged) VALUES (NEW.id, 500, 500);
  INSERT INTO public.wallet_transactions (user_id, type, amount, description, balance_after)
  VALUES (NEW.id, 'credit', 500, 'Welcome bonus', 500);
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data ->> 'role')::app_role, 'customer'::app_role));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- SEED LEADS
INSERT INTO public.leads (applicant_name, full_phone, masked_phone, email, city, loan_type, loan_amount, monthly_income, score, price, source) VALUES
('Rahul Sharma',  '+919876543210', '+91 98****3210', 'rahul.s@email.com',  'Mumbai',    'personal',    500000,  75000,  'hot',  149, 'Facebook Ads'),
('Priya Patel',   '+919823456789', '+91 98****6789', 'priya.p@email.com',  'Ahmedabad', 'home',        2500000, 120000, 'hot',  299, 'Google Ads'),
('Amit Kumar',    '+919812345678', '+91 98****5678', 'amit.k@email.com',   'Delhi',     'business',    1000000, 200000, 'hot',  249, 'Instagram'),
('Sneha Reddy',   '+919845671230', '+91 98****1230', 'sneha.r@email.com',  'Hyderabad', 'credit_card', 0,       55000,  'warm', 79,  'Website'),
('Vikram Singh',  '+919898765432', '+91 98****5432', 'vikram.s@email.com', 'Jaipur',    'personal',    300000,  45000,  'warm', 99,  'Facebook Ads'),
('Anjali Mehta',  '+919876123456', '+91 98****3456', 'anjali.m@email.com', 'Pune',      'insurance',   500000,  60000,  'warm', 89,  'Referral'),
('Karan Joshi',   '+919865432198', '+91 98****2198', 'karan.j@email.com',  'Bengaluru', 'home',        4000000, 180000, 'hot',  349, 'Google Ads'),
('Divya Iyer',    '+919812348765', '+91 98****8765', 'divya.i@email.com',  'Chennai',   'mutual_fund', 100000,  90000,  'cold', 49,  'Website'),
('Rohit Gupta',   '+919876549876', '+91 98****9876', 'rohit.g@email.com',  'Lucknow',   'personal',    200000,  35000,  'cold', 59,  'Facebook Ads'),
('Pooja Nair',    '+919823459012', '+91 98****9012', 'pooja.n@email.com',  'Kochi',     'business',    750000,  150000, 'hot',  229, 'Instagram'),
('Aditya Verma',  '+919845678901', '+91 98****8901', 'aditya.v@email.com', 'Noida',     'credit_card', 0,       80000,  'warm', 99,  'Google Ads'),
('Meera Kapoor',  '+919898761234', '+91 98****1234', 'meera.k@email.com',  'Gurgaon',   'home',        3000000, 220000, 'hot',  329, 'Website');