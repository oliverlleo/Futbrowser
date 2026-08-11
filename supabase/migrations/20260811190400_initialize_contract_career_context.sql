CREATE OR REPLACE FUNCTION private.bootstrap_contract_career_meta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'active' THEN
    PERFORM private.ensure_shirt_request(NEW.player_id);
    PERFORM private.ensure_teammate_relations(NEW.player_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bootstrap_contract_career_meta ON public.player_contracts;
CREATE TRIGGER trg_bootstrap_contract_career_meta
AFTER INSERT ON public.player_contracts
FOR EACH ROW
EXECUTE FUNCTION private.bootstrap_contract_career_meta();
