# Plano de Resolução — Futbrowser

**Base:** auditoria da `main` em 05/10/2026.

## Regra do plano

Não adicionar grandes funcionalidades novas antes de concluir as etapas de estabilidade que sustentam o restante.

---

## Etapa 1 — Estabilizar o projeto

**Objetivo:** tornar o estado atual confiável antes de refatorar.

- [ ] Fazer CI rodar em PR e em `main`.
- [ ] Executar toda a suíte `tests/*.mjs`.
- [ ] Validar sintaxe de todos os JS ativos.
- [ ] Criar inventário dos módulos realmente carregados.
- [ ] Identificar arquivos históricos, temporários e mortos.
- [ ] Parar de criar novos `patch-vX`.
- [ ] Registrar baseline funcional do modo Jogador e Manager.

**Concluída quando:** qualquer regressão relevante é detectável automaticamente.

---

## Etapa 2 — Consolidar o motor da carreira/partida

**Objetivo:** substituir a cadeia de patches por arquitetura previsível.

Estrutura alvo aproximada:

```text
match/
  engine/
  state/
  tactics/
  possession/
  decisions/
  goalkeeper/
  simulation/
  persistence/
  ui/
```

- [ ] Definir um único entrypoint do motor.
- [ ] Incorporar regras dos patches ao módulo responsável.
- [ ] Remover alterações tardias de prototype.
- [ ] Remover substituição global de `MutationObserver`.
- [ ] Eliminar fallback que inventa contexto esportivo.
- [ ] Manter testes de comportamento durante a migração.
- [ ] Excluir versões antigas somente após paridade comprovada.

**Concluída quando:** a regra final da partida pode ser entendida sem depender da ordem dos scripts.

---

## Etapa 3 — Fechar o contrato do backend

**Objetivo:** garantir que código, migrations e produção representem o mesmo jogo.

- [ ] Subir banco limpo em teste.
- [ ] Aplicar todas as migrations desde zero.
- [ ] Validar todas as RPCs consumidas pelo frontend.
- [ ] Auditar `SECURITY DEFINER`, RLS e grants.
- [ ] Criar testes de ownership e isolamento entre usuários.
- [ ] Criar testes de atomicidade de contrato e partida.
- [ ] Validar progressão de categoria e transferências.
- [ ] Validar isolamento Jogador × Manager.
- [ ] Comparar schema esperado com Supabase de produção.
- [ ] Migrar/remover os valores antigos `tecnico` e `presidente`, caso não façam mais parte do produto.

**Concluída quando:** não existe drift conhecido entre repositório e banco.

---

## Etapa 4 — Alinhar promessa e produto

**Objetivo:** parar de prometer funcionalidades que o usuário não recebe.

- [ ] Decidir se o produto atual é Jogador + Manager ou MMO.
- [ ] Ajustar a home para os modos realmente disponíveis.
- [ ] Remover números online estáticos.
- [ ] Remover `tempo real`/MMO enquanto não houver sistema correspondente, se essa for a decisão.
- [ ] Explicar Seleção como parte da carreira Jogador, caso não exista modo independente.
- [ ] Garantir que todo card/CTA leve a um fluxo funcional.

**Concluída quando:** nenhum texto comercial da interface promete algo inexistente.

---

## Etapa 5 — Completar o Manager

**Objetivo:** transformar a fundação atual em uma carreira completa.

### 5.1 Mercado
- [ ] busca/scouting;
- [ ] contratação;
- [ ] venda;
- [ ] empréstimo;
- [ ] negociação;
- [ ] salário/contrato;
- [ ] janelas.

### 5.2 Gestão esportiva
- [ ] lesões;
- [ ] suspensões;
- [ ] moral individual;
- [ ] promessas;
- [ ] rotação;
- [ ] desenvolvimento.

### 5.3 Carreira do treinador
- [ ] classificação completa;
- [ ] objetivos da diretoria;
- [ ] risco de demissão;
- [ ] reputação;
- [ ] propostas de outros clubes;
- [ ] troca de clube;
- [ ] encerramento da temporada;
- [ ] próxima temporada.

**Concluída quando:** é possível jogar várias temporadas e mudar de clube sem sair do loop Manager.

---

## Etapa 6 — Fechar o ciclo do modo Jogador

**Objetivo:** transformar os sistemas já existentes em uma carreira contínua.

- [ ] validar criação e onboarding;
- [ ] base por categoria;
- [ ] partidas e calendário;
- [ ] evolução;
- [ ] promoção;
- [ ] transferências;
- [ ] profissional;
- [ ] seleção;
- [ ] auge;
- [ ] queda física/idade;
- [ ] aposentadoria;
- [ ] histórico final da carreira.

**Concluída quando:** o jogador pode iniciar e terminar uma carreira completa sem estados quebrados.

---

## Etapa 7 — Reorganizar a interface

**Objetivo:** diminuir sobrecarga e preparar desktop/mobile para a expansão.

### Career
- [ ] destacar o que acontece hoje;
- [ ] destacar a ação disponível agora;
- [ ] destacar o próximo jogo;
- [ ] mover detalhes para navegação secundária.

### Manager
Criar áreas:
- [ ] Visão geral;
- [ ] Elenco;
- [ ] Tática;
- [ ] Mercado;
- [ ] Competições;
- [ ] Carreira/Clube.

### Mobile
- [ ] nova auditoria 360–430px;
- [ ] navegação inferior;
- [ ] touch targets;
- [ ] tabelas adaptadas;
- [ ] modais/bottom sheets;
- [ ] partida mobile;
- [ ] remover cortes/overflow.

**Concluída quando:** desktop e mobile entregam os mesmos fluxos sem tentar usar exatamente o mesmo layout.

---

# Ordem obrigatória

1. **Estabilidade e testes**
2. **Consolidação do código**
3. **Contrato do backend**
4. **Promessa do produto**
5. **Manager**
6. **Ciclo completo Jogador**
7. **Reestruturação final da interface**

## Regra de execução

Cada etapa só deve ser marcada como concluída depois de:

- implementação;
- teste;
- verificação do fluxo do usuário;
- atualização deste checklist.

Não considerar uma etapa pronta apenas porque o código foi escrito.
