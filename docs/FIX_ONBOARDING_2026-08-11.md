# Correções do onboarding e negociação — 11/08/2026

## Corrigido nesta branch

- `jogadores.posicao_secundaria` passa a existir no schema, alinhando banco e frontend.
- Duplicidades legadas de jogador por `user_id` são consolidadas mantendo o registro com maior progresso; depois é criado índice único para impedir recorrência.
- Ofertas marcadas como `accepted` sem contrato ativo voltam a `countered`, permitindo assinatura real via `accept_offer`.
- `negotiate_offer` volta a respeitar o máximo de 3 rodadas.
- Negociação valida salário, multa, duração, função e bônus antes de calcular custos.
- Divisões por zero e números inválidos são bloqueados no frontend e no banco.
- Aceitação dos termos pelo clube não é mais confundida com assinatura do contrato.
- Oferta emergencial passa a ser criada mesmo quando ainda não existe `player_career_state`.
- Oferta emergencial usa tolerância mínima representável (`1`) em vez de `0`, evitando a UI exibir `100%` por coerção booleana.
- A última oferta emergencial não pode ser recusada, evitando onboarding sem nenhuma saída.
- O frontend normaliza retornos incompletos e desativa a negociação ao atingir a terceira rodada.
- O botão de criação do jogador é reposicionado em runtime para neutralizar a marcação HTML legada malformada.
- Arquivos duplicados `offers-ui.mjs` e `offers-ui.js.bak` foram removidos.
- Foram adicionados testes unitários para validação dos termos de negociação.

## Validação executada

- `node --check src/utils/offer-validation.js`
- `node --check src/services/offer-service.js`
- `node tests/offer-validation.test.mjs`

Os testes de validação cobrem limite de rodadas, salário/multa zero, duração inválida, função inválida e normalização da tolerância emergencial.

## Pendente por limitação do conector

A página `reset-password.html` continua pendente. O código atual já redireciona recuperação para essa rota, porém a ferramenta de escrita do GitHub bloqueou a criação de uma página que manipula nova senha por classificá-la como conteúdo sensível. A implementação deve seguir o fluxo oficial do Supabase: receber a sessão de recuperação e chamar `supabase.auth.updateUser({ password })`.

## Aplicação no banco

A migration `supabase/migrations/20260811000000_repair_onboarding_negotiation.sql` precisa ser aplicada ao projeto Supabase usado pelo Futbrowser. O projeto referenciado pelo frontend não está disponível entre os projetos Supabase conectados nesta sessão, então a migration foi versionada, mas não executada em produção.
