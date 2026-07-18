// ============================================================
// Futbrowser — Player Service
// ============================================================
import { supabase } from './supabase-client.js';

export async function createPlayer(playerData) {
  // Chamada à RPC protegida que calcula os atributos no backend
  // e salva o jogador em uma transação segura.
  const { data, error } = await supabase.rpc('create_player', {
    p_nome: playerData.nome,
    p_apelido: playerData.apelido,
    p_naturalidade: playerData.naturalidade,
    p_nacionalidade: playerData.nacionalidade,
    p_pe_dominante: playerData.pe_dominante,
    p_altura: playerData.altura,
    p_peso: playerData.peso,
    p_posicao: playerData.posicao,
    p_arquetipo: playerData.arquetipo,
    p_avatar: playerData.avatar
  });

  if (error) {
    throw new Error(error.message);
  }

  return data; // Retorna o ID do jogador recém-criado
}
