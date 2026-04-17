-- ===== Marketing templates (admin-curated, all users read) =====
CREATE TYPE public.marketing_template_kind AS ENUM ('post', 'reel', 'whatsapp', 'visiting_card');
CREATE TYPE public.marketing_product AS ENUM ('personal_loan','business_loan','home_loan','lap','msme','credit_card','insurance','investment','generic');

CREATE TABLE public.marketing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.marketing_template_kind NOT NULL DEFAULT 'post',
  product public.marketing_product NOT NULL DEFAULT 'generic',
  name TEXT NOT NULL,
  headline TEXT NOT NULL,
  subheadline TEXT,
  body TEXT,
  cta TEXT NOT NULL DEFAULT 'Apply Now',
  theme JSONB NOT NULL DEFAULT '{}'::jsonb, -- {bg, accent, text, pattern}
  enabled BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read enabled templates"
  ON public.marketing_templates FOR SELECT TO authenticated
  USING (enabled = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage templates"
  ON public.marketing_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_marketing_templates_updated_at
  BEFORE UPDATE ON public.marketing_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Visiting cards (one per user, can have multiple) =====
CREATE TABLE public.visiting_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  designation TEXT,
  company_name TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  whatsapp TEXT,
  website TEXT,
  city TEXT,
  photo_url TEXT,
  logo_url TEXT,
  products TEXT[] NOT NULL DEFAULT '{}',
  theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.visiting_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cards"
  ON public.visiting_cards FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_visiting_cards_updated_at
  BEFORE UPDATE ON public.visiting_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_visiting_cards_user ON public.visiting_cards(user_id);

-- ===== Marketing campaigns / shareable creatives =====
CREATE TABLE public.marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  template_id UUID REFERENCES public.marketing_templates(id) ON DELETE SET NULL,
  kind public.marketing_template_kind NOT NULL DEFAULT 'post',
  product public.marketing_product NOT NULL DEFAULT 'generic',
  title TEXT NOT NULL,
  custom_text JSONB NOT NULL DEFAULT '{}'::jsonb,
  referral_code TEXT UNIQUE,
  share_url TEXT,
  shares INTEGER NOT NULL DEFAULT 0,
  downloads INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own campaigns"
  ON public.marketing_campaigns FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_marketing_campaigns_updated_at
  BEFORE UPDATE ON public.marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_marketing_campaigns_user ON public.marketing_campaigns(user_id);

-- ===== Seed default templates =====
INSERT INTO public.marketing_templates (kind, product, name, headline, subheadline, body, cta, theme, display_order) VALUES
('post','personal_loan','PL — Instant Approval','Personal Loan up to ₹10 Lakhs','Approval in 24 hours','No collateral · Minimal documents · Flexible EMIs','Apply Now',
 '{"bg":"#0c2340","accent":"#2dd4a8","text":"#ffffff","pattern":"diagonal"}'::jsonb, 1),
('post','business_loan','BL — Grow Your Business','Business Loan up to ₹50 Lakhs','Fund your growth','Quick approval · Competitive rates · Up to 5 years tenure','Get Quote',
 '{"bg":"#1a1a2e","accent":"#e85d3a","text":"#ffffff","pattern":"dots"}'::jsonb, 2),
('post','home_loan','HL — Dream Home','Home Loan from 8.5%* p.a.','Make it yours today','Up to ₹5 Cr · 30-year tenure · Balance transfer available','Check Eligibility',
 '{"bg":"#fafbfc","accent":"#3b82f6","text":"#0a0a1a","pattern":"waves"}'::jsonb, 3),
('post','credit_card','Credit Card — Lifetime Free','Lifetime FREE Credit Card','Up to 5% cashback','Instant approval · Welcome bonus · Premium offers','Apply Free',
 '{"bg":"#0d0d0d","accent":"#c9a84c","text":"#f5f0e0","pattern":"luxury"}'::jsonb, 4),
('post','insurance','Term Insurance — ₹1 Cr Cover','Secure Your Family — ₹1 Cr Cover','Premium starts ₹500/mo','Tax benefits · Critical illness rider · 99% claim ratio','Get Quote',
 '{"bg":"#064e3b","accent":"#f5f0e0","text":"#ffffff","pattern":"shield"}'::jsonb, 5),
('post','lap','LAP — Loan Against Property','Loan Against Property','Up to 70% of property value','Lower interest rates · Long tenure · Multipurpose use','Know More',
 '{"bg":"#5c2018","accent":"#e8b84a","text":"#ffffff","pattern":"grid"}'::jsonb, 6),
('post','msme','MSME — Working Capital','MSME Working Capital Loan','Powered by Govt. schemes','Mudra · CGTMSE · No collateral up to ₹10L','Apply Today',
 '{"bg":"#1b4332","accent":"#73ffb8","text":"#ffffff","pattern":"diagonal"}'::jsonb, 7),
('post','generic','Festival Offer — Diwali','Diwali Special Offers','Lowest rates of the season','PL · BL · HL · Insurance · Limited period only','Grab Now',
 '{"bg":"#9b4423","accent":"#e8b84a","text":"#ffffff","pattern":"festive"}'::jsonb, 8),
('whatsapp','personal_loan','WA — Personal Loan Pitch','Get instant Personal Loan up to ₹10L','','Hi {{name}}, get instant Personal Loan up to ₹10L at attractive rates. Quick approval, minimal documents. Apply now: {{link}}','Apply Now',
 '{}'::jsonb, 1),
('whatsapp','credit_card','WA — Credit Card Offer','Lifetime FREE Credit Card','','Hi {{name}}, you are pre-approved for a Lifetime Free Credit Card with up to 5% cashback. Apply here: {{link}}','Apply Free',
 '{}'::jsonb, 2),
('whatsapp','insurance','WA — Term Plan Pitch','Term Insurance ₹1 Cr cover','','Hi {{name}}, secure your family with ₹1 Cr term cover at just ₹500/month. Get a free quote: {{link}}','Get Quote',
 '{}'::jsonb, 3),
('reel','personal_loan','Reel — PL Quick Pitch','Need cash fast?','15-second pitch','Hook → Problem → Solution → CTA','Apply Now',
 '{"bg":"#0c2340","accent":"#2dd4a8","text":"#ffffff"}'::jsonb, 1),
('reel','generic','Reel — Festival Bonanza','Festival Loan Bonanza','Limited offers','Stack 3 quick frames with offer text','Grab Now',
 '{"bg":"#9b4423","accent":"#e8b84a","text":"#ffffff"}'::jsonb, 2);