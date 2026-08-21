REVOKE SELECT ON TABLE public.player_career_actions FROM authenticated;

-- O histórico é devolvido por get_career_hub() sem hidden_effects.
-- Assim o jogador vê o que aconteceu, mas não a matemática interna da decisão.
