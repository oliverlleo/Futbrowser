-- Migration: 20260718000005_correct_ai_squads.sql

BEGIN;

    ALTER TABLE public.base_ai_players DROP CONSTRAINT IF EXISTS base_ai_players_ovr_check;
    ALTER TABLE public.base_ai_players ADD CONSTRAINT base_ai_players_ovr_check CHECK (ovr BETWEEN 30 AND 80);

DELETE FROM public.base_ai_players;

DO $$
DECLARE
    v_club1 UUID;
    v_club2 UUID;
    v_club3 UUID;
    v_club4 UUID;
    v_club5 UUID;
BEGIN
    SELECT id INTO v_club1 FROM public.base_clubs WHERE name LIKE 'Atlético do Vale%' LIMIT 1;
    SELECT id INTO v_club2 FROM public.base_clubs WHERE name LIKE 'União Litorânea%' LIMIT 1;
    SELECT id INTO v_club3 FROM public.base_clubs WHERE name LIKE 'Academia Aurora%' LIMIT 1;
    SELECT id INTO v_club4 FROM public.base_clubs WHERE name LIKE 'Ferroviário Central%' LIMIT 1;
    SELECT id INTO v_club5 FROM public.base_clubs WHERE name LIKE 'Real Horizonte%' LIMIT 1;

    -- Inserindo Elencos Determinísticos (18 jogadores por clube)
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club1, 'Marcos Silva', 16, 'Goleiro', NULL, 63, 'Goleiro', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club1, 'João Souza', 17, 'Goleiro', NULL, 55, 'Goleiro', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club1, 'Pedro Alves', 18, 'Zagueiro', 'Volante', 65, 'Zagueiro Defensivo', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club1, 'Lucas Gomes', 16, 'Zagueiro', 'Volante', 56, 'Zagueiro Defensivo', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club1, 'Matheus Martins', 17, 'Zagueiro', 'Volante', 55, 'Zagueiro Defensivo', 'Rotação', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club1, 'Gabriel Lopes', 18, 'Zagueiro', 'Volante', 57, 'Zagueiro Defensivo', 'Rotação', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club1, 'Rafael Vieira', 16, 'Lateral Direito', 'Zagueiro', 65, 'Lateral Defensivo', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club1, 'Felipe Dias', 17, 'Lateral Direito', 'Zagueiro', 55, 'Lateral Defensivo', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club1, 'Thiago Moreira', 18, 'Lateral Esquerdo', 'Meia Esquerda', 63, 'Lateral Ofensivo', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club1, 'Bruno Machado', 16, 'Lateral Esquerdo', 'Meia Esquerda', 56, 'Lateral Ofensivo', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club1, 'Leonardo Cardoso', 17, 'Volante', 'Zagueiro', 65, 'Raçudo', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club1, 'Eduardo Santana', 18, 'Volante', 'Zagueiro', 57, 'Raçudo', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club1, 'Gustavo Correia', 16, 'Meia Central', 'Volante', 63, 'Criador', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club1, 'Diego Batista', 17, 'Meia Central', 'Volante', 55, 'Criador', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club1, 'Rodrigo Castro', 18, 'Meia Central', 'Volante', 57, 'Criador', 'Rotação', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club1, 'Fernando Farias', 16, 'Ponta Direita', 'Ponta Esquerda', 62, 'Driblador', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club1, 'Guilherme Brito', 17, 'Ponta Esquerda', 'Atacante', 63, 'Driblador', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club1, 'Caio Santos', 18, 'Atacante', 'Ponta Direita', 64, 'Finalizador', 'Titular', true);

    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club2, 'Vinícius Rodrigues', 16, 'Goleiro', NULL, 53, 'Goleiro', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club2, 'Igor Pereira', 17, 'Goleiro', NULL, 45, 'Goleiro', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club2, 'Vitor Costa', 18, 'Zagueiro', 'Volante', 55, 'Zagueiro Defensivo', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club2, 'André Carvalho', 16, 'Zagueiro', 'Volante', 46, 'Zagueiro Defensivo', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club2, 'Luiz Soares', 17, 'Zagueiro', 'Volante', 45, 'Zagueiro Defensivo', 'Rotação', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club2, 'Henrique Barbosa', 18, 'Zagueiro', 'Volante', 47, 'Zagueiro Defensivo', 'Rotação', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club2, 'Ricardo Nascimento', 16, 'Lateral Direito', 'Ponta Direita', 55, 'Lateral Ofensivo', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club2, 'Marcelo Nunes', 17, 'Lateral Direito', 'Ponta Direita', 45, 'Lateral Ofensivo', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club2, 'Alexandre Mendes', 18, 'Lateral Esquerdo', 'Zagueiro', 53, 'Lateral Defensivo', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club2, 'Daniel Ramos', 16, 'Lateral Esquerdo', 'Zagueiro', 46, 'Lateral Defensivo', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club2, 'Carlos Teixeira', 17, 'Volante', 'Meia Central', 55, 'Raçudo', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club2, 'Paulo Moraes', 18, 'Volante', 'Meia Central', 47, 'Raçudo', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club2, 'Victor Borges', 16, 'Volante', 'Meia Central', 46, 'Raçudo', 'Rotação', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club2, 'Renato Azevedo', 17, 'Meia Ofensivo', 'Meia Central', 54, 'Criador', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club2, 'Julio Macedo', 18, 'Meia Ofensivo', 'Meia Central', 47, 'Criador', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club2, 'Leandro Tavares', 16, 'Meia Direita', 'Ponta Direita', 52, 'Driblador', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club2, 'Roberto Oliveira', 17, 'Meia Esquerda', 'Ponta Esquerda', 53, 'Driblador', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club2, 'Samuel Ferreira', 18, 'Atacante', 'Meia Ofensivo', 54, 'Finalizador', 'Titular', true);

    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club3, 'Arthur Lima', 16, 'Goleiro', NULL, 68, 'Goleiro', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club3, 'Bernardo Ribeiro', 17, 'Goleiro', NULL, 60, 'Goleiro', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club3, 'Davi Almeida', 18, 'Zagueiro', 'Volante', 70, 'Zagueiro Defensivo', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club3, 'Heitor Fernandes', 16, 'Zagueiro', 'Volante', 61, 'Zagueiro Defensivo', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club3, 'Lorenzo Rocha', 17, 'Zagueiro', 'Volante', 60, 'Zagueiro Defensivo', 'Rotação', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club3, 'Miguel Andrade', 18, 'Zagueiro', 'Volante', 62, 'Zagueiro Defensivo', 'Rotação', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club3, 'Theo Marques', 16, 'Lateral Direito', 'Zagueiro', 70, 'Lateral Defensivo', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club3, 'Enzo Freitas', 17, 'Lateral Direito', 'Zagueiro', 60, 'Lateral Defensivo', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club3, 'Cauã Gonçalves', 18, 'Lateral Esquerdo', 'Meia Esquerda', 68, 'Lateral Ofensivo', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club3, 'Yuri Melo', 16, 'Lateral Esquerdo', 'Meia Esquerda', 61, 'Lateral Ofensivo', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club3, 'Breno Neves', 17, 'Volante', 'Zagueiro', 70, 'Raçudo', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club3, 'Kauan Campos', 18, 'Volante', 'Zagueiro', 62, 'Raçudo', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club3, 'Luan Barros', 16, 'Meia Central', 'Volante', 68, 'Criador', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club3, 'Marcos Pinto', 17, 'Meia Central', 'Volante', 60, 'Criador', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club3, 'João Silva', 18, 'Meia Central', 'Volante', 62, 'Criador', 'Rotação', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club3, 'Pedro Souza', 16, 'Ponta Direita', 'Ponta Esquerda', 67, 'Driblador', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club3, 'Lucas Alves', 17, 'Ponta Esquerda', 'Atacante', 68, 'Driblador', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club3, 'Matheus Gomes', 18, 'Atacante', 'Ponta Direita', 69, 'Finalizador', 'Titular', true);

    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club4, 'Gabriel Martins', 16, 'Goleiro', NULL, 58, 'Goleiro', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club4, 'Rafael Lopes', 17, 'Goleiro', NULL, 50, 'Goleiro', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club4, 'Felipe Vieira', 18, 'Zagueiro', 'Volante', 60, 'Zagueiro Defensivo', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club4, 'Thiago Dias', 16, 'Zagueiro', 'Volante', 51, 'Zagueiro Defensivo', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club4, 'Bruno Moreira', 17, 'Zagueiro', 'Volante', 50, 'Zagueiro Defensivo', 'Rotação', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club4, 'Leonardo Machado', 18, 'Zagueiro', 'Volante', 52, 'Zagueiro Defensivo', 'Rotação', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club4, 'Eduardo Cardoso', 16, 'Lateral Direito', 'Zagueiro', 60, 'Lateral Defensivo', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club4, 'Gustavo Santana', 17, 'Lateral Direito', 'Zagueiro', 50, 'Lateral Defensivo', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club4, 'Diego Correia', 18, 'Lateral Esquerdo', 'Meia Esquerda', 58, 'Lateral Ofensivo', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club4, 'Rodrigo Batista', 16, 'Lateral Esquerdo', 'Meia Esquerda', 51, 'Lateral Ofensivo', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club4, 'Fernando Castro', 17, 'Meia Central', 'Volante', 60, 'Criador', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club4, 'Guilherme Farias', 18, 'Meia Central', 'Volante', 52, 'Criador', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club4, 'Caio Brito', 16, 'Meia Central', 'Volante', 51, 'Criador', 'Rotação', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club4, 'Vinícius Santos', 17, 'Meia Central', 'Volante', 50, 'Criador', 'Rotação', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club4, 'Igor Rodrigues', 18, 'Meia Direita', 'Ponta Direita', 60, 'Driblador', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club4, 'Vitor Pereira', 16, 'Meia Esquerda', 'Ponta Esquerda', 57, 'Driblador', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club4, 'André Costa', 17, 'Atacante', 'Meia Ofensivo', 58, 'Finalizador', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club4, 'Luiz Carvalho', 18, 'Atacante', 'Meia Ofensivo', 52, 'Finalizador', 'Reserva', false);

    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club5, 'Henrique Soares', 16, 'Goleiro', NULL, 48, 'Goleiro', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club5, 'Ricardo Barbosa', 17, 'Goleiro', NULL, 40, 'Goleiro', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club5, 'Marcelo Nascimento', 18, 'Zagueiro', 'Volante', 50, 'Zagueiro Defensivo', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club5, 'Alexandre Nunes', 16, 'Zagueiro', 'Volante', 41, 'Zagueiro Defensivo', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club5, 'Daniel Mendes', 17, 'Zagueiro', 'Volante', 40, 'Zagueiro Defensivo', 'Rotação', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club5, 'Carlos Ramos', 18, 'Zagueiro', 'Volante', 42, 'Zagueiro Defensivo', 'Rotação', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club5, 'Paulo Teixeira', 16, 'Lateral Direito', 'Ponta Direita', 50, 'Lateral Ofensivo', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club5, 'Victor Moraes', 17, 'Lateral Direito', 'Ponta Direita', 40, 'Lateral Ofensivo', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club5, 'Renato Borges', 18, 'Lateral Esquerdo', 'Zagueiro', 48, 'Lateral Defensivo', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club5, 'Julio Azevedo', 16, 'Lateral Esquerdo', 'Zagueiro', 41, 'Lateral Defensivo', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club5, 'Leandro Macedo', 17, 'Volante', 'Meia Central', 50, 'Raçudo', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club5, 'Roberto Tavares', 18, 'Volante', 'Meia Central', 42, 'Raçudo', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club5, 'Samuel Oliveira', 16, 'Volante', 'Meia Central', 41, 'Raçudo', 'Rotação', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club5, 'Arthur Ferreira', 17, 'Meia Ofensivo', 'Meia Central', 49, 'Criador', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club5, 'Bernardo Lima', 18, 'Meia Ofensivo', 'Meia Central', 42, 'Criador', 'Reserva', false);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club5, 'Davi Ribeiro', 16, 'Meia Direita', 'Ponta Direita', 47, 'Driblador', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club5, 'Heitor Almeida', 17, 'Meia Esquerda', 'Ponta Esquerda', 48, 'Driblador', 'Titular', true);
    INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter)
    VALUES (v_club5, 'Lorenzo Fernandes', 18, 'Atacante', 'Meia Ofensivo', 49, 'Finalizador', 'Titular', true);

END;
$$;

COMMIT;
