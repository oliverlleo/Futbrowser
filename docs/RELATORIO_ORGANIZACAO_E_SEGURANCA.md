# Relatório de Organização e Segurança - Futbrowser

> **Aviso Importante:** A baseline original foi movida para `docs/database/provisional_baseline.sql` pois não correspondia à estrutura real. O banco real foi **auditado com sucesso** e os arquivos locais agora refletem **exatamente** o que está em produção.

## 1. Organização do Frontend
A reestruturação modular foi concluída. Os arquivos HTML principais acessam a estrutura em `src/`:
- `index.html` -> `src/styles/global.css`, `src/pages/login/login.css`, `src/pages/login/login.js`
- `dashboard.html` -> `src/styles/global.css`, `src/pages/dashboard/dashboard.css`, `src/pages/dashboard/dashboard.js`
- Os avatares corrompidos (`avatar16.webp` e `avatar18.webp`) foram removidos da pasta local, e o código agora usa uma matriz fixa (`validAvatars`) para carregamento sequencial.

## 2. Auditoria e Estrutura Real do Banco
A auditoria no Supabase revelou:
- `altura` e `peso` na tabela `jogadores` são do tipo `TEXT`, diferente do inferido inicialmente.
- Já existia o trigger `ensure_secure_attributes` chamando a função `calculate_player_attributes()`.
- O trigger já preenchia os atributos de forma segura baseando-se nos inputs primários.
- Constatada duplicidade real no banco para o UUID `3cd4e4d4-65f8-45b8-9c60-e0d0aa99624a` (2 jogadores).

## 3. Segurança e RPCs Aplicadas
A migration `20260717000001_security_and_rpc.sql` foi **executada com sucesso** no ambiente de produção do Supabase, implementando:
1. **Locking Transacional:** Implementado `pg_advisory_xact_lock` determinístico via UUID na RPC `create_player` para barrar a criação simultânea e proteger contra novas duplicidades, preservando o registro duplicado antigo intacto sem gerar falhas de `UNIQUE`.
2. **Revogação Total:** Foram descartadas as políticas reais exatas (`Usuários podem excluir seus próprios jogadores`, etc.) que abriam brecha para `UPDATE/INSERT/DELETE` diretos por `authenticated`.
3. **Leitura Protegida:** A única política deixada para `jogadores` foi a leitura do próprio jogador: `USING (auth.uid() = user_id)`.
4. **Trigger Direcionado:** O trigger foi atualizado para processar atributos no `INSERT` obrigatoriamente, e no `UPDATE` apenas em `OF posicao, arquetipo, altura, peso`. O `search_path` foi fixado em `'public'`.
5. **Integração RPC + Trigger:** A RPC foi simplificada para fazer apenas o `INSERT` dos dados base. O trigger assume e chama `calculate_player_attributes()`, calculando e injetando o JSON em tempo real no servidor.

## 4. Testes e Validação no Banco
- [x] Tentativa de inserção direta pela API/SQL: **Bloqueada** (Privilégios insuficientes).
- [x] Atualização ou exclusão direta: **Bloqueadas** (Privilégios insuficientes).
- [x] Inserção via `create_player`: **Garante Integridade** (Rejeita duplicações).
- [x] O cálculo de atributos continua operando no trigger do lado do servidor sem intervenção do usuário ou frontend.
- [x] A leitura do perfil próprio funciona; a leitura de perfis alheios é **Bloqueada**.

## 5. Pendências Residuais
- **Redefinição de Senha:** O seletor foi corrigido (`recuperarEmail`), mas a página destino do redirect (`/reset-password.html`) **não existe**. Essa funcionalidade não está completa até a página ser desenvolvida.
- **Resolução de Duplicidade:** Decidir manualmente via banco qual dos 2 jogadores vinculados ao UUID `3cd4e4d4-65f8-45b8-9c60-e0d0aa99624a` será mantido para finalmente criar a constraint `UNIQUE (user_id)`.
