# Relatório de Organização e Segurança - Futbrowser

## Estrutura Anterior Encontrada
O projeto original consistia em um frontend flat, onde a maioria dos arquivos (`.js`, `.css`, `.html`) estavam soltos na raiz, misturando scripts de página com lógicas de serviço (ex: inicialização do Supabase) e tratamento de erros. A página `escolha-caminho` existia e era praticamente uma versão antiga ou duplicada da página `dashboard` (que contém adicionalmente a criação de jogadores).

A comunicação com o backend (Supabase) enviava dados abertos do frontend para funções RPC para gerar os atributos, os quais eram devolvidos para o cliente, e então o cliente submetia os atributos finais em um `insert` diretamente para a tabela `jogadores`.

## Estrutura Final
A organização modular proposta focou em não alterar a funcionalidade visual, separando as preocupações em diretórios no `src/`:

- **`src/config/`**: `supabase-config.js` (Exporta Constantes).
- **`src/services/`**: `supabase-client.js` (Cliente), `auth-service.js` (Autenticação), `player-service.js` (Gestão de Jogador via RPC protegida).
- **`src/components/`**: `toast/toast.js` (Centralização de mensagens na UI).
- **`src/utils/`**: `errors.js` (Mensagens humanizadas), `validators.js` (Limpeza e formatação de pesos/alturas).
- **`src/styles/`**: `global.css` (estilos legados compartilhados).
- **`src/pages/`**: `login/` e `dashboard/` com seus respectivos scripts e folhas de estilo.
- **`supabase/migrations/`**: Contém arquivos SQL com a Baseline e as atualizações de RLS/RPC.

## Arquivos Movidos
- `index.css` -> `src/styles/global.css`
- `authService.js` -> `src/services/auth-service.js`
- `supabase-config.js` -> `src/config/supabase-config.js`
- `login.js`, `login.css` -> `src/pages/login/`
- `dashboard.js`, `dashboard.css` -> `src/pages/dashboard/`

## Funcionalidades Extraídas
- **Toast**: Unificado do `login.js` e `dashboard.js` para um componente único em `src/components/toast/toast.js`.
- **Validações e Erros**: Mapeados e centralizados em `src/utils/`.
- **Criação de Jogador**: Lógica cliente refatorada para chamar exclusivamente a nova RPC `create_player` via `player-service.js`, garantindo que atributos e ids não sejam adulterados.

## Bugs Corrigidos
- **Tratamento de altura/peso**: Padronizado para remover bugs quando usuário envia vírgula, caracteres ou medidas fora do formato.
- **Mensagem de sucesso errada**: Anteriormente o sistema poderia simular "Jogador Criado" usando o `localStorage` se o backend falhasse. Agora ele retorna erro apropriado (o `localStorage` foi mantido apenas para flag de UI).

## Arquivos Excluídos
> Pendente. Como solicitado, os arquivos `escolha-caminho.html/css/js` não foram deletados até que haja testes compreensivos do login e dashboard pelo desenvolvedor, bem como o git estar online.

## Mudanças Feitas no Supabase
Foram criadas duas migrações na pasta `supabase/migrations`:
1. `20260717000000_baseline.sql`: Mapeamento das tabelas inferido da aplicação para servir como baseline reproduzível (visto que o `supabase cli` não pôde executar `db pull`).
2. `20260717000001_security_and_rpc.sql`: Contendo as revogações e grants, políticas RLS ativadas, restrição da tabela de jogadores (sem permissão de insert/delete ao usuário comum), e criação da RPC `create_player`.

## Políticas RLS e Segurança
- Todos os privilégios abertos na `PUBLIC` e `anon` para tabelas sensíveis foram revogados.
- O `authenticated` ganhou leitura geral nas tabelas (cada um pode ver o perfil/jogador dos outros).
- Update condicionado a `auth.uid() = id` / `user_id`.
- Função `create_player` forçada com `SECURITY DEFINER` protegida e com validação interna rigorosa de que `auth.uid()` só pode ter 1 jogador, além da aplicação automática do `user_id` sem aceitá-lo como parâmetro aberto.

## Testes Realizados e Pendentes
* Foram realizados testes unitários informais via leitura de código.
* Como não há CLI do Supabase ativo ou credenciais para acesso, os **testes de RLS e Autorização cruzada** com 2 usuários precisam ser rodados pelo administrador via dashboard/Test runner próprio. O ambiente de frontend também precisa ser recarregado no navegador para checagem dos imports.

## Decisões para a Futura Expansão
- A inclusão de uma transação via RPC para as rotinas cruciais do jogo (ex: treinos, jogos, transações de dinheiro) vai ser o padrão ouro do projeto. O frontend agirá apenas como um terminal de visualização.
- Roteamento e Bundling: Eventualmente, quando a aplicação crescer (Clubes, Finanças, Partidas), um bundler simples como Vite deverá ser adotado caso o fluxo de ESModules nativo se torne custoso para a rede do usuário.
