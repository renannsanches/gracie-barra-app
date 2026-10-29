# CLAUDE.md

> Este ficheiro serve dois públicos: **programadores** que vão trabalhar no código, e **estrategistas de produto/negócio** com literacia tecnológica que precisam entender o que está construído, o que falta, e para onde vai.
>
> **Estado verificado em 2026-10-29 contra `master` de produção `2849e91` (PR #70).** O histórico completo, PR a PR, está em [`docs/CHANGELOG.md`](docs/CHANGELOG.md). Este ficheiro descreve o estado **actual**; o CHANGELOG descreve **como lá chegámos**. Quem fechar um PR deve actualizar os dois.

---

## 1. O que é este produto

**Gracie Barra Famalicão App** é um sistema de gestão de academia de Jiu-Jitsu, construído como Progressive Web App (PWA) instalável em qualquer dispositivo. Resolve três problemas centrais de uma academia de artes marciais:

1. **Controlo de presença** — substituir a folha de papel por QR Code no telemóvel do aluno + tablet fixo na recepção
2. **Gestão administrativa** — CRUD de alunos, turmas, aulas, mensalidades, graduações e galeria num painel web
3. **Comunicação** — avisos, galeria de fotos e histórico de progresso visível pelo aluno

### Quem usa e como

| Persona | Onde acede | O que faz |
|---------|------------|-----------|
| **Aluno** | `/perfil`, `/presenca`, `/aulas`, `/avisos`, `/galeria` | Gera QR para registar presença, reserva aulas, vê histórico, fotos e avisos |
| **Responsável (pai/mãe)** | `/perfil`, `/presenca` | Gera QR para si e para os filhos dependentes num único scan |
| **Tablet da academia** | `/tablet` | Câmera aberta permanentemente a ler QR Codes; confirma presença com foto e faixa do aluno |
| **Admin / Professor** | `/admin/*` | Gere alunos, turmas, mensalidades, graduações, avisos e galeria |

### Contexto de negócio
- Academia: **Gracie Barra Vila Nova de Famalicão**, Portugal
- Mensalidades: 62 €/mês (adultos), 55 €/mês (menores de 16 anos)
- Moeda: Euro (€) · Prefixo telefónico: +351 · Locale: pt-PT
- Contrato de prestação de serviços enviado por email automaticamente no cadastro

---

## 2. Comandos

### Repositório e deploy

| Repositório | Ramo | Papel |
|-------------|------|-------|
| **`renannsanches/gracie-barra-app`** | `master` | **Produção** — Vercel faz deploy automático (`gracie-barra-app.vercel.app`) |
| `gb-famalicao/gb-famalicao-app` | `main` | Cópia — **não fazer push aqui** (Claude não tem acesso de escrita, dá 403) |

Fluxo: ramo novo → PR para `master` em `renannsanches/gracie-barra-app` → preview Vercel verde → merge. **Cada PR actualiza este ficheiro (se mudou algo que ele descreve) e acrescenta uma entrada a `docs/CHANGELOG.md`.**

Atenção: o `master` de produção pode estar à frente do `main` do outro repositório, e já houve deploys de produção feitos directamente de ramos não mergeados. Antes de mergear, comparar o SHA do último deploy `production` na Vercel com `master`. Os previews da Vercel dão 500 (o ambiente Preview não tem as variáveis do Supabase) — a validação final faz-se em produção, com rollback instantâneo na Vercel se preciso.

```bash
npm run dev      # servidor local em http://localhost:3000
npm run build    # `next build --webpack`: build de produção (verifica tipos TypeScript; o Next 16 já não corre lint)
npm run lint     # ESLint 9 (eslint.config.mjs) — 0 erros; avisos de código legado
npm test         # testes unitários (vitest) — lógica pura em src/**/*.test.ts

# Testes E2E (requer servidor a correr: npm run dev ou npm run start)
npm run test:e2e          # correr todos os testes E2E
npm run test:e2e:ui       # Playwright UI mode (interactivo, com browser visível)
npm run test:e2e:headed   # browser visível em modo terminal
npm run test:e2e:report   # ver relatório HTML do último run
```

### Testes E2E (Playwright)

**Pré-requisitos:**
1. `.env.local` com as variáveis `PLAYWRIGHT_*` e `SUPABASE_SERVICE_ROLE_KEY` (ver secção 4)
2. Supabase project com **password auth** habilitado (Settings → Auth → Providers → Email)
3. Servidor local a correr (`npm run dev`)

**Como funciona:**
- `e2e/global-setup.ts` cria/actualiza utilizadores de teste via Supabase Admin SDK (idempotente)
- Auth state guardado em `e2e/.auth/*.json` (gitignored — nunca commitar)
- Testes correm com sessão autenticada pré-estabelecida (sem necessidade de OTP)

**Fluxos testados:**
| Spec | Fluxo |
|------|-------|
| `cadastro.spec.ts` | Redirecionamentos de auth + fluxo de cadastro com utilizador fresh |
| `presenca.spec.ts` | Geração de QR Code + countdown + expiração |
| `financeiro.spec.ts` | Marcar mensalidade como paga + desmarcar (admin) |
| `gamificacao.spec.ts` | Pílulas do Início (/perfil), /conquistas, abas do /ranking (aluno de teste fica oculto do ranking) |
| `feed.spec.ts` | Corre como staff (projecto admin): publica, põe gosto, comenta e apaga (limpa os posts `e2e-feed-*` e os ficheiros); graduação pela ficha do aluno de teste → post "recebeu a faixa" no Início, que sai ao apagar a graduação e não aparece com `ocultar_ranking = true` (repõe faixa, graus, categoria e `ocultar_ranking` no fim) |
| `reset-senha.spec.ts` | Sem login, com tokens falsos: `/nova-senha?token_hash=…` mostra "Continuar" (e não o campo de senha), Continuar com token inválido mostra "link expirou", `/auth/callback` com `type=recovery` não verifica no GET, `/esqueci-senha?erro=link` |
| `tema.spec.ts` | Interruptor em Minha conta liga/desliga `dark`, persiste no reload, /admin fica sempre claro, segue o esquema do sistema em /perfil mas não em /admin/alunos |

A BD dos testes é a de produção: o `global-setup` põe `ocultar_ranking = true` nos utilizadores de teste para não aparecerem no ranking real.

**Troubleshooting:**
- `global-setup` falha: verificar que `.env.local` tem todos os `PLAYWRIGHT_*` vars
- Auth redireciona para `/login` mesmo com storageState: correr `DEBUG=pw:api npm run test:e2e`
- Supabase "email not confirmed": o `global-setup` já define `email_confirm: true` — verificar SERVICE_ROLE_KEY

---

## 3. Stack técnica

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js **16.2** (App Router, build `--webpack`) + React 19.2 + TypeScript 5 |
| Styling | Tailwind CSS **3.4** (`tailwind.config.ts`; `tailwindcss-animate` + `tw-animate-css`) + shadcn/ui (pacote `radix-ui` + alguns `@radix-ui/react-*`) |
| Backend / DB | Supabase (Postgres + Auth + Storage + RLS) — `@supabase/supabase-js` + `@supabase/ssr` |
| QR — gerar | `qrcode` npm package |
| QR — ler | `@zxing/browser` (carregado via `dynamic(..., { ssr: false })`) |
| Email | Nodemailer + Gmail app password |
| PWA | `@ducanh2912/next-pwa` (Workbox) + handlers de push em `worker/index.ts` |
| Push | `web-push` (VAPID) — ver `src/lib/push-sender.ts` |
| Gráficos | Sem biblioteca: `src/app/admin/PresencasChart.tsx` desenha as barras à mão (Recharts **não** está instalado) |
| Relatórios | `xlsx` (Excel/CSV) + `jspdf` + `jspdf-autotable` (PDF) |
| Feedback UI | `sonner` (toasts), `lucide-react` (ícones), `input-otp`, `react-phone-number-input` |
| Imagens | Next.js Image (`sharp` só no servidor do Next). Compressão no cliente por canvas em `src/lib/comprimir-imagem.ts`: WebP, com queda para JPEG (Safari/iPhone) |
| Deploy | Vercel (produção automática no push para `master`) |
| Fonte | SF Pro Display (woff2 local em `public/fonts/`) → `system-ui`. O Geist é carregado no `layout.tsx` mas não está na pilha de fontes do Tailwind |
| Observabilidade | Sentry (`@sentry/nextjs` 10) — erros de cliente e servidor |
| Testes | Vitest 3 (unitários, `src/**/*.test.ts`) + Playwright (`@playwright/test`) para fluxos críticos |
| Lint | ESLint 9 (flat config) + `eslint-config-next` 16 |

---

## 4. Variáveis de ambiente

```bash
# Público (seguro no cliente)
NEXT_PUBLIC_SUPABASE_URL=https://fjqiyilzxxyoyposqsfz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_3wPqhs8SFm2_dvKrH_99Jw_8Nt2tIVR

# Secretas — NUNCA expor ao cliente, nunca commitar
SUPABASE_SERVICE_ROLE_KEY=<somente em .env.local>
GMAIL_USER=graciebarrafamalicao@gmail.com
GMAIL_APP_PASSWORD=<app password do Gmail>

# Sentry — Monitorização de erros (free tier)
NEXT_PUBLIC_SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project>   # cliente (instrumentation-client.ts)
SENTRY_AUTH_TOKEN=sntrys_...   # build-time — NUNCA commitar, só em Vercel env vars
# O DSN do servidor/edge (sentry.server.config.ts, sentry.edge.config.ts) e o org/project do
# upload de source maps (next.config.ts) estão escritos nesses ficheiros — o código NÃO lê
# SENTRY_DSN, SENTRY_ORG nem SENTRY_PROJECT.

# Web Push (VAPID) — sem estas, o push não sai
VAPID_PUBLIC_KEY=<chave pública>            # servidor (push-sender.ts)
VAPID_PRIVATE_KEY=<chave privada>           # servidor — NUNCA expor
VAPID_SUBJECT=mailto:<email de contacto>    # servidor
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<chave pública> # cliente (usePushSubscription.ts) — a mesma que VAPID_PUBLIC_KEY
CRON_SECRET=<secret-aleatorio>              # valida o header Authorization dos crons em /api/push/send

# Fornecidas pela plataforma / CI (não configurar à mão)
VERCEL_ENV=production|preview|development   # a Vercel define; o push só sai com "production"
CI=true                                     # Playwright e next.config.ts

# Playwright E2E — credenciais de utilizadores de teste
BASE_URL=http://localhost:3000
PLAYWRIGHT_TEST_EMAIL=test-aluno@graciebarrafamalicao.app
PLAYWRIGHT_TEST_PASSWORD=<strong-random>
PLAYWRIGHT_ADMIN_EMAIL=test-admin@graciebarrafamalicao.app
PLAYWRIGHT_ADMIN_PASSWORD=<strong-random>
```

**Sentry em Vercel:** adicionar `NEXT_PUBLIC_SENTRY_DSN` e `SENTRY_AUTH_TOKEN` no dashboard do Vercel (Settings → Environment Variables) para produção + preview. O código está todo ligado (`instrumentation-client.ts`, `src/instrumentation.ts`, `sentry.*.config.ts`, `global-error.tsx`, `withSentryConfig` em `next.config.ts`); não foi possível verificar a partir do repo se as variáveis já estão definidas na Vercel.

**Cron jobs (Vercel):** `CRON_SECRET` tem de existir nas env vars da Vercel. O `/api/push/send` valida-o no header `Authorization: Bearer …` para aceitar chamadas dos crons configurados em `vercel.json`:

| `type=` | Hora (UTC) | O que faz |
|---------|-----------|-----------|
| `mensalidade` | 09:00 | Push de mensalidade (vence amanhã/hoje/em atraso) |
| `graduacao` | 09:00 | Push de aluno apto a graduar |
| `responsavel_aula` | 08:00 | Push a responsáveis sobre aulas dos dependentes |
| `conquistas` | 09:00 | Grava medalhas novas e notifica (`?dry=1` só conta) |
| `feed_podio` | 09:00 | Publica o pódio do mês anterior no feed (`?dry=1` só calcula e só com ele se aceita `&hoje=YYYY-MM-DD`; fora de produção corre sempre como dry, para não inserir o post real nem gastar o push do mês) |

As horas da Vercel são **UTC**: 09:00 UTC = 10:00 em Lisboa no verão (09:00 no inverno). A rota aceita ainda `type=aviso`, sem cron — é disparado a partir de `src/app/admin/avisos/avisos-actions.ts` ao publicar um aviso. `sendPushNovoPost` e `sendPushComentario` (feed) também não têm cron: saem das server actions em `src/app/(app)/perfil/feed/`.

---

## 5. Mapa de rotas

```
/                       → redireciona para /perfil ou /login
/login                  → autenticação (email + password, via route handler /api/auth/login)
/cadastro               → onboarding multi-step (3 tipos de perfil; email + password + código OTP de confirmação)
/esqueci-senha          → pedido de reset de password
/nova-senha             → nova password; com `?token_hash=&type=recovery` mostra primeiro "Continuar" (o clique gasta o token)
/aula-experimental      → PÚBLICA (sem login): agendamento de aula experimental → tabela agendamentos_experimental, depois abre WhatsApp
/perfil                 → Início: pílulas Feed · Ranking · Conquistas · Galeria (`?tab=`); staff vê no separador Feed o card recolhível de aptos a graduar e o compositor de publicações; aqui vivem os modais de medalhas novas e de aptos a graduar (o modal/banner de mensalidade em atraso vivem em `(app)/layout.tsx`)
/conta                  → Minha conta: dados, faixa, mensalidades, dependentes, Dashboard (staff), Sair
/presenca               → gera QR Code (self ou dependentes); polling até confirmação
/presencas              → histórico de presenças com calendário visual e filtro por mês
/aulas                  → vista semanal de aulas disponíveis; reservar/cancelar
/turmas                 → turmas em que o aluno está inscrito
/avisos                 → mural de avisos publicados pela academia
/galeria                → lista de álbuns de fotos
/galeria/[id]           → álbum com lightbox (prev/next, teclado, thumbnails)
/ranking                → ranking de aulas (mês e ano, Adultos/Kids); o aluno pode ocultar-se
/conquistas             → sequência semanal e medalhas (próprio e dependentes)
/offline                → página de fallback PWA sem rede

/tablet                 → scanner QR permanente (câmera aberta, frontal por defeito)
/tablet/login           → login exclusivo para conta tablet

/admin                  → dashboard: KPIs, gráfico, alunos ausentes, últimas graduações
/admin/alunos           → lista de alunos com filtros (grupo, perfil, faixa, categoria) e pesquisa; aceita ?grupo=<id>
/admin/alunos/novo      → formulário de novo aluno
/admin/alunos/[id]      → ficha completa: dados, fotos, mensalidades, presenças, graduações, dependentes
/admin/grupos           → locais de treino (Academia, Colégio…): criar, renomear, ativar/desativar; contagens vêm das modalidades
/admin/modalidades      → modalidades (Jiu-Jitsu, Capoeira…): valor sugerido adulto/menores de 16, ativar/desativar, apagar sem uso
/admin/turmas           → lista de turmas
/admin/turmas/nova      → criar turma
/admin/turmas/[id]      → editar turma + gerir aulas + ver reservas + marcar presenças
/admin/financeiro       → separador "Mensalidades": tabela com filtros (mês, status, aluno, grupo). Os outros separadores (`FinanceiroTabs.tsx`) ficam abaixo
/admin/financeiro/contas          → lançamentos avulsos (contas a pagar/receber) — tabela lancamentos_financeiros
/admin/financeiro/contas/novo     → novo lançamento
/admin/financeiro/contas/[id]     → editar lançamento
/admin/financeiro/fornecedores    → fornecedores/funcionários/outros (tabela fornecedores)
/admin/financeiro/clientes        → clientes (mesma tabela fornecedores, tipo "cliente")
/admin/financeiro/categorias      → "Plano de contas" (tabela categorias_financeiras, despesa/receita)
/admin/financeiro/formas-pagamento → formas de pagamento (tabela formas_pagamento)
/admin/avisos           → CRUD de avisos (criar, editar, fixar, publicar/arquivar)
/admin/relatorios       → exportar Excel/CSV e PDF de presenças, financeiro, lançamentos e relação de alunos (modal com colunas e alertas)
/admin/albuns           → gestão de álbuns de fotos
/admin/albuns/[id]/fotos → upload e gestão de fotos de um álbum

/auth/callback          → route handler: PKCE (`?code=`) e OTP recovery (`?token_hash=&type=recovery`) — ver 6.2
/api/auth/login         → POST: login por route handler (necessário para o Safari 15 do tablet)
/api/admin/delete-user  → POST: apagar utilizador (só staff)
/api/push/subscribe     → POST: guarda a push subscription do dispositivo
/api/push/send          → GET: crons e envio de push (valida CRON_SECRET) — ver secção 4
```

---

## 6. Arquitectura

### 6.1 Clientes Supabase — três variantes, regras rígidas

| Ficheiro | Quando usar | Contexto | RLS |
|----------|------------|----------|-----|
| `src/lib/supabase/client.ts` | Componentes `"use client"` | Browser | Respeitada |
| `src/lib/supabase/server.ts` | Server Components, Server Actions | Servidor | Respeitada |
| `src/lib/supabase/admin.ts` | Server Actions admin, API routes | Servidor | **Ignorada** |

`createAdminClient()` usa `service_role` — nunca deve aparecer em código cliente nem ser commitado.

### 6.2 Autenticação e guardas de rota

**Middleware** (`src/middleware.ts` → `src/lib/supabase/middleware.ts`):
- Paths públicos (9): `/login`, `/cadastro`, `/esqueci-senha`, `/nova-senha`, `/auth/callback`, `/tablet/login`, `/api/push/send`, `/api/auth/login`, `/aula-experimental`
- Resgate na raiz: `/?code=…` é reencaminhado para `/auth/callback?next=/nova-senha` antes da verificação de sessão (links de reset que caem em `/`)
- Não autenticado + path protegido → `/login` (ou `/tablet/login` se path começa com `/tablet`)
- Autenticado com `user_metadata.onboarding = true` → forçado para `/cadastro` até completar (isenta `/tablet*` e `/auth/callback`)
- Autenticado em `/login` ou `/cadastro` → `/perfil` (não se aplica a `/esqueci-senha` nem `/nova-senha`, nem a server actions)

**Auth callback** (`src/app/auth/callback/route.ts`): suporta dois fluxos distintos:
- `?code=...` — PKCE (login social, magic link)
- `?token_hash=...&type=recovery` — OTP recovery (reset de password via `resetPasswordForEmail`). **O GET não gasta o token**: reencaminha para `/nova-senha?token_hash=…&type=recovery`, onde o aluno carrega em "Continuar" e só então a server action `validarLinkRecuperacao` faz o `verifyOtp` (scanners de email não clicam). Falha com `next=/nova-senha` → `/esqueci-senha?erro=link`
- O `resetPasswordForEmail` usa o fluxo OTP, não PKCE — ambos têm de ser tratados no callback ou o link de reset quebra.

**Auth guard nas Server Actions** (`src/lib/auth-guard.ts`):
- `requireAdmin()` — verifica sessão + `perfil === "admin" | "professor"`; retorna `{ ok: false, erro }` se falhar
- `requireTablet()` — verifica sessão + `perfil === "tablet"`
- Todas as Server Actions admin e tablet chamam o respectivo guard como primeira instrução

**Layout admin** (`src/app/admin/layout.tsx`): verifica `perfil === "admin" | "professor"` server-side; redireciona para `/perfil` se não autorizado.

### 6.3 Padrão de página

```
page.tsx (Server Component)
  ↓ busca dados com createServerClient() ou createAdminClient()
  ↓ passa props
*View.tsx ou *Form.tsx (Client Component — "use client")
  ↓ interactividade, useTransition, estado local
*-actions.ts ("use server")
  ↓ requireAdmin() / requireTablet()
  ↓ mutation com createAdminClient()
  ↓ revalidatePath()
  ↓ return { ok: boolean; erro?: string; ...dados }
```

### 6.4 Fluxo de presença via QR Code

```
Aluno abre /presenca
  → selecciona para quem (self + dependentes)
  → cliente: supabase.rpc("gerar_qr_token", { p_aluno_ids }) (uuid[]) → { token, mensagem } válido 60s
  → QR renderizado no ecrã
  → polling tabela presencas a cada 2,5s

Tablet lê QR
  → @zxing/browser (dynamic import, ssr:false)
  → supabase.rpc("registrar_presenca_por_token", { p_token }) no cliente
    → RPC verifica: token existe? não usado? não expirado? (senão devolve sucesso=false)
    → RPC verifica: bloqueio financeiro? (verificar_bloqueio_financeiro ≥10 dias → RAISE 'mensalidade_bloqueada')
    → Marca o token como usado e insere uma presença por aluno do QR
    → Devolve jsonb { sucesso, mensagem, alunos: [{ aluno_nome, aluno_foto, aluno_faixa, aluno_graus }] }
    ⚠ A versão em produção NÃO verifica reserva nem cooldown (as migrations do repo
      dizem o contrário — estão desactualizadas). O único intervalo é o do /presenca
      (30 min, no cliente). Ver a definição real com pg_get_functiondef.
    → Retorna nome, foto, faixa e graus de cada aluno (sem campo "aula"; ver src/app/tablet/resultado-qr.ts)
  → Tablet exibe confirmação verde 5s (erro/QR inválido: 3s)

Aluno recebe confirmação via polling
  → ecrã verde com check
```

**Regra de bloqueio financeiro:** sem mensalidade = permitir; atrasado <10 dias = permitir; atrasado ≥10 dias = bloquear. Aplica-se a QR, presença manual no tablet e reservas de aulas. **Onde é aplicada:** só o RPC de produção do QR chama `verificar_bloqueio_financeiro`; a presença manual (`src/app/tablet/tablet-actions.ts`) e as reservas (`src/app/(app)/aulas/aulas-actions.ts`) repetem a regra em JS. Helpers em `src/lib/mensalidade-status.ts`.

Fluxo manual no tablet (sem QR): pesquisa aluno por nome → selecciona aula disponível (hoje ±2h) → verificação financeira em JS + cooldown de 1 h. O `aulaId` escolhido **não é gravado** — o insert só escreve `aluno_id` e `registrado_em`.

**Intervalo mínimo entre presenças (cada caminho tem o seu):**

| Caminho | Intervalo | Onde |
|---------|-----------|------|
| QR (`/presenca`) | 30 min | cliente, `INTERVALO_MIN_MS` em `PresencaView.tsx` |
| Manual no tablet | 1 h | `tablet-actions.ts` |
| RPC `registrar_presenca_por_token` (produção) | nenhum | — |

**Reservas (`/aulas`):** o componente `AulasView` busca lista de alunos bloqueados financeiramente e desabilita o botão de reserva com aviso âmbar.

### 6.5 Cadastro — fluxo multi-step e 3 tipos de perfil

O cadastro aceita 3 tipos de inscrição:
- **Aluno** — conta própria com login, perfil de aluno
- **Responsável** — conta própria com login, sem faixa, gere dependentes
- **Aluno e Responsável** — conta própria com login, tem perfil de aluno E pode ter dependentes

Steps:
1. Email + password (`supabase.auth.signUp`) + código OTP de confirmação (`verifyOtp`)
2. Tipo de perfil
3. Dados pessoais + dependentes (se aplicável) + NIF + aceitar contrato

Ao concluir cadastro (`src/app/cadastro/cadastro-actions.ts`):
- `user_metadata.onboarding` é limpo → middleware liberta o acesso
- 6 mensalidades geradas automaticamente, dia 5 (fim-de-semana passa para segunda: sábado → 7, domingo → 6). A primeira é a do mês corrente se o registo for nos dias 1–10, senão a do mês seguinte. Os dependentes recebem as suas 6; um responsável puro não recebe nenhuma
- O valor vem da modalidade padrão (Jiu-Jitsu Academia) e cria-se a linha em `aluno_modalidades`; 62 €/55 € são só o fallback quando não há modalidade padrão
- Email com PDF do contrato: é aguardado (`await`) mas nunca lança erro — `send-contract-email.ts` apanha as suas próprias falhas, portanto não bloqueia o registo
- Trigger Supabase cria row em `profiles` automaticamente no signup

---

## 7. Base de dados

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Perfil de cada utilizador (aluno, professor, admin, tablet, responsavel) |
| `presencas` | Registo de presença (`aluno_id`, `registrado_em`; **sem `aula_id`**). Pode haver 2 no mesmo dia (o índice único por dia foi removido). Intervalos mínimos: ver 6.4 |
| `qr_tokens` | Tokens temporários de 60s para validar presença. Em produção um token cobre vários alunos (`uuid[]`); o schema do repo ainda tem um só `aluno_id` (ver "Drift" abaixo) |
| `mensalidades` | Mensalidades por aluno (mês referência, vencimento, valor, status, `itens` jsonb com a composição) |
| `turmas` | Definição de turmas (dia, hora, recorrência, lotação, categoria, professor, `modalidade_id`, `apenas_experimental`) |
| `aulas` | Instâncias específicas de aulas geradas a partir de turmas |
| `reservas` | Reservas de alunos para aulas específicas |
| `historico_graduacoes` | Registo de cada promoção de faixa/grau |
| `dependentes` | Relação pai/responsável → filho (responsavel_id → dependente_id) |
| `avisos` | Avisos publicados pela academia (fixado, publicado, timestamps) |
| `albuns` | Álbuns de fotos (título, capa, autor) |
| `fotos` | Fotos dentro de álbuns (URL no Storage, legenda) |
| `conquistas` | Medalhas ganhas (`codigo`, `referencia` = mês nas repetíveis, `conquistada_em`, `vista_em`, `notificada_em`). Só o servidor grava (service_role) |
| `feed_posts` | Publicações do feed (`autor_id` null = academia, `tipo` manual/graduacao/podio, `texto` ≤2000, `fotos` ≤10 URLs públicos completos de ficheiros do bucket `feed`, `referencia` única por tipo para os automáticos: id da graduação em `graduacao`, mês `YYYY-MM` em `podio`; `dados` jsonb com o conteúdo do cartão — `DadosGraduacao` (aluno, nome, faixa, graus, categoria) ou `DadosPodio` (Top 3 Adultos/Kids), null nos manuais). RLS ligada **sem policies** → só service_role |
| `feed_curtidas` | Gostos (post_id + user_id). Só service_role |
| `feed_comentarios` | Comentários (texto 1–300). Só service_role |
| `grupos_alunos` | Locais de treino (nome, ativo, padrao). Cada modalidade pertence a um local; o(s) local(is) do aluno são derivados das suas modalidades (`profiles.grupo_id` está obsoleto — não usar) |
| `modalidades` | Catálogo (nome, valor, valor_infantil, ativo, padrao, `grupo_id` = local, `desconta_noutro_local`). Nome único por local. Padrão (Jiu-Jitsu Academia) = registos da app |
| `aluno_modalidades` | "Plano" do aluno: modalidades + valor próprio + `cobrar` (false = pago diretamente no local, fora da app) |
| `aluno_descontos` | Descontos mensais do aluno (descricao, valor, `origem_modalidade_id` quando automático). Mensalidade = Σ linhas cobradas − Σ descontos |
| `push_subscriptions` | Subscrições Web Push por dispositivo (`/api/push/subscribe`) |
| `notificacoes_mensalidade_enviadas` | Deduplicação do push de mensalidade (aluno + mensalidade + tipo) |
| `notificacoes_graduacao_enviadas` | Deduplicação do push de aptos a graduar |
| `lancamentos_financeiros` | Contas a pagar/receber avulsas (`tipo` pagar/receber, `status` pendente/pago/atrasado/cancelado, `aluno_id` opcional) |
| `categorias_financeiras` | "Plano de contas" (`tipo` despesa/receita) |
| `formas_pagamento` | Formas de pagamento dos lançamentos |
| `fornecedores` | Fornecedores, clientes, funcionários e outros (`tipo`); `/admin/financeiro/clientes` lê a mesma tabela |
| `agendamentos_experimental` | Pedidos públicos de aula experimental (`/aula-experimental`) |
| `academias` | Criada para o Horizonte 2 (multi-tenant) mas **sem uso no código**: `academia_id` existe nullable em 12 tabelas, ninguém o lê nem escreve (ver secção 13) |

### Campos chave de `profiles`

```typescript
id: string                // UUID = auth.uid()
nome_completo: string
telefone: string | null
data_nascimento: string | null
perfil: "aluno" | "professor" | "admin" | "tablet" | "responsavel"
faixa: CorFaixa | null
graus: number             // graus na faixa actual (a UI usa 0–4; a BD aceita 0–6)
categoria: "adulto" | "infantil" | "adulto_infantil"
status: "ativo" | "inativo" | "trancado"
foto_url: string | null   // bucket avatars no Supabase Storage
contacto_emergencia: string | null
iban: string | null
nif: string | null
aulas_manual: number      // contador de presenças importadas manualmente (fichinhas físicas)
sem_login: boolean | null // true para dependentes (filhos sem conta de auth)
ocultar_ranking: boolean  // aluno fora do ranking (e do Top 3); muda por server action (ainda falta no tipo `Profile`)
grupo_id: string | null   // OBSOLETO — o local vem das modalidades (aluno_modalidades → modalidades.grupo_id)
academia_id: string | null // existe na BD (migração multi-tenant) mas ninguém o usa; não está no tipo `Profile`
data_inicio: string | null // existe na BD (schema inicial); não está no tipo `Profile`
```

O email **não** é coluna de `profiles`: vem do Auth (`admin.getUserById`).

### RPCs (funções Postgres)

| RPC | O que faz |
|-----|-----------|
| `gerar_qr_token(p_aluno_ids uuid[])` | Cria token UUID válido 60s na tabela `qr_tokens` (um token para vários alunos). Chamado pelo cliente em `PresencaView`; devolve `{ token, mensagem }` |
| `registrar_presenca_por_token(p_token)` | **Produção:** devolve jsonb `{ sucesso, mensagem, alunos[] }`; valida token (existe/não usado/não expirado) e bloqueio financeiro e insere uma presença por aluno. **Não** verifica reserva nem cooldown. (As migrations do repo descrevem uma versão antiga em TABLE com cooldown de 1 h) |
| `verificar_bloqueio_financeiro(p_aluno_id)` | Helper que retorna `true` se aluno tem mensalidade atrasada ≥10 dias. Só o RPC do QR o chama; presença manual e reservas repetem a regra em JS (`src/lib/mensalidade-status.ts`). EXECUTE revogado a `authenticated` |
| `gerar_aulas(p_turma_id, p_semanas)` | Gera as instâncias de `aulas` a partir de uma turma (`turma-actions.ts`, `turmas/nova/actions.ts`) |
| `limpar_tokens_expirados()` | Remove tokens expirados — **nada a chama hoje** (sem cron nem `.rpc`) |
| `is_staff()`, `is_admin()`, `is_tablet()`, `e_meu_dependente()` | Helpers das policies RLS |
| `handle_new_user`, `proteger_colunas_profiles`, `set_updated_at`, `set_atualizado_em`, `sync_dia_registro` | Funções de trigger (criar `profiles` no signup, proteger colunas, timestamps) |
| `dias_treino_alunos(p_aluno_ids)` | Datas (Lisboa) de cada aula por aluno, 1 linha por aluno — só service_role |
| `ranking_presencas(p_inicio, p_fim)` | Aulas por aluno activo num período, sem os ocultos — só service_role |
| `semanas_com_treino()` | Segundas-feiras com alguma presença na academia (semanas de pausa não quebram sequências) — só service_role |

**Trigger `tg_profiles_proteger_colunas`:** um aluno (role `authenticated`, não staff) só pode alterar `nome_completo`, `telefone`, `data_nascimento` e `foto_url` do próprio perfil. Tudo o resto passa por server actions com o admin client.

### Storage (Supabase)

| Bucket | Uso |
|--------|-----|
| `avatars` | Fotos de perfil dos alunos |
| `galeria` | Fotos dos álbuns |
| `Contrato` | PDF do contrato de prestação de serviços |
| `feed` | Fotos do feed — público, 5 MB, `image/webp` e `image/jpeg` (JPEG porque o Safari/iPhone não gera WebP a partir do canvas; `comprimirFoto` em `src/lib/comprimir-imagem.ts` cai para JPEG) |

### Drift entre migrations do repo e produção

`supabase/migrations/` **não reproduz** a BD de produção. Diferenças conhecidas: `gerar_qr_token(uuid[])` e `qr_tokens` com vários alunos, a versão jsonb de `registrar_presenca_por_token`, a coluna `profiles.sem_login`, e os buckets `galeria` e `Contrato` (só `avatars` e `feed` têm migração). A fonte de verdade é a BD: ver definições com `pg_get_functiondef` ou o MCP do Supabase, e **não** confiar só nos `.sql` do repo. Migrations aplicadas pelo MCP ficam com a versão = hora da aplicação; o ficheiro do repo deve ser renomeado para essa versão.

---

## 8. Tipos TypeScript (`src/lib/types.ts`)

```typescript
PerfilUsuario    = "aluno" | "professor" | "admin" | "tablet" | "responsavel"
StatusAluno      = "ativo" | "inativo" | "trancado"
StatusMensalidade = "pendente" | "pago" | "atrasado"
StatusAula       = "agendada" | "cancelada" | "concluida"
StatusReserva    = "confirmada" | "cancelada" | "presente"
RecorrenciaTurma = "semanal" | "quinzenal" | "mensal" | "diario" | "personalizado"

// Sistema de faixas BJJ (adulto + infantil)
CategoriaFaixa = "adulto" | "infantil" | "adulto_infantil"
CorFaixa = "branca" | "cinza_branca" | "cinza" | "cinza_preta" |
           "amarela_branca" | "amarela" | "amarela_preta" |
           "laranja_branca" | "laranja" | "laranja_preta" |
           "verde_branca" | "verde" | "verde_preta" |
           "azul" | "roxa" | "marrom" | "preta" | "coral" | "vermelha"

// Financeiro avulso (lançamentos)
TipoCategoriaFinanceira = "despesa" | "receita"
TipoFornecedor          = "fornecedor" | "cliente" | "funcionario" | "outro"
TipoLancamento          = "pagar" | "receber"
StatusLancamento        = "pendente" | "pago" | "atrasado" | "cancelado"

ActionResult = { ok: boolean; erro?: string }  // retorno padrão de Server Actions (interface)
```

Interfaces também em `types.ts`: `Profile`, `Mensalidade`, `ItemMensalidade`, `Modalidade`, `AlunoModalidade`, `AlunoDesconto`, `GrupoAluno`, `Turma`, `Aula`, `Reserva`, `HistoricoGraduacao`, `Dependente(Perfil)`, `Aviso`, `Album`, `Foto`, `CategoriaFinanceira`, `FormaPagamento`, `Fornecedor`, `LancamentoFinanceiro`, `AlunoCombo`. Os tipos do feed (`TipoPost`, `DadosGraduacao`, `DadosPodio`) vivem em `src/lib/feed.ts`, não em `types.ts`.

---

## 9. Componentes de domínio

| Componente | Descrição |
|-----------|-----------|
| `FaixaBJJ` | Renderiza imagem `.webp` da faixa com graus (pastas `/img/adulto/` e `/img/infantil/`) |
| `FaixaBelt` | Variante visual alternativa da faixa — **código morto**: nada a importa; apagar ou reutilizar |
| `GBLogo` | Logo Gracie Barra SVG |
| `DebugConsole` | Consola dentro da página, activa com `?debug=1` no URL (montada no `layout.tsx` raiz). Existe para diagnosticar o iPad da recepção (Safari 15), onde não há Web Inspector sem Mac |
| `GrupoPicker` | Selector de local de treino (usado em modalidades e turmas) |
| `ModalidadesEditor` | Editor do plano do aluno: modalidades, valor por aluno, "pago no local" (`cobrar`) e descontos; usado em `NovoAlunoForm` e `AlunoEditView` |
| `ValorMensalidade` | Mostra o valor da mensalidade com o detalhe da composição ("JJ 50 € · Capoeira 20 €") |
| `PhoneInput` | Campo de telefone (`react-phone-number-input`, prefixo +351 por defeito; regras em `src/lib/phone.ts`) |
| `ui/*` | Primitivos shadcn: `button`, `input`, `label`, `badge`, `card`, `dialog`, `skeleton`, `switch` (interruptores: modo escuro, ranking, grupos, modalidades), `euro-input` (valores em €), `input-otp` |
| `PresencasCalendario` | Calendário visual com dias de treino marcados |
| `AvisosMarkRead` | Marca avisos como lidos via localStorage |
| `InstallPrompt` | Banner PWA de instalação (respeita `pwa-install-dismissed` no localStorage) |
| `ServiceWorkerUpdater` | Recarrega página quando novo SW disponível (desactivado em dev) |
| `MensalidadeVencidaBanner` | Client component: banner âmbar fixo no topo quando mensalidade (própria ou de dependente) está atrasada ≥5 dias; publica a sua altura em `--banner-h` (as pílulas do Início prendem-se por baixo dela) |
| `MensalidadeAtrasoModal` | Modal central 1x/dia (localStorage) quando atraso ≥2 dias; botão "Falar com Simone" abre WhatsApp com mensagem pré-preenchida |
| `Medalha` | Medalha redonda (bronze/prata/ouro) — número nos marcos de aulas e sequências, ícone nas especiais |
| `NovaConquistaModal` | Modal em `/perfil` com medalhas ainda não vistas (próprio + dependentes); não aparece com o aviso de graduação nem com mensalidade ≥2 dias em atraso |
| `GraduacaoAptosModal` | Modal 2x por semana (1º acesso a partir de segunda e a partir de quinta, hora de Lisboa) para admin/professor quando há ≥1 aluno apto a graduar; janela vista guardada em `user_metadata.aviso_graduacao_janela` (por conta, não por dispositivo); renderizado em `/perfil` |
| `BottomNav` | Barra inferior do grupo `(app)`: Início · Aulas · Presença (centro) · Histórico · Avisos; ponto de avisos por ler (compara o último aviso publicado com `localStorage.avisos_last_seen`) |
| `PageHeader` | Header escuro das páginas do aluno (título, ícone, voltar opcional, safe area). Tabs da barra inferior não têm "voltar" |
| `skeletons` + `ui/skeleton` | Blocos para os `loading.tsx` — `AppPageSkeleton`, `CardListSkeleton`, `AdminPageSkeleton` |
| `ui/dialog` | Diálogo Radix partilhado (`variant="center"` ou `"sheet"` = bottom sheet no telemóvel). Usar em vez de `fixed inset-0` à mão |
| `ConfirmDialog` | `await confirmar({ titulo, descricao?, destrutivo? })` — substitui `window.confirm()` |
| `InicioView` | Início em `/perfil`: pílulas Feed · Ranking · Conquistas · Galeria (`?tab=`, o voltar do browser percorre os separadores), faixa e acesso a Minha conta |
| `AptosGraduarCard` | Card recolhível (fechado por defeito) com os alunos aptos a graduar; staff, no separador Feed do Início, acima de "Nova publicação". Se o cálculo falhar o card não aparece e o feed carrega na mesma |
| `FeedLista` / `PostCard` | Feed paginado (10 posts por página) e cartão de publicação com gosto, comentários e (staff) editar/apagar |
| `FotosCarrossel` | Carrossel de fotos de um post (até 10) |
| `CurtidasSheet` / `ComentariosSheet` | Bottom sheets com quem deu gosto e com os comentários (máx. 300 caracteres) |
| `PostComposer` | Compositor de publicações (staff): texto ≤2000, até 10 fotos comprimidas no cliente, 4 MB no total por envio (limite do body na Vercel) |
| `ContaView` | Minha conta em `/conta` (antiga `PerfilView`): dados, faixa, mensalidades, dependentes, Dashboard (staff); `BottomNav` marca Início também em `/conta`; secção Preferências com o interruptor "Modo escuro" |
| `FeedbackHosts` | `<Toaster>` (sonner, topo) + host do `confirmar()`; montado nos layouts `(app)` e `admin`; o tema do Toaster segue o tema activo |
| `TemaScope` | Em `(app)/layout.tsx`: põe/tira `dark` no `<html>` conforme a rota (só as do aluno, `ROTAS_COM_TEMA` em `src/lib/tema.ts`), a preferência (`localStorage["tema"]` = claro/escuro; vazio = segue o sistema) e o `prefers-color-scheme`; tira-o ao sair (ex.: para /admin). O script sem flash está no `<head>` do layout raiz (`scriptTema()`) e actualiza o `theme-color` |
| `useTemaAtivo` / `usePreferenciaTema` | Hooks em `src/components/useTema.ts`: tema aplicado agora (`claro`/`escuro`) e preferência guardada (`null` = sistema); reagem ao evento `tema-mudou` |
| `usePushSubscription` | Hook em `src/hooks/`: subscreve o dispositivo ao Web Push em silêncio quando o Início monta (`InicioView`) |

**Componentes que vivem junto da rota** (não em `src/components/`): `PostGraduacao` e `PostPodio` (cartões automáticos do feed), `NotificacoesModal` (sino, `(app)/perfil`), `DependenteModal` (`(app)/conta`), `AdminSidebar`, `PresencasChart` e `FinanceiroTabs` (`admin/`), `TabletScanner` / `TabletScannerWrapper` (`tablet/`), `AulaExperimentalForm` (`aula-experimental/`), `NovoLancamentoForm` e `LancamentoEditView` (`admin/financeiro/contas/`).

### Bibliotecas de domínio (`src/lib/`)

| Ficheiro | O que tem |
|----------|-----------|
| `types.ts` | Tipos partilhados (secção 8) |
| `auth-guard.ts` | `requireAdmin()` / `requireTablet()` |
| `supabase/` | Os três clientes (6.1) + middleware |
| `graduacao-rules.ts` | Ordem das faixas, próxima promoção, semanas exigidas, datas de início de faixa/último grau e elegibilidade (adulto e infantil) |
| `aptos-graduar.ts` | `calcularAptosGraduar` — lista de alunos aptos (card e modal) |
| `aviso-graduacao.ts` | Janela do aviso 2x por semana (segunda e quinta, hora de Lisboa) |
| `mensalidade-status.ts` | `getEffectiveStatus`, `getDiasAtraso`, `isBloqueadoFinanceiramente` — o status "atrasado" é derivado do vencimento, não só gravado |
| `modalidades.ts` / `grupos.ts` | Plano do aluno, composição da mensalidade, locais derivados das modalidades |
| `gamificacao.ts` / `conquistas-sync.ts` | Regras puras (testadas) e gravação das medalhas |
| `feed.ts` / `feed-automatico.ts` / `feed-servidor.ts` | Regras do feed, regras dos posts automáticos (testadas) e gravação no servidor |
| `inicio.ts` | Separadores do Início (`?tab=`) |
| `push-sender.ts` / `push-ativo.ts` | Envio de push (mensalidade, aviso, responsável, graduação, conquistas, feed) e gate `VERCEL_ENV=production` |
| `relatorio-alunos.ts` | Regras do relatório de alunos (alertas; testadas) |
| `fetch-all-presencas.ts` | `fetchAllPresencasDias` — lê todas as presenças por páginas (um `select` simples não traz tudo) |
| `turma-tags.ts` | Etiquetas visuais das turmas (GB1/GB2…) |
| `comprimir-imagem.ts` | Compressão de fotos no cliente (WebP → JPEG) |
| `tema.ts` | Regras puras do modo escuro (`ROTAS_COM_TEMA`, `scriptTema()`) |
| `senha.ts` / `login-client.ts` | Regra de password (8+ caracteres com maiúscula, minúscula e número — tem de bater com a policy do Supabase Auth) e login pelo route handler |
| `send-contract-email.ts` / `mailer.ts` | Email do contrato (Nodemailer/Gmail) |
| `phone.ts` / `utils.ts` | Formatação de telefone; `cn()` e utilitários |

A lógica dos lançamentos financeiros e da aula experimental não tem biblioteca própria: está em `src/app/admin/financeiro/contas/actions.ts` e `src/app/aula-experimental/actions.ts`.

---

## 10. Cores e design

Tokens em `src/app/globals.css` como canais RGB (`--brand: 204 0 0`) → o Tailwind gera `bg-brand/10` etc. **Nada de `oklch()`**: o tablet é Safari 15 (só suporta a partir do 15.4).

```javascript
// tailwind.config.ts — preferir os semânticos em código novo
brand / brand-dark / brand-light   // #CC0000 / #990000 / #E31E24
ink        // #0A0A0A — headers escuros
canvas     // #F5F5F5 — fundo das páginas
surface    // #FFFFFF — cards
success / warning / destructive
whatsapp / whatsapp-dark          // botões "Falar com a Simone"
fg / fg-muted / line              // texto principal / secundário / bordas (--fg, --fg-muted, --line em globals.css)
subtle / fg-subtle / line-strong     // fundo de blocos, texto terciário, borda forte (têm valor próprio em `.dark`)
// gb-blue, gb-black, gb-gray… continuam como aliases (gb-blue é o vermelho, nome histórico)
```

Utilitários: `pt-header` (40px ou notch + 16px), `pt-safe`, `pb-safe`, `pb-sheet`, `pb-bottom-nav`; `duration-fast`/`duration-base` + `ease-out-expo`; `animar-entrada` / `animar-lista` (entrada de conteúdo). Texto nunca abaixo de 12px (`text-xs`). Avatares de utilizador em `<img>` (URL sobrescrito no upload), logos em `next/image`. O viewport usa `viewportFit: "cover"` e **não bloqueia o zoom** — em ecrãs táteis os campos ficam ≥16px para o iOS não fazer zoom ao focar.

**Modo escuro:** classe `dark` no `<html>`, só nas rotas do aluno (`/admin` e `/tablet` ficam sempre claros — o tablet é Safari 15). Os ficheiros do aluno usam só tokens semânticos (`bg-surface`, `bg-canvas`, `bg-subtle`, `text-fg*`, `border-line*`…); cores fixas de propósito (ex.: caixa branca do QR) levam o comentário `tema: fixo` na mesma linha ou na anterior. O guarda `src/lib/tema-cores.test.ts` falha com `bg-white`, `text-gray-N`, `text-ink`… Canais RGB em `.dark` de `globals.css`, nunca `oklch()`.

**Theme color PWA:** `#ED1C24` · **Fonte principal:** SF Pro Display (local woff2) + Geist · **Locale:** pt-PT · **Interface:** português europeu · **Código:** inglês · **Mobile-first**

---

## 11. Padrões e convenções

- `createAdminClient()` para queries no dashboard e mutations admin (contorna RLS)
- `Promise.all()` para queries paralelas em Server Components
- `dynamic(() => import(...), { ssr: false })` — **apenas em Client Components** para `@zxing/browser`
- Server Actions retornam `{ ok: boolean; erro?: string }` e chamam `revalidatePath()` após mutations
- Imagens de upload comprimidas no cliente (WebP, ou JPEG quando o browser não gera WebP) antes do upload
- Rotas do aluno (`(app)`) e `admin/` têm `loading.tsx` com skeleton do formato real (header com o título já conhecido); as sub-rotas de `admin/` herdam o de `admin/` (só `admin/alunos/[id]` tem o seu). Rota nova do aluno = `loading.tsx` novo; as páginas públicas não têm
- Navegação interna com `<Link>` (prefetch); `router.push` só para redirecionar depois de uma acção (ainda há ~22 em 10 ficheiros, ex. `NovoAlunoForm`, `AlunoEditView`, `TurmaEditView`)
- Plano da Fase 15 (concluída) em `docs/plano-fluidez-ui.md`; desenho e planos do feed/modo escuro em `docs/superpowers/` (specs e plans, todos implementados); histórico PR a PR em `docs/CHANGELOG.md`
- Confirmações: `confirmar()` de `@/components/ConfirmDialog` — nunca `window.confirm()`/`alert()`
- Resultado de acções (apagar, guardar, reservar): `toast.success` / `toast.error` do `sonner`. Erros de validação de formulário ficam inline, junto ao campo
- Modais: `<Dialog>` de `@/components/ui/dialog`; conteúdo que lê um objecto (ex.: `deleteTarget.x`) fica dentro de `{obj && (<DialogContent>…)}` para não rebentar na animação de saída

---

## 12. Regras críticas aprendidas em produção

| Problema | Solução |
|----------|---------|
| Queries admin retornam vazio | Usar `createAdminClient()` — RLS bloqueia com anon key |
| Aluno não vê nome/foto de outro aluno ou do professor | RLS de `profiles` só deixa ler o próprio, os dependentes e (staff) todos — protege IBAN/NIF/telefone. Dados de outras pessoas vêm do servidor com `createAdminClient()` e só as colunas necessárias (ex.: ranking, reservas em `/aulas`, professor no histórico de graduações) |
| Câmera não funciona no tablet | HTTPS obrigatório; HTTP bloqueia API de câmera |
| `@zxing/browser` quebra SSR | `dynamic(..., { ssr: false })` só em Client Components |
| `pgcrypto` indisponível | Habilitar extensão explicitamente no Supabase |
| UIDs em SQL sem aspas | Sempre aspas simples corretas nos UUIDs |
| Middleware redireciona actions | Detectar header `next-action` antes de redirecionar |
| Perfil incompleto bypassa onboarding | Usar `user_metadata.onboarding` (não query ao DB — zero round-trips) |
| Enum `responsavel` em falta no DB | Adicionar ao enum Postgres antes de usar no código |
| Índice único em `aulas` incompleto | Incluir `horario` — mesmo dia com horas diferentes gerava conflito |
| Link de reset de password vai para `/login?erro=confirmacao` | `resetPasswordForEmail` usa fluxo OTP (`token_hash+type=recovery`), não PKCE — o callback tem de tratar ambos os casos com `verifyOtp` |
| Dev/e2e a enviar push a alunos reais | Dev, e2e e produção partilham a BD e as chaves VAPID. Push só sai com `VERCEL_ENV=production` (`pushAtivo` em `src/lib/push-ativo.ts`); fora de produção as escritas de deduplicação (`notificacoes_*_enviadas`, `conquistas.notificada_em`) também são saltadas, para não gastar o "já notificado" |
| Push de mensalidade não chega a dependentes | Dependentes (`sem_login=true`) não têm push subscription própria — buscar na tabela `dependentes` e substituir pelos IDs dos responsáveis antes de consultar `push_subscriptions` |
| `/api/push/send` bloqueada pelo middleware | Adicionar à lista de paths públicos — é chamada pelo Vercel Cron sem sessão de utilizador |
| Pódio do feed a notificar duas vezes | O cron `feed_podio` corre todos os dias mas só publica nos dias 1 a 3 do mês (Lisboa; `dry` ignora a janela), para um post apagado não ressuscitar com novo push; é idempotente por mês (`referencia` única). Só manda push quem **insere** o post: se já existia ou o insert dá 23505 (outro pedido ganhou), não há push |
| `proxy.ts` não suportado no Vercel | Usar `middleware.ts` (hoje `src/middleware.ts`) — em 2026-05 o Vercel não reconheceu `proxy.ts` como middleware. O Next 16 renomeou oficialmente o ficheiro para `proxy.ts` e deixou `middleware` deprecated; **não migrar sem testar** em produção com rollback à mão |
| Reset de password abre "link inválido ou expirado" | O template "Reset Password" do Supabase é o `{{ .ConfirmationURL }}` por defeito (fluxo PKCE: só funciona no mesmo browser que pediu o reset). **Resolvido em 2026-10-29.** Código no PR #72 (página `/nova-senha` com botão "Continuar", ver 6.2) + configuração no Dashboard do Supabase, já aplicada e testada (pedido no PC, link aberto no telemóvel): Authentication → Email Templates → Reset Password usa o link `{{ .SiteURL }}/nova-senha?token_hash={{ .TokenHash }}&type=recovery`, e o **Site URL** (Authentication → URL Configuration) passou de `http://localhost:3000` para `https://gracie-barra-app.vercel.app` (as Redirect URLs `http://localhost:3000/**` e `https://gracie-barra-app.vercel.app/**` mantêm-se). Se o Site URL voltar a `localhost`, os links dos emails quebram. Rollback do template: `{{ .ConfirmationURL }}`; o código serve os dois formatos |
| Login do tablet/iPad (Safari 15) falha em silêncio | O tablet da recepção é um iPad Air em iPadOS 15. Manter `.browserslistrc` com `safari >= 15` / `ios_saf >= 15`; autenticar por route handler (`/api/auth/login`) + `window.location.assign()`, não Server Action + `router.push()`; diagnosticar com `?debug=1` (`DebugConsole`). Sem `oklch()` nas cores |
| Migration do repo diverge da BD | Ver "Drift entre migrations do repo e produção" na secção 7 |
| Hook RTK (se o utilizador o tiver) esconde merges no `git log` e faz `grep` varrer `.claude/worktrees/` | Usar `rtk proxy git log …` / `rtk proxy grep …`, ou as ferramentas Grep/Glob |

---

## 13. Débitos técnicos conhecidos

| Débito | Impacto | Prioridade |
|--------|---------|------------|
| **Multi-tenancy "fantasma"** | `academias` e `academia_id` (12 tabelas, nullable, sem default) existem mas **nada no código os usa** (confirmado em 2026-10-29): as RLS filtram só por `perfil`, as páginas admin usam `createAdminClient()` com `select("*")`; numa análise de 2026-07-23 o RPC do QR e `/api/admin/delete-user` também não verificavam tenant. **Bloqueio duro para vender a uma 2.ª academia** — ver Horizonte 2 | Alta (só para comercialização) |
| Migrations do repo ≠ produção | Ver "Drift" na secção 7; quem recriar a BD a partir dos `.sql` não obtém a BD real | Média |
| Testes E2E cobrem 7 fluxos (`cadastro`, `presenca`, `financeiro`, `gamificacao`, `feed`, `tema`, `reset-senha`); `financeiro.spec.ts` tem 2 testes que falham na árvore limpa ("marks mensalidade as pago" / "unmarks"): **7/9 é o estado de referência**. Testes unitários (8 ficheiros) só para a lógica pura de `src/lib` (gamificação, feed, Início, push, tema, relatório de alunos) | Risco em refactors; não culpar a mudança em curso pelas 2 falhas sem confirmar | Média |
| Cadastro sem rollback transaccional | Perfis parciais se mensalidades falharem | Média |
| Uploads de Storage não atómicos | Ficheiros órfãos se DB falhar a seguir | Média |
| Race condition na capacidade de aulas | Exceder lotação com utilizadores simultâneos | Baixa (academia pequena) |
| Componentes com 900+ linhas | `CadastroForm.tsx` (~2020), `AlunoEditView.tsx` (~1580), `ContaView.tsx` (~910, ainda a crescer) — difíceis de manter | Baixa |
| ~36 avisos de lint em código legado | 0 erros. 23 vêm de regras rebaixadas a aviso em `eslint.config.mjs` (`no-explicit-any` 11, `set-state-in-effect` 9, `purity` 3); os outros 13 são `no-unused-vars` 7, `no-img-element` 5, `exhaustive-deps` 1. Voltar a erro depois de corrigidos | Baixa |
| Código/ficheiros mortos | `src/components/FaixaBelt.tsx` (ninguém importa); `@radix-ui/react-toast`, `react-avatar`, `react-separator` instalados sem uso; `public/fonts/* - Copia.woff2` duplicados; `img_2303.jpeg_…jpg` solto na raiz | Baixa |
| `router.push` em vez de `<Link>` e overlays `fixed inset-0` à mão | ~22 `router.push` (a maioria redirecciona após acção); `GaleriaAlbumView.tsx` (lightbox) e `TabletScanner.tsx` ainda não usam `ui/dialog` | Baixa |
| Número de WhatsApp fixo no código | `wa.me/14076941856` (prefixo +1, EUA) em 5 sítios — ver secção 16. **Confirmar com a academia que é o número certo** | Média |

---

## 14. Estado actual das funcionalidades

### ✅ Implementado e em produção

| Fase | Funcionalidade | Notas |
|------|---------------|-------|
| 1 | Auth + Perfil | Login por email + password (route handler), cadastro com código OTP de confirmação, reset de password, perfil completo |
| 2 | QR Code base | Rotas `/presenca`, `/tablet`, `/tablet/login` |
| 3 | Fluxo QR completo | Geração, leitura, polling, confirmação, bloqueio financeiro |
| 4 | Perfil do aluno | Upload de foto, edição de dados, calendário de presenças |
| 5 | Painel admin | CRUD de alunos, filtros, busca, visualizar presenças |
| 6 | Gestão financeira | Mensalidades, status automático, marcar pago/pendente, edição inline, eliminar, editar mês de referência em lote |
| 7 | Turmas e reservas | CRUD turmas, editar horário, excluir aula com reservas, geração de aulas, reservar/cancelar, etiquetas visuais por turma (`turma-tags.ts`), lista de quem reservou cada aula com avatares expansíveis. Em produção o QR **não** exige reserva (ver 6.4) |
| 8 | Graduações | Registo de promoções, timeline visual, faixas adulto + infantil, elegibilidade automática por requisitos |
| 9 | Dashboard admin | KPIs, gráfico de presenças (`PresencasChart`, SVG/div à mão), alunos ausentes, últimas graduações |
| 10 | Relatórios | Excel/CSV de presenças e financeiro, PDF com logo Gracie Barra, página admin `/admin/relatorios` (ver também "Relatório de alunos") |
| 11 | Avisos | CRUD admin, publicar/fixar, badge de não lidos |
| 12 | Galeria de fotos | Álbuns, upload múltiplo, lightbox com teclado |
| 13 | Dependentes | 3 tipos de cadastro, QR multi-aluno, pai vê filhos |
| 14 | PWA | Manifest, service worker, splash screens iOS, install prompt, offline |
| — | Tablet melhorado | Câmera frontal/traseira toggle, presença manual sem QR, batch manual entry |
| — | Importação histórica | Admin selecciona dias em calendário para importar presenças antigas |
| — | Frequência semanal | Painel de semanas com 0/1/2/3+ treinos no perfil admin do aluno |
| — | Categoria adulto_infantil | Alunos que treinam nos dois grupos vêem turmas de ambas as categorias |
| — | Email de contrato | Enviado automaticamente no cadastro (aguardado, mas nunca bloqueia o registo — ver 6.5) |
| — | **Aula experimental pública** | `/aula-experimental` sem login: o visitante escolhe uma turma marcada `apenas_experimental`/disponível e fica registado em `agendamentos_experimental`; depois abre o WhatsApp da academia. Migração `20260720145247_aula_experimental_publica.sql` |
| — | **Financeiro: contas a pagar/receber** | Submódulo `/admin/financeiro/*` além das mensalidades: lançamentos avulsos (`lancamentos_financeiros`, com `aluno_id` opcional) com parcelamento (N parcelas, intervalo em dias; apagar "só esta" ou "todo o parcelamento"), fornecedores, clientes, plano de contas hierárquico, formas de pagamento, filtros por mês/ano e período, KPI "A receber" que inclui mensalidades pendentes. Mensalidades: o status "atrasado" é derivado do vencimento (`getEffectiveStatus`), não só gravado. Entra nos relatórios |
| — | **Modal de notificações (sino)** | Sino no Início abre `NotificacoesModal` com os avisos e alertas recentes |
| — | **Privacidade de `profiles` e colunas protegidas** | RLS restrita (aluno só lê o próprio, dependentes; staff todos) + trigger `tg_profiles_proteger_colunas` — ver secções 7 e 12 |
| — | Auth guard nas actions | `requireAdmin()` / `requireTablet()` em todas as Server Actions |
| — | Histórico filtro pessoa | Alunos filtram histórico de presenças por pessoa (self ou dependentes) |
| — | Monitorização erros | Sentry (`@sentry/nextjs`) integrado, mapeamento de source maps em Vercel |
| 16 | **Notificações push + WhatsApp** | Web Push via `web-push` + VAPID keys; tabelas `push_subscriptions`, `notificacoes_graduacao_enviadas` e `notificacoes_mensalidade_enviadas`; Vercel Cron (UTC, ver tabela na secção 4); push de aviso fire-and-forget em `avisos-actions.ts`; o push de mensalidade (vence amanhã/hoje/atraso) abre `/conta`, onde Mensalidades começa aberta se houver alguma por pagar; botão WhatsApp em `/conta` › Mensalidades quando mensalidade atrasada |
| — | **Bloqueio financeiro em reservas** | Mensalidade atrasada ≥10 dias bloqueia QR, presença manual e reservas de aulas; helper RPC `verificar_bloqueio_financeiro`; `AulasView` mostra botão desabilitado com aviso âmbar |
| — | **Card "aptos a graduar" no Início** | Admin e professor vêem no Início (`/perfil`, separador Feed, acima de "Nova publicação") um card recolhível, fechado por defeito, com alunos que cumprem requisitos de graduação |
| — | **Email no card do aluno** | `AlunoEditView` mostra campo email (read-only) buscado via `admin.getUserById`; ocultado para dependentes (`sem_login=true`) |
| — | **Push para dependentes via responsável** | `push-sender` faz lookup em `dependentes` para substituir IDs de dependentes pelos dos responsáveis antes de buscar subscriptions |
| — | **Push de avisos inclui professores** | Notificações de avisos publicados enviadas a alunos E professores |
| — | **Modal de mensalidade em atraso** | Atraso ≥2 dias (próprio ou de dependente) → modal 1x/dia no layout `(app)` com WhatsApp da Simone; some quando a mensalidade é paga |
| — | **Modal de aptos a graduar (2x/semana)** | Admin/professor vêem em `/perfil`, no 1º acesso a partir de segunda e de quinta, aviso de que há alunos aptos (só se houver ≥1); controlo por conta em `user_metadata` |
| — | **Grupos de alunos** | `/admin/grupos` (CRUD inline); campo Grupo em novo aluno e ficha (todos os perfis menos responsável); filtro por grupo em Cadastros e Financeiro (totais seguem o filtro); `/cadastro` atribui o grupo padrão |
| — | **Modalidades** | `/admin/modalidades`; card Modalidades na ficha (valor por aluno, total, "Atualizar pendentes" quando muda); `mensalidades.itens` (jsonb) guarda a composição e `valor` continua a ser o total; detalhe "JJ 50 € · Capoeira 20 €" no Financeiro, ficha, perfil do aluno e relatórios; `turmas.modalidade_id` filtra `/aulas` e é validado em `reservar` |
| — | **Colégio e descontos** | Modalidade "Jiu-Jitsu · Colégio" 13 € com `desconta_noutro_local`: ao juntar uma modalidade de outro local, o editor passa o Colégio a "pago no colégio" (`cobrar=false`) e cria "Desconto aluno do Colégio −13 €" (editável); ao sair, reverte. Ficha mostra "Onde treina"; filtros de grupo (Cadastros, Financeiro) usam locais derivados; descontos manuais no editor |
| 17 | **Gamificação** | `/ranking` (mês/ano, Adultos/Kids pela regra da graduação, empates 1,1,3, opção de ocultar); `/conquistas` (sequência = semanas seg–dom com ≥2 aulas, semana sem ninguém na academia é pausa; medalhas de aulas 10–500, sequências 4–52, Mês perfeito, Top 3 do mês desde 2026-10, 1/2/3 anos). Regras em `src/lib/gamificacao.ts` (testadas com vitest); gravação em `src/lib/conquistas-sync.ts` — depois do QR (ecrã de confirmação), na presença manual do tablet (`after`) e no cron diário `type=conquistas` (`?dry=1` só conta). Push agrupado por pessoa; backfill antigo não gera push |
| — | **Relatório de alunos** | Aba "Alunos" em `/admin/relatorios`: modal com mês, filtro Ativos / Inativos / Ativos e inativos (inativos = status ≠ ativo; com inativos entra a coluna Status) e colunas (Nome fixo; Categoria, Vencimento, Valor, Plano, Alerta pré-marcadas e desmarcáveis) → Excel/PDF, uma linha por aluno, alertas primeiro. Alertas: sem mensalidade (só ativos; salvo plano a 0 €), valor ≠ plano, kids (< 16 anos) com valor de adulto, vencimento diferente do habitual do aluno (segunda-feira +1/+2 = dia empurrado do fim de semana). Regras em `src/lib/relatorio-alunos.ts` (testadas com vitest) |
| 18 | **Feed da academia (PR 1)** | `/perfil` é o Início com pílulas Feed · Ranking · Conquistas · Galeria; `/conta` = Minha conta. Staff publica/edita/apaga (texto + até 10 fotos); aluno/responsável/professor põem gosto e comentam. Tabelas `feed_*` + bucket `feed` (migrações `20261026120000_feed.sql` e `20261027120000_feed_jpeg.sql`, já aplicadas em produção). Push: novo post → alunos/responsáveis/professores activos (menos o autor); comentário → só o autor do post; gostos não notificam. Regras puras em `src/lib/feed.ts` (testadas); loaders partilhados `dados.ts` em ranking/conquistas/galeria. Desvio ao spec §5.2: sem linha "Notificações" em Minha conta (não existe toggle de push); a linha "Modo escuro" veio no PR 3 |
| 18 | **Feed (PR 2) — posts automáticos** | Autor "Gracie Barra Famalicão" (`autor_id` null); staff pode editá-los e juntar fotos. **Graduação**: `registrarGraduacao` publica "X recebeu a faixa Y." só com faixa nova que **sobe** (não só graus, nem o primeiro registo, nem correcções/descidas; ordem de `graduacao-rules`, infantis abaixo das de adulto), aluno visível no ranking e `data_graduacao` entre hoje e 7 dias atrás (Lisboa); nome como no ranking; sem push; `excluirGraduacao` apaga o post e as fotos. **Pódio**: cron diário `type=feed_podio` publica o Top 3 Adultos e Kids do mês anterior (regras do `/ranking`, mínimo 4 aulas, desde 2026-10 → o primeiro sai a 1 de novembro) com push a alunos, responsáveis e professores activos. Regras em `src/lib/feed-automatico.ts` (testadas), gravação em `src/lib/feed-servidor.ts`, cartões `PostGraduacao`/`PostPodio`. Migração `20261028120000_feed_dados.sql` (coluna `dados`) já aplicada |
| 18 | **Modo escuro (PR 3)** | Segue o sistema por defeito; interruptor em Minha conta › Preferências guarda a escolha por dispositivo (`localStorage["tema"]`), sem flash no carregamento (script no `<head>`). Cobre as páginas do aluno (grupo `(app)`), Minha conta e feed; `/admin` e `/tablet` ficam sempre claros. ~260 cores fixas passaram a tokens semânticos (`subtle`, `fg-subtle`, `line-strong` novos) com guarda em vitest; `theme-color` e Toaster seguem o tema. Regras puras em `src/lib/tema.ts` (testadas), `TemaScope` + `useTema`. Sem migração de BD |

### ❌ Por implementar

| Fase | Funcionalidade | Prioridade |
|------|---------------|------------|
| 18 | **Vídeo no feed via Bunny Stream** — decisão do dono; o feed arranca só com fotos (spec §3) | Baixa |
| 15 | **UI/UX Polishing** — feito (PRs #61–#63): tokens, safe areas, zoom, skeletons, barra inferior, toasts, diálogos/confirmações, UI optimista, micro-interacções, cores/tipografia consistentes. Opcional: Barlow Condensed nos números (`docs/plano-fluidez-ui.md`) | — |

### 🔀 PRs abertos em `renannsanches/gracie-barra-app` (não estão em produção)

Verificado em 2026-10-29. Antes de os mergear, rebasear/reconciliar com `master` e ver se ainda fazem sentido; confirmar sempre com `gh pr list`.

| PR | Ramo | O que é | Nota |
|----|------|---------|------|
| #65 | `feat/home-compacta` | Home compacta por perfil + `/perfil/conta` | **Rascunho** ("validar antes do merge"). Anterior ao Início novo do feed (#67) e a `/conta` — provável conflito; talvez superado |
| #64 | `fix/aptos-graduar-noah-segundo` | Põe um aluno específico em 2.º na lista de aptos a graduar | Ajuste pontual de ordem. Em 2026-10-16 a produção chegou a correr este ramo antes do merge — comparar sempre o SHA do deploy |
| #52 | `fix/grupos-criar-ativo` | Botão "Criar grupo" sempre activo | Pequeno; verificar se `/admin/grupos` ainda tem o problema |
| #40 | `feat/push-lembrete-vencimento` | Push de lembrete de vencimento (dia 5) + cron mensal | Funcionalidade nova, por rever |
| #39 | `feat/mensagens-erro-auth` | Mensagens de erro de auth em PT-PT | Pode estar parcialmente superado por #42/#43 |
| #36 | `claude/graduation-list-display-5helk4` | Layout do card "Aptos a Graduar" (faixa grande cortava o nome) | Provável obsoleto: o card foi refeito (#37, depois Início/feed) |
| #34 | `claude/qr-device-inactive-classes-k8vGl` | Ocultar turmas inactivas na presença manual do tablet | Por rever |
| #31 | `feat/notification-bell-modal` | Modal de notificações no sino | **Obsoleto**: reposto em produção pelo #33 |
| #30 | `claude/dashboard-card-visibility-gEqJ3` | Nome completo no card Aptos a Graduar do dashboard | Provável obsoleto (ver #36) |
| #27 | `fix/mensalidades-duplicate-key-error` | Trata erro de chave duplicada em `gerarProximoMes` | Por rever; pode ainda ser um bug real |
| #26 | `claude/relaxed-ride-ezJWT` | Fluxo de redefinição de senha | **Obsoleto**: resolvido por #24/#29 |

---

## 15. Roadmap de produto — visão estratégica

O produto evolui em 3 horizontes. Cada horizonte só começa depois do anterior estar estável.

### Horizonte 1 — Estabilização Famalicão *(actual)*
Consolidar o produto para a academia actual antes de qualquer expansão.

**Pendente:**
- ✅ Fase 10: Relatórios (Excel + PDF) — implementado
- ✅ Testes E2E nos fluxos críticos (QR, cadastro, marcação de pago) — implementado
- ✅ Logging com Sentry (free tier) — implementado e ligado no código (confirmar que `NEXT_PUBLIC_SENTRY_DSN` e `SENTRY_AUTH_TOKEN` estão na Vercel)
- ✅ Notificações push (Fase 16) — implementado; fixes de professores e dependentes aplicados
- ✅ UI Polishing (Fase 15) — feito (#61–#63)
- ✅ Gamificação (Fase 17) e Feed + modo escuro (Fase 18) — feitos (#58, #67–#69)

**Ainda por fazer neste horizonte:** decidir o destino dos PRs abertos (secção 14); reconciliar as migrations do repo com a BD real (secção 7); confirmar o número de WhatsApp (secção 13).

### Horizonte 2 — Rede Gracie Barra *(multi-tenant, mesma marca)*
Expandir para outras unidades da Gracie Barra, cada uma com a sua configuração local.

**O que muda tecnicamente:**
- Tornar `academia_id` `NOT NULL` com default e **usá-lo**: hoje a coluna já existe (nullable) em 12 tabelas, e a tabela `academias` também (migração `20260525130240_multi_tenant_academias.sql`), mas o código ignora ambas — ver "Multi-tenancy fantasma" na secção 13. Há tabelas novas (financeiro avulso, feed, push, modalidades…) que nem sequer têm a coluna
- Reescrever RLS policies para filtrar por academia (ex. `is_staff_of(academia)`), pôr o tenant em `app_metadata`/JWT e filtrar todas as queries admin, RPCs e API routes
- Preencher a tabela `academias` (nome, cidade, logo, cores, WhatsApp, email, preços, contrato PDF)
- Roteamento por subdomínio (`famalicao.grb.app`, `porto.grb.app`) ou path
- Context de tenant injectado no middleware e propagado às Server Actions
- Painel super-admin para gerir todas as unidades
- Config de preços e contacto vinda do DB, não hardcoded

**O que NÃO muda:** sistema de faixas BJJ, fluxo de QR, estrutura de turmas/aulas

**Modelo de negócio:** subscrição mensal por unidade (valor a definir)

### Horizonte 3 — Outras academias de artes marciais *(white-label)*
Abrir o produto para academias de Karaté, Taekwondo, Judo, Muay Thai, etc.

**Adicionalmente ao Horizonte 2:**
- Sistema de graduação configurável (substituir enum `CorFaixa` fixo por tabela `graduacoes_config` por academia)
- Componente `GraduacaoWidget` genérico em vez de `FaixaBJJ`
- Terminologia configurável ("faixa" / "cinturão" / "dan" / "grau")
- Self-service onboarding — academia cria conta e configura sozinha
- Billing integrado (Stripe) — plataforma cobra as academias

**Fora de âmbito neste horizonte:** outros desportos sem sistema de graduação (natação, tênis, etc.)

---

## 16. Valores hardcoded a migrar para config (Horizonte 2)

Antes de escalar, estes valores precisam sair do código para a tabela `academias`:

| Valor | Localização actual |
|-------|--------------------|
| "Gracie Barra Famalicão" | `layout.tsx`, `InstallPrompt.tsx`, `login/page.tsx` (diz "Vila Nova de Famalicão"), `cadastro/CadastroForm.tsx` (múltiplos), `src/lib/feed.ts` (autor dos posts automáticos), `src/lib/push-sender.ts` |
| `graciebarrafamalicao@gmail.com` | `src/lib/send-contract-email.ts` (e `GMAIL_USER` em env) |
| PDF do contrato URL e logo | `src/lib/send-contract-email.ts` (URLs do Storage do Supabase escritos à mão) |
| Preços (62 €/55 €) | Fallback em `src/app/cadastro/cadastro-actions.ts`; o valor normal já vem da modalidade padrão (`src/lib/modalidades.ts`, tabela `modalidades`) |
| Número WhatsApp da academia (`14076941856`) | `MensalidadeAtrasoModal.tsx`, `MensalidadeVencidaBanner.tsx`, `ContaView.tsx`, `AulaExperimentalForm.tsx`, `send-contract-email.ts` |
| Org/project do Sentry e DSN do servidor | `next.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` |
