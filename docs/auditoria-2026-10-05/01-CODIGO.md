# Auditoria — Código

**Projeto:** Futbrowser  
**Base analisada:** `main`  
**Data:** 05/10/2026

## Objetivo

Registrar os pontos do código que hoje aumentam o risco de regressão, tornam a manutenção difícil ou deixam o comportamento da plataforma dependente da ordem de carregamento de vários arquivos.

## Prioridade P0 — corrigir primeiro

### 1. Career Hub construído por uma cadeia excessiva de patches

O arquivo `src/pages/career/career-loader-v3.js` carrega o núcleo e, depois, uma grande sequência de módulos de correção e extensão:

- formação;
- goleiro;
- fluxo de futebol;
- inteligência;
- UI;
- workload;
- balanceamento;
- contexto;
- cadeia de posse;
- consequências;
- guards;
- gameplay depth;
- runtime;
- feedback;
- preparação;
- estado;
- identidade do adversário.

O problema não é a quantidade de funcionalidades. O problema é que vários desses arquivos alteram ou complementam o mesmo motor em runtime.

**Risco:** a ordem de importação passa a fazer parte da regra do jogo. Uma correção pode sobrescrever outra sem que isso fique óbvio.

**Direção:** consolidar o motor da partida em módulos estáveis por responsabilidade, sem novos arquivos `patch-vX`.

### 2. Alteração global de MutationObserver

`career-loader-v3.js` substitui `window.MutationObserver` por uma implementação intermediária para neutralizar comportamentos considerados perigosos.

Isso é um sinal de acoplamento alto entre módulos da tela.

**Risco:** componentes legítimos podem deixar de observar alterações do DOM por uma regra global criada para corrigir outro componente.

**Direção:** remover a alteração global e corrigir os observers nos módulos que realmente precisam dela.

### 3. Motor da partida sem uma fonte única

Hoje coexistem:

- `career-match-engine-v2.js`;
- `career-match-engine-v3.js`;
- patches que importam e modificam o v2;
- runtime que continua importando diretamente o v2.

Exemplo: `career-match-formation-patch.js` modifica métodos do prototype do motor depois da criação da classe.

**Problema:** não existe um único arquivo ou conjunto pequeno de módulos que represente integralmente a regra atual da partida.

**Direção:** criar um núcleo único e explícito.

## Prioridade P1 — alto impacto

### 4. Fallback de contexto de partida pode esconder falha de backend

`career-match-runtime-v3.js` possui fallback para montar contexto da partida quando o contexto dedicado não está disponível.

Esse fallback inclui defaults de adversário, formação e informações de partida.

**Risco:** uma falha real do backend pode aparecer para o usuário como uma partida válida.

**Direção:** o fallback não deve inventar estado esportivo. Backend indisponível deve bloquear a partida com erro claro e recuperável.

### 5. CI não protege adequadamente a branch main

O workflow `.github/workflows/career-regression.yml` executa `push` apenas em branches antigas específicas e não em `main`.

Além disso, a lista manual de testes do workflow não acompanha todos os testes existentes no diretório `tests/`.

**Direção:**
- rodar em toda PR relevante;
- rodar em push para `main`;
- executar a suíte completa com `node --test tests/*.mjs`;
- validar sintaxe de todos os arquivos JavaScript ativos.

### 6. Arquivos de versões antigas e resíduos aumentam ambiguidade

Existem arquivos como:

- `career-v2.js` e `career-v3.js`;
- shims de compatibilidade;
- `scratch/`;
- arquivos `temp*`;
- versões antigas de SQL como `squads_v2.sql` e `squads_v3.sql`.

Nem todos estão ativos, mas ficam misturados à árvore principal.

**Direção:** classificar cada arquivo como ativo, histórico ou descartável e retirar resíduos do caminho produtivo.

## Prioridade P2 — manutenção

### 7. Estado compartilhado via window

Há diversos estados globais como `window.__futbrowserCareerHubRequest`, flags de patches e eventos globais.

Eles resolvem sincronização imediata, porém aumentam o acoplamento entre módulos.

**Direção:** centralizar estado compartilhado em um pequeno controlador da aplicação.

### 8. CSS e comportamento são injetados por JavaScript

Vários módulos adicionam folhas de estilo, overlays e componentes durante a execução.

**Risco:** a estrutura final da tela não fica evidente ao analisar o HTML e a ordem de carregamento afeta a apresentação.

**Direção:** reduzir CSS injetado dinamicamente e tornar a composição da página explícita.

## Critério para considerar esta frente resolvida

- [ ] Não existem novos arquivos `patch-vX` para corrigir o motor.
- [ ] O motor da partida possui uma fonte clara e modular.
- [ ] Nenhum módulo substitui APIs globais do navegador.
- [ ] Falha de backend não gera partida com dados inventados.
- [ ] CI roda na `main` e executa toda a suíte de regressão.
- [ ] Arquivos temporários/históricos estão fora do caminho produtivo.
- [ ] A ordem de importação não altera silenciosamente a regra do jogo.
