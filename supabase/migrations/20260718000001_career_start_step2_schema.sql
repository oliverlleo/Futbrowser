-- Migration: 20260718000001_career_start_step2_schema.sql

-- ==============================================================================
-- 1. REFERÊNCIAS (Domínio Base) - Tabelas que representam os clubes da IA
-- ==============================================================================

-- Tabela de Treinadores
CREATE TABLE IF NOT EXISTS public.base_coaches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    profile VARCHAR(50) NOT NULL CHECK (profile IN ('Amigável', 'Rígido', 'Equilibrado', 'Técnico', 'Teórico')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Clubes
CREATE TABLE IF NOT EXISTS public.base_clubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    shield_url VARCHAR(255) NOT NULL,
    reputation INT NOT NULL CHECK (reputation BETWEEN 1 AND 5),
    formation VARCHAR(20) NOT NULL,
    play_style VARCHAR(50) NOT NULL CHECK (play_style IN ('Recuado', 'Ofensivo', 'Contra-ataque', 'Equilibrado', 'Pelas alas', 'Posse de bola')),
    coach_id UUID NOT NULL REFERENCES public.base_coaches(id) ON DELETE RESTRICT,
    flexibility INT NOT NULL CHECK (flexibility BETWEEN 0 AND 100),
    is_active BOOLEAN DEFAULT true,
    base_terms JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_base_clubs_coach ON public.base_clubs(coach_id);

-- Tabela de Perfil de Academia
CREATE TABLE IF NOT EXISTS public.base_academy_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL UNIQUE REFERENCES public.base_clubs(id) ON DELETE CASCADE,
    physical INT NOT NULL CHECK (physical BETWEEN 1 AND 5),
    speed INT NOT NULL CHECK (speed BETWEEN 1 AND 5),
    technical INT NOT NULL CHECK (technical BETWEEN 1 AND 5),
    recovery INT NOT NULL CHECK (recovery BETWEEN 1 AND 5),
    tactical INT NOT NULL CHECK (tactical BETWEEN 1 AND 5)
);

-- Tabela de Elencos da IA
CREATE TABLE IF NOT EXISTS public.base_ai_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.base_clubs(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    age INT NOT NULL CHECK (age BETWEEN 16 AND 18),
    primary_position VARCHAR(50) NOT NULL,
    secondary_position VARCHAR(50),
    ovr INT NOT NULL CHECK (ovr BETWEEN 42 AND 64),
    archetype VARCHAR(50),
    squad_role VARCHAR(50) NOT NULL CHECK (squad_role IN ('Promessa', 'Reserva', 'Rotação', 'Titular')),
    is_starter BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_base_ai_players_club ON public.base_ai_players(club_id);

-- ==============================================================================
-- 2. DADOS PRIVADOS DO JOGADOR - Ofertas, Negociações, Contratos e Carreira
-- ==============================================================================

-- Tabela de Ofertas (As propostas recebidas)
CREATE TABLE IF NOT EXISTS public.player_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.base_clubs(id) ON DELETE RESTRICT,
    initial_terms JSONB NOT NULL,
    current_terms JSONB NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('new', 'reviewed', 'negotiating', 'countered', 'accepted', 'rejected', 'withdrawn', 'expired')),
    round INT NOT NULL DEFAULT 0 CHECK (round BETWEEN 0 AND 3),
    internal_tolerance INT NOT NULL,
    compatibility_breakdown JSONB NOT NULL DEFAULT '{}',
    snapshot_data JSONB NOT NULL DEFAULT '{}',
    is_emergency BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);
CREATE INDEX idx_player_offers_player ON public.player_offers(player_id);
CREATE INDEX idx_player_offers_club ON public.player_offers(club_id);
-- Uma oferta inicial (ativa ou pending) única por clube por jogador.
CREATE UNIQUE INDEX idx_unique_active_offer ON public.player_offers (player_id, club_id) WHERE status NOT IN ('rejected', 'withdrawn', 'expired', 'accepted');

-- Histórico de Negociação (Gamificação por pontos)
CREATE TABLE IF NOT EXISTS public.player_offer_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID NOT NULL REFERENCES public.player_offers(id) ON DELETE CASCADE,
    round INT NOT NULL CHECK (round BETWEEN 0 AND 3),
    previous_terms JSONB NOT NULL DEFAULT '{}',
    requested_terms JSONB NOT NULL,
    club_response_terms JSONB NOT NULL DEFAULT '{}',
    negotiation_cost INT NOT NULL,
    remaining_flexibility INT NOT NULL,
    response_action VARCHAR(50) NOT NULL,
    before_stance VARCHAR(50),
    after_stance VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_offer_history_offer ON public.player_offer_history(offer_id);

-- Tabela de Contratos (Histórico preservado)
CREATE TABLE IF NOT EXISTS public.player_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.base_clubs(id) ON DELETE RESTRICT,
    duration_seasons INT NOT NULL CHECK (duration_seasons IN (1, 2, 3)),
    monthly_wage INT NOT NULL CHECK (monthly_wage >= 0),
    signing_bonus INT NOT NULL CHECK (signing_bonus >= 0),
    release_clause INT NOT NULL CHECK (release_clause >= 0),
    squad_role VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated')),
    signed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_player_contracts_player ON public.player_contracts(player_id);
-- Índice parcial que permite múltiplos contratos finalizados, mas apenas 1 ativo.
CREATE UNIQUE INDEX idx_unique_active_contract ON public.player_contracts (player_id) WHERE status = 'active';

-- Estado atual da carreira do jogador
CREATE TABLE IF NOT EXISTS public.player_career_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL UNIQUE REFERENCES public.jogadores(id) ON DELETE CASCADE,
    club_id UUID REFERENCES public.base_clubs(id) ON DELETE SET NULL,
    coach_id UUID REFERENCES public.base_coaches(id) ON DELETE SET NULL,
    trust INT NOT NULL DEFAULT 50 CHECK (trust BETWEEN 0 AND 100),
    morale INT NOT NULL DEFAULT 50 CHECK (morale BETWEEN 0 AND 100),
    energy INT NOT NULL DEFAULT 100 CHECK (energy BETWEEN 0 AND 100),
    hierarchy VARCHAR(50) NOT NULL,
    compatibility INT NOT NULL DEFAULT 0 CHECK (compatibility BETWEEN 0 AND 100),
    evolution_modifiers JSONB DEFAULT '{}',
    recovery_modifier INT NOT NULL DEFAULT 0,
    onboarding_completed BOOLEAN NOT NULL DEFAULT false,
    pending_initial_balance INT NOT NULL DEFAULT 0 CHECK (pending_initial_balance >= 0),
    financial_credit_applied BOOLEAN NOT NULL DEFAULT false,
    emergency_offer_generated BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_career_state_player ON public.player_career_state(player_id);

-- ==============================================================================
-- 3. SEGURANÇA E RLS (Row Level Security)
-- ==============================================================================

-- Ativar RLS
ALTER TABLE public.base_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_academy_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_ai_players ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.player_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_offer_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_career_state ENABLE ROW LEVEL SECURITY;

-- Revogar acesso público/anon
REVOKE ALL ON public.base_coaches FROM anon, public;
REVOKE ALL ON public.base_clubs FROM anon, public;
REVOKE ALL ON public.base_academy_profiles FROM anon, public;
REVOKE ALL ON public.base_ai_players FROM anon, public;
REVOKE ALL ON public.player_offers FROM anon, public;
REVOKE ALL ON public.player_offer_history FROM anon, public;
REVOKE ALL ON public.player_contracts FROM anon, public;
REVOKE ALL ON public.player_career_state FROM anon, public;

-- Garantir acesso de LEITURA para Authenticated em tabelas base
GRANT SELECT ON public.base_coaches TO authenticated;
GRANT SELECT ON public.base_clubs TO authenticated;
GRANT SELECT ON public.base_academy_profiles TO authenticated;
GRANT SELECT ON public.base_ai_players TO authenticated;

-- Políticas de LEITURA para as tabelas Base
CREATE POLICY "Base Coaches Select" ON public.base_coaches FOR SELECT USING (true);
CREATE POLICY "Base Clubs Select" ON public.base_clubs FOR SELECT USING (true);
CREATE POLICY "Base Academy Select" ON public.base_academy_profiles FOR SELECT USING (true);
CREATE POLICY "Base AI Players Select" ON public.base_ai_players FOR SELECT USING (true);

-- Garantir acesso de LEITURA nas tabelas Privadas apenas para o dono
GRANT SELECT ON public.player_offers TO authenticated;
GRANT SELECT ON public.player_offer_history TO authenticated;
GRANT SELECT ON public.player_contracts TO authenticated;
GRANT SELECT ON public.player_career_state TO authenticated;

-- Função auxiliar para validar propriedade do jogador
CREATE OR REPLACE FUNCTION public.is_player_owner(p_player_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.jogadores 
        WHERE id = p_player_id AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.is_player_owner(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_player_owner(UUID) TO authenticated;

-- Políticas de LEITURA nas tabelas Privadas
CREATE POLICY "Owner Offers Select" ON public.player_offers 
    FOR SELECT USING (public.is_player_owner(player_id));

CREATE POLICY "Owner Offer History Select" ON public.player_offer_history 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.player_offers 
            WHERE id = player_offer_history.offer_id AND public.is_player_owner(player_id)
        )
    );

CREATE POLICY "Owner Contracts Select" ON public.player_contracts 
    FOR SELECT USING (public.is_player_owner(player_id));

CREATE POLICY "Owner Career State Select" ON public.player_career_state 
    FOR SELECT USING (public.is_player_owner(player_id));
