-- Phase 6: AI intelligence, communications, automation, SLA (additive)

-- Ensure app_role enum values exist (safe if 20260421064906 was not applied)
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ceo';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend notification types for LOS events
DO $$ BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'sanction_approved';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'payout_received';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'stage_updated';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'task_assigned';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- customer_ai_insights
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  dsa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL DEFAULT 'followup_suggestion',
  channel TEXT DEFAULT 'general',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority_score INTEGER DEFAULT 50,
  intent_tags TEXT[] DEFAULT '{}',
  suggested_action TEXT,
  scheduled_for TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_ai_insights_purchase ON public.customer_ai_insights(lead_purchase_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- customer_communications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  dsa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outbound',
  subject TEXT,
  body TEXT NOT NULL,
  template_key TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_communications_purchase ON public.customer_communications(lead_purchase_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- customer_communication_templates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_communication_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dsa_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  name TEXT NOT NULL,
  body_template TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- customer_automation_rules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dsa_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dsa_id, rule_key)
);

-- ---------------------------------------------------------------------------
-- customer_automation_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key TEXT NOT NULL,
  customer_profile_id UUID REFERENCES public.customer_profiles(id) ON DELETE SET NULL,
  lead_purchase_id UUID REFERENCES public.lead_purchases(id) ON DELETE SET NULL,
  dsa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'success',
  message TEXT,
  task_id UUID REFERENCES public.customer_tasks(id) ON DELETE SET NULL,
  retry_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_automation_logs_dsa ON public.customer_automation_logs(dsa_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- customer_sla_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_sla_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  dsa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sla_type TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  target_hours INTEGER NOT NULL DEFAULT 24,
  status TEXT NOT NULL DEFAULT 'on_track',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_sla_events_purchase ON public.customer_sla_events(lead_purchase_id, sla_type);

-- updated_at triggers
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['customer_automation_rules', 'customer_sla_events']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      t, t
    );
  END LOOP;
END $$;

-- RLS
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customer_ai_insights',
    'customer_communications',
    'customer_automation_logs',
    'customer_sla_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_select" ON public.%I FOR SELECT TO authenticated USING (public.user_owns_lead_purchase(lead_purchase_id))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.user_owns_lead_purchase(lead_purchase_id) AND dsa_id = auth.uid())', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_update" ON public.%I FOR UPDATE TO authenticated USING (public.user_owns_lead_purchase(lead_purchase_id)) WITH CHECK (public.user_owns_lead_purchase(lead_purchase_id))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_delete" ON public.%I FOR DELETE TO authenticated USING (public.user_owns_lead_purchase(lead_purchase_id))', t, t);
  END LOOP;
END $$;

-- automation_rules: DSA owns their rules; admins see all via has_role
ALTER TABLE public.customer_automation_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customer_automation_rules_select" ON public.customer_automation_rules;
CREATE POLICY "customer_automation_rules_select" ON public.customer_automation_rules
  FOR SELECT TO authenticated
  USING (dsa_id IS NULL OR dsa_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "customer_automation_rules_mutate" ON public.customer_automation_rules;
CREATE POLICY "customer_automation_rules_mutate" ON public.customer_automation_rules
  FOR ALL TO authenticated
  USING (dsa_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (dsa_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- templates: system + own
ALTER TABLE public.customer_communication_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customer_communication_templates_select" ON public.customer_communication_templates;
CREATE POLICY "customer_communication_templates_select" ON public.customer_communication_templates
  FOR SELECT TO authenticated
  USING (is_system = true OR dsa_id = auth.uid() OR dsa_id IS NULL);
DROP POLICY IF EXISTS "customer_communication_templates_insert" ON public.customer_communication_templates;
CREATE POLICY "customer_communication_templates_insert" ON public.customer_communication_templates
  FOR INSERT TO authenticated WITH CHECK (dsa_id = auth.uid());

-- Seed system templates (idempotent)
INSERT INTO public.customer_communication_templates (dsa_id, channel, name, body_template, is_system)
SELECT NULL, 'whatsapp', 'Doc reminder', 'Hi {{name}}, please share your pending documents for faster loan processing. — {{dsa}}', true
WHERE NOT EXISTS (SELECT 1 FROM public.customer_communication_templates WHERE is_system AND channel = 'whatsapp' AND name = 'Doc reminder');

INSERT INTO public.customer_communication_templates (dsa_id, channel, name, body_template, is_system)
SELECT NULL, 'sms', 'Follow-up', 'Dear {{name}}, we tried reaching you regarding your loan application. Please call us back.', true
WHERE NOT EXISTS (SELECT 1 FROM public.customer_communication_templates WHERE is_system AND channel = 'sms' AND name = 'Follow-up');

INSERT INTO public.customer_communication_templates (dsa_id, channel, name, body_template, is_system)
SELECT NULL, 'email', 'Sanction update', E'Dear {{name}},\n\nYour loan application has progressed. We will share sanction details shortly.\n\nRegards,\n{{dsa}}', true
WHERE NOT EXISTS (SELECT 1 FROM public.customer_communication_templates WHERE is_system AND channel = 'email' AND name = 'Sanction update');

INSERT INTO public.customer_communication_templates (dsa_id, channel, name, body_template, is_system)
SELECT NULL, 'call', 'Call script', 'Introduce yourself, confirm interest, check document status, schedule next follow-up.', true
WHERE NOT EXISTS (SELECT 1 FROM public.customer_communication_templates WHERE is_system AND channel = 'call' AND name = 'Call script');

-- Seed default automation rules (system-wide)
INSERT INTO public.customer_automation_rules (dsa_id, rule_key, name, description, enabled, config)
SELECT NULL, 'docs_pending_reminder', 'Docs pending reminder', 'Create task if docs pending > 3 days', true, '{"days": 3}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.customer_automation_rules WHERE dsa_id IS NULL AND rule_key = 'docs_pending_reminder');

INSERT INTO public.customer_automation_rules (dsa_id, rule_key, name, description, enabled, config)
SELECT NULL, 'sanction_disbursal_task', 'Sanction → disbursal task', 'Create disbursal task on sanction', true, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.customer_automation_rules WHERE dsa_id IS NULL AND rule_key = 'sanction_disbursal_task');

INSERT INTO public.customer_automation_rules (dsa_id, rule_key, name, description, enabled, config)
SELECT NULL, 'payout_followup', 'Payout follow-up', 'Follow up if payout pending > 7 days', true, '{"days": 7}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.customer_automation_rules WHERE dsa_id IS NULL AND rule_key = 'payout_followup');

INSERT INTO public.customer_automation_rules (dsa_id, rule_key, name, description, enabled, config)
SELECT NULL, 'unreachable_retry', 'Unreachable retry', 'Schedule retry if customer unreachable', true, '{"days": 2}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.customer_automation_rules WHERE dsa_id IS NULL AND rule_key = 'unreachable_retry');

INSERT INTO public.customer_automation_rules (dsa_id, rule_key, name, description, enabled, config)
SELECT NULL, 'rejected_lender_alt', 'Alternate lender on rejection', 'Recommend alternate lender', true, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.customer_automation_rules WHERE dsa_id IS NULL AND rule_key = 'rejected_lender_alt');
