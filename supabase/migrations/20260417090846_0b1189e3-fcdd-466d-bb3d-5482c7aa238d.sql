-- ============================================================
-- 1. PRODUCT TYPES
-- ============================================================
CREATE TABLE public.product_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category public.product_category NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  default_lead_price NUMERIC NOT NULL DEFAULT 99,
  commission_pct_min NUMERIC NOT NULL DEFAULT 0,
  commission_pct_max NUMERIC NOT NULL DEFAULT 0,
  commission_flat_min NUMERIC NOT NULL DEFAULT 0,
  commission_flat_max NUMERIC NOT NULL DEFAULT 0,
  high_demand BOOLEAN NOT NULL DEFAULT false,
  high_commission BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_types_category ON public.product_types(category);
CREATE INDEX idx_product_types_enabled ON public.product_types(enabled);

ALTER TABLE public.product_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read product types"
  ON public.product_types FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage product types"
  ON public.product_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_product_types_updated_at
  BEFORE UPDATE ON public.product_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. PRODUCT PIPELINES
-- ============================================================
CREATE TABLE public.product_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category public.product_category NOT NULL UNIQUE,
  name TEXT NOT NULL,
  stages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read pipelines"
  ON public.product_pipelines FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage pipelines"
  ON public.product_pipelines FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_product_pipelines_updated_at
  BEFORE UPDATE ON public.product_pipelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. LEADS: link to product_types
-- ============================================================
ALTER TABLE public.leads
  ADD COLUMN product_type_id UUID REFERENCES public.product_types(id) ON DELETE SET NULL;

CREATE INDEX idx_leads_product_type ON public.leads(product_type_id);

-- ============================================================
-- 4. SEED PRODUCT TYPES (codes prefixed by category)
-- ============================================================
INSERT INTO public.product_types (category, code, name, description, icon, color, default_lead_price, commission_pct_min, commission_pct_max, commission_flat_min, commission_flat_max, high_demand, high_commission, display_order) VALUES
-- LOANS (loan_*)
('loan','loan_personal','Personal Loan','Unsecured loan for any personal need — weddings, travel, medical.','Wallet','blue',299,1,3,0,0,true,false,1),
('loan','loan_business','Business Loan','Working capital and growth funding for SMEs.','Briefcase','blue',399,2,4,0,0,true,true,2),
('loan','loan_home','Home Loan','Long-tenure secured loan to buy or build a home.','Home','blue',499,0.5,1.5,0,0,true,false,3),
('loan','loan_lap','Loan Against Property','Mortgage your property for a low-cost loan.','Building','blue',449,1,2.5,0,0,false,true,4),
('loan','loan_msme','MSME Loan','Government-backed credit for micro & small enterprises.','Factory','blue',349,1.5,3.5,0,0,false,false,5),
('loan','loan_working_capital','Working Capital Loan','Short-term liquidity for day-to-day operations.','Activity','blue',349,1.5,3,0,0,false,false,6),
('loan','loan_machinery','Machinery Loan','Finance industrial equipment & machines.','Cog','blue',299,2,4,0,0,false,true,7),
('loan','loan_equipment','Equipment Finance','Lease or buy commercial equipment.','HardHat','blue',299,2,4,0,0,false,false,8),
('loan','loan_education','Education Loan','Domestic & abroad study loans.','GraduationCap','blue',249,0.5,2,0,0,false,false,9),
('loan','loan_auto_new','Auto Loan (New Car)','Finance a brand new car.','Car','blue',249,1,3,0,0,false,false,10),
('loan','loan_auto_used','Auto Loan (Used Car)','Finance a pre-owned car.','Car','blue',249,2,5,0,0,false,true,11),
('loan','loan_two_wheeler','Two Wheeler Loan','EMI financing for bikes & scooters.','Bike','blue',149,3,5,0,0,false,false,12),
('loan','loan_gold','Gold Loan','Pledge gold for instant credit.','Coins','blue',199,1,3,0,0,true,false,13),
('loan','loan_construction','Construction Loan','Funding for self-construction of property.','Construction','blue',449,1,2.5,0,0,false,false,14),
('loan','loan_balance_transfer','Balance Transfer Loan','Switch existing loan to a lower rate.','Repeat','blue',299,1,2,0,0,false,false,15),

-- INSURANCE (ins_*)
('insurance','ins_term_life','Term Life Insurance','Pure protection life cover.','ShieldCheck','green',149,15,40,0,0,true,true,1),
('insurance','ins_ulip','ULIP','Unit-linked investment + life cover.','TrendingUp','green',199,8,25,0,0,false,true,2),
('insurance','ins_endowment','Endowment Plan','Savings with life cover.','PiggyBank','green',179,10,30,0,0,false,true,3),
('insurance','ins_health_individual','Health (Individual)','Mediclaim for one person.','Heart','green',129,15,35,0,0,true,true,4),
('insurance','ins_health_family','Health (Family Floater)','Single sum insured for the whole family.','Users','green',179,15,35,0,0,true,true,5),
('insurance','ins_health_senior','Health (Senior Citizen)','Tailored cover for 60+ age.','HeartHandshake','green',199,12,30,0,0,false,true,6),
('insurance','ins_motor_car','Motor (Car)','Mandatory + own-damage cover.','Car','green',99,15,30,0,0,true,false,7),
('insurance','ins_motor_bike','Motor (Bike)','Two-wheeler insurance.','Bike','green',79,15,30,0,0,false,false,8),
('insurance','ins_travel','Travel Insurance','Domestic & international travel cover.','Plane','green',79,10,25,0,0,false,false,9),
('insurance','ins_fire','Fire Insurance','Property cover against fire & allied perils.','Flame','green',149,12,30,0,0,false,true,10),
('insurance','ins_marine','Marine Insurance','Cargo & shipping cover.','Ship','green',199,15,35,0,0,false,true,11),
('insurance','ins_shop','Shop Insurance','Retail shopkeeper package policy.','Store','green',129,12,28,0,0,false,false,12),
('insurance','ins_cyber','Cyber Insurance','Online fraud & data breach cover.','ShieldAlert','green',149,15,32,0,0,true,true,13),

-- CREDIT CARDS (cc_*)
('credit_card','cc_lifetime_free','Lifetime Free Cards','No annual fee, ever.','CreditCard','orange',299,0,0,500,2000,true,false,1),
('credit_card','cc_cashback','Cashback Cards','Earn cashback on every spend.','Coins','orange',349,0,0,800,3000,true,true,2),
('credit_card','cc_travel','Travel Cards','Miles, lounge access, forex perks.','Plane','orange',499,0,0,1500,5000,false,true,3),
('credit_card','cc_business','Business Cards','GST input, expense management for SMEs.','Briefcase','orange',599,0,0,1000,4000,false,true,4),
('credit_card','cc_secured','Secured Cards','FD-backed cards for credit-builders.','Lock','orange',199,0,0,500,1500,false,false,5),

-- INVESTMENTS (inv_*)
('investment','inv_mutual_funds','Mutual Funds','SIP & Lump-sum equity / debt funds.','LineChart','purple',199,0.5,1.5,0,0,false,false,1),
('investment','inv_fixed_deposits','Fixed Deposits','Safe guaranteed returns.','Vault','purple',99,0.25,1,0,0,false,false,2),
('investment','inv_bonds','Bonds','Govt & corporate fixed-income.','FileText','purple',149,0.5,1.5,0,0,false,false,3),
('investment','inv_demat','Demat Account','Open trading + demat in minutes.','BarChart3','purple',249,0,0,200,1500,true,false,4),
('investment','inv_nps','NPS','National Pension Scheme onboarding.','Landmark','purple',129,0.25,1,0,0,false,false,5);

-- ============================================================
-- 5. SEED PIPELINES
-- ============================================================
INSERT INTO public.product_pipelines (category, name, stages) VALUES
('loan', 'Loan Pipeline', '[
  {"key":"new","label":"New","color":"slate"},
  {"key":"contacted","label":"Contacted","color":"blue"},
  {"key":"docs","label":"Docs","color":"indigo"},
  {"key":"submitted","label":"Submitted","color":"violet"},
  {"key":"approved","label":"Approved","color":"emerald"},
  {"key":"disbursed","label":"Disbursed","color":"green"}
]'::jsonb),
('insurance', 'Insurance Pipeline', '[
  {"key":"new","label":"New","color":"slate"},
  {"key":"quote","label":"Quote Shared","color":"blue"},
  {"key":"follow_up","label":"Follow-up","color":"amber"},
  {"key":"payment","label":"Payment","color":"violet"},
  {"key":"issued","label":"Policy Issued","color":"emerald"}
]'::jsonb),
('credit_card', 'Credit Card Pipeline', '[
  {"key":"new","label":"New","color":"slate"},
  {"key":"applied","label":"Applied","color":"blue"},
  {"key":"kyc","label":"KYC","color":"amber"},
  {"key":"approved","label":"Approved","color":"emerald"},
  {"key":"delivered","label":"Delivered","color":"green"}
]'::jsonb),
('investment', 'Investment Pipeline', '[
  {"key":"new","label":"New","color":"slate"},
  {"key":"contacted","label":"Contacted","color":"blue"},
  {"key":"kyc","label":"KYC","color":"amber"},
  {"key":"invested","label":"Invested","color":"emerald"}
]'::jsonb);

-- ============================================================
-- 6. Backfill leads → product_type_id
-- ============================================================
UPDATE public.leads l SET product_type_id = pt.id
  FROM public.product_types pt
  WHERE l.product_type_id IS NULL
    AND l.product_subtype IS NOT NULL
    AND pt.code = CASE l.product_category::text
      WHEN 'loan' THEN 'loan_' || l.product_subtype
      WHEN 'insurance' THEN 'ins_' || l.product_subtype
      WHEN 'credit_card' THEN 'cc_' || l.product_subtype
      WHEN 'investment' THEN 'inv_' || l.product_subtype
      ELSE l.product_subtype
    END;
