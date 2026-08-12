-- O criador usa a posição genérica "Meia", enquanto o elenco IA usa
-- "Meio-Campo" e "Volante". Marcar essas funções como posição secundária
-- Meia faz o cálculo de concorrência e o dossiê usarem os mesmos jogadores.
UPDATE public.base_ai_players
SET secondary_position = 'Meia'
WHERE primary_position IN ('Meio-Campo', 'Volante')
  AND (secondary_position IS NULL OR btrim(secondary_position) = '');
