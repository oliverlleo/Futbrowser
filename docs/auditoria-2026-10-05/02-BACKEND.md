# Auditoria — Backend

**Projeto:** Futbrowser  
**Base analisada:** `main`  
**Data:** 05/10/2026

## Objetivo

Registrar problemas de arquitetura, integridade e confiabilidade entre frontend, RPCs e banco Supabase.

> Esta análise usa o backend versionado no GitHub. O estado exato do banco vivo deve ser validado diretamente no projeto Supabase antes de qualquer conclusão sobre produção.

## Prioridade P0 — corrigir primeiro

### 1. Existe histórico comprovado de drift entre migrations e produção

O histórico do projeto registra situação em que migrations apareciam como avançadas, mas objetos esperados não estavam realmente disponíveis no banco.

Isso é grave porque o Futbrowser depende de muitas RPCs para:

- onboarding;
- contratos;
- progressão;
- partidas;
- competições;
- mercado;
- patrocínio;
- Manager.

**Direção:** criar validação automática de schema e RPCs reais após deploy.

### 2. Domínio de caminhos ainda aceita estados antigos

A interface atual trabalha principalmente com:

- `jogador`;
- `manager`.

Porém código e constraint ainda aceitam também:

- `tecnico`;
- `presidente`.

**Risco:** usuários/dados antigos podem permanecer em estados que a interface atual não entrega.

**Direção:** definir oficialmente o domínio suportado e migrar valores antigos.

### 3. Integridade depende de muitas funções SECURITY DEFINER

O projeto usa corretamente vários `REVOKE` e `GRANT`, mas a quantidade de funções privilegiadas é alta.

**Risco:** uma nova função pública criada sem revogação adequada pode virar um endpoint privilegiado exposto.

**Direção:** auditoria automatizada de:
- funções `SECURITY DEFINER`;
- permissões de execução;
- owner checks;
- `search_path`;
- exposição a `PUBLIC`, `anon` e `authenticated`.

## Prioridade P1 — alto impacto

### 4. Frontend mistura RPCs de domínio com acesso direto a tabelas

Há fluxos críticos via RPC, mas ainda existem leituras e algumas alterações diretas em tabelas como:

- `usuarios`;
- `jogadores`;
- `player_contracts`;
- `player_career_state`;
- `base_clubs`;
- `manager_careers`.

**Problema:** parte da regra fica no backend e parte fica implícita no frontend.

**Direção:** alterações de estado do jogo devem passar por RPCs de domínio. Acesso direto deve ficar restrito a leitura simples quando realmente necessário.

### 5. Reviews de progressão podem falhar silenciosamente

`reviewCareerProgressionContext()` executa revisões como:

- mudança pendente;
- promoção;
- interesse de mercado.

O helper atual aceita falha e segue o fluxo após apenas registrar warning.

**Risco:** o usuário continua jogando enquanto uma evolução estrutural deixa de acontecer.

**Direção:** distinguir falha tolerável de falha de integridade e registrar pendência recuperável no estado da carreira.

### 6. Migrações históricas e corretivas dificultam reproduzir o estado final

Há uma grande sequência de migrations que sobrescrevem funções criadas anteriormente.

Isso é aceitável historicamente, mas torna a reprodução e auditoria do estado final mais difícil.

**Direção:** manter migrations imutáveis, mas gerar documentação automática do estado final esperado e testes de instalação limpa.

## Prioridade P2 — documentação e operação

### 7. Documentação de backend está desatualizada

Alguns documentos ainda registram pendências já resolvidas, enquanto outros declaram implementação integral antes de diversas correções posteriores.

**Direção:** documentos de auditoria devem indicar claramente:
- data;
- branch;
- commit;
- ambiente verificado;
- se é histórico ou estado atual.

## Testes obrigatórios de integridade

- [ ] Usuário A nunca lê/altera save do usuário B.
- [ ] Jogador possui no máximo um contrato ativo válido.
- [ ] Uma partida só pode ser persistida uma vez.
- [ ] Resultado salvo e avanço do calendário são atômicos.
- [ ] Categoria esportiva nunca vira a raiz organizacional `base`.
- [ ] Promoção respeita a hierarquia esportiva.
- [ ] Transferência mantém categoria de destino correta.
- [ ] Manager nunca altera dados mutáveis do modo Jogador.
- [ ] RPC privilegiada rejeita usuário não autenticado/não proprietário.
- [ ] Banco limpo recebe todas as migrations sem drift.
- [ ] Schema final contém todas as RPCs que o frontend consome.

## Critério para considerar esta frente resolvida

O GitHub, uma instalação limpa e o Supabase de produção devem representar o mesmo contrato de dados e regras do jogo.
