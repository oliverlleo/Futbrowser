# Auditoria — Funcionalidades do Usuário

**Projeto:** Futbrowser  
**Base analisada:** `main`  
**Data:** 05/10/2026

## Objetivo

Avaliar se o que o usuário entende que a plataforma oferece corresponde ao que ele realmente consegue fazer.

## Prioridade P0 — quebra direta da promessa

### 1. A plataforma se apresenta como MMO/tempo real sem entregar multiplayer correspondente

A interface usa mensagens como:

- `MMO DE FUTEBOL`;
- `Mundo online`;
- `Jogadores reais`;
- `Dispute em tempo real`;
- `Online agora 8.456`.

Na implementação atual não foi encontrado um fluxo multiplayer equivalente que sustente essas promessas.

Não há no frontend analisado um sistema de presença/realtime que transforme partidas e saves em um mundo multiplayer entre usuários.

**Decisão necessária:**

#### Opção A — produto atual
Assumir temporariamente o Futbrowser como simulador de carreira online persistente e remover promessas de MMO que ainda não existem.

#### Opção B — MMO real
Implementar presença, interação entre usuários e sistemas compartilhados antes de voltar a comunicar o produto como MMO.

### 2. Home promete quatro caminhos, fluxo real entrega dois

A home apresenta:

- Jogador;
- Técnico;
- Presidente;
- Seleção.

A dashboard atual apresenta:

- Jogador;
- Manager.

Isso cria expectativa errada antes do usuário entrar no jogo.

**Direção:** alinhar imediatamente a home ao produto real ou desenvolver os modos prometidos.

### 3. Seleção existe como parte da carreira, não como modo independente

Há suporte a convocações e histórico do jogador pela seleção.

Porém isso não corresponde à promessa da home de um caminho independente para comandar uma seleção.

**Direção:** ou remover Seleção como caminho inicial ou criar um modo real de treinador de seleção.

## Prioridade P1 — funcionalidades incompletas

### 4. Manager promete mercado e orçamento, mas o usuário não consegue administrar o mercado

A interface exibe:

- orçamento de transferências;
- folha disponível;
- promessa de `Mercado e orçamento esportivo`.

Mas a Central Manager atual não oferece um mercado completo para:

- contratar;
- vender;
- emprestar;
- negociar;
- renovar;
- pesquisar/scoutar jogadores.

**Resultado:** existe recurso financeiro sem um loop completo para usá-lo.

### 5. Manager ainda não fecha uma carreira longa

O loop atual já possui:

- criação do Manager;
- propostas iniciais;
- clube;
- escalação;
- tática;
- treino;
- partidas;
- calendário;
- pressão/diretoria.

Ainda faltam componentes essenciais para uma carreira duradoura:

- mercado completo;
- contratos;
- lesões e suspensões profundas;
- scouting;
- classificação/competições completas;
- demissão;
- reputação e propostas de outros clubes;
- mudança de clube;
- fim e início de temporada;
- evolução de elenco ao longo dos anos;
- categorias de base;
- staff.

### 6. Modo Jogador é amplo, mas precisa fechar o ciclo de vida completo

O modo Jogador já possui boa parte dos sistemas:

- base;
- treino;
- partidas;
- evolução;
- relações;
- patrocínio;
- mercado;
- promoção;
- seleção.

O objetivo agora deve ser garantir um ciclo coerente:

`criação → base → promoção → profissional → transferências → seleção → auge → declínio → aposentadoria`.

Cada etapa precisa acontecer por consequência do save, e não apenas existir como sistema isolado.

## Prioridade P2 — mundo vivo

Se a intenção continuar sendo MMO, a plataforma precisará de pelo menos uma camada social/multiplayer real, por exemplo:

- presença online real;
- ranking;
- estatísticas globais;
- eventos compartilhados;
- comparação de carreiras;
- temporadas sincronizadas;
- mercado ou competições com algum grau de interação entre usuários.

Não é necessário implementar tudo, mas precisa existir uma mecânica central que justifique a promessa de MMO.

## Critério para considerar esta frente resolvida

- [ ] Tudo que a home promete possui fluxo utilizável.
- [ ] Números exibidos como dados online são reais ou deixam de ser apresentados como reais.
- [ ] Manager possui uso concreto para orçamento e folha.
- [ ] Manager fecha pelo menos uma temporada completa e inicia a seguinte.
- [ ] Jogador possui uma progressão de carreira completa e coerente.
- [ ] A descrição do produto corresponde exatamente às funcionalidades existentes.
