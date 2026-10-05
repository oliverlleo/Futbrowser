# Auditoria — Interface

**Projeto:** Futbrowser  
**Base analisada:** `main`  
**Data:** 05/10/2026

## Objetivo

Registrar os pontos de interface que prejudicam clareza, responsividade, consistência e confiança do usuário.

## Prioridade P0 — corrigir primeiro

### 1. A reestruturação mobile foi revertida

A PR de reestruturação responsiva foi mergeada e depois revertida na `main`.

Isso não significa que não existam media queries, mas a camada criada especificamente para corrigir a experiência mobile deixou de fazer parte da versão atual.

**Direção:** fazer uma nova auditoria mobile da versão atual e reaplicar somente as soluções que funcionarem, sem restaurar cegamente a PR antiga.

### 2. Comunicação visual promete dados em tempo real que não são reais

Elementos como:

- `Online agora 8.456`;
- crescimento diário fixo;
- `Jogadores reais`;
- `Dispute em tempo real`.

são apresentados visualmente como estado vivo da plataforma.

Quando esses números não vêm de dados reais, a interface transmite uma condição inexistente.

**Direção:** remover, rotular como conceito ou alimentar com telemetria real.

## Prioridade P1 — usabilidade

### 3. Career Hub apresenta informação demais no mesmo nível

A tela pode colocar simultaneamente diante do usuário:

- energia;
- estafa;
- prontidão;
- risco físico;
- forma;
- pressão;
- agenda;
- treino;
- atividades;
- ambiente;
- e-mail;
- escolhas recentes;
- desenvolvimento;
- competições;
- mercado;
- patrocínio;
- partida.

Muita informação é útil, mas falta hierarquia.

**Direção da tela principal:**

Responder primeiro:

1. O que está acontecendo hoje?
2. O que eu posso fazer agora?
3. Qual é o próximo compromisso?

Informações profundas ficam em áreas secundárias.

### 4. Tipografia pequena demais em partes da carreira

Há diversas regras de fonte com 10px ou menos, chegando a 7px.

Isso é especialmente problemático em interface rica em dados.

**Direção:** usar 12px como piso prático para informações secundárias, com exceções muito específicas.

### 5. Interface final depende de injeções em runtime

Diversos módulos adicionam:

- CSS;
- modal;
- overlay;
- cards;
- controles.

Isso dificulta manter consistência de:

- spacing;
- tipografia;
- estados;
- botões;
- z-index;
- responsividade.

**Direção:** consolidar componentes visuais e manter um sistema de layout compartilhado.

### 6. Manager concentra muitos controles sem navegação interna clara

O Manager combina na mesma área:

- identidade;
- clube;
- pressão;
- finanças;
- partida;
- calendário;
- elenco;
- escalação;
- tática;
- treino.

Com a chegada do mercado, contratos e scouting, essa tela não deve continuar crescendo verticalmente.

**Direção:** separar em navegação:

- Visão geral;
- Elenco;
- Tática;
- Mercado;
- Competições;
- Clube/Carreira.

## Direção mobile

Para mobile, priorizar:

- barra de navegação inferior;
- cards de ação principal;
- tabelas convertidas em listas ou rolagem controlada;
- bottom sheets para decisão;
- safe-area;
- touch targets adequados;
- placar e partida sem esmagar os rails desktop.

Não tentar apenas comprimir a interface desktop inteira.

## Critério para considerar esta frente resolvida

- [ ] Todas as telas principais funcionam em 360–430px sem corte horizontal acidental.
- [ ] Nenhuma informação importante depende de texto minúsculo.
- [ ] O usuário identifica a ação principal da tela em poucos segundos.
- [ ] Career e Manager possuem hierarquia clara.
- [ ] Componentes visuais não dependem de dezenas de injeções independentes.
- [ ] Dados apresentados como ao vivo realmente vêm do sistema.
