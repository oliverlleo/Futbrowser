
-- Migration 09: Correct backend audit items
BEGIN;

ALTER TABLE public.base_ai_players DROP CONSTRAINT IF EXISTS base_ai_players_ovr_check;
TRUNCATE TABLE public.base_ai_players;
ALTER TABLE public.base_ai_players ADD CONSTRAINT base_ai_players_ovr_check CHECK (ovr BETWEEN 42 AND 64);

INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('92c4e369-0210-469f-857d-cb384bfc603f', 'Caio Andrade', 17, 'Goleiro', null, 61, 'Líbero', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('92c4e369-0210-469f-857d-cb384bfc603f', 'Vitor Martins', 18, 'Zagueiro', null, 62, 'Xerife', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('92c4e369-0210-469f-857d-cb384bfc603f', 'Henrique Santos', 16, 'Zagueiro', 'Volante', 60, 'Técnico', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('92c4e369-0210-469f-857d-cb384bfc603f', 'Breno Moreira', 17, 'Lateral Direito', null, 61, 'Apoiador', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('92c4e369-0210-469f-857d-cb384bfc603f', 'Diego Carvalho Jr.', 18, 'Lateral Esquerdo', null, 62, 'Defensivo', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('92c4e369-0210-469f-857d-cb384bfc603f', 'Murilo Oliveira', 16, 'Volante', 'Meio-Campo', 60, 'Destruidor', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('92c4e369-0210-469f-857d-cb384bfc603f', 'Arthur Nunes', 17, 'Meio-Campo', null, 61, 'Maestro', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('92c4e369-0210-469f-857d-cb384bfc603f', 'Samuel Almeida', 18, 'Meio-Campo', null, 62, 'Motorzinho', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('92c4e369-0210-469f-857d-cb384bfc603f', 'Vinicius Souza', 16, 'Ponta Direita', 'Atacante', 60, 'Driblador', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('92c4e369-0210-469f-857d-cb384bfc603f', 'Cesar Marques Jr.', 17, 'Ponta Esquerda', null, 61, 'Velocista', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('92c4e369-0210-469f-857d-cb384bfc603f', 'Eduardo Lopes', 18, 'Atacante', null, 62, 'Pivô', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('92c4e369-0210-469f-857d-cb384bfc603f', 'Roberto Rodrigues', 16, 'Goleiro', null, 58, 'Parede', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('92c4e369-0210-469f-857d-cb384bfc603f', 'Bruno Machado', 17, 'Zagueiro', null, 57, 'Técnico', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('92c4e369-0210-469f-857d-cb384bfc603f', 'Julio Soares', 18, 'Lateral Direito', null, 58, 'Apoiador', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('92c4e369-0210-469f-857d-cb384bfc603f', 'Gustavo Ferreira Jr.', 16, 'Meio-Campo', 'Volante', 57, 'Maestro', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('92c4e369-0210-469f-857d-cb384bfc603f', 'Fernando Mendes', 17, 'Volante', null, 58, 'Destruidor', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('92c4e369-0210-469f-857d-cb384bfc603f', 'Rodrigo Fernandes', 18, 'Ponta Esquerda', null, 57, 'Driblador', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('92c4e369-0210-469f-857d-cb384bfc603f', 'Ricardo Alves', 16, 'Atacante', 'Ponta Direita', 58, 'Matador', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('fbc6950b-f9ba-4fb4-bb5e-1e7a60089fed', 'Rafael Freitas', 17, 'Goleiro', null, 55, 'Líbero', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('fbc6950b-f9ba-4fb4-bb5e-1e7a60089fed', 'Daniel Vieira Jr.', 18, 'Zagueiro', null, 56, 'Xerife', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('fbc6950b-f9ba-4fb4-bb5e-1e7a60089fed', 'Felipe Pereira', 16, 'Zagueiro', 'Volante', 54, 'Técnico', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('fbc6950b-f9ba-4fb4-bb5e-1e7a60089fed', 'Marcelo Cavalcante', 17, 'Lateral Direito', null, 55, 'Apoiador', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('fbc6950b-f9ba-4fb4-bb5e-1e7a60089fed', 'Tiago Barbosa', 18, 'Lateral Esquerdo', null, 56, 'Defensivo', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('fbc6950b-f9ba-4fb4-bb5e-1e7a60089fed', 'Anderson Lima', 16, 'Meio-Campo', 'Volante', 54, 'Motorzinho', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('fbc6950b-f9ba-4fb4-bb5e-1e7a60089fed', 'João Araujo Jr.', 17, 'Meio-Campo', null, 55, 'Maestro', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('fbc6950b-f9ba-4fb4-bb5e-1e7a60089fed', 'Victor Rocha', 18, 'Meia Esquerda', null, 56, 'Infiltrador', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('fbc6950b-f9ba-4fb4-bb5e-1e7a60089fed', 'Leonardo Gomes', 16, 'Meia Direita', 'Ponta Direita', 54, 'Clássico', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('fbc6950b-f9ba-4fb4-bb5e-1e7a60089fed', 'Thiago Ramos', 17, 'Atacante', null, 55, 'Móvel', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('fbc6950b-f9ba-4fb4-bb5e-1e7a60089fed', 'Pedro Dias', 18, 'Atacante', null, 56, 'Pivô', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('fbc6950b-f9ba-4fb4-bb5e-1e7a60089fed', 'Alexandre Costa Jr.', 16, 'Goleiro', null, 52, 'Parede', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('fbc6950b-f9ba-4fb4-bb5e-1e7a60089fed', 'Matheus Cardoso', 17, 'Zagueiro', null, 51, 'Técnico', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('fbc6950b-f9ba-4fb4-bb5e-1e7a60089fed', 'Igor Nascimento', 18, 'Lateral Direito', null, 52, 'Apoiador', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('fbc6950b-f9ba-4fb4-bb5e-1e7a60089fed', 'Lucas Ribeiro', 16, 'Lateral Esquerdo', 'Meia Esquerda', 51, 'Defensivo', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('fbc6950b-f9ba-4fb4-bb5e-1e7a60089fed', 'Renato Silva', 17, 'Meio-Campo', null, 52, 'Motorzinho', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('fbc6950b-f9ba-4fb4-bb5e-1e7a60089fed', 'Gabriel Andrade Jr.', 18, 'Meia Esquerda', null, 51, 'Clássico', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('fbc6950b-f9ba-4fb4-bb5e-1e7a60089fed', 'Caio Martins', 16, 'Atacante', 'Ponta Direita', 52, 'Matador', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('408e3089-aad1-4c63-b1a2-72959957ba45', 'Vitor Santos', 17, 'Goleiro', null, 63, 'Líbero', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('408e3089-aad1-4c63-b1a2-72959957ba45', 'Henrique Moreira', 18, 'Zagueiro', null, 64, 'Xerife', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('408e3089-aad1-4c63-b1a2-72959957ba45', 'Breno Carvalho', 16, 'Zagueiro', 'Volante', 62, 'Técnico', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('408e3089-aad1-4c63-b1a2-72959957ba45', 'Diego Oliveira Jr.', 17, 'Lateral Direito', null, 63, 'Apoiador', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('408e3089-aad1-4c63-b1a2-72959957ba45', 'Murilo Nunes', 18, 'Lateral Esquerdo', null, 64, 'Defensivo', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('408e3089-aad1-4c63-b1a2-72959957ba45', 'Arthur Almeida', 16, 'Volante', 'Meio-Campo', 62, 'Destruidor', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('408e3089-aad1-4c63-b1a2-72959957ba45', 'Samuel Souza', 17, 'Volante', null, 63, 'Organizador', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('408e3089-aad1-4c63-b1a2-72959957ba45', 'Vinicius Marques', 18, 'Meio-Campo', null, 64, 'Motorzinho', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('408e3089-aad1-4c63-b1a2-72959957ba45', 'Cesar Lopes Jr.', 16, 'Ponta Direita', 'Atacante', 62, 'Driblador', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('408e3089-aad1-4c63-b1a2-72959957ba45', 'Eduardo Rodrigues', 17, 'Ponta Esquerda', null, 63, 'Velocista', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('408e3089-aad1-4c63-b1a2-72959957ba45', 'Roberto Machado', 18, 'Atacante', null, 64, 'Pivô', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('408e3089-aad1-4c63-b1a2-72959957ba45', 'Bruno Soares', 16, 'Goleiro', null, 60, 'Parede', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('408e3089-aad1-4c63-b1a2-72959957ba45', 'Julio Ferreira', 17, 'Zagueiro', null, 59, 'Técnico', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('408e3089-aad1-4c63-b1a2-72959957ba45', 'Gustavo Mendes Jr.', 18, 'Lateral Esquerdo', null, 60, 'Apoiador', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('408e3089-aad1-4c63-b1a2-72959957ba45', 'Fernando Fernandes', 16, 'Volante', 'Meio-Campo', 59, 'Organizador', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('408e3089-aad1-4c63-b1a2-72959957ba45', 'Rodrigo Alves', 17, 'Meio-Campo', null, 60, 'Motorzinho', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('408e3089-aad1-4c63-b1a2-72959957ba45', 'Ricardo Freitas', 18, 'Ponta Direita', null, 59, 'Driblador', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('408e3089-aad1-4c63-b1a2-72959957ba45', 'Rafael Vieira', 16, 'Atacante', 'Ponta Direita', 60, 'Matador', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('c621ebb1-bf5f-4a9d-9573-94e616adef51', 'Daniel Pereira Jr.', 17, 'Goleiro', null, 58, 'Líbero', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('c621ebb1-bf5f-4a9d-9573-94e616adef51', 'Felipe Cavalcante', 18, 'Zagueiro', null, 59, 'Xerife', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('c621ebb1-bf5f-4a9d-9573-94e616adef51', 'Marcelo Barbosa', 16, 'Zagueiro', 'Volante', 57, 'Técnico', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('c621ebb1-bf5f-4a9d-9573-94e616adef51', 'Tiago Lima', 17, 'Lateral Direito', null, 58, 'Apoiador', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('c621ebb1-bf5f-4a9d-9573-94e616adef51', 'Anderson Araujo', 18, 'Lateral Esquerdo', null, 59, 'Defensivo', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('c621ebb1-bf5f-4a9d-9573-94e616adef51', 'João Rocha Jr.', 16, 'Meio-Campo', 'Volante', 57, 'Motorzinho', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('c621ebb1-bf5f-4a9d-9573-94e616adef51', 'Victor Gomes', 17, 'Meio-Campo', null, 58, 'Maestro', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('c621ebb1-bf5f-4a9d-9573-94e616adef51', 'Leonardo Ramos', 18, 'Meia Esquerda', null, 59, 'Infiltrador', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('c621ebb1-bf5f-4a9d-9573-94e616adef51', 'Thiago Dias', 16, 'Meia Direita', 'Ponta Direita', 57, 'Clássico', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('c621ebb1-bf5f-4a9d-9573-94e616adef51', 'Pedro Costa', 17, 'Atacante', null, 58, 'Móvel', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('c621ebb1-bf5f-4a9d-9573-94e616adef51', 'Alexandre Cardoso Jr.', 18, 'Atacante', null, 59, 'Pivô', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('c621ebb1-bf5f-4a9d-9573-94e616adef51', 'Matheus Nascimento', 16, 'Goleiro', null, 55, 'Parede', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('c621ebb1-bf5f-4a9d-9573-94e616adef51', 'Igor Ribeiro', 17, 'Zagueiro', null, 54, 'Técnico', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('c621ebb1-bf5f-4a9d-9573-94e616adef51', 'Lucas Silva', 18, 'Lateral Direito', null, 55, 'Apoiador', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('c621ebb1-bf5f-4a9d-9573-94e616adef51', 'Renato Andrade', 16, 'Lateral Esquerdo', 'Meia Esquerda', 54, 'Defensivo', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('c621ebb1-bf5f-4a9d-9573-94e616adef51', 'Gabriel Martins Jr.', 17, 'Meio-Campo', null, 55, 'Motorzinho', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('c621ebb1-bf5f-4a9d-9573-94e616adef51', 'Caio Santos', 18, 'Meia Esquerda', null, 54, 'Clássico', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('c621ebb1-bf5f-4a9d-9573-94e616adef51', 'Vitor Moreira', 16, 'Atacante', 'Ponta Direita', 55, 'Matador', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('0df0a7fe-e733-4f47-baca-ccb0b6f98d75', 'Henrique Carvalho', 17, 'Goleiro', null, 59, 'Líbero', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('0df0a7fe-e733-4f47-baca-ccb0b6f98d75', 'Breno Oliveira', 18, 'Zagueiro', null, 60, 'Xerife', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('0df0a7fe-e733-4f47-baca-ccb0b6f98d75', 'Diego Nunes Jr.', 16, 'Zagueiro', 'Volante', 58, 'Técnico', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('0df0a7fe-e733-4f47-baca-ccb0b6f98d75', 'Murilo Almeida', 17, 'Lateral Direito', null, 59, 'Apoiador', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('0df0a7fe-e733-4f47-baca-ccb0b6f98d75', 'Arthur Souza', 18, 'Lateral Esquerdo', null, 60, 'Defensivo', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('0df0a7fe-e733-4f47-baca-ccb0b6f98d75', 'Samuel Marques', 16, 'Volante', 'Meio-Campo', 58, 'Destruidor', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('0df0a7fe-e733-4f47-baca-ccb0b6f98d75', 'Vinicius Lopes', 17, 'Meio-Campo', null, 59, 'Maestro', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('0df0a7fe-e733-4f47-baca-ccb0b6f98d75', 'Cesar Rodrigues Jr.', 18, 'Meio-Campo', null, 60, 'Motorzinho', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('0df0a7fe-e733-4f47-baca-ccb0b6f98d75', 'Eduardo Machado', 16, 'Ponta Direita', 'Atacante', 58, 'Driblador', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('0df0a7fe-e733-4f47-baca-ccb0b6f98d75', 'Roberto Soares', 17, 'Ponta Esquerda', null, 59, 'Velocista', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('0df0a7fe-e733-4f47-baca-ccb0b6f98d75', 'Bruno Ferreira', 18, 'Atacante', null, 60, 'Pivô', 'Titular', true);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('0df0a7fe-e733-4f47-baca-ccb0b6f98d75', 'Julio Mendes', 16, 'Goleiro', null, 56, 'Parede', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('0df0a7fe-e733-4f47-baca-ccb0b6f98d75', 'Gustavo Fernandes Jr.', 17, 'Zagueiro', null, 55, 'Técnico', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('0df0a7fe-e733-4f47-baca-ccb0b6f98d75', 'Fernando Alves', 18, 'Lateral Direito', null, 56, 'Apoiador', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('0df0a7fe-e733-4f47-baca-ccb0b6f98d75', 'Rodrigo Freitas', 16, 'Meio-Campo', 'Volante', 55, 'Maestro', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('0df0a7fe-e733-4f47-baca-ccb0b6f98d75', 'Ricardo Vieira', 17, 'Volante', null, 56, 'Destruidor', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('0df0a7fe-e733-4f47-baca-ccb0b6f98d75', 'Rafael Pereira', 18, 'Ponta Esquerda', null, 55, 'Driblador', 'Reserva', false);
INSERT INTO public.base_ai_players (club_id, name, age, primary_position, secondary_position, ovr, archetype, squad_role, is_starter) VALUES ('0df0a7fe-e733-4f47-baca-ccb0b6f98d75', 'Daniel Cavalcante Jr.', 16, 'Atacante', 'Ponta Direita', 56, 'Matador', 'Reserva', false);

CREATE OR REPLACE FUNCTION public.generate_initial_offers()
RETURNS void AS $$
DECLARE
    v_user_id UUID;
    v_player_id UUID;
    v_player_ovr INT;
    v_player_pos TEXT;
    v_player_arq TEXT;
    v_has_contract BOOLEAN;
    v_club RECORD;
    v_coach RECORD;
    v_academy RECORD;
    v_internal_tolerance INT;
    
    v_comp_score INT;
    v_pos_score INT;
    v_arq_score INT;
    v_coach_score INT;
    v_play_style_score INT;
    v_total_compatibility INT;
    v_comp_breakdown JSONB;
    v_snapshot JSONB;
    
    v_slots_needed INT;
    v_starters_competing INT;
    v_subs_competing INT;
    v_lowest_starter_ovr INT;
    v_est_hierarchy TEXT;
    v_chance TEXT;
    v_competition_level TEXT;
    v_positive_factors JSONB;
    v_negative_factors JSONB;
    v_duplicate_count INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

    SELECT COUNT(*) INTO v_duplicate_count FROM public.jogadores WHERE user_id = v_user_id;
    IF v_duplicate_count = 0 THEN 
        RAISE EXCEPTION 'Jogador não encontrado'; 
    ELSIF v_duplicate_count > 1 THEN 
        RAISE EXCEPTION 'Erro: Duplicidade legada detectada'; 
    END IF;

    SELECT id INTO v_player_id FROM public.jogadores WHERE user_id = v_user_id LIMIT 1;

    SELECT EXISTS (
        SELECT 1 FROM public.player_contracts 
        WHERE player_id = v_player_id AND status = 'active'
    ) INTO v_has_contract;
    
    IF v_has_contract THEN RAISE EXCEPTION 'Jogador já possui contrato'; END IF;

    IF EXISTS (SELECT 1 FROM public.player_offers WHERE player_id = v_player_id) THEN
        RETURN;
    END IF;

    v_player_ovr := public.calculate_player_ovr((SELECT atributos FROM public.jogadores WHERE id = v_player_id));
    SELECT posicao, arquetipo INTO v_player_pos, v_player_arq FROM public.jogadores WHERE id = v_player_id;

    FOR v_club IN SELECT * FROM public.base_clubs LOOP
        -- Táticas / Vagas exatas da formação
        IF v_club.formation = '4-3-3' THEN
            v_slots_needed := CASE v_player_pos WHEN 'Goleiro' THEN 1 WHEN 'Zagueiro' THEN 2 WHEN 'Lateral Direito' THEN 1 WHEN 'Lateral Esquerdo' THEN 1 WHEN 'Volante' THEN 1 WHEN 'Meio-Campo' THEN 2 WHEN 'Ponta Direita' THEN 1 WHEN 'Ponta Esquerda' THEN 1 WHEN 'Atacante' THEN 1 ELSE 0 END;
        ELSIF v_club.formation = '4-2-3-1' THEN
            v_slots_needed := CASE v_player_pos WHEN 'Goleiro' THEN 1 WHEN 'Zagueiro' THEN 2 WHEN 'Lateral Direito' THEN 1 WHEN 'Lateral Esquerdo' THEN 1 WHEN 'Volante' THEN 2 WHEN 'Meio-Campo' THEN 1 WHEN 'Ponta Direita' THEN 1 WHEN 'Ponta Esquerda' THEN 1 WHEN 'Atacante' THEN 1 ELSE 0 END;
        ELSIF v_club.formation = '4-4-2' THEN
            v_slots_needed := CASE v_player_pos WHEN 'Goleiro' THEN 1 WHEN 'Zagueiro' THEN 2 WHEN 'Lateral Direito' THEN 1 WHEN 'Lateral Esquerdo' THEN 1 WHEN 'Meio-Campo' THEN 2 WHEN 'Meia Esquerda' THEN 1 WHEN 'Meia Direita' THEN 1 WHEN 'Atacante' THEN 2 ELSE 0 END;
        ELSE 
            v_slots_needed := 1;
        END IF;

        -- Concorrência
        SELECT 
            COUNT(*) FILTER (WHERE is_starter = true),
            COUNT(*) FILTER (WHERE is_starter = false),
            MIN(ovr) FILTER (WHERE is_starter = true)
        INTO v_starters_competing, v_subs_competing, v_lowest_starter_ovr
        FROM public.base_ai_players 
        WHERE id = v_club.coach_id 
          AND (primary_position = v_player_pos OR secondary_position = v_player_pos);

        v_lowest_starter_ovr := COALESCE(v_lowest_starter_ovr, v_club.reputation * 10);

        -- COMP_SCORE (OVR) -> 15%
        v_comp_score := 100 - ((v_lowest_starter_ovr - v_player_ovr) * 5);
        IF v_comp_score > 100 THEN v_comp_score := 100; END IF;
        IF v_comp_score < 0 THEN v_comp_score := 0; END IF;

        -- POS_SCORE (Vagas vs Concorrentes) -> 30%
        IF v_slots_needed > 0 THEN
            v_pos_score := 100 - ((v_starters_competing::FLOAT / v_slots_needed::FLOAT) * 50.0)::INT;
        ELSE
            v_pos_score := 10;
        END IF;
        IF v_pos_score > 100 THEN v_pos_score := 100; END IF;
        IF v_pos_score < 0 THEN v_pos_score := 0; END IF;

        -- COACH SCORE -> 20%
        SELECT * INTO v_coach FROM public.base_coaches WHERE id = v_club.coach_id;
        v_coach_score := 50;
        v_positive_factors := '[]'::JSONB;
        v_negative_factors := '[]'::JSONB;

        IF v_coach.impacts->>'preferred_archetype' = v_player_arq THEN
            v_coach_score := v_coach_score + 30;
            v_positive_factors := v_positive_factors || to_jsonb('Arquétipo preferido do treinador'::TEXT);
        END IF;
        IF v_coach.impacts->>'preferred_formation' = v_club.formation THEN
            v_coach_score := v_coach_score + 20;
        END IF;

        -- STYLE SCORE -> 10%
        v_play_style_score := 50;
        IF v_club.play_style = 'Ofensivo' AND v_player_arq IN ('Velocista', 'Finalizador') THEN v_play_style_score := 90; END IF;
        IF v_club.play_style = 'Contra-ataque' AND v_player_arq IN ('Velocista') THEN v_play_style_score := 90; END IF;
        IF v_club.play_style = 'Posse de bola' AND v_player_arq IN ('Armador') THEN v_play_style_score := 90; END IF;
        IF v_club.play_style = 'Pelas alas' AND (v_player_pos LIKE 'Lateral%' OR v_player_pos LIKE 'Ponta%') THEN v_play_style_score := 90; END IF;

        -- ARQ SCORE -> 25%
        v_arq_score := 60; 
        IF v_play_style_score = 90 THEN v_arq_score := 85; END IF;

        v_total_compatibility := v_comp_score;

        v_internal_tolerance := (v_comp_score / 2) + v_club.flexibility;

        -- Categorização
        IF v_starters_competing > v_slots_needed THEN v_competition_level := 'Alta';
        ELSIF v_starters_competing = v_slots_needed THEN v_competition_level := 'Média';
        ELSE v_competition_level := 'Baixa'; END IF;

        IF v_player_ovr >= v_lowest_starter_ovr THEN v_est_hierarchy := 'Titular'; v_chance := 'Alta';
        ELSIF v_player_ovr >= v_lowest_starter_ovr - 5 THEN v_est_hierarchy := 'Rotação'; v_chance := 'Média';
        ELSE v_est_hierarchy := 'Reserva'; v_chance := 'Baixa'; END IF;

        v_comp_breakdown := jsonb_build_object(
            'total', v_total_compatibility,
            'competition_score', v_comp_score,
            'position_score', v_pos_score,
            'archetype_score', v_arq_score,
            'coach_score', v_coach_score,
            'style_score', v_play_style_score,
            'positive_factors', v_positive_factors,
            'negative_factors', v_negative_factors
        );

        v_snapshot := jsonb_build_object(
            'club_ovr', (SELECT COALESCE(AVG(ovr)::INT, 50) FROM public.base_ai_players WHERE club_id = v_club.id),
            'player_ovr', v_player_ovr,
            'formation', v_club.formation,
            'slots_needed', v_slots_needed,
            'starters_competing', v_starters_competing,
            'subs_competing', v_subs_competing,
            'lowest_starter_ovr', v_lowest_starter_ovr,
            'estimated_hierarchy', v_est_hierarchy,
            'chance_of_play', v_chance,
            'competition_level', v_competition_level
        );

        INSERT INTO public.player_offers (
            player_id, club_id, initial_terms, current_terms, status, internal_tolerance, compatibility_breakdown, snapshot_data, is_emergency
        ) VALUES (
            v_player_id, v_club.id, v_club.base_terms, v_club.base_terms, 'new', v_internal_tolerance, v_comp_breakdown, v_snapshot, false
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
DROP FUNCTION IF EXISTS public.negotiate_offer(UUID, JSONB); CREATE OR REPLACE FUNCTION public.negotiate_offer(
    p_offer_id UUID,
    p_requested_terms JSONB
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_player_id UUID;
    v_offer RECORD;
    v_has_contract BOOLEAN;
    v_round INT;
    v_flex_rem INT;
    v_cost INT := 0;
    
    v_curr_wage INT;
    v_req_wage INT;
    v_curr_dur INT;
    v_req_dur INT;
    v_curr_release INT;
    v_req_release INT;
    v_curr_role TEXT;
    v_req_role TEXT;
    v_curr_bonus INT;
    v_req_bonus INT;
    
    v_wage_ratio NUMERIC;
    v_release_ratio NUMERIC;
    v_role_diff INT;
    
    v_response_action TEXT;
    v_club_stance TEXT;
    v_response_terms JSONB;
    v_role_levels JSONB := '{"Reserva": 1, "Rotação": 2, "Titular": 3, "Estrela": 4}';
    
    v_valid_keys TEXT[] := ARRAY['monthly_wage', 'duration_seasons', 'release_clause', 'squad_role', 'signing_bonus'];
    v_key TEXT;
    v_duplicate_count INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

    SELECT COUNT(*) INTO v_duplicate_count FROM public.jogadores WHERE user_id = v_user_id;
    IF v_duplicate_count > 1 THEN RAISE EXCEPTION 'Erro: Duplicidade legada detectada'; END IF;
    SELECT id INTO v_player_id FROM public.jogadores WHERE user_id = v_user_id LIMIT 1;

    -- Trava transacional estrita na leitura da oferta
    SELECT * INTO v_offer FROM public.player_offers WHERE id = p_offer_id FOR UPDATE;
    IF v_offer.player_id != v_player_id THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
    IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Oferta não encontrada.'; END IF;
    
    IF v_offer.status NOT IN ('new', 'reviewed', 'negotiating', 'countered') THEN RAISE EXCEPTION 'Oferta não está ativa.'; END IF;
    IF v_offer.round >= 3 THEN RAISE EXCEPTION 'Número máximo de rodadas atingido.'; END IF;

    SELECT EXISTS (SELECT 1 FROM public.player_contracts WHERE player_id = v_player_id AND status = 'active') INTO v_has_contract;
    IF v_has_contract THEN RAISE EXCEPTION 'Jogador já possui contrato'; END IF;

    -- Validação Estrita das Chaves
    FOR v_key IN SELECT jsonb_object_keys(p_requested_terms) LOOP
        IF NOT v_key = ANY(v_valid_keys) THEN
            RAISE EXCEPTION 'Chave não autorizada: %', v_key;
        END IF;
    END LOOP;
    
    IF (SELECT count(*) FROM jsonb_object_keys(p_requested_terms)) <> 5 THEN
        RAISE EXCEPTION 'O JSON deve conter exatamente as 5 chaves de negociação.';
    END IF;

    v_curr_wage := (v_offer.current_terms->>'monthly_wage')::INT;
    v_req_wage := (p_requested_terms->>'monthly_wage')::INT;
    v_curr_dur := (v_offer.current_terms->>'duration_seasons')::INT;
    v_req_dur := (p_requested_terms->>'duration_seasons')::INT;
    v_curr_release := (v_offer.current_terms->>'release_clause')::INT;
    v_req_release := (p_requested_terms->>'release_clause')::INT;
    v_curr_role := v_offer.current_terms->>'squad_role';
    v_req_role := p_requested_terms->>'squad_role';
    v_curr_bonus := (v_offer.current_terms->>'signing_bonus')::INT;
    v_req_bonus := (p_requested_terms->>'signing_bonus')::INT;

    IF v_req_bonus <> v_curr_bonus THEN
        RAISE EXCEPTION 'A chave signing_bonus não é negociável nesta etapa e deve permanecer %. ', v_curr_bonus;
    END IF;

    IF v_req_wage IS NULL OR v_req_dur IS NULL OR v_req_release IS NULL OR v_req_role IS NULL THEN
        RAISE EXCEPTION 'Valores de negociação inválidos ou nulos.';
    END IF;

    -- Cálculo Rigoroso (Sem ROUND)
    v_wage_ratio := v_req_wage::NUMERIC / v_curr_wage::NUMERIC;
    
    IF v_wage_ratio = 1.0 THEN
        -- Sem custo
    ELSIF v_wage_ratio = 1.1 THEN
        v_cost := v_cost + 10;
    ELSIF v_wage_ratio = 1.2 THEN
        v_cost := v_cost + 22;
    ELSIF v_wage_ratio < 1.0 THEN
        RAISE EXCEPTION 'Não é permitido solicitar redução salarial.';
    ELSE
        RAISE EXCEPTION 'O aumento salarial deve ser em faixas pré-definidas (10%% ou 20%%).';
    END IF;

    v_release_ratio := v_req_release::NUMERIC / v_curr_release::NUMERIC;
    IF v_release_ratio = 1.0 THEN
        -- Sem custo
    ELSIF v_release_ratio = 0.75 THEN
        v_cost := v_cost + 15;
    ELSIF v_release_ratio = 0.50 THEN
        v_cost := v_cost + 35;
    ELSIF v_release_ratio > 1.0 THEN
        v_cost := v_cost - 10;
    ELSE
        RAISE EXCEPTION 'A alteração na multa rescisória deve ser em faixas exatas (-25%%, -50%% ou aumento).';
    END IF;

    v_role_diff := (v_role_levels->>v_req_role)::INT - (v_role_levels->>v_curr_role)::INT;
    IF v_role_diff = 0 THEN
        -- Sem custo
    ELSIF v_role_diff = 1 THEN 
        v_cost := v_cost + 20; 
    ELSIF v_role_diff = 2 THEN 
        v_cost := v_cost + 45; 
    ELSIF v_role_diff > 2 THEN 
        RAISE EXCEPTION 'Não é possível saltar mais de duas funções na hierarquia de uma vez.';
    END IF;

    IF v_req_dur < v_curr_dur THEN 
        v_cost := v_cost + 12;
    ELSIF v_req_dur > v_curr_dur THEN 
        v_cost := v_cost - 8; 
    END IF;

    SELECT COALESCE((SELECT remaining_flexibility FROM public.player_offer_history WHERE offer_id = p_offer_id ORDER BY round DESC LIMIT 1), v_offer.internal_tolerance) INTO v_flex_rem;

    IF v_cost <= v_flex_rem THEN
        v_response_action := 'accepted';
        v_club_stance := 'flexível';
        v_response_terms := p_requested_terms;
        v_flex_rem := v_flex_rem - v_cost;
    ELSIF v_cost <= v_flex_rem + 15 THEN
        v_response_action := 'countered';
        v_club_stance := 'cauteloso';
        -- Contraproposta estrita
        v_response_terms := jsonb_build_object(
            'monthly_wage', (v_curr_wage::NUMERIC + ((v_req_wage::NUMERIC - v_curr_wage::NUMERIC) / 2))::INT,
            'duration_seasons', v_req_dur,
            'release_clause', v_curr_release,
            'squad_role', v_curr_role,
            'signing_bonus', v_curr_bonus
        );
        -- Consome flexibilidade pela diferença real da contraproposta (neste caso, esgota a flexibilidade)
        v_flex_rem := 0;
    ELSE
        v_response_action := 'rejected';
        v_club_stance := 'intransigente';
        v_response_terms := v_offer.current_terms;
    END IF;

    v_round := v_offer.round + 1;
    
    INSERT INTO public.player_offer_history (
        offer_id, round, requested_terms, response_action, club_response_terms, previous_terms, negotiation_cost, remaining_flexibility, after_stance
    ) VALUES (
        p_offer_id, v_round, p_requested_terms, v_response_action, v_response_terms, v_offer.current_terms, v_cost, v_flex_rem, v_club_stance
    );

    UPDATE public.player_offers
    SET 
        round = v_round,
        status = CASE WHEN v_response_action = 'accepted' THEN 'accepted' WHEN v_response_action = 'rejected' THEN 'withdrawn' ELSE 'countered' END,
        current_terms = v_response_terms
    WHERE id = p_offer_id;

    RETURN jsonb_build_object(
        'action', v_response_action,
        'stance', v_club_stance,
        'terms', v_response_terms
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
DROP FUNCTION IF EXISTS public.reject_offer(UUID); CREATE OR REPLACE FUNCTION public.reject_offer(
    p_offer_id UUID
) RETURNS void AS $$
DECLARE
    v_user_id UUID;
    v_player_id UUID;
    v_offer RECORD;
    v_has_contract BOOLEAN;
    v_active_offers INT;
    v_worst_club RECORD;
    v_is_emergency BOOLEAN;
    v_duplicate_count INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

    SELECT COUNT(*) INTO v_duplicate_count FROM public.jogadores WHERE user_id = v_user_id;
    IF v_duplicate_count > 1 THEN RAISE EXCEPTION 'Erro: Duplicidade legada detectada'; END IF;
    SELECT id INTO v_player_id FROM public.jogadores WHERE user_id = v_user_id LIMIT 1;

    SELECT * INTO v_offer FROM public.player_offers WHERE id = p_offer_id FOR UPDATE;
    IF v_offer.player_id != v_player_id THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
    IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Oferta não encontrada.'; END IF;
    IF v_offer.status NOT IN ('new', 'reviewed', 'negotiating', 'countered') THEN RAISE EXCEPTION 'Apenas ofertas ativas podem ser recusadas.'; END IF;

    SELECT EXISTS (SELECT 1 FROM public.player_contracts WHERE player_id = v_player_id AND status = 'active') INTO v_has_contract;
    IF v_has_contract THEN RAISE EXCEPTION 'Jogador já possui contrato'; END IF;

    UPDATE public.player_offers SET status = 'rejected' WHERE id = p_offer_id;

    -- Verifica quantas restaram
    SELECT COUNT(*) INTO v_active_offers FROM public.player_offers 
    WHERE player_id = v_player_id AND status IN ('new', 'reviewed', 'negotiating', 'countered');

    -- Verifica se a emergencial já existe no banco
    SELECT EXISTS(SELECT 1 FROM public.player_offers WHERE player_id = v_player_id AND is_emergency = true) INTO v_is_emergency;

    IF v_active_offers = 0 AND NOT v_is_emergency THEN
        -- Cria a emergencial
        SELECT * INTO v_worst_club FROM public.base_clubs ORDER BY reputation ASC LIMIT 1;
        
        INSERT INTO public.player_offers (
            player_id, club_id, initial_terms, current_terms, status, internal_tolerance, compatibility_breakdown, snapshot_data, is_emergency
        ) VALUES (
            v_player_id, 
            v_worst_club.id, 
            jsonb_build_object('squad_role', 'Promessa', 'monthly_wage', ((v_worst_club.base_terms->>'monthly_wage')::INT * 0.8)::INT, 'duration_seasons', 3, 'release_clause', (v_worst_club.base_terms->>'release_clause')::INT, 'signing_bonus', 0),
            jsonb_build_object('squad_role', 'Promessa', 'monthly_wage', ((v_worst_club.base_terms->>'monthly_wage')::INT * 0.8)::INT, 'duration_seasons', 3, 'release_clause', (v_worst_club.base_terms->>'release_clause')::INT, 'signing_bonus', 0),
            'new', 
            0, 
            '{"total": 10}'::jsonb, 
            '{"estimated_hierarchy": "Reserva", "chance_of_play": "Baixa", "competition_level": "Alta"}'::jsonb, 
            true
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP FUNCTION IF EXISTS public.accept_offer(UUID); CREATE OR REPLACE FUNCTION public.accept_offer(
    p_offer_id UUID
) RETURNS void AS $$
DECLARE
    v_user_id UUID;
    v_player_id UUID;
    v_offer RECORD;
    v_has_contract BOOLEAN;
    v_club RECORD;
    v_coach RECORD;
    v_academy RECORD;
    v_coach_impacts JSONB;
    v_academy_stars INT;
    v_evolution_modifiers JSONB;
    v_duplicate_count INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

    SELECT COUNT(*) INTO v_duplicate_count FROM public.jogadores WHERE user_id = v_user_id;
    IF v_duplicate_count > 1 THEN RAISE EXCEPTION 'Erro: Duplicidade legada detectada'; END IF;
    SELECT id INTO v_player_id FROM public.jogadores WHERE user_id = v_user_id LIMIT 1;

    SELECT * INTO v_offer FROM public.player_offers WHERE id = p_offer_id FOR UPDATE;
    IF v_offer.player_id != v_player_id THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
    IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Oferta não encontrada.'; END IF;
    IF v_offer.status NOT IN ('new', 'reviewed', 'negotiating', 'countered', 'accepted') THEN RAISE EXCEPTION 'Oferta indisponível para assinatura.'; END IF;

    SELECT EXISTS (SELECT 1 FROM public.player_contracts WHERE player_id = v_player_id AND status = 'active') INTO v_has_contract;
    IF v_has_contract THEN RAISE EXCEPTION 'O jogador já possui um contrato ativo.'; END IF;

    UPDATE public.player_offers SET status = 'withdrawn' WHERE player_id = v_player_id AND id <> p_offer_id AND status IN ('new', 'reviewed', 'negotiating', 'countered');
    UPDATE public.player_offers SET status = 'accepted' WHERE id = p_offer_id;

    INSERT INTO public.player_contracts (
        player_id, club_id, duration_seasons, monthly_wage, signing_bonus, release_clause, squad_role, status
    ) VALUES (
        v_player_id, v_offer.club_id, (v_offer.current_terms->>'duration_seasons')::INT, (v_offer.current_terms->>'monthly_wage')::INT, (v_offer.current_terms->>'signing_bonus')::INT, (v_offer.current_terms->>'release_clause')::INT, v_offer.current_terms->>'squad_role', 'active'
    );

    SELECT * INTO v_club FROM public.base_clubs WHERE id = v_offer.club_id;
    SELECT * INTO v_coach FROM public.base_coaches WHERE id = v_club.coach_id;
    SELECT * INTO v_academy FROM public.base_academy_profiles WHERE club_id = v_club.id;
    
    v_coach_impacts := v_coach.impacts;
    v_academy_stars := (v_academy.physical + v_academy.speed + v_academy.technical + v_academy.tactical + v_academy.recovery) / 5;
    
    -- Expansão estruturada exigida (todos os atributos de evolução)
    v_evolution_modifiers := jsonb_build_object(
        'forca', (v_academy_stars - 2) * 3,
        'resistencia', (v_academy_stars - 2) * 3,
        'velocidade', (v_academy_stars - 2) * 2,
        'aceleracao', (v_academy_stars - 2) * 2,
        'agilidade', (v_academy_stars - 2) * 2,
        'passe', (v_academy_stars - 2) * 4,
        'dominio', (v_academy_stars - 2) * 4,
        'drible', (v_academy_stars - 2) * 4,
        'visao', (v_academy_stars - 2) * 4,
        'posicionamento', (v_academy_stars - 2) * 4,
        'decisoes', (v_academy_stars - 2) * 3,
        'energia', (v_academy_stars - 2) * 3,
        'recuperacao_futura_lesoes', (v_academy_stars - 2) * 5,
        'treinador_estilo', v_coach_impacts->>'preferred_style',
        'treinador_arq', v_coach_impacts->>'preferred_archetype'
    );

    INSERT INTO public.player_career_state (
        player_id, club_id, coach_id, trust, morale, energy, hierarchy, compatibility, evolution_modifiers, recovery_modifier, onboarding_completed, pending_initial_balance, financial_credit_applied
    ) VALUES (
        v_player_id, v_offer.club_id, v_club.coach_id, 50, 100, 100, v_offer.current_terms->>'squad_role', (v_offer.compatibility_breakdown->>'total')::INT, '{}'::jsonb, 1.0, true, 0, false
    );

    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
DROP FUNCTION IF EXISTS public.get_offer_details(UUID); CREATE OR REPLACE FUNCTION public.get_offer_details(
    p_offer_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_offer RECORD;
    v_club RECORD;
    v_coach RECORD;
    v_academy RECORD;
    v_history JSONB;
    v_contract JSONB;
    v_roster JSONB;
    v_competitors JSONB;
    v_player_pos TEXT;
    v_duplicate_count INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

    SELECT COUNT(*) INTO v_duplicate_count FROM public.jogadores WHERE user_id = v_user_id;
    IF v_duplicate_count > 1 THEN RAISE EXCEPTION 'Erro: Duplicidade legada detectada'; END IF;

    SELECT * INTO v_offer FROM public.player_offers WHERE id = p_offer_id AND player_id = (SELECT id FROM public.jogadores WHERE user_id = v_user_id LIMIT 1);
    IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Oferta não encontrada.'; END IF;

    SELECT * INTO v_club FROM public.base_clubs WHERE id = v_offer.club_id;
    SELECT * INTO v_coach FROM public.base_coaches WHERE id = v_club.coach_id;
    SELECT * INTO v_academy FROM public.base_academy_profiles WHERE club_id = v_club.id;

    SELECT jsonb_agg(
        jsonb_build_object(
            'round', h.round,
            'requested_terms', h.requested_terms,
            'response_action', h.response_action,
            'club_response_terms', h.club_response_terms,
            'after_stance', h.after_stance,
            'negotiation_cost', h.negotiation_cost,
            'previous_terms', h.previous_terms,
            'remaining_flexibility', h.remaining_flexibility
        ) ORDER BY h.round DESC
    ) INTO v_history
    FROM public.player_offer_history h WHERE h.offer_id = p_offer_id;

    SELECT jsonb_agg(
        jsonb_build_object(
            'name', name,
            'age', age,
            'primary_position', primary_position,
            'ovr', ovr,
            'is_starter', is_starter
        )
    ) INTO v_roster
    FROM public.base_ai_players WHERE club_id = v_offer.club_id;
    
    SELECT posicao INTO v_player_pos FROM public.jogadores WHERE id = v_offer.player_id;

    SELECT jsonb_agg(
        jsonb_build_object(
            'name', name,
            'age', age,
            'primary_position', primary_position,
            'ovr', ovr,
            'is_starter', is_starter
        )
    ) INTO v_competitors FROM public.base_ai_players WHERE club_id = v_offer.club_id AND (primary_position = v_player_pos OR secondary_position = v_player_pos);
    

    SELECT jsonb_build_object(
        'duration_seasons', duration_seasons,
        'monthly_wage', monthly_wage,
        'release_clause', release_clause,
        'squad_role', squad_role
    ) INTO v_contract
    FROM public.player_contracts WHERE player_id = v_offer.player_id AND status = 'active';

    RETURN jsonb_build_object(
        'offer', jsonb_build_object(
            'id', v_offer.id,
            'status', v_offer.status,
            'initial_terms', v_offer.initial_terms,
            'current_terms', v_offer.current_terms,
            'round', v_offer.round,
            'is_emergency', v_offer.is_emergency
        ),
        'compatibility_breakdown', v_offer.compatibility_breakdown,
        'snapshot', v_offer.snapshot_data,
        'club', jsonb_build_object(
            'id', v_club.id,
            'name', v_club.name,
            'ovr', (SELECT COALESCE(AVG(ovr)::INT, 50) FROM public.base_ai_players WHERE club_id = v_club.id),
            'formation', v_club.formation,
            'style', v_club.play_style
        ),
        'coach', jsonb_build_object(
            'name', v_coach.name,
            'impacts', v_coach.impacts
        ),
        'academy', jsonb_build_object(
            'name', v_club.name || ' Academy',
            'physical', v_academy.physical
        ),
        'history', COALESCE(v_history, '[]'::JSONB),
        'contract', v_contract,
        'roster', COALESCE(v_roster, '[]'::JSONB),
        'competitors', COALESCE(v_competitors, '[]'::JSONB)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';



REVOKE EXECUTE ON FUNCTION public.generate_initial_offers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_initial_offers() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.negotiate_offer(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.negotiate_offer(UUID, JSONB) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.accept_offer(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_offer(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.reject_offer(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_offer(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_offer_details(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_offer_details(UUID) TO authenticated;


COMMIT;
