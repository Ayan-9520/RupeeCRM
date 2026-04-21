-- Partner sub-tenant hierarchy
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS parent_workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workspaces_parent ON public.workspaces(parent_workspace_id);

-- CEO / super_admin detector
CREATE OR REPLACE FUNCTION public.is_ceo_or_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('ceo'::app_role, 'super_admin'::app_role)
  )
$$;

-- Workspace membership: includes CEO/super_admin via owned-ancestor chain
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_member BOOLEAN;
  _is_elevated BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  ) INTO _is_member;
  IF _is_member THEN RETURN true; END IF;

  SELECT public.is_ceo_or_super_admin(_user_id) INTO _is_elevated;
  IF _is_elevated THEN
    RETURN EXISTS (
      WITH RECURSIVE chain AS (
        SELECT id, parent_workspace_id, owner_id
        FROM public.workspaces WHERE id = _workspace_id
        UNION ALL
        SELECT w.id, w.parent_workspace_id, w.owner_id
        FROM public.workspaces w
        JOIN chain c ON c.parent_workspace_id = w.id
      )
      SELECT 1 FROM chain WHERE owner_id = _user_id
    );
  END IF;

  RETURN false;
END;
$$;

-- CEO workspace tree (own + descendants)
CREATE OR REPLACE FUNCTION public.get_ceo_workspaces(_user_id uuid)
RETURNS TABLE(workspace_id uuid, name text, parent_workspace_id uuid, depth int)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE tree AS (
    SELECT w.id, w.name, w.parent_workspace_id, 0 AS depth
    FROM public.workspaces w
    WHERE w.owner_id = _user_id
    UNION ALL
    SELECT w.id, w.name, w.parent_workspace_id, t.depth + 1
    FROM public.workspaces w
    JOIN tree t ON w.parent_workspace_id = t.id
  )
  SELECT id AS workspace_id, name, parent_workspace_id, depth FROM tree
$$;