-- Migration: 20260718000006_correct_coaches_academies.sql

BEGIN;

-- 1. Alterar base_coaches para armazenar estruturadamente
ALTER TABLE public.base_coaches 
ADD COLUMN IF NOT EXISTS impacts JSONB NOT NULL DEFAULT '{}';

-- Atualizar os treinadores existentes com os impactos baseados no perfil
UPDATE public.base_coaches SET impacts = '{
    "morale_initial_bonus": 10,
    "recovery_pct_bonus": 20,
    "tolerance_to_bad_games": "high",
    "discipline_penalty": -5
}' WHERE profile = 'Amigável';

UPDATE public.base_coaches SET impacts = '{
    "physical_evolution_bonus": 8,
    "tactical_evolution_bonus": 8,
    "tolerance_to_bad_games": "low",
    "morale_penalty_on_failure": -10
}' WHERE profile = 'Rígido';

UPDATE public.base_coaches SET impacts = '{
    "general_evolution_bonus": 4,
    "tolerance_to_bad_games": "medium",
    "morale_penalty_on_failure": 0
}' WHERE profile = 'Equilibrado';

UPDATE public.base_coaches SET impacts = '{
    "technical_evolution_bonus": 10,
    "pass_control_dribble_bonus": 5,
    "physical_evolution_penalty": -5
}' WHERE profile = 'Técnico';

UPDATE public.base_coaches SET impacts = '{
    "tactical_evolution_bonus": 10,
    "positioning_vision_decision_bonus": 5,
    "creative_freedom_penalty": -5
}' WHERE profile = 'Teórico';

-- 2. Garantir que as estrelas da academia sejam usadas para conversão nas funções e não diretamente persistidas
-- Como base_academy_profiles já possui as estrelas físicas, técnicas, etc., a conversão ocorrerá diretamente
-- na RPC de aceitar a proposta. O Schema da academia já reflete o estado correto (valores de 1 a 5).
-- Nenhuma alteração de schema é necessária para a academia, a correção de lógica será na RPC.

COMMIT;
