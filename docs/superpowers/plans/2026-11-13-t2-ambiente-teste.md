# T2 — Ambiente de teste separado: plano de implementação

> **Estado (2026-11-13):** ramo `feat/t2-ambiente-teste` (worktree `.claude/worktrees/t2-ambiente-teste`), sem push.
> - ✅ Task 1 (`0fffae2`): guarda; provada contra produção (E2E recusado, produção 140/233 antes e depois).
> - ✅ Task 2 (`cfeb55f`): host do env; build OK; 141/141 testes.
> - ✅ Task 3 (`782f303`): seed aplicado 2× no staging (13 perfis, 3 turmas, 24 aulas, 33 mensalidades, 306 presenças); schema 11/11; histórico do staging = só a baseline. Marca do staging = segredo `ambiente` no Vault (o Supabase recusa GUC).
> - Task 4: ✅ C (Vercel Preview com as 3 chaves do staging; Production intacta). A.2 (templates) saltado: o plano grátis não edita templates sem SMTP próprio. Falta o dono confirmar A.1, A.3 e B (`.env.local`).
> - Próximo: copiar o `.env.local` para o worktree → Task 4.5 (dev local) → Task 5 (E2E + preview) → Task 6 (docs, revisão, PR).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dev local, E2E e previews da Vercel passam a usar o projecto Supabase de staging; nada de teste volta a escrever na BD de produção.

**Architecture:** o staging já existe (T1: `gracie-barra-staging`, `luakxrtecetdkccoctzm`, eu-west-2, grátis, schema 11/11 igual à produção, vazio). O T2 junta-lhe um seed SQL de dados fictícios com guarda de ambiente, configuração de Auth, as env vars do Preview na Vercel e um guarda em código que impede o E2E de correr contra produção. O host do Supabase deixa de estar escrito em `next.config.ts`.

**Tech Stack:** Next.js 16, Supabase (Postgres 17, Auth, Storage), Vercel, Playwright, vitest. MCP Supabase (`execute_sql`, `get_publishable_keys`, `get_advisors`). O MCP da Vercel dá 403 a env vars: o dono põe-nas no Dashboard. Sem Supabase CLI nem Vercel CLI na máquina.

**Spec:** este plano faz as vezes de spec; ao executar, copiar para `docs/superpowers/specs/2026-11-12-t2-ambiente-teste-design.md` (secções Context + Decisões) e `docs/superpowers/plans/2026-11-12-t2-ambiente-teste.md` (tarefas).

## Context

Item T2 do roadmap (`docs/roadmap-saas.md`; plano mestre §B). Hoje `.env.local` aponta para produção: `npm run dev` e `npm run test:e2e` escrevem em alunos reais (`financeiro.spec.ts` faz upsert/delete em `mensalidades`, `feed.spec.ts` cria e apaga posts, graduações e ficheiros, `global-setup.ts` cria utilizadores). Os previews da Vercel dão 500 porque o ambiente Preview não tem as variáveis do Supabase. O 1.1 (reescrever a RLS de todas as tabelas) precisa de um sítio para ser testado que não seja produção.

**Pronto quando:** `npm run test:e2e` corre contra o staging sem tocar na produção; correr o E2E com o URL de produção falha antes de qualquer escrita; um preview da Vercel abre, faz login e mostra os dados fictícios; o staging continua 11/11 igual à produção em schema.

### Decisões (dono, 2026-11-12)
| Decisão | Escolha |
|---|---|
| Dev local | Dev **e** E2E no staging: `.env.local` passa a ter só chaves do staging; as de produção ficam só na Vercel |
| Seed | Mínimo realista (lista na Task 3) |
| Supabase branch vs projecto | Projecto de staging do T1 (branching é pago; o staging grátis já está provado igual) |
| Quem mexe em segredos | O dono: copia a service role key do staging para `.env.local` e para a Vercel. Eu nunca a vejo |

## Global Constraints
- Ref de produção: `fjqiyilzxxyoyposqsfz`. Ref de staging: `luakxrtecetdkccoctzm`.
- Regra do dono: nada se apaga **em produção** sem backup verificado + confirmação no momento. O T2 não apaga nada em produção (os utilizadores de teste e restos de E2E que já lá estão ficam; limpeza = follow-up com backup).
- Schema do staging não muda no T2 (só dados). `supabase/verificar-schema.sql` tem de continuar 11/11 igual entre staging e produção.
- UUIDs fixos do seed para os defaults da baseline: `grupos_alunos.id = f1a2b776-86b0-46d0-8ea2-d5cb7b290aad`, `modalidades.id = 76043248-42d7-46d5-a647-cc7cdae6719b`.
- Regra de password do Auth tem de bater com `src/lib/senha.ts`: 8+ caracteres, maiúscula, minúscula, número.
- Sem `oklch()`, interface pt-PT, código em inglês/pt como o resto (ver `CLAUDE.md` §10–11).
- Push continua só com `VERCEL_ENV=production` (`src/lib/push-ativo.ts`); não mudar.

## Review Focus
1. **E2E apontado para produção por engano** (env antiga, variável exportada na shell) → `global-setup` tem de falhar antes de criar utilizadores. Teste: Task 1 (unitário) + Task 5 passo de verificação com override do URL.
2. **Seed corrido em produção por engano** (MCP no `project_id` errado) → o SQL aborta sem inserir nada. Teste: Task 3, passo que corre só o bloco de guarda contra produção (read-only: aborta no `RAISE`).
3. **Imagens do Storage do staging no preview** (`next/image` com host não autorizado dá erro 400) → host vem do env. Teste: Task 2 (unitário) + smoke no preview com a foto de um álbum/avatar do seed.
4. **Links de email do staging** (reset de password) a apontarem para produção ou localhost errado → Site URL/Redirect URLs do staging. Verificação manual na Task 4.
5. **Gmail real a enviar contratos a emails fictícios** a partir de dev/preview → `GMAIL_*` fora de `.env.local` e do Preview; `send-contract-email.ts` já engole a falha. Verificação na Task 4.

---

### Task 1: Guarda de ambiente (`src/lib/ambiente.ts`)

**Files:**
- Create: `src/lib/ambiente.ts`, `src/lib/ambiente.test.ts`
- Modify: `e2e/global-setup.ts` (início de `globalSetup`), comentário de `ocultar_ranking` no upsert; `e2e/gamificacao.spec.ts:3-5` (comentário)

**Interfaces — Produces:**
- `export const REF_PRODUCAO = "fjqiyilzxxyoyposqsfz"`
- `export function refDoProjeto(url: string | undefined): string | null` — subdomínio de `https://<ref>.supabase.co`; `null` se o URL não for desse formato
- `export function eProducao(url: string | undefined): boolean`
- `export function exigirForaDeProducao(url: string | undefined): void` — lança `Error("E2E recusado: NEXT_PUBLIC_SUPABASE_URL aponta para a produção (fjqiyilzxxyoyposqsfz). Usar o staging.")`
- `export function hostSupabase(url: string | undefined): string` — hostname; lança `Error("NEXT_PUBLIC_SUPABASE_URL em falta ou inválido")` se vazio/inválido

- [ ] **Step 1: testes que falham** em `src/lib/ambiente.test.ts`:
  - `refDoProjeto("https://fjqiyilzxxyoyposqsfz.supabase.co")` → `"fjqiyilzxxyoyposqsfz"`; com `/` final e com path → igual; `"http://localhost:54321"` → `null`; `undefined` → `null`
  - `eProducao` true para o URL de produção (também em maiúsculas), false para `https://luakxrtecetdkccoctzm.supabase.co`, false para `undefined`
  - `exigirForaDeProducao(prod)` lança com a mensagem acima; `exigirForaDeProducao(staging)` não lança
  - `hostSupabase("https://luakxrtecetdkccoctzm.supabase.co")` → `"luakxrtecetdkccoctzm.supabase.co"`; `hostSupabase(undefined)` e `hostSupabase("lixo")` lançam
- [ ] **Step 2:** `npx vitest run src/lib/ambiente.test.ts` → FAIL (módulo não existe)
- [ ] **Step 3:** implementar com `new URL()` em try/catch; comparação case-insensitive
- [ ] **Step 4:** `npx vitest run src/lib/ambiente.test.ts` → PASS; `npm test` → todos verdes (112 + novos)
- [ ] **Step 5:** em `e2e/global-setup.ts`, primeira linha de `globalSetup`: `exigirForaDeProducao(SUPABASE_URL)` (import relativo `../src/lib/ambiente`). O upsert mantém `ocultar_ranking: true` (o `gamificacao.spec.ts` testa o estado "oculto"); trocar o comentário para "fixture: testa o aluno oculto do ranking". Actualizar o comentário de `gamificacao.spec.ts:3-5` no mesmo sentido
- [ ] **Step 6:** commit `feat(t2): guarda que impede E2E contra a BD de produção`

### Task 2: Host do Supabase vindo do env em `next.config.ts`

**Files:** Modify `next.config.ts` (`runtimeCaching[0].urlPattern` e `images.remotePatterns[0].hostname`)

**Interfaces — Consumes:** `hostSupabase` (Task 1).

- [ ] **Step 1: teste que falha** em `src/lib/ambiente.test.ts`: `padraoSupabase("https://luakxrtecetdkccoctzm.supabase.co")` devolve RegExp que casa `https://luakxrtecetdkccoctzm.supabase.co/storage/v1/x` e **não** casa `https://fjqiyilzxxyoyposqsfz.supabase.co/x` nem `https://luakxrtecetdkccoctzmXsupabase.co/x` (pontos escapados)
- [ ] **Step 2:** correr → FAIL
- [ ] **Step 3:** `export function padraoSupabase(url: string | undefined): RegExp` em `ambiente.ts` (`^https://<host escapado>/.*`, flag `i`); `next.config.ts` usa `hostSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL)` e `padraoSupabase(...)` (import relativo `./src/lib/ambiente`)
- [ ] **Step 4:** `npm test` PASS; `npm run build` OK com `.env.local` actual
- [ ] **Step 5:** commit `fix(t2): host do Supabase nas imagens e no service worker vem do env`

### Task 3: Seed do staging (`supabase/seed-staging.sql`)

**Files:** Create `supabase/seed-staging.sql`

Formato: um ficheiro, uma transacção, idempotente (UUIDs fixos + `on conflict do nothing`), datas relativas a `current_date`.

**Guarda (primeiro bloco do ficheiro):** `do $$ begin if coalesce(current_setting('app.ambiente', true), '') <> 'staging' then raise exception 'seed-staging.sql só corre no staging (app.ambiente)'; end if; end $$;`
A marca põe-se uma vez, só no staging: `alter database postgres set app.ambiente = 'staging';` (fora do ficheiro; registado no cabeçalho do seed e no `CLAUDE.md` §7). Não entra em `verificar-schema.sql`.

**Conteúdo (mínimo realista):**
- `grupos_alunos`: "Academia" (id fixo acima, `padrao = true`, ativo)
- `modalidades`: "Jiu-Jitsu" (id fixo acima, grupo acima, `padrao = true`, `valor = 62`, `valor_infantil = 55`)
- `turmas`: 3 (Adultos seg/qua 19:00, Kids ter/qui 18:00, Open Mat sáb 10:00), `modalidade_id` padrão; aulas por `select gerar_aulas(<id>, 8)` para cada turma
- `profiles` (todos `sem_login = true`, nomes claramente fictícios, sem IBAN/NIF reais): 8 adultos com faixas variadas (branca→preta), 3 kids (faixas infantis, `categoria = infantil`), 1 responsável (`perfil = responsavel`, sem faixa) + linha em `dependentes` para 1 kid
- `aluno_modalidades`: cada aluno na modalidade padrão
- `mensalidades`: 3 meses por aluno (pago / pendente / 1 aluno com atraso ≥10 dias para exercitar o bloqueio, 1 com 3 dias)
- `presencas`: ~3 meses, 1–3 por semana por aluno (gera ranking, sequências e "aptos a graduar" plausíveis)
- `historico_graduacoes`: 2 registos
- `avisos`: 1 publicado e fixado
- `albuns`: 1 sem fotos (o bucket `galeria` do staging fica vazio)
- Não semeia `auth.users`: os utilizadores com login são os do `global-setup` (E2E) e os que o dono criar

- [ ] **Step 1:** `alter database postgres set app.ambiente = 'staging'` no staging (MCP `execute_sql`, `project_id = luakxrtecetdkccoctzm`); confirmar em nova sessão `select current_setting('app.ambiente', true)` = `staging`
- [ ] **Step 2 (guarda, read-only):** correr **só o bloco de guarda** em produção → erro `seed-staging.sql só corre no staging`; nada mais é enviado à produção
- [ ] **Step 3:** escrever o seed; correr no staging via MCP; correr segunda vez → sem erros e contagens iguais (idempotente)
- [ ] **Step 4:** contagens esperadas no staging: `profiles` 12, `turmas` 3, `aulas` ≥ 30, `mensalidades` 33, `presencas` > 100, `avisos` 1, `albuns` 1
- [ ] **Step 5:** `verificar-schema.sql` no staging = referência de produção do spec do T1 (11/11); `get_advisors` security no staging sem avisos novos
- [ ] **Step 6:** alinhar o histórico de migrations do staging (só staging, metadados): trocar a linha `20261112180318 baseline_producao_revokes` por `20261112180000 baseline_producao` (os REVOKE já estão na baseline); `list_migrations` no staging = só a baseline
- [ ] **Step 7:** commit `feat(t2): seed de dados fictícios do staging`

### Task 4: Auth do staging, `.env.local` e Preview da Vercel (o dono, guiado)

Sem código. Eu preparo os valores não secretos e a checklist; o dono executa no Dashboard (~20 min).

- [ ] **Step 1 (eu):** `get_publishable_keys` do staging → URL e publishable key (públicas) para a checklist
- [ ] **Step 2 (dono) — Supabase staging › Authentication:**
  - URL Configuration: Site URL `http://localhost:3000`; Redirect URLs `http://localhost:3000/**` e `https://gracie-barra-app-*-<slug da equipa>.vercel.app/**` (slug confirmado por mim com `list_deployments` antes)
  - Email Templates: copiar da produção "Confirm signup" (código OTP) e "Reset Password" (`{{ .SiteURL }}/nova-senha?token_hash={{ .TokenHash }}&type=recovery`)
  - Providers › Email: confirmação de email ligada; password mínimo 8 com minúsculas, maiúsculas e dígitos (igual a produção)
  - SMTP: fica o do Supabase (só envia para membros da organização; o E2E não depende de email)
- [ ] **Step 3 (dono) — `.env.local`:** guardar o actual como `.env.producao.bak` **fora do repo** (ex.: pasta pessoal/gestor de passwords); trocar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` pelas do staging; **apagar** `GMAIL_USER`/`GMAIL_APP_PASSWORD`; manter Sentry, VAPID, CRON e `PLAYWRIGHT_*`
- [ ] **Step 4 (dono) — Vercel › Settings › Environment Variables, alvo só "Preview":** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` do staging. Confirmar que as variáveis de Production ficam intactas e que nenhuma variável de produção do Supabase está marcada também para Preview. Sem `GMAIL_*`, `VAPID_PRIVATE_KEY`, `CRON_SECRET` em Preview. `NEXT_PUBLIC_SENTRY_DSN`/`SENTRY_AUTH_TOKEN` em Preview se ainda não estiverem (erros do preview com `environment=preview`)
- [ ] **Step 5 (eu):** `npm run dev` → `/login` com o admin de teste (depois da Task 5 o criar) mostra os 12 alunos fictícios em `/admin/alunos`; nenhum aluno real

### Task 5: E2E contra o staging + preview

**Files:** nenhum novo; ajustes só se um spec depender de dados de produção.

- [ ] **Step 1 (guarda):** `NEXT_PUBLIC_SUPABASE_URL=https://fjqiyilzxxyoyposqsfz.supabase.co npx playwright test` → falha no `global-setup` com a mensagem da Task 1; confirmar em produção (read-only) que não apareceu utilizador/perfil novo (`auth.users` e `profiles` com contagem igual à de antes)
- [ ] **Step 2:** `npm run dev` + `npm run test:e2e` contra o staging. Registar o resultado como nova referência (hoje 7/9 em produção; as 2 falhas de `financeiro.spec.ts` podem mudar). Falha que dependa de dados de produção → corrigir o spec ou o seed; falha antiga → não esconder, registar
- [ ] **Step 3:** correr o E2E segunda vez (idempotência do `global-setup` e limpezas no staging)
- [ ] **Step 4:** push do ramo + PR → preview da Vercel: `/login` 200, login com o admin de teste, `/admin/alunos` lista os fictícios, `/perfil` do aluno abre, sem erros no `get_runtime_logs` do deployment

### Task 6: Docs, revisão e PR

**Files:** `CLAUDE.md`, `docs/CHANGELOG.md`, `docs/roadmap-saas.md`, `docs/superpowers/plans/2026-11-12-roadmap-saas-mestre.md`, spec + plano do T2 em `docs/superpowers/`, `src/lib/push-ativo.ts` (comentário)

- [ ] **Step 1:** `CLAUDE.md`: §2 (previews já não dão 500; E2E corre no staging; tirar "a BD dos testes é a de produção"), §4 (`.env.local` = staging; produção só na Vercel; Preview com staging; sem `GMAIL_*` local), §7 (staging com seed, `app.ambiente`, como re-semear), §11 (regra de backup: tirar "até ao T2"), §12 (linhas de push e previews), §13 (testes: nova referência), §14/§15 (T2 feito); comentário de `push-ativo.ts` ("dev e e2e usam o staging; as chaves VAPID continuam partilhadas")
- [ ] **Step 2:** `docs/CHANGELOG.md` (entrada 2026-11-xx), coluna Estado do T2 em `roadmap-saas.md`, checkboxes do T2 no plano mestre; memória `project_roadmap_saas`
- [ ] **Step 3:** `npm test`, `npm run lint` (0 erros), `npm run build`
- [ ] **Step 4:** `code-review` + `security-review` (env/segredos: nenhuma chave no diff; seed sem dados reais)
- [ ] **Step 5:** PR para `master` em `renannsanches/gracie-barra-app` (`superpowers:finishing-a-development-branch`), ramo `feat/t2-ambiente-teste` a partir de `producao/master` em worktree

## Verificação final (pronto quando)
1. `npm test` verde, com `ambiente.test.ts`.
2. E2E com URL de produção → recusado no `global-setup`; contagens de produção iguais antes/depois.
3. `npm run test:e2e` contra o staging com resultado registado como nova referência.
4. Preview da Vercel do PR abre, faz login e mostra dados fictícios.
5. `verificar-schema.sql`: staging = produção 11/11 depois do seed.

## Follow-ups (fora do T2)
- Limpar em produção os utilizadores de teste e restos de E2E (com backup, regra do dono).
- CI a correr o E2E contra o staging (GitHub Actions) — Fase 3.
- "Leaked password protection" (advisor do T1) — avaliar no 1.6.

## Tempo
~3 h minhas. Do dono: ~20 min (Task 4, passos 2–4).

## Execução
Recomendo **Native** (`superpowers:executing-plans`): 6 tarefas pequenas e sequenciais, a Task 4 depende do dono e o código novo é pouco (1 helper + 1 SQL); um revisor fresco no fim sobre o ramo todo.

## Notas da execução (2026-11-13)

- **Marca do staging:** o Supabase recusa `ALTER DATABASE`/`ALTER ROLE … SET app.ambiente` (42501). Ficou o segredo `ambiente = staging` no Vault; a guarda do seed lê `vault.decrypted_secrets`. Em produção, o bloco de guarda aborta (P0001), testado.
- **Seed:** 13 perfis (o plano dizia 12: avisos, álbuns e graduações exigem `autor_id`, daí o "Prof. Rui Fictício"); 24 aulas (3 turmas × 8 semanas pelo `gerar_aulas`); presenças incluem a semana actual. Corrido 2× sem duplicar. Schema do staging 11/11 = produção depois do seed.
- **Histórico de migrations do staging:** a linha `baseline_producao_revokes` foi trocada por `20261112180000 baseline_producao`.
- **Templates de email:** o passo de copiar templates saltou-se (o plano grátis não os edita sem SMTP próprio).
- **Dev server num worktree:** `npm --prefix <worktree> run dev` (configuração `dev-t2` no `.claude/launch.json` da pasta principal). O `dev` normal corre o código da pasta principal.
- **E2E no staging:** 19/21 em duas corridas; as 2 falhas são as antigas de `financeiro.spec.ts`. A guarda recusou o URL de produção; produção 140 utilizadores / 233 perfis antes e depois.
- **Bug encontrado:** `cadastro.spec.ts` apagava o utilizador e deixava o perfil (sem FK para `auth.users`). Corrigido. Os 13 "perfis com login sem conta" da produção eram restos deste spec (ficam para limpar com backup).
