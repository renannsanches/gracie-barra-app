# T2 — Ambiente de teste separado (spec)

> Desenho aprovado pelo dono em 2026-11-12. Plano e notas de execução: [`../plans/2026-11-13-t2-ambiente-teste.md`](../plans/2026-11-13-t2-ambiente-teste.md). Item T2 de [`docs/roadmap-saas.md`](../../roadmap-saas.md).

## Context

Até ao T2, `.env.local` apontava para a produção: `npm run dev` e `npm run test:e2e` escreviam em dados reais (`financeiro.spec.ts` fazia upsert/delete em `mensalidades`, `feed.spec.ts` criava e apagava posts, graduações e ficheiros, `global-setup.ts` criava utilizadores). Os previews da Vercel davam 500 porque o ambiente Preview não tinha as variáveis do Supabase. O 1.1 (RLS por academia em todas as tabelas) precisa de um sítio para ser testado que não seja a produção.

**Pronto quando:** o E2E corre contra o staging sem tocar na produção; com o URL de produção, o E2E falha antes de qualquer escrita; um preview da Vercel abre com dados fictícios; o staging continua 11/11 igual à produção em schema.

## Decisões

| Decisão | Escolha |
|---|---|
| Branch Supabase vs projecto | Projecto `gracie-barra-staging` do T1 (branching é pago; o staging grátis já estava provado igual) |
| Dev local | Dev **e** E2E no staging; as chaves de produção ficam só na Vercel |
| Seed | Mínimo realista: 13 pessoas fictícias, 3 turmas, 3 meses de mensalidades, 13 semanas de presenças, 1 aviso, 1 álbum |
| Marca do staging (guarda do seed) | Segredo `ambiente = staging` no Vault. `ALTER DATABASE/ROLE … SET app.ambiente` é recusado pelo Supabase (42501) |
| Guarda do E2E | `exigirForaDeProducao(NEXT_PUBLIC_SUPABASE_URL)` no início de `e2e/global-setup.ts` |
| Host do Supabase em `next.config.ts` | Vem do env (`hostSupabase`, `padraoSupabase` em `src/lib/ambiente.ts`) |
| `ocultar_ranking` dos utilizadores de teste | Fica: `gamificacao.spec.ts` testa o estado "oculto" |
| Templates de email do staging | Os de série: o plano grátis só os edita com SMTP próprio. E2E e previews não usam email |
| Segredos | O dono pôs as chaves do staging no `.env.local` e na Vercel; o agente nunca as viu |

## Fora do T2 (follow-ups)
- Limpar em produção os utilizadores de teste e os 13 perfis órfãos `e2e-cadastro-…` (com backup e confirmação, regra do dono).
- CI a correr o E2E contra o staging (Fase 3).
- SMTP próprio com SPF/DKIM (Fase 3), que também desbloqueia os templates do staging.
