# Arquitetura de Base e Equipes de Categoria

## Regra de domínio

Contrato e equipe esportiva são conceitos diferentes.

- O contrato inicial do jogador é com a **base do clube** (`squad_level = base`).
- A equipe em que o jogador atua é registrada separadamente em `player_career_state.club_id` e em `player_squad_assignments`.
- A progressão esportiva permitida é: **Base → Sub-17 → Sub-18 → Sub-20 → Principal**.
- A idade define elegibilidade, quando necessário, mas **não escolhe automaticamente a competição do jogador**.
- Uma competição de base só pode conter equipes cujo `base_clubs.squad_level` seja igual ao `competition_definitions.age_level`.

## Fontes de verdade

- `player_contracts.club_id`: organização com a qual existe vínculo contratual.
- `player_career_state.club_id`: equipe esportiva atual.
- `player_squad_assignments`: histórico de movimentação entre Base/Sub-17/Sub-18/Sub-20/Principal.
- `career_competition_fixtures`: fonte de verdade para datas e rodadas de partidas oficiais.
- `competition_definitions.age_level`: categoria da competição.

O nome do clube é apenas apresentação. Nenhuma regra deve inferir categoria usando textos como `Sub-17` ou `Sub-18` no nome.

## Competições e rodadas

`selected.current_round` representa a rodada do próximo compromisso da equipe na competição selecionada. `selected.viewed_round` representa somente a rodada que o usuário está navegando na interface.

A interface não deve manter uma rodada antiga como fonte de verdade durante recarregamentos. Ao atualizar o Hub, a consulta deve voltar para a rodada atual calculada pelo backend.

## Ofertas

Clubes de categoria (`u17`, `u18`, `u20`) não podem emitir oferta de contrato de base. `generate_initial_offers()` trabalha apenas com `club_level = academy` e `squad_level = base`.

## Integridade no banco

A migration `20260812192549_academy_squad_integrity_guards.sql` impede:

- equipe de categoria errada em `career_competition_entries`;
- mandante/visitante de categoria errada em fixtures;
- estatística de jogador atribuída a equipe de categoria errada;
- oferta de base emitida diretamente por equipe Sub-17/Sub-18/Sub-20.

## Contas legadas

Contas com partida oficial preservam a partida, placar, rodada, estatísticas e passam a apontar para a equipe esportiva correta. Contas que tinham campeonatos gerados somente pela antiga regra de idade, sem nenhuma partida jogada, voltam para `Base` e não mantêm calendário fictício.

A promoção ao time principal não deve ser inventada por associação de nome/cidade. Ela só ocorre quando existir vínculo profissional estruturalmente válido.
