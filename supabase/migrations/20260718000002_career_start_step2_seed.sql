-- Migration: 20260718000002_career_start_step2_seed.sql

BEGIN;

DO $$
DECLARE
    -- Treinadores
    v_coach1 UUID;
    v_coach2 UUID;
    v_coach3 UUID;
    v_coach4 UUID;
    v_coach5 UUID;

    -- Clubes
    v_club1 UUID;
    v_club2 UUID;
    v_club3 UUID;
    v_club4 UUID;
    v_club5 UUID;

    -- Função auxiliar para jogadores IA
    i INT;
    v_ovr INT;
    v_titular BOOLEAN;
    v_funcao VARCHAR;
    v_pos VARCHAR;
    v_archetype VARCHAR;
BEGIN
    -- 1. SEED TREINADORES
    INSERT INTO public.base_coaches (name, profile) VALUES ('Marcelo Ferraz', 'Rígido') RETURNING id INTO v_coach1;
    INSERT INTO public.base_coaches (name, profile) VALUES ('Bruno Salles', 'Amigável') RETURNING id INTO v_coach2;
    INSERT INTO public.base_coaches (name, profile) VALUES ('Henrique Paiva', 'Técnico') RETURNING id INTO v_coach3;
    INSERT INTO public.base_coaches (name, profile) VALUES ('Sérgio Almeida', 'Teórico') RETURNING id INTO v_coach4;
    INSERT INTO public.base_coaches (name, profile) VALUES ('Eduardo Braga', 'Equilibrado') RETURNING id INTO v_coach5;

    -- 2. SEED CLUBES
    INSERT INTO public.base_clubs (name, city, shield_url, reputation, formation, play_style, coach_id, flexibility, base_terms)
    VALUES (
        'Atlético do Vale Sub-18', 'Vale do Sol', 'img/clubs/atletico_vale.png', 4, '4-3-3', 'Ofensivo', v_coach1, 20, 
        '{"squad_role":"Reserva","duration_seasons":2,"monthly_wage":1800,"signing_bonus":3000,"release_clause":600000}'
    ) RETURNING id INTO v_club1;

    INSERT INTO public.base_clubs (name, city, shield_url, reputation, formation, play_style, coach_id, flexibility, base_terms)
    VALUES (
        'União Litorânea Sub-18', 'Costa Verde', 'img/clubs/uniao_litoranea.png', 2, '4-2-3-1', 'Pelas alas', v_coach2, 45, 
        '{"squad_role":"Titular","duration_seasons":2,"monthly_wage":1250,"signing_bonus":1000,"release_clause":250000}'
    ) RETURNING id INTO v_club2;

    INSERT INTO public.base_clubs (name, city, shield_url, reputation, formation, play_style, coach_id, flexibility, base_terms)
    VALUES (
        'Academia Aurora Sub-18', 'Aurora', 'img/clubs/aurora.png', 5, '4-3-3', 'Posse de bola', v_coach3, 10, 
        '{"squad_role":"Promessa","duration_seasons":3,"monthly_wage":1600,"signing_bonus":4000,"release_clause":1000000}'
    ) RETURNING id INTO v_club3;

    INSERT INTO public.base_clubs (name, city, shield_url, reputation, formation, play_style, coach_id, flexibility, base_terms)
    VALUES (
        'Ferroviário Central Sub-18', 'Centro', 'img/clubs/ferroviario.png', 3, '4-4-2', 'Contra-ataque', v_coach4, 30, 
        '{"squad_role":"Rotação","duration_seasons":2,"monthly_wage":1450,"signing_bonus":2000,"release_clause":400000}'
    ) RETURNING id INTO v_club4;

    INSERT INTO public.base_clubs (name, city, shield_url, reputation, formation, play_style, coach_id, flexibility, base_terms)
    VALUES (
        'Real Horizonte Sub-18', 'Horizonte', 'img/clubs/horizonte.png', 3, '4-2-3-1', 'Equilibrado', v_coach5, 35, 
        '{"squad_role":"Rotação","duration_seasons":3,"monthly_wage":1550,"signing_bonus":2500,"release_clause":550000}'
    ) RETURNING id INTO v_club5;

    -- 3. SEED ACADEMIAS
    INSERT INTO public.base_academy_profiles (club_id, physical, speed, technical, recovery, tactical) VALUES
    (v_club1, 5, 3, 2, 2, 4),
    (v_club2, 2, 5, 3, 3, 2),
    (v_club3, 2, 3, 5, 2, 4),
    (v_club4, 3, 3, 2, 5, 5),
    (v_club5, 4, 4, 4, 4, 4);

    -- 4. SEED ELENCOS
    -- Atlético do Vale (Reputação 4 - OVR aprox 60)
    FOR i IN 1..18 LOOP
        IF i <= 11 THEN v_titular := true; v_funcao := 'Titular'; v_ovr := 58 + (i % 5);
        ELSIF i <= 15 THEN v_titular := false; v_funcao := 'Reserva'; v_ovr := 52 + (i % 4);
        ELSE v_titular := false; v_funcao := 'Promessa'; v_ovr := 48 + (i % 3);
        END IF;

        IF i = 1 THEN v_pos := 'Goleiro'; v_archetype := 'Defesa';
        ELSIF i BETWEEN 2 AND 5 THEN v_pos := 'Zagueiro'; v_archetype := 'Raçudo';
        ELSIF i BETWEEN 6 AND 8 THEN v_pos := 'Meia'; v_archetype := 'Criador';
        ELSE v_pos := 'Atacante'; v_archetype := 'Finalizador';
        END IF;

        INSERT INTO public.base_ai_players (club_id, name, age, primary_position, ovr, archetype, squad_role, is_starter)
        VALUES (v_club1, 'Jogador IA ' || i || 'A', 17, v_pos, v_ovr, v_archetype, v_funcao, v_titular);
    END LOOP;

    -- União Litorânea (Reputação 2 - OVR aprox 54)
    FOR i IN 1..18 LOOP
        IF i <= 11 THEN v_titular := true; v_funcao := 'Titular'; v_ovr := 52 + (i % 5);
        ELSIF i <= 15 THEN v_titular := false; v_funcao := 'Reserva'; v_ovr := 46 + (i % 4);
        ELSE v_titular := false; v_funcao := 'Promessa'; v_ovr := 42 + (i % 3);
        END IF;
        IF i = 1 THEN v_pos := 'Goleiro'; ELSIF i <= 5 THEN v_pos := 'Zagueiro'; ELSIF i <= 8 THEN v_pos := 'Meia'; ELSE v_pos := 'Atacante'; END IF;
        INSERT INTO public.base_ai_players (club_id, name, age, primary_position, ovr, squad_role, is_starter)
        VALUES (v_club2, 'Jogador IA ' || i || 'B', 17, v_pos, v_ovr, v_funcao, v_titular);
    END LOOP;

    -- Academia Aurora (Reputação 5 - OVR aprox 62)
    FOR i IN 1..18 LOOP
        IF i <= 11 THEN v_titular := true; v_funcao := 'Titular'; v_ovr := 60 + (i % 5);
        ELSIF i <= 15 THEN v_titular := false; v_funcao := 'Reserva'; v_ovr := 55 + (i % 4);
        ELSE v_titular := false; v_funcao := 'Promessa'; v_ovr := 50 + (i % 3);
        END IF;
        IF i = 1 THEN v_pos := 'Goleiro'; ELSIF i <= 5 THEN v_pos := 'Zagueiro'; ELSIF i <= 8 THEN v_pos := 'Meia'; ELSE v_pos := 'Atacante'; END IF;
        INSERT INTO public.base_ai_players (club_id, name, age, primary_position, ovr, squad_role, is_starter)
        VALUES (v_club3, 'Jogador IA ' || i || 'C', 17, v_pos, v_ovr, v_funcao, v_titular);
    END LOOP;

    -- Ferroviário Central (Reputação 3 - OVR aprox 57)
    FOR i IN 1..18 LOOP
        IF i <= 11 THEN v_titular := true; v_funcao := 'Titular'; v_ovr := 55 + (i % 5);
        ELSIF i <= 15 THEN v_titular := false; v_funcao := 'Reserva'; v_ovr := 49 + (i % 4);
        ELSE v_titular := false; v_funcao := 'Promessa'; v_ovr := 45 + (i % 3);
        END IF;
        IF i = 1 THEN v_pos := 'Goleiro'; ELSIF i <= 5 THEN v_pos := 'Zagueiro'; ELSIF i <= 8 THEN v_pos := 'Meia'; ELSE v_pos := 'Atacante'; END IF;
        INSERT INTO public.base_ai_players (club_id, name, age, primary_position, ovr, squad_role, is_starter)
        VALUES (v_club4, 'Jogador IA ' || i || 'D', 17, v_pos, v_ovr, v_funcao, v_titular);
    END LOOP;

    -- Real Horizonte (Reputação 3 - OVR aprox 58)
    FOR i IN 1..18 LOOP
        IF i <= 11 THEN v_titular := true; v_funcao := 'Titular'; v_ovr := 56 + (i % 5);
        ELSIF i <= 15 THEN v_titular := false; v_funcao := 'Reserva'; v_ovr := 50 + (i % 4);
        ELSE v_titular := false; v_funcao := 'Promessa'; v_ovr := 45 + (i % 3);
        END IF;
        IF i = 1 THEN v_pos := 'Goleiro'; ELSIF i <= 5 THEN v_pos := 'Zagueiro'; ELSIF i <= 8 THEN v_pos := 'Meia'; ELSE v_pos := 'Atacante'; END IF;
        INSERT INTO public.base_ai_players (club_id, name, age, primary_position, ovr, squad_role, is_starter)
        VALUES (v_club5, 'Jogador IA ' || i || 'E', 17, v_pos, v_ovr, v_funcao, v_titular);
    END LOOP;
END $$;
COMMIT;
