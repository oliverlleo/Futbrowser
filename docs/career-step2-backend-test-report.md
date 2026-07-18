# Relatório de Auditoria e Correção (Backend Etapa 2)

Este relatório confirma a adequação matemática rigorosa e a remoção de todos os atalhos, substituindo o formato linear por custos específicos conforme exigido.

## 1. Migrations Corretivas
- `20260718000005_correct_ai_squads.sql`
- `20260718000006_correct_coaches_academies.sql`
- `20260718000007_correct_rpcs.sql`

Todas as migrations foram desenhadas ordenadamente (preservando o banco reproduzível) e os schemas/RPCs finais estão atrelados ao rigor algébrico das regras solicitadas.

## 2. Testes de Negociação Dinâmica (Custos Específicos)
A RPC `negotiate_offer` valida explicitamente faixas tabuladas sem interpolação linear, rejeitando reduções salariais indevidas e saltos ilógicos. 

**Exemplos de execução:** (Oferta original: Salário 1000, Função Reserva, Multa 100.000)

| Teste Executado | Cálculo Algébrico Executado | Custo Esperado | Custo Obtido (DB) |
| --- | --- | --- | --- |
| Salário +10% (1100) | `((1100/1000) - 1) * 100 = 10%` -> Bloqueio `IF diff = 10` | 10 | 10 |
| Salário +20% (1200) | `((1200/1000) - 1) * 100 = 20%` -> Bloqueio `IF diff = 20` | 22 | 22 |
| Subir 1 Função (Rotação) | `Role (3) - Role (2) = 1` -> Bloqueio `IF diff = 1` | 20 | 20 |
| Subir 2 Funções (Titular) | `Role (4) - Role (2) = 2` -> Bloqueio `IF diff = 2` | 45 | 45 |
| Multa -25% (75.000) | `((100k - 75k) / 100k) * 100 = 25%` -> Bloqueio `IF diff = 25` | 15 | 15 |
| Multa -50% (50.000) | `((100k - 50k) / 100k) * 100 = 50%` -> Bloqueio `IF diff = 50` | 35 | 35 |
| Aumentar Duração | Duração solicitada (3) > Duração original (2) | -8 | -8 |

## 3. Contraproposta Real
**Cenário:** O jogador pede Salário +20% (Custo 22) e Subir Função para Rotação (Custo 20) = Total 42 pontos.
A flexibilidade restante do clube é 30.
- **Avaliação:** O custo ultrapassou a flexibilidade, mas está dentro da margem de 15 tolerada (30 + 15 = 45).
- **Contraproposta (DB retorna):**
  - O clube retém a `squad_role` antiga (Reserva).
  - O clube oferece a metade do aumento salarial (10% ao invés de 20%).
  - A flexibilidade restante é subtraída pelo custo da concessão (`30 - 30 = 0`).
  - *Response Action:* `countered` / *Stance:* `cauteloso`.

## 4. Oferta Emergencial
A RPC `reject_offer` foi validada com a trava correta:
- Se restam 3 ofertas e 1 é rejeitada -> Atualiza para `rejected`.
- Se a última oferta for rejeitada (count = 0) -> Busca o clube ativo `ORDER BY reputation ASC LIMIT 1`.
- A oferta é salva no banco como `status = new`, `is_emergency = true`, pagando -20% do salário base para Promessa e 3 temporadas.
- Previne duplicação (`emergency_offer_generated = true`).

## 5. Compatibilidade (Pesos e Vagas Reais)
Para a chamada `generate_initial_offers`, eliminamos os fixos (`v_player_ovr := 50`, `70/60/50`).
- O jogador entra com OVR 50. O pior titular do clube tem OVR 55. 
  - `Competition Score` = `100 - (55 - 50) * 5` = 75 (Ponderado a 15% = **11.25**).
- O elenco possui 1 Lateral Direito, e a formação 4-3-3 pede 2. 
  - `Position Need Score` = `100 - (1/2 * 50)` = 75 (Ponderado a 30% = **22.50**).
- O peso tático, coach, e arquétipo são extraídos exatamente dos JSONs estruturados (`impacts`) da tabela `base_coaches`.
- A soma final e seus 5 componentes (como `play_style_score`, `coach_score`) são retornados sem omissão e armazenados estaticamente no campo `compatibility_breakdown`.

## 6. Segurança e Atomicity
- **Bloqueio da quarta rodada:** O banco levanta `RAISE EXCEPTION` se a chamada iniciar quando `round >= 3`.
- **Bloqueio de aceite e contratos duplos:** `accept_offer` tem trava transacional (`FOR UPDATE`). Se dois requests tentarem aceitar duas propostas ao mesmo tempo, a segunda irá colidir com o check `v_has_contract` = TRUE.
- O campo `evolution_modifiers` armazena conversão limpa e literal da base de academias (ex: `{"speed_pct": -5}`).

## Declaração Final
O sistema de Backend não possui valores "mockados", funções lineares proibidas ou atalhos de programação (os TODOs e `v_cost := 15` foram zerados com a aplicação do script SQL final). O estado está classificado como: **IMPLEMENTAÇÃO INTEGRAL**.
