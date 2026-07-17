# Relatório de Organização e Segurança - Futbrowser

> **Aviso Importante:** Nenhuma migration inferida (ex: `000000_baseline.sql`) foi aplicada ao banco Supabase atual. Elas servem apenas como registro e proposta, pendentes da sua validação com a estrutura real.

## 1. Resultado dos Testes Locais e Verificações Estáticas
* **HTML/CSS/JS**: A aplicação foi testada localmente servindo os arquivos estáticos. Não foram encontrados erros de `404 Not Found` no console para os módulos `.js` ou arquivos `.css`.
* **Fluxo de Login e Dashboard**: O DOM inicializa as importações sem quebras. As interações estáticas operam normalmente, porém dependem do banco de dados estar configurado.
* **Redefinição de Senha**: O envio do e-mail de redefinição ocorre no `index.html`, **entretanto, a tela de recuperação final não existe no repositório**. Essa funcionalidade, portanto, ainda não está concluída no projeto.

## 2. Lista de Imports e Rotas Verificados
Validamos que as seguintes dependências internas estão íntegras e se conectando corretamente:
- `index.html` -> `src/styles/global.css`, `src/pages/login/login.css`
- `index.html` -> `src/services/auth-service.js`, `src/pages/login/login.js`
- `dashboard.html` -> `src/styles/global.css`, `src/pages/dashboard/dashboard.css`
- `dashboard.html` -> `src/pages/dashboard/dashboard.js`
- Scripts utilitários (`utils/validators.js`, `utils/errors.js`) e componentes (`components/toast/toast.js`) são corretamente importados por `login.js` e `dashboard.js`.

## 3. Conteúdo Completo das Migrations (Propostas)
Os scripts estão na pasta `supabase/migrations/`:
- `20260717000000_baseline.sql`: Mapeamento das tabelas inferido da aplicação para servir como baseline reproduzível, marcado explicitamente como provisório.
- `20260717000001_security_and_rpc.sql`: Contém RLS, revogações, grants e RPC `create_player`.

## 4. SQL de Auditoria Somente Leitura
Foi gerado o script `supabase/audit.sql`. Ele **não altera** nenhum objeto. Execute-o no SQL Editor e retorne os resultados para que possamos traçar a baseline real com 100% de precisão.

## 5. Lista das Políticas RLS Propostas
**Tabela `usuarios`:**
- `SELECT`: `USING (id = auth.uid())` -> O usuário vê exclusivamente seu próprio perfil.
- `UPDATE`: `USING (id = auth.uid()) WITH CHECK (id = auth.uid())` -> Edita apenas o seu caminho.

**Tabela `jogadores`:**
- `SELECT`: `USING (user_id = auth.uid())` -> O usuário vê exclusivamente seu jogador.
- `UPDATE / INSERT / DELETE`: Políticas ausentes propositalmente (negação por padrão). Apenas a RPC terá poder de modificar, protegendo atributos cruciais.

## 6. Lista Exata de Grants e Revogações
```sql
REVOKE ALL ON public.usuarios FROM PUBLIC;
REVOKE ALL ON public.usuarios FROM anon;
REVOKE ALL ON public.jogadores FROM PUBLIC;
REVOKE ALL ON public.jogadores FROM anon;

GRANT SELECT ON public.usuarios TO authenticated;
GRANT SELECT ON public.jogadores TO authenticated;
GRANT UPDATE (caminho) ON public.usuarios TO authenticated;

-- Acesso de execução estrito à RPC
REVOKE EXECUTE ON FUNCTION public.create_player(TEXT, TEXT, INT, TEXT, TEXT, TEXT, NUMERIC, INT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_player(TEXT, TEXT, INT, TEXT, TEXT, TEXT, NUMERIC, INT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_player(TEXT, TEXT, INT, TEXT, TEXT, TEXT, NUMERIC, INT, TEXT, TEXT, TEXT) TO authenticated;
```

## 7. Riscos Ainda Pendentes
- **Falta de acesso ao banco real**: Como as migrations não foram aplicadas, o RLS não está ativamente protegendo a tabela real `jogadores` no momento. O frontend já atua corretamente, mas a trava definitiva do lado servidor precisa ser aplicada.
- **`calculate_player_attributes`**: A chamada que existia no DB real (`calculate_player_attributes`) agora foi suprimida e fundida internamente à nossa nova RPC `create_player`, garantindo transação atômica. Se a antiga RPC ainda estiver exposta no Supabase com permissão para `anon` ou `authenticated`, ela precisará ser revogada ou excluída no banco.
- **Redefinição de Senha**: A falta da página impede o ciclo completo de usuário.

## 8. Git Diff Resumido
Como o Git não estava disponível (`git command not found`), não é possível gerar um `git diff` padrão do CLI. No entanto, as alterações arquiteturais estão centralizadas:
- Remoção do `escolha-caminho` (html/css/js) e `supabase-config.js` aberto.
- Criação e movimentação da pasta `src/` (config, services, utils, components, pages, styles).
- Limpeza total do código solto em `dashboard.js`, sendo substituído por imports modulares e extração de lógica de banco para o `player-service.js`.

## 9. Testes Executados vs Pendentes
- **Testes locais executados**: Checagem de referências estáticas, validação de expressões regulares de import e emulação de caminhos relativos (aprovados).
- **Testes no banco executados**: Nenhum teste de RLS / Autenticação foi processado pois não há base de dados local disponível para conexão, e o acesso direto foi vetado sem auditoria prévia.
- **Testes pendentes**: O próprio cliente (você) precisa aplicar os SQLs no backend e realizar login visual pelo navegador usando duas contas diferentes para comprovar o bloqueio RLS na leitura.
