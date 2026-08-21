CREATE OR REPLACE FUNCTION private.advance_career_clock(p_player_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_state record; v_new_date date; v_new_period smallint; v_contract record;
  v_recovery integer; v_energy_gain integer; v_fatigue_drop integer; v_fan_growth integer;
BEGIN
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=p_player_id FOR UPDATE;
  v_new_date:=v_state.career_date;
  v_new_period:=v_state.day_period+1;

  IF v_new_period>2 THEN
    v_new_period:=0;
    v_new_date:=v_state.career_date+1;
    v_recovery:=COALESCE(v_state.recovery_modifier,0);
    v_energy_gain:=GREATEST(7,12+ROUND(v_recovery*0.40)::int);
    v_fatigue_drop:=GREATEST(2,4+ROUND(v_recovery*0.25)::int);
    v_fan_growth:=GREATEST(0,
      FLOOR(COALESCE(v_state.fame,0)/8.0)::int
      + FLOOR(GREATEST(0,COALESCE(v_state.public_image,50)-50)/20.0)::int
      + FLOOR(GREATEST(0,COALESCE(v_state.form,50)-50)/25.0)::int
    );

    UPDATE public.player_career_state
    SET energy=private.career_clamp(energy+v_energy_gain),
        fatigue=private.career_clamp(fatigue-v_fatigue_drop),
        pressure=private.career_clamp(pressure-2),
        injury_days=GREATEST(0,injury_days-1),
        injury_status=CASE WHEN injury_days-1<=0 THEN 'healthy' ELSE injury_status END,
        injury_label=CASE WHEN injury_days-1<=0 THEN NULL ELSE injury_label END,
        fanbase=GREATEST(0,fanbase+v_fan_growth)
    WHERE player_id=p_player_id;

    SELECT * INTO v_contract
    FROM public.player_contracts
    WHERE player_id=p_player_id AND status='active'
    ORDER BY signed_at DESC LIMIT 1;

    IF v_state.last_salary_date IS NOT NULL AND v_new_date>=v_state.last_salary_date+30 THEN
      UPDATE public.player_career_state
      SET cash_balance=cash_balance+COALESCE(v_contract.monthly_wage,0),last_salary_date=v_new_date
      WHERE player_id=p_player_id;
      INSERT INTO public.player_messages(player_id,club_id,message_type,subject,body,metadata)
      VALUES(p_player_id,v_contract.club_id,'career','Salário recebido','O pagamento mensal do seu contrato foi depositado na sua conta.',jsonb_build_object('kind','salary','amount',COALESCE(v_contract.monthly_wage,0)));
    END IF;
  END IF;

  UPDATE public.player_career_state
  SET career_date=v_new_date,day_period=v_new_period,updated_at=now()
  WHERE player_id=p_player_id;

  IF v_new_date<>v_state.career_date THEN
    PERFORM private.ensure_shirt_request(p_player_id);
    PERFORM private.maybe_send_development_reports(p_player_id,v_new_date);
    PERFORM private.maybe_generate_sponsor_opportunity(p_player_id);
    PERFORM private.roll_squad_week_event(p_player_id,v_new_date);
  END IF;
  PERFORM private.ensure_match_selection_if_due(p_player_id);
END; $$;
