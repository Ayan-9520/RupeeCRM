-- Workspace role enum
CREATE TYPE public.workspace_role AS ENUM ('owner', 'admin', 'manager', 'employee', 'viewer');
CREATE TYPE public.workspace_plan AS ENUM ('starter', 'growth', 'pro', 'enterprise');

-- Workspaces table
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL,
  plan workspace_plan NOT NULL DEFAULT 'starter',
  seat_limit INTEGER NOT NULL DEFAULT 1,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Workspace members
CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role workspace_role NOT NULL DEFAULT 'employee',
  invited_by UUID,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX idx_workspace_members_workspace ON public.workspace_members(workspace_id);

-- Add workspace_id to leads and lead_purchases (nullable initially for legacy rows)
ALTER TABLE public.leads ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.lead_purchases ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

CREATE INDEX idx_leads_workspace ON public.leads(workspace_id);
CREATE INDEX idx_lead_purchases_workspace ON public.lead_purchases(workspace_id);

-- Security definer helpers (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.has_workspace_role(_workspace_id UUID, _user_id UUID, _roles workspace_role[])
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id AND role = ANY(_roles)
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_workspaces(_user_id UUID)
RETURNS TABLE (workspace_id UUID, role workspace_role)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT workspace_id, role FROM public.workspace_members WHERE user_id = _user_id
$$;

-- Enable RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Workspaces RLS
CREATE POLICY "Members can view their workspaces"
ON public.workspaces FOR SELECT TO authenticated
USING (public.is_workspace_member(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can create workspaces"
ON public.workspaces FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners and admins can update workspace"
ON public.workspaces FOR UPDATE TO authenticated
USING (public.has_workspace_role(id, auth.uid(), ARRAY['owner','admin']::workspace_role[]) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only owner can delete workspace"
ON public.workspaces FOR DELETE TO authenticated
USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

-- Workspace members RLS
CREATE POLICY "Members view own workspace members"
ON public.workspace_members FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners/admins invite members"
ON public.workspace_members FOR INSERT TO authenticated
WITH CHECK (
  public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']::workspace_role[])
  OR public.has_role(auth.uid(), 'admin')
  OR (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
);

CREATE POLICY "Owners/admins update member roles"
ON public.workspace_members FOR UPDATE TO authenticated
USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']::workspace_role[]) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners/admins remove members"
ON public.workspace_members FOR DELETE TO authenticated
USING (
  public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']::workspace_role[])
  OR public.has_role(auth.uid(), 'admin')
  OR auth.uid() = user_id
);

-- Update existing leads policies to include workspace scoping
DROP POLICY IF EXISTS "Authenticated can view available leads" ON public.leads;
CREATE POLICY "View leads in workspace or marketplace"
ON public.leads FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR (workspace_id IS NULL AND status = 'available')
  OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
  OR EXISTS (SELECT 1 FROM public.lead_purchases lp WHERE lp.lead_id = leads.id AND lp.dsa_id = auth.uid())
);

-- Update lead_purchases to scope by workspace
DROP POLICY IF EXISTS "DSAs view own purchases" ON public.lead_purchases;
CREATE POLICY "View purchases in own workspace"
ON public.lead_purchases FOR SELECT TO authenticated
USING (
  auth.uid() = dsa_id
  OR has_role(auth.uid(), 'admin')
  OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
);

-- Trigger: create personal workspace on signup
CREATE OR REPLACE FUNCTION public.create_personal_workspace()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ws_id UUID;
  _slug TEXT;
  _name TEXT;
BEGIN
  _name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'My Workspace');
  _slug := lower(regexp_replace(_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(NEW.id::text, 1, 8);

  INSERT INTO public.workspaces (name, slug, owner_id, plan, seat_limit)
  VALUES (_name || '''s Workspace', _slug, NEW.id, 'starter', 1)
  RETURNING id INTO _ws_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (_ws_id, NEW.id, 'owner');

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created_workspace
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_personal_workspace();

-- Backfill workspaces for existing users
DO $$
DECLARE u RECORD; _ws_id UUID; _slug TEXT;
BEGIN
  FOR u IN SELECT id, COALESCE((SELECT full_name FROM public.profiles WHERE id = au.id), 'User') AS name FROM auth.users au LOOP
    IF NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = u.id) THEN
      _slug := 'ws-' || substr(u.id::text, 1, 12);
      INSERT INTO public.workspaces (name, slug, owner_id, plan, seat_limit)
      VALUES (u.name || '''s Workspace', _slug, u.id, 'starter', 1)
      RETURNING id INTO _ws_id;
      INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES (_ws_id, u.id, 'owner');
    END IF;
  END LOOP;
END $$;

-- Updated_at trigger for workspaces
CREATE TRIGGER update_workspaces_updated_at
BEFORE UPDATE ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();