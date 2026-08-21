BEGIN;

-- Contract and sporting squad are different concepts.
-- Academy offers are made by the base organization; competition entries must use
-- the sporting team whose squad_level matches the competition age_level.

CREATE OR REPLACE FUNCTION private.validate_competition_entry_squad()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_stage text;v_age text;v_squad text;
BEGIN
 SELECT d.career_stage,lower(d.age_level) INTO v_stage,v_age
 FROM public.career_competition_seasons s JOIN public.competition_definitions d ON d.code=s.competition_code
 WHERE s.id=NEW.season_id;
 IF v_stage='academy' THEN
  SELECT squad_level INTO v_squad FROM public.base_clubs WHERE id=NEW.club_id;
  IF v_squad IS DISTINCT FROM v_age THEN
   RAISE EXCEPTION 'Equipe % não pertence à categoria % desta competição.',NEW.club_id,upper(v_age);
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_competition_entry_squad ON public.career_competition_entries;
CREATE TRIGGER trg_validate_competition_entry_squad
BEFORE INSERT OR UPDATE OF season_id,club_id ON public.career_competition_entries
FOR EACH ROW EXECUTE FUNCTION private.validate_competition_entry_squad();

CREATE OR REPLACE FUNCTION private.validate_competition_fixture_squads()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_stage text;v_age text;v_home text;v_away text;
BEGIN
 SELECT d.career_stage,lower(d.age_level) INTO v_stage,v_age
 FROM public.career_competition_seasons s JOIN public.competition_definitions d ON d.code=s.competition_code
 WHERE s.id=NEW.season_id;
 IF v_stage='academy' THEN
  IF NEW.home_club_id IS NOT NULL THEN SELECT squad_level INTO v_home FROM public.base_clubs WHERE id=NEW.home_club_id;END IF;
  IF NEW.away_club_id IS NOT NULL THEN SELECT squad_level INTO v_away FROM public.base_clubs WHERE id=NEW.away_club_id;END IF;
  IF NEW.home_club_id IS NOT NULL AND v_home IS DISTINCT FROM v_age THEN
   RAISE EXCEPTION 'Mandante % não pertence à categoria % desta competição.',NEW.home_club_id,upper(v_age);
  END IF;
  IF NEW.away_club_id IS NOT NULL AND v_away IS DISTINCT FROM v_age THEN
   RAISE EXCEPTION 'Visitante % não pertence à categoria % desta competição.',NEW.away_club_id,upper(v_age);
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_competition_fixture_squads ON public.career_competition_fixtures;
CREATE TRIGGER trg_validate_competition_fixture_squads
BEFORE INSERT OR UPDATE OF season_id,home_club_id,away_club_id ON public.career_competition_fixtures
FOR EACH ROW EXECUTE FUNCTION private.validate_competition_fixture_squads();

CREATE OR REPLACE FUNCTION private.validate_competition_stat_squad()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_stage text;v_age text;v_squad text;
BEGIN
 SELECT d.career_stage,lower(d.age_level) INTO v_stage,v_age
 FROM public.career_competition_seasons s JOIN public.competition_definitions d ON d.code=s.competition_code
 WHERE s.id=NEW.season_id;
 IF v_stage='academy' THEN
  SELECT squad_level INTO v_squad FROM public.base_clubs WHERE id=NEW.club_id;
  IF v_squad IS DISTINCT FROM v_age THEN
   RAISE EXCEPTION 'Estatística vinculada a equipe % fora da categoria %.',NEW.club_id,upper(v_age);
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_competition_stat_squad ON public.career_competition_player_stats;
CREATE TRIGGER trg_validate_competition_stat_squad
BEFORE INSERT OR UPDATE OF season_id,club_id ON public.career_competition_player_stats
FOR EACH ROW EXECUTE FUNCTION private.validate_competition_stat_squad();

CREATE OR REPLACE FUNCTION private.validate_academy_offer_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_level text;v_squad text;
BEGIN
 SELECT club_level,squad_level INTO v_level,v_squad FROM public.base_clubs WHERE id=NEW.club_id;
 IF v_level='academy' AND v_squad IS DISTINCT FROM 'base' THEN
  RAISE EXCEPTION 'Contrato de base deve ser ofertado pela base do clube, não pela equipe %.',upper(coalesce(v_squad,'indefinida'));
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_academy_offer_scope ON public.player_offers;
CREATE TRIGGER trg_validate_academy_offer_scope
BEFORE INSERT OR UPDATE OF club_id ON public.player_offers
FOR EACH ROW EXECUTE FUNCTION private.validate_academy_offer_scope();

COMMIT;
