CREATE OR REPLACE FUNCTION public.create_player(
  p_nome text,
  p_apelido text,
  p_naturalidade text,
  p_nacionalidade text,
  p_pe_dominante text,
  p_altura text,
  p_peso text,
  p_posicao text,
  p_arquetipo text,
  p_avatar text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_jogador_id UUID;
  v_lock_key BIGINT;
  v_height NUMERIC;
  v_weight INT;
  v_height_text TEXT;
  v_weight_text TEXT;
  v_nome TEXT := btrim(COALESCE(p_nome, ''));
  v_apelido TEXT := btrim(COALESCE(p_apelido, ''));
  v_naturalidade TEXT := btrim(COALESCE(p_naturalidade, ''));
  v_nacionalidade TEXT := btrim(COALESCE(p_nacionalidade, ''));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
  END IF;

  v_lock_key := ('x' || substr(md5(v_user_id::text), 1, 16))::bit(64)::bigint;
  PERFORM pg_catalog.pg_advisory_xact_lock(v_lock_key);

  IF EXISTS (SELECT 1 FROM public.jogadores WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'Usuário já possui um jogador cadastrado.';
  END IF;

  IF char_length(v_nome) < 3 OR char_length(v_nome) > 24 THEN
    RAISE EXCEPTION 'Nome do jogador deve ter entre 3 e 24 caracteres.';
  END IF;
  IF v_nome ~ '[<>]' OR v_apelido ~ '[<>]' THEN
    RAISE EXCEPTION 'Nome ou apelido contém caracteres inválidos.';
  END IF;
  IF char_length(v_apelido) > 24 THEN
    RAISE EXCEPTION 'Apelido deve ter no máximo 24 caracteres.';
  END IF;

  IF v_naturalidade = '' OR v_nacionalidade = '' THEN
    RAISE EXCEPTION 'Selecione a nacionalidade do jogador.';
  END IF;
  IF char_length(v_naturalidade) > 80 OR char_length(v_nacionalidade) > 80 THEN
    RAISE EXCEPTION 'Nacionalidade inválida.';
  END IF;

  IF p_posicao NOT IN ('Atacante', 'Meia', 'Zagueiro', 'Goleiro') THEN
    RAISE EXCEPTION 'Posição inválida.';
  END IF;
  IF p_arquetipo NOT IN ('Finalizador', 'Driblador', 'Criador', 'Raçudo') THEN
    RAISE EXCEPTION 'Arquétipo inválido.';
  END IF;
  IF p_pe_dominante NOT IN ('Esquerdo', 'Direito', 'Ambidestro') THEN
    RAISE EXCEPTION 'Pé dominante inválido.';
  END IF;

  v_height_text := replace(btrim(COALESCE(p_altura, '')), ',', '.');
  IF v_height_text !~ '^[0-9]+([.][0-9]{1,2})?$' THEN
    RAISE EXCEPTION 'Altura inválida.';
  END IF;
  BEGIN
    v_height := v_height_text::NUMERIC;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Altura inválida.';
  END;
  IF v_height < 1.10 OR v_height > 2.30 THEN
    RAISE EXCEPTION 'Altura deve estar entre 1,10 m e 2,30 m.';
  END IF;

  v_weight_text := btrim(COALESCE(p_peso, ''));
  IF v_weight_text !~* '^[0-9]{2,3}([[:space:]]*kg)?$' THEN
    RAISE EXCEPTION 'Peso inválido.';
  END IF;
  BEGIN
    v_weight := regexp_replace(v_weight_text, '[^0-9]', '', 'g')::INT;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Peso inválido.';
  END;
  IF v_weight < 35 OR v_weight > 160 THEN
    RAISE EXCEPTION 'Peso deve estar entre 35 kg e 160 kg.';
  END IF;

  IF p_avatar IS NULL OR p_avatar !~ '^avatar([1-9]|1[0-5]|17|19|20|21)[.]webp$' THEN
    RAISE EXCEPTION 'Avatar inválido.';
  END IF;

  INSERT INTO public.jogadores (
    user_id, avatar, nome, apelido, idade,
    naturalidade, nacionalidade, pe_dominante,
    altura, peso, posicao, arquetipo
  ) VALUES (
    v_user_id,
    p_avatar,
    v_nome,
    NULLIF(v_apelido, ''),
    16,
    v_naturalidade,
    v_nacionalidade,
    p_pe_dominante,
    trim(to_char(v_height, 'FM9D00')),
    v_weight::TEXT,
    p_posicao,
    p_arquetipo
  ) RETURNING id INTO v_jogador_id;

  RETURN v_jogador_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_player(text,text,text,text,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_player(text,text,text,text,text,text,text,text,text,text) TO authenticated;
