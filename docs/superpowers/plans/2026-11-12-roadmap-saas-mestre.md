# Roadmap SaaS — plano mestre de execução

> **Estado: em curso.** Fase 0 concluída (confirmado pelo dono em 2026-11-12). T1 feito (2026-11-12). Próximo passo: T2.
>
> Este é o plano **mestre**: diz a ordem, como cada item se divide em PRs e que skills usar. Não é um plano de implementação passo a passo. Cada item, ao começar, ganha o seu próprio spec (`docs/superpowers/specs/`) e plano (`docs/superpowers/plans/`) pelo ciclo da secção A.

**Goal:** Pôr o app em condições de ser vendido a outras academias: as 7 mudanças bloqueadoras (Fase 1), a paridade com a concorrência (Fase 2) e a operação (Fase 3) de [`docs/roadmap-saas.md`](../../roadmap-saas.md).

**Ponto de partida:** o app é de uma academia só. `academias` e `academia_id` existem na BD mas nada no código os usa (`CLAUDE.md` §13, "Multi-tenancy fantasma"); há ~50 sítios com o nome da academia escrito à mão e regras de negócio em constantes (`CLAUDE.md` §16); as migrations do repo não reproduzem a BD (`CLAUDE.md` §7, "Drift"); E2E correm contra a BD de produção.

**Tech Stack:** Next.js 16 (App Router) + Supabase (Postgres, Auth, RLS, Storage) + Vercel; vitest + Playwright.

---

## A. Ciclo padrão por item

Todo o item técnico passa por estas skills, nesta ordem:

1. `superpowers:brainstorming` → decisões e spec em `docs/superpowers/specs/AAAA-MM-DD-<item>.md`
2. `superpowers:writing-plans` → plano em `docs/superpowers/plans/AAAA-MM-DD-<item>.md`
3. `superpowers:using-git-worktrees` → ramo `feat/<item>` a partir de `producao/master`
4. `superpowers:test-driven-development` + `superpowers:subagent-driven-development` (ou `superpowers:executing-plans`)
5. `code-review` ou `superpowers:requesting-code-review`; `security-review` em todo o item que toque dados de alunos, RLS ou pagamentos
6. `superpowers:verification-before-completion`: `npm test`, `npm run build`, `npm run lint`, `npm run test:e2e` (7/9 é a referência enquanto as 2 falhas de `financeiro.spec.ts` existirem)
7. `superpowers:finishing-a-development-branch` → PR para `master` em `renannsanches/gracie-barra-app`; actualizar `CLAUDE.md`, `docs/CHANGELOG.md` e a coluna **Estado** de `docs/roadmap-saas.md`

Itens que são só decisão (1.7, partes legais do 1.6) saltam 3–7: o resultado é um documento em `docs/` e uma linha no `CLAUDE.md`.

## B. Passo T — pré-requisitos técnicos (antes do 1.1)

Não estavam no roadmap original. O 1.1 reescreve a RLS e o acesso a dados de todas as tabelas; sem estes dois passos isso teria de ser testado em produção.

### T1 — Reconciliar migrations com produção
- [x] Ler o schema real (Supabase MCP: `list_tables`, `list_migrations`; SQL `pg_get_functiondef` para os RPCs) e gerar uma migration baseline que reproduza a BD de produção: `gerar_qr_token(uuid[])`, `qr_tokens` multi-aluno, `registrar_presenca_por_token` jsonb, `profiles.sem_login`, buckets `galeria` e `Contrato`.
- [x] Marcar as migrations antigas como substituídas: movidas para `supabase/migrations_arquivo/`; o histórico de produção foi substituído pela baseline com backup em `supabase_migrations.schema_migrations_backup_20261112` (regra do dono: nada se apaga sem backup).
- **Pronto quando:** um branch Supabase criado do repo tem o mesmo schema que produção (comparar `list_tables` e as definições dos RPCs).
- **Skills:** `database-design:postgresql-table-design`, `database-design:sql-pro` (agente), MCP Supabase.

### T2 — Ambiente de teste separado
- [ ] Supabase branch (ou projecto de staging) a partir da baseline do T1, com seed de dados fictícios.
- [ ] Variáveis do ambiente Preview da Vercel a apontar para staging (hoje os previews dão 500 por falta delas).
- [ ] `e2e/global-setup.ts` e `.env.local` de testes a apontar para staging; o `ocultar_ranking` dos utilizadores de teste deixa de ser necessário.
- **Pronto quando:** `npm run test:e2e` corre sem tocar na BD de produção e um preview da Vercel abre.
- **Skills:** MCP Supabase (`create_branch`, `get_advisors`), MCP Vercel (`create_project_env`), `setup-deploy`, `engineering:testing-strategy`.

## C. Fase 1 — bloqueadores

Ordem: **1.1 → 1.3 → 1.2 → 1.6 → 1.4 → 1.5**. **1.7** corre em paralelo e cedo: o nome comercial define domínio, subdomínios e os textos que o 1.3 tira do código.

### 1.1 Multi-academia (G)
PRs:
- [ ] **a)** `academia_id NOT NULL`, default = Famalicão, backfill e índice em todas as tabelas — incluindo as que ainda não têm a coluna (financeiro avulso, feed, push, modalidades, grupos, conquistas, notificações, agendamentos…).
- [ ] **b)** Tabela `academia_membros(user_id, academia_id, papel)` (papel por academia) + tenant no JWT (`app_metadata` via custom access token hook).
- [ ] **c)** RLS reescrita: helpers `academia_atual()` e `is_staff_of(academia)` no lugar de `is_staff()`/`is_admin()`.
- [ ] **d)** Código: helper de tenant no servidor; todo o `createAdminClient()` filtra por `academia_id` (ignora RLS, portanto o filtro tem de ser explícito); RPCs (`registrar_presenca_por_token`, `gerar_qr_token`, `ranking_presencas`, `dias_treino_alunos`, `semanas_com_treino`…), crons de `/api/push/send` (correm por academia), Storage com prefixo `academia_id/`, `/api/admin/delete-user`, páginas públicas (`/aula-experimental`, `/cadastro`).
- [ ] **e)** Fluxo "criar academia" (super-admin).
- [ ] **f)** Teste automático de isolamento: duas academias no staging, cada perfil de uma não lê nem escreve dados da outra (SQL + Playwright).
- **Pronto quando:** como no roadmap — duas academias no mesmo ambiente sem ver dados uma da outra, com teste automatizado.
- **Skills:** `database-design:database-design-database-architect` (agente), `database-design:postgresql-table-design`, `backend-api-security:backend-api-security-backend-security-coder` (agente), `security-review`, `cso`, `full-stack-orchestration:full-stack-orchestration-test-automator` (agente), `playwright-cli`.

### 1.3 Configuração no lugar de valores fixos (M)
Inventário completo dos valores em `CLAUDE.md` §16.
- [ ] **a)** Tabela `academia_config` (1 linha por academia) + loader no servidor com cache.
- [ ] **b)** Marca: nome, logo, cores, WhatsApp, email de remetente, moeda, fuso, idioma.
- [ ] **c)** Regras: dia de vencimento (5), bloqueio por atraso (10 dias — hoje copiado em 5 ficheiros: juntar num só helper), avisos (2 e 5 dias), intervalos de presença (30 min QR, 1 h tablet), margem de aula (±2 h), sequência mínima (2 aulas), preços de fallback (62/55).
- [ ] **d)** Faixas: tabela `graduacoes_config` (ordem, tempo por faixa e grau, idades) no lugar das constantes de `src/lib/graduacao-rules.ts`; `CorFaixa` deixa de ser a única fonte.
- [ ] **e)** Página admin "Configurações".
- [ ] **f)** Guarda em vitest (como `tema-cores.test.ts`): falha se aparecer o nome da academia ou `351922296501` em `src/`.
- **Skills:** `superpowers:test-driven-development`, `ui-design:design-system-patterns`, `frontend-design:frontend-design`, `design:ux-copy`.

### 1.2 Cobrança automática (G)
- [ ] **a)** Stripe Connect na conta do dono da academia (cartão, débito directo SEPA, Apple/Google Pay).
- [ ] **b)** Webhooks idempotentes; pagamento confirmado dá baixa automática na mensalidade (`mensalidades.status = pago`).
- [ ] **c)** Falha de pagamento: nova tentativa automática + aviso ao aluno (push hoje; email/WhatsApp no 2.3).
- [ ] **d)** Reembolso pelo admin.
- [ ] **e)** Brasil: Pix e boleto via Asaas.
- [ ] **f)** Pagamento manual (dinheiro, transferência) continua a funcionar como hoje.
- **Skills:** `payment-processing:stripe-integration`, `payment-processing:billing-automation`, `payment-processing:pci-compliance`, `payment-processing:payment-integration` (agente), `security-review`.

### 1.6 Privacidade e menores (G)
- [ ] **a)** Consentimento dos pais registado (cadastro, foto, feed), com data e versão do texto.
- [ ] **b)** Foto de menor no feed só com autorização (bloqueio no `PostComposer` e nos posts automáticos).
- [ ] **c)** Exportar e apagar os dados de um aluno (incluindo Storage).
- [ ] **d)** Política de privacidade, termos, contrato de tratamento de dados por academia, lista de subprocessadores, hospedagem na UE.
- [ ] **e)** Barreira de idade para menores de 13 anos (EUA).
- **Pronto quando:** consentimento e exclusão a funcionar; textos revistos por advogado.
- **Skills:** `legal:compliance-check`, `legal:legal-risk-assessment`, `legal:review-contract`, `anthropic-skills:docx` (textos para o advogado), `security-review`.

### 1.4 Entrada e migração (M)
- [ ] **a)** Assistente de configuração: academia, modalidades, turmas, preços.
- [ ] **b)** Importar alunos, faixas e presenças por CSV, com pré-visualização e erros por linha (modelos de CSV descarregáveis).
- [ ] **c)** Exportar tudo.
- **Pronto quando:** academia nova opera em até 1 hora sem ajuda.
- **Skills:** `marketing-skills:onboarding`, `ui-design:interaction-design`, `design:ux-copy`, `anthropic-skills:xlsx`.

### 1.5 Cobrança do SaaS (M)
- [ ] **a)** Planos por número de alunos activos, teste de 30 dias, assinatura (Stripe Billing).
- [ ] **b)** Suspensão por falta de pagamento.
- [ ] **c)** Painel super-admin: academias, receita recorrente, quem está em teste, quem atrasou, uso.
- **Skills:** `payment-processing:stripe-integration`, `marketing-skills:pricing`, `startup-business-analyst:startup-metrics-framework`, `business-analytics:kpi-dashboard-design`.

### 1.7 Fiscal e marca (P) — decisões
- [ ] Portugal: exportar para software certificado pela AT (o app não emite fatura).
- [ ] Brasil: nota fiscal fora da v1, ou não.
- [ ] Nome comercial sem "Gracie Barra".
- **Resultado:** `docs/decisoes-fiscal-marca.md` + linha no `CLAUDE.md` §1.
- **Skills:** `anthropic-skills:contabilidade`, `legal:brief`, `legal:legal-risk-assessment`, `brand-voice:guideline-generation`.

### Fecho da Fase 1 — piloto com 3 academias
- **Skills:** `operations:runbook` (entrada de cada piloto), `customer-support:kb-article`.

## D. Fase 2 — paridade (por pedido dos pilotos)

Cada item segue o ciclo A.

| Item | Skills de domínio |
|---|---|
| 2.1 Idiomas en/es/pt-BR, moeda e data por região, textos fora do código | `frontend-mobile-development:nextjs-app-router-patterns`, `design:ux-copy` |
| 2.2 Videoteca e currículo por faixa (Bunny Stream) | `frontend-mobile-development:nextjs-app-router-patterns`, `ui-design:web-component-design` |
| 2.3 Lembrete de cobrança por e-mail e WhatsApp | `marketing-skills:emails`, `payment-processing:billing-automation` |
| 2.4 Funil de aula experimental (pedido → contacto → matrícula) | `marketing-skills:cro`, `small-business:speed-to-lead`, `marketing-skills:signup` |
| 2.5 Alerta automático de risco de evasão | `marketing-skills:churn-prevention`, `data:statistical-analysis` |
| 2.6 Termo e contrato com assinatura digital | `legal:signature-request`, `anthropic-skills:pdf` |
| 2.7 Relatórios de negócio (receita recorrente, cancelamentos, inadimplência) | `business-analytics:kpi-dashboard-design`, `startup-business-analyst:startup-metrics-framework`, `dataviz` |
| 2.8 Totem configurável em qualquer tablet ou TV | `ui-design:responsive-design`, `ui-design:accessibility-compliance` |

## E. Fase 3 — operação

| Item | Skills / ferramentas |
|---|---|
| Ambiente de teste + testes dos fluxos críticos (QR, cobrança, isolamento) | ambiente no T2; testes com `engineering:testing-strategy`, `full-stack-orchestration:full-stack-orchestration-test-automator` (agente) |
| Monitorização de erros com alerta; backup restaurado em teste | MCP Sentry (`create_alert_rule`), `engineering:incident-response`, `operations:runbook` |
| E-mail transacional com SPF e DKIM (sair do app password do Gmail) | `engineering:deploy-checklist` |
| Limite de fotos e custo por academia | `application-performance:performance-optimization` |
| Ambiente de demonstração com dados fictícios | seed do T2 + `superpowers:test-driven-development` |
| Central de ajuda, suporte, termos com regras de disponibilidade | `customer-support:kb-article`, `operations:process-doc` |
| Páginas de venda e preços (PT, BR, EN) | `marketing-skills:copywriting`, `marketing-skills:pricing`, `anthropic-skills:landing-page`, `seo-audit` |

## F. Decisões em aberto

Resolver no `superpowers:brainstorming` do item:

| Decisão | Item | Opções |
|---|---|---|
| Como se resolve a academia de um pedido | 1.1 | Subdomínio (`<academia>.<dominio>`) vs academia do utilizador autenticado (subdomínio só para páginas públicas) |
| Papel global vs por academia | 1.1 | Manter `profiles.perfil` e acrescentar `academia_membros`, ou migrar tudo para `academia_membros.papel` |
| Tipo de conta Stripe Connect | 1.2 | Standard vs Express |
| Nome comercial e domínio | 1.7 | — |
