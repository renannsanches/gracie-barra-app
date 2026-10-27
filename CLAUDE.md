# CLAUDE.md

> Este ficheiro serve dois públicos: **programadores** que vão trabalhar no código, e **estrategistas de produto/negócio** com literacia tecnológica que precisam entender o que está construído, o que falta, e para onde vai.

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

Fluxo: ramo novo → PR para `master` em `renannsanches/gracie-barra-app` → preview Vercel verde → merge.

```bash
npm run dev      # servidor local em http://localhost:3000
npm run build    # build de produção (verifica tipos TypeScript; o Next 16 já não corre lint)
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

A BD dos testes é a de produção: o `global-setup` põe `ocultar_ranking = true` nos utilizadores de teste para não aparecerem no ranking real.

**Troubleshooting:**
- `global-setup` falha: verificar que `.env.local` tem todos os `PLAYWRIGHT_*` vars
- Auth redireciona para `/login` mesmo com storageState: correr `DEBUG=pw:api npm run test:e2e`
- Supabase "email not confirmed": o `global-setup` já define `email_confirm: true` — verificar SERVICE_ROLE_KEY

---

## 3. Stack técnica

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui (Radix primitivos) |
| Backend / DB | Supabase (Postgres + Auth + Storage + RLS) |
| QR — gerar | `qrcode` npm package |
| QR — ler | `@zxing/browser` (carregado via `dynamic(..., { ssr: false })`) |
| Email | Nodemailer + Gmail app password |
| PWA | `@ducanh2912/next-pwa` (Workbox) |
| Charts | Recharts |
| Imagens | Next.js Image + `sharp` (compressão WebP no cliente) |
| Deploy | Vercel (produção automática no push para `master`) |
| Fonte | SF Pro Display (woff2 local) + Geist (fallback) |
| Observabilidade | Sentry (`@sentry/nextjs`) — erros de cliente e servidor |
| Testes E2E | Playwright (`@playwright/test`) — fluxos críticos |

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
NEXT_PUBLIC_SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project>   # cliente
SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project>               # servidor
SENTRY_ORG=<org-slug>          # build-time (upload de source maps)
SENTRY_PROJECT=<project-slug>  # build-time
SENTRY_AUTH_TOKEN=sntrys_...   # build-time — NUNCA commitar, só em Vercel env vars

# Playwright E2E — credenciais de utilizadores de teste
BASE_URL=http://localhost:3000
PLAYWRIGHT_TEST_EMAIL=test-aluno@graciebarrafamalicao.app
PLAYWRIGHT_TEST_PASSWORD=<strong-random>
PLAYWRIGHT_ADMIN_EMAIL=test-admin@graciebarrafamalicao.app
PLAYWRIGHT_ADMIN_PASSWORD=<strong-random>
```

**Sentry em Vercel:** adicionar `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, e `SENTRY_AUTH_TOKEN` no dashboard do Vercel (Settings → Environment Variables) para produção + preview.

**Cron jobs (Vercel):** adicionar `CRON_SECRET=<secret-aleatorio>` nas env vars do Vercel. O `/api/push/send` valida este token no header `Authorization: Bearer …` para aceitar chamadas dos crons configurados em `vercel.json`: `type=mensalidade`, `graduacao`, `responsavel_aula`, `conquistas` (`?dry=1` só conta) e `feed_podio` (pódio do mês anterior no feed; `?dry=1` só calcula e só com ele se aceita `&hoje=YYYY-MM-DD`).

---

## 5. Mapa de rotas

```
/                       → redireciona para /perfil ou /login
/login                  → autenticação (email + OTP)
/cadastro               → onboarding multi-step (3 tipos de perfil)
/esqueci-senha          → pedido de reset de password
/nova-senha             → formulário de nova password
/perfil                 → Início: pílulas Feed · Ranking · Conquistas · Galeria (`?tab=`); staff vê no separador Feed o card recolhível de aptos a graduar e o compositor de publicações; aqui vivem os modais (mensalidade, medalhas, aptos a graduar)
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
/admin/financeiro       → tabela de mensalidades com filtros (mês, status, aluno)
/admin/avisos           → CRUD de avisos (criar, editar, fixar, publicar/arquivar)
/admin/relatorios       → exportar Excel/CSV e PDF de presenças e financeiro
/admin/albuns           → gestão de álbuns de fotos
/admin/albuns/[id]/fotos → upload e gestão de fotos de um álbum
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
- Paths públicos: `/login`, `/cadastro`, `/esqueci-senha`, `/nova-senha`, `/auth/callback`, `/tablet/login`, `/api/push/send`
- Não autenticado + path protegido → `/login` (ou `/tablet/login` se path começa com `/tablet`)
- Autenticado com `user_metadata.onboarding = true` → forçado para `/cadastro` até completar
- Autenticado + path de auth → `/perfil`

**Auth callback** (`src/app/auth/callback/route.ts`): suporta dois fluxos distintos:
- `?code=...` — PKCE (login social, magic link)
- `?token_hash=...&type=recovery` — OTP recovery (reset de password via `resetPasswordForEmail`) → redireciona para `/nova-senha`
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
  → Server Action: gerar_qr_token() RPC → token válido 60s
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
    → Retorna nome, foto, faixa, aula
  → Tablet exibe confirmação verde 3s

Aluno recebe confirmação via polling
  → ecrã verde com check
```

**Regra de bloqueio financeiro:** sem mensalidade = permitir; atrasado <10 dias = permitir; atrasado ≥10 dias = bloquear. Aplica-se a QR, presença manual no tablet e reservas de aulas.

Fluxo manual no tablet (sem QR): pesquisa aluno por nome → selecciona aula disponível (hoje ±2h) → mesmas verificações (financeiro + cooldown).

**Reservas (`/aulas`):** o componente `AulasView` busca lista de alunos bloqueados financeiramente e desabilita o botão de reserva com aviso âmbar.

### 6.5 Cadastro — fluxo multi-step e 3 tipos de perfil

O cadastro aceita 3 tipos de inscrição:
- **Aluno** — conta própria com login, perfil de aluno
- **Responsável** — conta própria com login, sem faixa, gere dependentes
- **Aluno e Responsável** — conta própria com login, tem perfil de aluno E pode ter dependentes

Steps:
1. Email + OTP (via Supabase Auth)
2. Tipo de perfil
3. Dados pessoais + dependentes (se aplicável) + NIF + aceitar contrato

Ao concluir cadastro:
- `user_metadata.onboarding` é limpo → middleware liberta o acesso
- 6 mensalidades geradas automaticamente (mês corrente + 5 seguintes, dia 5, ajustado para segunda-feira se fim-de-semana)
- Email com PDF do contrato enviado em background (fire-and-forget — falha não bloqueia registo)
- Trigger Supabase cria row em `profiles` automaticamente no signup

---

## 7. Base de dados

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Perfil de cada utilizador (aluno, professor, admin, tablet, responsavel) |
| `presencas` | Registo de presença — 1 linha por aula; pode haver 2 no mesmo dia (o índice único por dia foi removido; cooldown de 1h) |
| `qr_tokens` | Tokens temporários de 60s para validar presença |
| `mensalidades` | Mensalidades por aluno (mês referência, vencimento, valor, status) |
| `turmas` | Definição de turmas (dia, hora, recorrência, lotação, categoria, professor) |
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

### Campos chave de `profiles`

```typescript
id: string                // UUID = auth.uid()
nome_completo: string
telefone: string | null
data_nascimento: string | null
perfil: "aluno" | "professor" | "admin" | "tablet" | "responsavel"
faixa: CorFaixa | null
graus: number             // 0–4 graus na faixa actual
categoria: "adulto" | "infantil" | "adulto_infantil"
status: "ativo" | "inativo" | "trancado"
foto_url: string | null   // bucket avatars no Supabase Storage
contacto_emergencia: string | null
iban: string | null
nif: string | null
aulas_manual: number      // contador de presenças importadas manualmente (fichinhas físicas)
sem_login: boolean        // true para dependentes (filhos sem conta de auth)
ocultar_ranking: boolean  // aluno fora do ranking (e do Top 3); muda por server action
grupo_id: string | null   // OBSOLETO — o local vem das modalidades (aluno_modalidades → modalidades.grupo_id)
```

### RPCs (funções Postgres)

| RPC | O que faz |
|-----|-----------|
| `gerar_qr_token()` | Cria token UUID válido 60s na tabela `qr_tokens` |
| `registrar_presenca_por_token(p_token)` | Valida token, verifica financeiro + reserva + cooldown, insere em `presencas` |
| `verificar_bloqueio_financeiro(p_aluno_id)` | Helper que retorna `true` se aluno tem mensalidade atrasada ≥10 dias; usado em QR, presença manual e reservas |
| `limpar_tokens_expirados()` | Remove tokens expirados (manutenção periódica) |
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

ActionResult = { ok: boolean; erro?: string }  // retorno padrão de Server Actions
```

---

## 9. Componentes de domínio

| Componente | Descrição |
|-----------|-----------|
| `FaixaBJJ` | Renderiza imagem `.webp` da faixa com graus (pastas `/img/adulto/` e `/img/infantil/`) |
| `FaixaBelt` | Variante visual alternativa da faixa |
| `GBLogo` | Logo Gracie Barra SVG |
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
| `ContaView` | Minha conta em `/conta` (antiga `PerfilView`): dados, faixa, mensalidades, dependentes, Dashboard (staff); `BottomNav` marca Início também em `/conta` |
| `FeedbackHosts` | `<Toaster>` (sonner, topo) + host do `confirmar()`; montado nos layouts `(app)` e `admin` |

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
// gb-blue, gb-black, gb-gray… continuam como aliases (gb-blue é o vermelho, nome histórico)
```

Utilitários: `pt-header` (40px ou notch + 16px), `pt-safe`, `pb-safe`, `pb-sheet`, `pb-bottom-nav`; `duration-fast`/`duration-base` + `ease-out-expo`; `animar-entrada` / `animar-lista` (entrada de conteúdo). Texto nunca abaixo de 12px (`text-xs`). Avatares de utilizador em `<img>` (URL sobrescrito no upload), logos em `next/image`. O viewport usa `viewportFit: "cover"` e **não bloqueia o zoom** — em ecrãs táteis os campos ficam ≥16px para o iOS não fazer zoom ao focar.

**Theme color PWA:** `#ED1C24` · **Fonte principal:** SF Pro Display (local woff2) + Geist · **Locale:** pt-PT · **Interface:** português europeu · **Código:** inglês · **Mobile-first**

---

## 11. Padrões e convenções

- `createAdminClient()` para queries no dashboard e mutations admin (contorna RLS)
- `Promise.all()` para queries paralelas em Server Components
- `dynamic(() => import(...), { ssr: false })` — **apenas em Client Components** para `@zxing/browser`
- Server Actions retornam `{ ok: boolean; erro?: string }` e chamam `revalidatePath()` após mutations
- Imagens de upload comprimidas para WebP no cliente antes do upload
- Cada rota tem `loading.tsx` com skeleton do formato real (header com o título já conhecido) — rota nova = `loading.tsx` novo
- Navegação interna com `<Link>` (prefetch), não `router.push` em botões
- Plano da Fase 15 em `docs/plano-fluidez-ui.md`
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
| Pódio do feed a notificar duas vezes | O cron `feed_podio` corre todos os dias e é idempotente por mês (`referencia` única). Só manda push quem **insere** o post: se já existia ou o insert dá 23505 (outro pedido ganhou), não há push |
| `proxy.ts` não suportado no Vercel | Usar `middleware.ts` — o Vercel não reconhece `proxy.ts` como middleware Next.js |

---

## 13. Débitos técnicos conhecidos

| Débito | Impacto | Prioridade |
|--------|---------|------------|
| Testes E2E só cobrem 5 fluxos; testes unitários só para a gamificação | Risco em refactors | Média |
| Cadastro sem rollback transaccional | Perfis parciais se mensalidades falharem | Média |
| Uploads de Storage não atómicos | Ficheiros órfãos se DB falhar a seguir | Média |
| Race condition na capacidade de aulas | Exceder lotação com utilizadores simultâneos | Baixa (academia pequena) |
| Componentes com 1000+ linhas | `AlunoEditView.tsx`, `CadastroForm.tsx` — difíceis de manter | Baixa |
| ~36 avisos de lint em código legado | `no-explicit-any`, `set-state-in-effect` e `purity` rebaixadas a aviso em `eslint.config.mjs` — voltar a erro depois de corrigidas | Baixa |

---

## 14. Estado actual das funcionalidades

### ✅ Implementado e em produção

| Fase | Funcionalidade | Notas |
|------|---------------|-------|
| 1 | Auth + Perfil | Login OTP, cadastro, reset de password, perfil completo |
| 2 | QR Code base | Rotas `/presenca`, `/tablet`, `/tablet/login` |
| 3 | Fluxo QR completo | Geração, leitura, polling, confirmação, bloqueio financeiro |
| 4 | Perfil do aluno | Upload de foto, edição de dados, calendário de presenças |
| 5 | Painel admin | CRUD de alunos, filtros, busca, visualizar presenças |
| 6 | Gestão financeira | Mensalidades, status automático, marcar pago/pendente, edição inline, eliminar, editar mês de referência em lote |
| 7 | Turmas e reservas | CRUD turmas, editar horário, excluir aula com reservas, geração de aulas, reservar/cancelar, bloqueio por reserva no QR |
| 8 | Graduações | Registo de promoções, timeline visual, faixas adulto + infantil, elegibilidade automática por requisitos |
| 9 | Dashboard admin | KPIs, gráfico presenças (recharts), alunos ausentes, últimas graduações |
| 10 | Relatórios | Excel/CSV de presenças e financeiro, PDF com logo Gracie Barra, página admin `/admin/relatorios` |
| 11 | Avisos | CRUD admin, publicar/fixar, badge de não lidos |
| 12 | Galeria de fotos | Álbuns, upload múltiplo, lightbox com teclado |
| 13 | Dependentes | 3 tipos de cadastro, QR multi-aluno, pai vê filhos |
| 14 | PWA | Manifest, service worker, splash screens iOS, install prompt, offline |
| — | Tablet melhorado | Câmera frontal/traseira toggle, presença manual sem QR, batch manual entry |
| — | Importação histórica | Admin selecciona dias em calendário para importar presenças antigas |
| — | Frequência semanal | Painel de semanas com 0/1/2/3+ treinos no perfil admin do aluno |
| — | Categoria adulto_infantil | Alunos que treinam nos dois grupos vêem turmas de ambas as categorias |
| — | Email de contrato | Enviado automaticamente no cadastro (fire-and-forget) |
| — | Auth guard nas actions | `requireAdmin()` / `requireTablet()` em todas as Server Actions |
| — | Histórico filtro pessoa | Alunos filtram histórico de presenças por pessoa (self ou dependentes) |
| — | Monitorização erros | Sentry (`@sentry/nextjs`) integrado, mapeamento de source maps em Vercel |
| 16 | **Notificações push + WhatsApp** | Web Push via `web-push` + VAPID keys; tabelas `push_subscriptions` e `notificacoes_graduacao_enviadas`; Vercel Cron 09:00 mensalidades+graduações, 08:00 responsáveis; push de aviso fire-and-forget em `avisos-actions.ts`; o push de mensalidade (vence amanhã/hoje/atraso) abre `/conta`, onde Mensalidades começa aberta se houver alguma por pagar; botão WhatsApp em `/conta` › Mensalidades quando mensalidade atrasada |
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

| 18 | **Feed da academia (PR 1)** | `/perfil` é o Início com pílulas Feed · Ranking · Conquistas · Galeria; `/conta` = Minha conta. Staff publica/edita/apaga (texto + até 10 fotos); aluno/responsável/professor põem gosto e comentam. Tabelas `feed_*` + bucket `feed` (migrações `20261026120000_feed.sql` e `20261027120000_feed_jpeg.sql`, já aplicadas em produção). Push: novo post → alunos/responsáveis/professores activos (menos o autor); comentário → só o autor do post; gostos não notificam. Regras puras em `src/lib/feed.ts` (testadas); loaders partilhados `dados.ts` em ranking/conquistas/galeria. Desvio ao spec §5.2: sem linha "Notificações" em Minha conta (não existe toggle de push); a linha "Modo escuro" vem no PR 3 |
| 18 | **Feed (PR 2) — posts automáticos** | Autor "Gracie Barra Famalicão" (`autor_id` null); staff pode editá-los e juntar fotos. **Graduação**: `registrarGraduacao` publica "X recebeu a faixa Y." só com faixa nova (não só graus nem o primeiro registo), aluno visível no ranking e `data_graduacao` entre hoje e 7 dias atrás (Lisboa); nome como no ranking; sem push; `excluirGraduacao` apaga o post e as fotos. **Pódio**: cron diário `type=feed_podio` publica o Top 3 Adultos e Kids do mês anterior (regras do `/ranking`, mínimo 4 aulas, desde 2026-10 → o primeiro sai a 1 de novembro) com push a alunos, responsáveis e professores activos. Regras em `src/lib/feed-automatico.ts` (testadas), gravação em `src/lib/feed-servidor.ts`, cartões `PostGraduacao`/`PostPodio`. Migração `20261028120000_feed_dados.sql` (coluna `dados`) já aplicada |

### ❌ Por implementar

| Fase | Funcionalidade | Prioridade |
|------|---------------|------------|
| 18 | **Modo escuro** — PR 3 do mesmo spec; traz a linha "Modo escuro" em Minha conta | Baixa |
| 18 | **Vídeo no feed via Bunny Stream** — decisão do dono; o feed arranca só com fotos (spec §3) | Baixa |
| 15 | **UI/UX Polishing** — feito (PRs #61–#63): tokens, safe areas, zoom, skeletons, barra inferior, toasts, diálogos/confirmações, UI optimista, micro-interacções, cores/tipografia consistentes. Opcional: Barlow Condensed nos números (`docs/plano-fluidez-ui.md`) | — |

---

## 15. Roadmap de produto — visão estratégica

O produto evolui em 3 horizontes. Cada horizonte só começa depois do anterior estar estável.

### Horizonte 1 — Estabilização Famalicão *(actual)*
Consolidar o produto para a academia actual antes de qualquer expansão.

**Pendente:**
- ✅ Fase 10: Relatórios (Excel + PDF) — implementado
- ✅ Testes E2E nos fluxos críticos (QR, cadastro, marcação de pago) — implementado
- ✅ Logging com Sentry (free tier) — implementado (falta configurar DSN em Vercel)
- ✅ Notificações push (Fase 16) — implementado; fixes de professores e dependentes aplicados
- UI Polishing (Fase 15) — por implementar

### Horizonte 2 — Rede Gracie Barra *(multi-tenant, mesma marca)*
Expandir para outras unidades da Gracie Barra, cada uma com a sua configuração local.

**O que muda tecnicamente:**
- Adicionar `academia_id UUID` a todas as 12 tabelas
- Reescrever RLS policies para filtrar por academia
- Nova tabela `academias` (nome, cidade, logo, cores, WhatsApp, email, preços, contrato PDF)
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
| "Gracie Barra Famalicão" | `layout.tsx`, `InstallPrompt.tsx`, `login/page.tsx`, `cadastro/CadastroForm.tsx` (múltiplos) |
| `graciebarrafamalicao@gmail.com` | `src/lib/send-contract-email.ts` |
| PDF do contrato URL | `src/lib/send-contract-email.ts` |
| Preços (62 €/55 €) | `src/app/cadastro/CadastroForm.tsx` |
| Número WhatsApp da academia | componentes de bloqueio financeiro |
