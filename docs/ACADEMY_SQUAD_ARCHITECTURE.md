# Arquitetura da Base e das Categorias Esportivas

## Regra de domínio

**Base não é uma categoria esportiva.** Base é a organização/estrutura de formação do clube.

As equipes esportivas jogáveis são, e somente são:

1. `u15` — Sub-15
2. `u17` — Sub-17
3. `u18` — Sub-18
4. `u20` — Sub-20
5. `first_team` — Profissional

A progressão esportiva é **Sub-15 → Sub-17 → Sub-18 → Sub-20 → Profissional**.

O registro `base_clubs.squad_level = 'base'` existe apenas como **raiz organizacional/contratual da academia**. Ele não pode representar elenco em campo, categoria de competição, destino esportivo de mercado, atribuição de elenco ou equipe atual do jogador.

## Contrato x equipe esportiva

Contrato e atuação são conceitos diferentes:

- `player_contracts.club_id`: organização com a qual o jogador possui vínculo. Em contrato de formação, pode apontar para a raiz `base` da academia.
- `player_career_state.club_id`: equipe esportiva em que o jogador atua agora. Deve apontar para `u15`, `u17`, `u18`, `u20` ou `first_team`.
- `player_squad_assignments`: histórico das equipes esportivas reais. Nunca deve registrar `squad_level = 'base'`.
- `player_offers.target_squad_level`: categoria esportiva exata da proposta. Oferta inicial pode ser emitida pela organização `base`, mas precisa informar a categoria esportiva real.
- `player_transfer_agreements.target_squad_level`: categoria esportiva exata do destino.

Nenhuma regra deve inferir categoria pelo nome do clube.

## Entrada na carreira

`generate_initial_offers()` seleciona organizações de formação (`club_level = 'academy'` e `squad_level = 'base'`) porque são elas que oferecem o primeiro contrato.

A categoria esportiva do jogador é calculada separadamente por `private.career_youth_squad_for_age()`:

- até 15 anos → `u15`
- 16 ou 17 anos → `u17`
- 18 anos → `u18`
- 19 ou 20 anos → `u20`

A oferta guarda essa categoria em `target_squad_level`. O dossiê, treinador, concorrentes, OVR médio e elenco devem ser lidos da equipe dessa categoria, e não da raiz `base`.

Ao assinar:

- o contrato fica na organização da academia;
- `player_career_state` recebe a equipe esportiva correta;
- `player_squad_assignments` recebe a mesma categoria esportiva;
- competição, companheiros, número de camisa e calendário são inicializados a partir dessa equipe.

## Elencos

Cada categoria possui seu próprio `base_clubs.id` e seu próprio elenco em `base_ai_players`.

Sub-15, Sub-17, Sub-18, Sub-20 e Profissional não compartilham um único elenco genérico de base.

A raiz `base` não deve receber novos jogadores de IA. O trigger `trg_guard_base_ai_player_sporting_roster` bloqueia novas inserções/mudanças de jogadores de IA para a raiz organizacional.

Registros legados ligados à raiz não devem ser apagados sem migração segura de referências históricas. Eles não são fonte de elenco para as funções esportivas atuais.

## Promoção interna

A promoção acontece dentro da mesma família do clube e segue a ordem esportiva:

`u15 → u17 → u18 → u20 → first_team`

A mudança entre categorias de formação utiliza a equipe real da categoria. A promoção ao profissional só pode apontar para o `first_team` profissional estruturalmente ligado à família.

A raiz `base` nunca é uma etapa intermediária da progressão.

## Mercado e transferências

O mercado deve expor destinos por categoria real:

**Sub-15 | Sub-17 | Sub-18 | Sub-20 | Profissional**

Não existe filtro/categoria esportiva chamada simplesmente “Base”.

A elegibilidade controla se o jogador pode demonstrar interesse ou receber movimentação para determinada categoria, mas a categoria continua visível e identificável como equipe distinta.

Para transferência de formação:

- o interesse e a negociação esportiva apontam para o `base_clubs.id` da categoria escolhida;
- o acordo preserva `target_squad_level`;
- ao assinar, o contrato pode ser normalizado para a raiz organizacional da academia;
- a movimentação esportiva permanece na categoria exata escolhida.

Uma transferência para Sub-17 não pode virar Sub-18, Sub-20 ou uma raiz `base` durante o fluxo.

## Competições

Uma competição de formação só pode conter equipes cujo `base_clubs.squad_level` seja igual ao `competition_definitions.age_level`.

A raiz `base` não participa de `career_competition_entries`, fixtures ou estatísticas de competição.

`selected.current_round` representa a rodada esportiva atual. `selected.viewed_round` representa somente a rodada que o usuário está navegando na interface.

## Integridade obrigatória

O banco deve impedir regressões como:

- `player_career_state.club_id` apontando para uma raiz `base`;
- `player_squad_assignments` registrando `base`;
- competição ou fixture usando raiz `base`;
- transferência esportiva com `target_squad_level = 'base'`;
- proposta profissional fora de `first_team`;
- proposta de formação apontando para uma categoria diferente da equipe negociada;
- novo jogador de IA sendo criado na raiz organizacional.

A raiz `base` continua válida exclusivamente onde a organização contratual da academia precisa existir.

## Interface

Toda interface que apresenta a categoria esportiva deve usar o valor estrutural (`u15`, `u17`, `u18`, `u20`, `first_team`) e os rótulos correspondentes.

Não deve existir:

- passo “Base” separado na progressão;
- filtro genérico “Base” no mercado;
- “Sub-18” hardcoded no onboarding;
- dossiê que substitua o elenco esportivo pelo elenco da raiz contratual.

O nome do clube é apresentação; `squad_level`, `club_level`, `academy_base_id` e `family_code` são a estrutura.