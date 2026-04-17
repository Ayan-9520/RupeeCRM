-- ============ ENUMS ============
CREATE TYPE public.wa_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE public.wa_msg_status AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed', 'received');
CREATE TYPE public.wa_conversation_status AS ENUM ('active', 'qualified', 'closed', 'spam');
CREATE TYPE public.wa_template_category AS ENUM ('welcome', 'menu', 'collect_info', 'offer', 'festival', 'reminder', 'eligibility', 'documents', 'custom');
CREATE TYPE public.wa_followup_status AS ENUM ('scheduled', 'sent', 'cancelled', 'failed');

-- ============ CONVERSATIONS ============
CREATE TABLE public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wa_phone TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  current_step TEXT NOT NULL DEFAULT 'menu',
  collected_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  product_interest TEXT,
  assigned_to UUID,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  status public.wa_conversation_status NOT NULL DEFAULT 'active',
  unread_count INTEGER NOT NULL DEFAULT 0,
  last_inbound_at TIMESTAMPTZ,
  last_outbound_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_conv_assigned ON public.whatsapp_conversations(assigned_to);
CREATE INDEX idx_wa_conv_lead ON public.whatsapp_conversations(lead_id);
CREATE INDEX idx_wa_conv_status ON public.whatsapp_conversations(status);
CREATE INDEX idx_wa_conv_last_inbound ON public.whatsapp_conversations(last_inbound_at DESC);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all conversations"
  ON public.whatsapp_conversations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Assigned user views conversation"
  ON public.whatsapp_conversations FOR SELECT
  TO authenticated
  USING (assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Assigned user updates conversation"
  ON public.whatsapp_conversations FOR UPDATE
  TO authenticated
  USING (assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_wa_conv_updated
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ MESSAGES ============
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  wa_message_id TEXT,
  direction public.wa_direction NOT NULL,
  body TEXT NOT NULL,
  template_name TEXT,
  status public.wa_msg_status NOT NULL DEFAULT 'received',
  is_bot BOOLEAN NOT NULL DEFAULT false,
  sent_by UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_msg_conv ON public.whatsapp_messages(conversation_id, created_at DESC);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all messages"
  ON public.whatsapp_messages FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Assigned user views messages"
  ON public.whatsapp_messages FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.whatsapp_conversations c
    WHERE c.id = whatsapp_messages.conversation_id
      AND (c.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  ));

-- ============ TEMPLATES ============
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category public.wa_template_category NOT NULL DEFAULT 'custom',
  body TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  variables TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read templates"
  ON public.whatsapp_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage templates"
  ON public.whatsapp_templates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_wa_tpl_updated
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ FOLLOW-UPS ============
CREATE TABLE public.whatsapp_followups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  send_at TIMESTAMPTZ NOT NULL,
  status public.wa_followup_status NOT NULL DEFAULT 'scheduled',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_followup_pending ON public.whatsapp_followups(status, send_at)
  WHERE status = 'scheduled';

ALTER TABLE public.whatsapp_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all followups"
  ON public.whatsapp_followups FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ SEED TEMPLATES ============
INSERT INTO public.whatsapp_templates (name, category, body, variables) VALUES
  ('welcome_menu', 'welcome',
   E'Hi 👋 Welcome to RupeeDial!\n\nWhich product are you interested in?\n\n1️⃣ Personal Loan\n2️⃣ Business Loan\n3️⃣ Credit Card\n4️⃣ Insurance\n\nReply with the number (1-4) or product name.',
   ARRAY[]::TEXT[]),
  ('collect_name', 'collect_info',
   E'Great choice! 🎯 To process your *{{product}}* request, may I know your full name?',
   ARRAY['product']),
  ('collect_city', 'collect_info',
   E'Thanks {{name}}! Which city are you based in?',
   ARRAY['name']),
  ('collect_amount', 'collect_info',
   E'Got it. What loan amount are you looking for? (in ₹)',
   ARRAY[]::TEXT[]),
  ('collect_income', 'collect_info',
   E'One last thing — what is your monthly income? (in ₹)',
   ARRAY[]::TEXT[]),
  ('lead_captured', 'welcome',
   E'🎉 Thanks {{name}}! Your application is in our system.\n\nOur expert will call you within 30 minutes to share the best offers.\n\nReference ID: *{{ref}}*',
   ARRAY['name', 'ref']),
  ('eligibility_link', 'eligibility',
   E'Check your instant eligibility here 👇\n{{link}}\n\nTakes 2 minutes — no documents needed.',
   ARRAY['link']),
  ('documents_checklist', 'documents',
   E'📄 *Documents Required:*\n\n• PAN Card\n• Aadhaar Card\n• Last 3 months salary slips\n• Last 6 months bank statement\n• Address proof\n\nUpload them here: {{link}}',
   ARRAY['link']),
  ('callback_confirmed', 'custom',
   E'✅ Got it! Our team will call you shortly. Please keep your phone handy.',
   ARRAY[]::TEXT[]),
  ('followup_10min', 'reminder',
   E'Hi {{name}} 👋 Just checking in — were you able to see our message? Reply anytime to continue.',
   ARRAY['name']),
  ('followup_24hr', 'reminder',
   E'Hi {{name}}, your *{{product}}* application is still open. We have great offers waiting — reply YES to continue.',
   ARRAY['name', 'product']),
  ('followup_3day', 'reminder',
   E'This is our last reminder regarding your *{{product}}* enquiry. Reply STOP to opt out, or YES to get a callback.',
   ARRAY['product']),
  ('loan_offer', 'offer',
   E'🔥 *Special Offer for {{name}}*\n\n{{product}} starting at *{{rate}}% p.a.*\nUp to ₹{{amount}} — Approval in 24 hrs!\n\nApply now: {{link}}',
   ARRAY['name', 'product', 'rate', 'amount', 'link']),
  ('festival_diwali', 'festival',
   E'✨ *Happy Diwali from RupeeDial!* ✨\n\nLight up your dreams with our festive loan offers — rates from *9.99%* + zero processing fee.\n\nGrab it: {{link}}',
   ARRAY['link']);