# T1 — Plano de execução

> Spec: [`../specs/2026-11-12-t1-baseline-migrations-design.md`](../specs/2026-11-12-t1-baseline-migrations-design.md). Ramo `feat/t1-baseline-migrations` (empilhado sobre `docs/roadmap-saas`, PR #79).

**Goal:** `supabase/migrations/` passa a ter uma só migration (baseline) que, aplicada a um projecto Supabase vazio, dá o mesmo schema que produção; o histórico de produção passa a listar só essa baseline.

**Regra:** nada se apaga em produção sem backup verificado e confirmação do dono no momento.

## Passos

- [x] **1. Worktree** em `.claude/worktrees/t1-baseline-migrations`; `npm ci`; `npm test` = 112/112.
- [x] **2. `supabase/verificar-schema.sql`** — impressão digital por tipo de objecto. Referência de produção registada no spec.
- [x] **3. Cliente PostgreSQL 17** — zip EDB 17.8 em `C:\Users\Administrator\tools\pgsql`; `pg_dump --version` = 17.x.
- [x] **4. Dump** — o dono corre `pg_dump … --schema-only --schema=public --no-owner -f supabase/dump-public.sql` (password pedida pelo próprio `pg_dump`). `dump-public.sql` vai para `.gitignore`.
- [x] **5. Baseline** — `supabase/migrations/<versão>_baseline_producao.sql`: extensões → dump limpo de `SET`/`set_config` → trigger em `auth.users` → buckets `avatars`, `galeria`, `Contrato`, `feed` → 6 policies de `storage.objects`. As 61 migrations antigas → `supabase/migrations_arquivo/` (`git mv`).
- [x] **6. Staging** — `list_projects` (vaga no plano grátis); `get_cost` + `confirm_cost`; `create_project` na região de produção; `apply_migration` da baseline.
- [x] **7. Comparar** — `verificar-schema.sql` no staging = referência de produção em todas as 11 linhas. Se diferir: detalhe do tipo nos dois, corrigir a baseline, recriar o staging (ou aplicar o delta) e repetir. `get_advisors` security igual nos dois.
- [x] **8. Histórico de produção** (confirmar com o dono antes) — tabela `supabase_migrations.schema_migrations_backup_20261112` + JSON em `supabase/migrations_arquivo/`; conferir 61 = 61 = 61; `delete`; `insert` da baseline com a versão do momento; renomear o ficheiro para bater; `list_migrations` = 1.
- [x] **9. Verificar** — `npm test`, `npm run build`, `npm run lint`; smoke em produção (login, `/presenca`).
- [x] **10. Rever** — `code-review` + `security-review` sobre a baseline (RLS e grants).
- [x] **11. Docs** — `CLAUDE.md` §7, §11, §12, §13, §14; `docs/roadmap-saas.md` (T1 = feito); plano mestre (checkbox T1); `docs/CHANGELOG.md`; memória `project_roadmap_saas`.
- [ ] **12. PR** para `master` em `renannsanches/gracie-barra-app`.

## Notas da execução (2026-11-12)

- O `pg_dump` correu no terminal do dono; a baseline foi aplicada no staging (`gracie-barra-staging`, `luakxrtecetdkccoctzm`, eu-west-2, 0 $/mês) com `psql --single-transaction`, não por MCP: 78 KB de SQL copiados à mão arriscavam erros.
- A 1.ª comparação deu 9/11. As 2 diferenças:
  1. **Grants (segurança):** o `pg_dump` só escreve `GRANT`; os privilégios por defeito do Supabase dão tudo a `anon`/`authenticated` em objectos novos, por isso o staging ficou **mais permissivo** do que a produção em 9 funções e 4 tabelas. Corrigido com a secção 4 (`REVOKE`) da baseline.
  2. **Fins de linha:** `gerar_qr_token` e `registrar_presenca_por_token` têm CRLF em produção (coladas no Dashboard a partir do Windows). Mesmo código; `verificar-schema.sql` passou a ignorar `\r` e a ordenar as ACL.
- 2.ª comparação: **11/11 iguais**. Advisors de segurança iguais (a única diferença é Auth: "Leaked Password Protection" desligado em produção — fica para o T2).
- O staging tem a baseline aplicada fora do histórico de migrations (psql) mais a migration `baseline_producao_revokes` (MCP). Alinhar esse histórico no T2.
- Defaults com UUIDs de produção (`modalidades.grupo_id`, `turmas.modalidade_id`) apontam para linhas que não existem num projecto vazio: o seed do T2 tem de as criar com esses ids.
- Histórico de produção (passo 8): backup 61 = original 61 = JSON 61, md5 `c7a7f3170bd0208095d6efbf458bf2bf` conferido dentro da mesma transacção do `delete`; `list_migrations` = só `20261112180000 baseline_producao`. Produção depois: 29 tabelas, 82 policies, presenças a entrar normalmente; `/login` 200.
- Verificação (passo 9): `npm test` 112/112, `npm run lint` 0 erros (35 avisos antigos), `npm run build` OK.
- Revisão (passo 10): sem segredos no diff; `dump-public.sql` fora do git; RLS e grants provados iguais pela impressão digital. Achados antigos, fora do T1: `is_admin`/`is_staff`/`is_tablet` executáveis por `anon` (advisor 0028) — rever no 1.1.
