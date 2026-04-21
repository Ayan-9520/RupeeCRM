-- ============================================
-- Wallet: user-to-user transfers
-- ============================================
CREATE OR REPLACE FUNCTION public.transfer_money(
  _to_user_id uuid,
  _amount numeric,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _from_user uuid := auth.uid();
  _from_wallet RECORD;
  _to_wallet RECORD;
  _from_new numeric;
  _to_new numeric;
  _to_name text;
  _from_name text;
  _ref uuid := gen_random_uuid();
BEGIN
  IF _from_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _to_user_id IS NULL THEN RAISE EXCEPTION 'Recipient required'; END IF;
  IF _to_user_id = _from_user THEN RAISE EXCEPTION 'Cannot transfer to yourself'; END IF;
  IF _amount IS NULL OR _amount < 10 THEN RAISE EXCEPTION 'Minimum transfer is ₹10'; END IF;
  IF _amount > 50000 THEN RAISE EXCEPTION 'Maximum transfer is ₹50,000'; END IF;

  -- Lock both wallets in deterministic order to avoid deadlocks
  IF _from_user < _to_user_id THEN
    SELECT * INTO _from_wallet FROM public.wallets WHERE user_id = _from_user FOR UPDATE;
    SELECT * INTO _to_wallet FROM public.wallets WHERE user_id = _to_user_id FOR UPDATE;
  ELSE
    SELECT * INTO _to_wallet FROM public.wallets WHERE user_id = _to_user_id FOR UPDATE;
    SELECT * INTO _from_wallet FROM public.wallets WHERE user_id = _from_user FOR UPDATE;
  END IF;

  IF _from_wallet.user_id IS NULL THEN RAISE EXCEPTION 'Your wallet not found'; END IF;
  IF _to_wallet.user_id IS NULL THEN RAISE EXCEPTION 'Recipient wallet not found'; END IF;
  IF _from_wallet.balance < _amount THEN
    RAISE EXCEPTION 'Insufficient balance. Available: ₹%', _from_wallet.balance;
  END IF;

  SELECT COALESCE(full_name, 'User') INTO _to_name FROM public.profiles WHERE id = _to_user_id;
  SELECT COALESCE(full_name, 'User') INTO _from_name FROM public.profiles WHERE id = _from_user;

  -- Debit sender
  UPDATE public.wallets
     SET balance = balance - _amount,
         total_spent = total_spent + _amount,
         updated_at = now()
   WHERE user_id = _from_user
   RETURNING balance INTO _from_new;

  INSERT INTO public.wallet_transactions(user_id, type, amount, description, reference_id, balance_after)
  VALUES (_from_user, 'debit', _amount,
          'Transfer to ' || _to_name || COALESCE(' — ' || _note, ''),
          _ref, _from_new);

  -- Credit recipient
  UPDATE public.wallets
     SET balance = balance + _amount,
         total_recharged = total_recharged + _amount,
         updated_at = now()
   WHERE user_id = _to_user_id
   RETURNING balance INTO _to_new;

  INSERT INTO public.wallet_transactions(user_id, type, amount, description, reference_id, balance_after)
  VALUES (_to_user_id, 'credit', _amount,
          'Transfer from ' || _from_name || COALESCE(' — ' || _note, ''),
          _ref, _to_new);

  PERFORM public.notify(_to_user_id, 'system',
    '💸 You received ₹' || _amount,
    _from_name || ' sent you money' || COALESCE(' — ' || _note, '') || '. New balance: ₹' || _to_new,
    '/dashboard/wallet');

  RETURN jsonb_build_object(
    'success', true,
    'reference', _ref,
    'amount', _amount,
    'new_balance', _from_new,
    'recipient_name', _to_name
  );
END;
$$;

-- ============================================
-- Workspace admins can view member wallets
-- ============================================
CREATE OR REPLACE FUNCTION public.user_shares_workspace_with_admin(_target_user uuid, _viewer uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm_viewer
    JOIN public.workspace_members wm_target
      ON wm_target.workspace_id = wm_viewer.workspace_id
    WHERE wm_viewer.user_id = _viewer
      AND wm_viewer.role IN ('owner','admin')
      AND wm_target.user_id = _target_user
  );
$$;

-- Add new RLS policies (additive — existing policies remain)
DROP POLICY IF EXISTS "Workspace admins can view member wallets" ON public.wallets;
CREATE POLICY "Workspace admins can view member wallets"
ON public.wallets
FOR SELECT
USING (public.user_shares_workspace_with_admin(user_id, auth.uid()));

DROP POLICY IF EXISTS "Workspace admins can view member transactions" ON public.wallet_transactions;
CREATE POLICY "Workspace admins can view member transactions"
ON public.wallet_transactions
FOR SELECT
USING (public.user_shares_workspace_with_admin(user_id, auth.uid()));