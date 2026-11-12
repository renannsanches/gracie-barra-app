# T1 — Baseline de migrations fiel à produção (spec)

> Desenho aprovado pelo dono em 2026-11-12. Plano de execução: [`../plans/2026-11-12-t1-baseline-migrations.md`](../plans/2026-11-12-t1-baseline-migrations.md). Item T1 de [`docs/roadmap-saas.md`](../../roadmap-saas.md).

## Context

Primeiro passo do roadmap SaaS (`docs/roadmap-saas.md`, ordem T1 → T2 → 1.1). Hoje `supabase/migrations/` (61 ficheiros) **não reproduz** a BD de produção: houve SQL corrido à mão no Dashboard (`gerar_qr_token(uuid[])`, `qr_tokens.aluno_ids`, `registrar_presenca_por_token` jsonb, `profiles.sem_login`, buckets `galeria` e `Contrato`). O histórico em produção (`supabase_migrations.schema_migrations`, 61 linhas) também diverge do repo (versões diferentes em `aula_experimental_publica`, `feed`, `feed_jpeg`, `feed_dados`; duplicados como `mensalidades` ×2, `add_nif` ×3).

Sem uma baseline fiel não há ambiente de teste (T2) e o 1.1 (reescrever a RLS de todas as tabelas) teria de ser testado em produção.

**Resultado:** uma migration `..._baseline_producao.sql` que, aplicada a um projecto Supabase vazio, dá o mesmo schema que produção; prova automática disso; histórico de produção alinhado com o repo.

### Decisões tomadas (com o dono, 2026-11-12)
| Decisão | Escolha |
|---|---|
| Como gerar | `pg_dump --schema-only` local (cliente PostgreSQL 17) |
| Como provar | Projecto Supabase novo, grátis (0 $/mês confirmado por `get_cost`), que depois vira o staging do T2 |
| Buckets `comprovativos` e `Gracie Barra Famalicao` (vazios, sem uso no código) | Fora da baseline; ficam intactos em produção |
| Histórico de produção | Reparar: backup → apagar as 61 linhas → registar só a baseline como aplicada |

### Regra do dono (2026-11-12): nada se apaga em produção sem backup
Nenhum passo apaga dados de produção. Qualquer coisa que precise de ser apagada ou substituída em produção (linhas, metadados, ficheiros, buckets) leva **backup verificado antes** (tabela de backup + export para o repo) e confirmação do dono no momento. Esta regra fica gravada em memória e em `CLAUDE.md` §11 para todos os itens seguintes do roadmap.

### Estado medido em produção (read-only, 2026-11-12)
- `public`: 29 tabelas, 241 colunas, 85 índices, 82 policies, 9 triggers, 0 views, 11 enums, 17 funções.
- Fora de `public`: trigger `tg_on_auth_user_created` em `auth.users`; 6 policies em `storage.objects` (avatars); 6 buckets.
- Extensões: só as de série do Supabase (`pgcrypto`, `uuid-ossp`, `pg_stat_statements` em `extensions`). Sem `pg_cron`, sem tabelas no realtime.
- Postgres 17.6. Sem branches Supabase. Máquina: sem Supabase CLI, Docker nem `pg_dump`; Node 22 disponível.

### Impressão digital de produção = staging (`supabase/verificar-schema.sql`, 2026-11-12, normalizada)
| tipo | total | md5 |
|---|---|---|
| bucket | 4 | `b65e8d762ca835564e67f8dedda911ae` |
| coluna | 241 | `ffa985f791936a7e4c0ac0fc63cdce6a` |
| constraint | 109 | `c8832f9e0755896e66287ee111e3f023` |
| default_acl | 6 | `f680f2bec1a117bbde0762e387a054f5` |
| enum | 12 | `d4af70116a1ad93de37e65a64ca6e0cd` |
| extensao | 2 | `29cf9b843694caca434605a61eb9f4fa` |
| funcao | 17 | `1c9b0118f6e94c7c820a640785e15385` |
| indice | 85 | `01ad72abe47943954837e1ad79a7ec6b` |
| policy | 88 | `aeb4683d6c7dec3fc925d95c004a5cbb` |
| relacao | 29 | `4186079448b8585d8e398728d2edb7f5` |
| trigger | 10 | `ee6cc3c8e1927449cf76ff15d1f74a91` |

## Abordagem

### 1. Preparar (ciclo do plano mestre, secção A)
- Ramo `feat/t1-baseline-migrations` a partir de `producao/master`, em worktree (`superpowers:using-git-worktrees`). PR #79 (roadmap) e #78 tocam `CLAUDE.md`/`CHANGELOG.md`: rebasear no fim se algum entrar primeiro.
- Registar este desenho como spec em `docs/superpowers/specs/2026-11-12-t1-baseline-migrations-design.md` e o plano de execução em `docs/superpowers/plans/2026-11-12-t1-baseline-migrations.md` (`superpowers:writing-plans`).

### 2. Ferramenta de comparação primeiro (TDD do schema)
Novo `supabase/verificar-schema.sql`: uma consulta de "impressão digital" do schema, linha por objecto, ordenada, com:
- tabelas/colunas (tipo, default, null), constraints (`pg_get_constraintdef`), índices (`indexdef`), policies (`qual`, `with_check`, roles, cmd), funções (`md5(pg_get_functiondef)`, `prosecdef`, `proacl`), triggers (`pg_get_triggerdef`), enums, grants de tabelas (`relacl`), RLS on/forced;
- `storage.buckets` (id, public, file_size_limit, allowed_mime_types), policies de `storage.objects`, triggers em `auth.users`.

Corre-se via MCP `execute_sql` em produção e no staging; o diff tem de ser vazio (excepto os 2 buckets excluídos). Fica no repo para reutilizar no T2 e no 1.1.

### 3. Dump de produção (o dono corre 1 comando)
- Instalar o cliente PostgreSQL 17: zip de binários da EnterpriseDB extraído para `C:\Users\Administrator\tools\pgsql` (sem serviço). **Pedir OK antes do download** (nome, origem, tamanho).
- O dono corre no terminal dele (a password nunca passa por mim; `pg_dump` pede-a):
  `pg_dump "postgresql://postgres.fjqiyilzxxyoyposqsfz@<host do session pooler>:5432/postgres" --schema-only --schema=public --no-owner -f supabase/dump-public.sql`
  (host em `supabase/.temp/pooler-url`, porta 5432 = session mode).

### 4. Montar a baseline
`supabase/migrations/<versão>_baseline_producao.sql`, por secções:
1. Extensões: `create extension if not exists pgcrypto / "uuid-ossp" with schema extensions`.
2. Conteúdo do `pg_dump` de `public` (tipos, tabelas, funções, triggers, índices, RLS, policies, grants), limpo de linhas de sessão (`SET`, `SELECT pg_catalog.set_config`) que não pertencem a uma migration.
3. Fora de `public`, gerado por consultas MCP a produção: trigger `tg_on_auth_user_created` em `auth.users`; `insert into storage.buckets` para `avatars`, `galeria`, `Contrato`, `feed` (com limites e MIME); as 6 policies de `storage.objects`.
4. Cabeçalho a explicar: substitui as 61 migrations antigas; dados, configuração de Auth (templates de email, Site URL) e env vars não estão aqui (vão para o T2).

As 61 migrations antigas passam para `supabase/migrations_arquivo/` (fora do directório que o CLI lê; ficam no git como histórico). `supabase/dump-public.sql` não é commitado.

### 5. Provar no staging
- MCP `create_project` (org `fuxafqdysdvxxuxmitkk`, mesma região de produção, 0 $/mês — `confirm_cost` antes). Verificar com `list_projects` que o plano grátis ainda tem vaga (limite de 2 projectos activos).
- `apply_migration` da baseline no staging.
- Correr `verificar-schema.sql` nos dois; iterar na baseline até o diff estar vazio.
- `get_advisors` (security) no staging deve dar os mesmos avisos que produção.

### 6. Reparar o histórico de produção (só metadados)
**Confirmar com o dono antes de executar** (apaga linhas em produção):
1. Backup: `create table supabase_migrations.schema_migrations_backup_20261112 as select * from supabase_migrations.schema_migrations` + export JSON para `supabase/migrations_arquivo/schema_migrations_producao_2026-11-12.json`.
2. `delete from supabase_migrations.schema_migrations`; `insert` da linha da baseline (versão e nome iguais ao ficheiro, sem `statements` — não corre).
3. `list_migrations` em produção deve listar só a baseline. Rollback: repor a partir da tabela de backup.

Antes do `delete`: confirmar que a tabela de backup tem 61 linhas e que o JSON tem 61 entradas. A tabela de backup **não** se apaga no fim.

A versão da baseline é a hora em que este passo corre; o ficheiro do repo é renomeado para bater (regra do `CLAUDE.md` §7).

### 7. Fecho
- `superpowers:verification-before-completion`: `npm test`, `npm run build`, `npm run lint` (nada no código da app muda; é para provar isso).
- `code-review` + `security-review` (a baseline contém toda a RLS: rever que nenhuma policy/grant mudou).
- Memória `feedback`: "nada se apaga em produção sem backup verificado + confirmação" (gravar logo ao sair do modo plano).
- Docs: `CLAUDE.md` §11 (regra de backup antes de apagar em produção), §7 (secção "Drift" passa a descrever a baseline, `verificar-schema.sql` e o staging), §12 (linha "Migration do repo diverge da BD"), §13 (remover débito), §14 (T1 = feito); `docs/roadmap-saas.md` coluna Estado do T1; checkbox do T1 no plano mestre; entrada em `docs/CHANGELOG.md`; memória `project_roadmap_saas`.
- PR para `master` em `renannsanches/gracie-barra-app` (`superpowers:finishing-a-development-branch`). Deploy na Vercel não muda nada em runtime.

## Ficheiros
- Novo: `supabase/migrations/<versão>_baseline_producao.sql`, `supabase/verificar-schema.sql`, `supabase/migrations_arquivo/` (61 ficheiros movidos + backup JSON do histórico).
- Editados: `CLAUDE.md`, `docs/CHANGELOG.md`, `docs/roadmap-saas.md`, `docs/superpowers/plans/2026-11-12-roadmap-saas-mestre.md`; novos spec e plano em `docs/superpowers/`.
- Código da app (`src/`): nenhum.

## Verificação (pronto quando)
1. `verificar-schema.sql` dá o mesmo resultado em produção e no staging (diferença só nos 2 buckets excluídos).
2. `get_advisors` security igual nos dois.
3. `list_migrations` em produção = 1 linha (baseline); backup existe em tabela e em JSON.
4. `npm test`, `npm run build`, `npm run lint` passam como hoje.
5. App em produção continua a funcionar (smoke: login, `/presenca` gera QR) — o passo 6 não toca no schema, mas confirma-se.

## Riscos
- `pg_dump` a partir do session pooler falhar → usar a ligação directa (`db.<ref>.supabase.co`, IPv6) ou o IPv4 add-on; ou cair para geração via MCP.
- Diferenças de privilégios por defeito entre projecto novo e produção → o diff do passo 5 apanha-as; corrigir com `grant`/`revoke` explícitos na baseline.
- Limite de 2 projectos grátis atingido → perguntar ao dono antes de pausar/criar.

## Tempo estimado
~3 h de execução minha. Do dono: ~15 min (OK ao download, correr o `pg_dump` com a password, OK ao passo 6).
