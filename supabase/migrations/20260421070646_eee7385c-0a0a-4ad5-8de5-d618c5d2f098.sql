-- ============================================================
-- COMMISSION ENGINE (additive — does not modify existing logic)
-- ============================================================

-- Enum for commission recipient roles
DO $$ BEGIN
  CREATE TYPE public.commission_role AS ENUM ('company', 'manager', 'employee', 'partner', 'referrer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enum for commission entry status
DO $$ BEGIN
  CREATE TYPE public.commission_status AS ENUM ('pending', 'credited', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- TABLE: commission_rules
-- ============================================================
CREATE TABLE IF NOT EXISTS public.commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.commission_role NOT NULL UNIQUE,
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authed reads active rules"
  ON public.commission_rules FOR SELECT TO authenticated
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage rules"
  ON public.commission_rules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_commission_rules_updated_at
  BEFORE UPDATE ON public.commission_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default rules
INSERT INTO public.commission_rules (role, percentage, description) VALUES
  ('company',  40, 'Platform / company share'),
  ('manager',  20, 'Workspace owner / manager share'),
  ('employee', 20, 'DSA who closed the lead'),
  ('partner',  20, 'Parent partner workspace share'),
  ('referrer',  0, 'Optional referrer override (disabled by default)')
ON CONFLICT (role) DO NOTHING;

-- ============================================================
-- TABLE: commissions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  disbursal_id UUID NOT NULL REFERENCES public.disbursals(id) ON DELETE CASCADE,
  user_id UUID,                              -- recipient (NULL = company/platform)
  role public.commission_role NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  base_amount NUMERIC(12,2) NOT NULL,        -- disbursal commission_amount
  percentage NUMERIC(5,2) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status public.commission_status NOT NULL DEFAULT 'pending',
  wallet_txn_id UUID,
  notes TEXT,
  credited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commissions_user ON public.commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_disbursal ON public.commissions(disbursal_id);
CREATE INDEX IF NOT EXISTS idx_commissions_workspace ON public.commissions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_commissions_lead ON public.commissions(lead_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_disbursal_role
  ON public.commissions(disbursal_id, role, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid));

ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recipients view own commissions"
  ON public.commissions FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (workspace_id IS NOT NULL AND is_workspace_member(workspace_id, auth.uid()))
  );

CREATE POLICY "Admins manage commissions"
  ON public.commissions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_commissions_updated_at
  BEFORE UPDATE ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- FUNCTION: calculate_and_distribute_commission
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_and_distribute_commission(_disbursal_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_disbursal       RECORD;
  v_purchase        RECORD;
  v_workspace       RECORD;
  v_rule            RECORD;
  v_recipient       UUID;
  v_amount          NUMERIC(12,2);
  v_base            NUMERIC(12,2);
  v_wallet_balance  NUMERIC(12,2);
  v_txn_id          UUID;
  v_results         JSONB := '[]'::jsonb;
BEGIN
  -- Skip if already distributed
  IF EXISTS (SELECT 1 FROM commissions WHERE disbursal_id = _disbursal_id AND status = 'credited') THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'already_distributed');
  END IF;

  SELECT * INTO v_disbursal FROM disbursals WHERE id = _disbursal_id;
  IF NOT FOUND OR v_disbursal.commission_amount <= 0 THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'no_commission');
  END IF;

  v_base := v_disbursal.commission_amount;

  SELECT * INTO v_purchase FROM lead_purchases WHERE id = v_disbursal.lead_purchase_id;
  IF v_purchase.workspace_id IS NOT NULL THEN
    SELECT w.*, p.owner_id AS parent_owner_id
    INTO v_workspace
    FROM workspaces w
    LEFT JOIN workspaces p ON p.id = w.parent_workspace_id
    WHERE w.id = v_purchase.workspace_id;
  END IF;

  FOR v_rule IN
    SELECT role, percentage FROM commission_rules
    WHERE is_active = true AND percentage > 0
    ORDER BY role
  LOOP
    v_recipient := NULL;
    v_amount := ROUND(v_base * v_rule.percentage / 100, 2);

    -- Map role -> recipient user_id
    IF v_rule.role = 'company' THEN
      v_recipient := NULL;  -- platform
    ELSIF v_rule.role = 'employee' THEN
      v_recipient := v_purchase.dsa_id;
    ELSIF v_rule.role = 'manager' THEN
      v_recipient := v_workspace.owner_id;
    ELSIF v_rule.role = 'partner' THEN
      v_recipient := v_workspace.parent_owner_id;
    ELSIF v_rule.role = 'referrer' THEN
      SELECT ref_dsa_id INTO v_recipient FROM leads WHERE id = v_disbursal.lead_id;
    END IF;

    -- Insert ledger entry
    INSERT INTO commissions (
      lead_id, lead_purchase_id, disbursal_id, user_id, role,
      workspace_id, base_amount, percentage, amount, status, notes
    )
    VALUES (
      v_disbursal.lead_id, v_disbursal.lead_purchase_id, _disbursal_id,
      v_recipient, v_rule.role, v_purchase.workspace_id,
      v_base, v_rule.percentage, v_amount,
      CASE WHEN v_recipient IS NULL AND v_rule.role <> 'company' THEN 'cancelled' ELSE 'pending' END,
      CASE WHEN v_recipient IS NULL AND v_rule.role <> 'company' THEN 'No recipient mapped' ELSE NULL END
    )
    ON CONFLICT (disbursal_id, role, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid)) DO NOTHING;

    -- Credit wallet for individual recipients
    IF v_recipient IS NOT NULL AND v_amount > 0 THEN
      INSERT INTO wallets (user_id, balance) VALUES (v_recipient, 0) ON CONFLICT (user_id) DO NOTHING;
      UPDATE wallets SET balance = balance + v_amount, updated_at = now()
        WHERE user_id = v_recipient
        RETURNING balance INTO v_wallet_balance;

      INSERT INTO wallet_transactions (user_id, amount, type, description, balance_after, reference_id)
      VALUES (
        v_recipient, v_amount, 'credit',
        format('Commission (%s) — Lead %s', v_rule.role, v_disbursal.lead_id),
        v_wallet_balance, _disbursal_id
      )
      RETURNING id INTO v_txn_id;

      UPDATE commissions
      SET status = 'credited', credited_at = now(), wallet_txn_id = v_txn_id
      WHERE disbursal_id = _disbursal_id AND role = v_rule.role AND user_id = v_recipient;

      INSERT INTO notifications (user_id, type, title, body, link, metadata)
      VALUES (
        v_recipient, 'commission_credited',
        'Commission credited',
        format('₹%s credited to your wallet (%s share)', v_amount, v_rule.role),
        '/dashboard/earnings',
        jsonb_build_object('disbursal_id', _disbursal_id, 'amount', v_amount, 'role', v_rule.role)
      );
    END IF;

    v_results := v_results || jsonb_build_object('role', v_rule.role, 'recipient', v_recipient, 'amount', v_amount);
  END LOOP;

  RETURN jsonb_build_object('success', true, 'base_amount', v_base, 'splits', v_results);
END;
$$;

-- Add notification type if missing
DO $$ BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'commission_credited';
EXCEPTION WHEN others THEN NULL; END $$;

-- ============================================================
-- TRIGGER: auto-distribute when disbursal status -> 'disbursed'
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_disbursal_distribute_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'disbursed' AND (OLD.status IS DISTINCT FROM 'disbursed') THEN
    PERFORM public.calculate_and_distribute_commission(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_disbursals_auto_commission ON public.disbursals;
CREATE TRIGGER trg_disbursals_auto_commission
  AFTER INSERT OR UPDATE OF status ON public.disbursals
  FOR EACH ROW EXECUTE FUNCTION public.trg_disbursal_distribute_commission();
