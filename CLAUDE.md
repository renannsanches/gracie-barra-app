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

```bash
npm run dev      # servidor local em http://localhost:3000
npm run build    # build de produção (verifica tipos TypeScript e lint)
npm run lint     # ESLint

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

**Cron jobs (Vercel):** adicionar `CRON_SECRET=<secret-aleatorio>` nas env vars do Vercel. O `/api/push/send` valida este token no header `Authorization: Bearer …` para aceitar chamadas dos crons configurados em `vercel.json`.

---

## 5. Mapa de rotas

```
/                       → redireciona para /perfil ou /login
/login                  → autenticação (email + OTP)
/cadastro               → onboarding multi-step (3 tipos de perfil)
/esqueci-senha          → pedido de reset de password
/nova-senha             → formulário de nova password
/perfil                 → home do aluno: faixa, mensalidade, dependentes, acções rápidas; admin/professor vêem card de alunos aptos a graduar
/presenca               → gera QR Code (self ou dependentes); polling até confirmação
/presencas              → histórico de presenças com calendário visual e filtro por mês
/aulas                  → vista semanal de aulas disponíveis; reservar/cancelar
/turmas                 → turmas em que o aluno está inscrito
/avisos                 → mural de avisos publicados pela academia
/galeria                → lista de álbuns de fotos
/galeria/[id]           → álbum com lightbox (prev/next, teclado, thumbnails)
/offline                → página de fallback PWA sem rede

/tablet                 → scanner QR permanente (câmera aberta, frontal por defeito)
/tablet/login           → login exclusivo para conta tablet

/admin                  → dashboard: KPIs, gráfico, alunos ausentes, últimas graduações
/admin/alunos           → lista de alunos com filtros e pesquisa
/admin/alunos/novo      → formulário de novo aluno
/admin/alunos/[id]      → ficha completa: dados, fotos, mensalidades, presenças, graduações, dependentes
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
  → Server Action: registrar_presenca_por_token(token)
    → RPC verifica: token válido? não expirado?
    → RPC verifica: bloqueio financeiro? (helper verificar_bloqueio_financeiro — bloqueia se atrasado ≥10 dias)
    → RPC verifica: reserva confirmada para hoje? (bloqueia se não reservou)
    → RPC verifica: cooldown 30min? (bloqueia re-entrada)
    → Insere em presencas (índice único por aluno+data)
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
| `presencas` | Registo de presença (1 por aluno por dia, índice único) |
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
```

### RPCs (funções Postgres)

| RPC | O que faz |
|-----|-----------|
| `gerar_qr_token()` | Cria token UUID válido 60s na tabela `qr_tokens` |
| `registrar_presenca_por_token(p_token)` | Valida token, verifica financeiro + reserva + cooldown, insere em `presencas` |
| `verificar_bloqueio_financeiro(p_aluno_id)` | Helper que retorna `true` se aluno tem mensalidade atrasada ≥10 dias; usado em QR, presença manual e reservas |
| `limpar_tokens_expirados()` | Remove tokens expirados (manutenção periódica) |

### Storage (Supabase)

| Bucket | Uso |
|--------|-----|
| `avatars` | Fotos de perfil dos alunos |
| `galeria` | Fotos dos álbuns |
| `Contrato` | PDF do contrato de prestação de serviços |

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

---

## 10. Cores e design

```javascript
// tailwind.config.ts — prefixo gb-
gb: {
  blue:         "#CC0000",   // Vermelho GB (nome histórico mantido)
  "blue-dark":  "#990000",
  "blue-light": "#E31E24",
  black:        "#0A0A0A",
  white:        "#FFFFFF",
  gray:         "#F5F5F5",   // Background padrão
  "gray-dark":  "#6B7280",
}
```

**Theme color PWA:** `#ED1C24` · **Fonte principal:** SF Pro Display (local woff2) + Geist · **Locale:** pt-PT · **Interface:** português europeu · **Código:** inglês · **Mobile-first**

---

## 11. Padrões e convenções

- `createAdminClient()` para queries no dashboard e mutations admin (contorna RLS)
- `Promise.all()` para queries paralelas em Server Components
- `dynamic(() => import(...), { ssr: false })` — **apenas em Client Components** para `@zxing/browser`
- Server Actions retornam `{ ok: boolean; erro?: string }` e chamam `revalidatePath()` após mutations
- Imagens de upload comprimidas para WebP no cliente antes do upload
- `window.confirm()` para confirmações destrutivas (débito UX a resolver na Fase 15)
- Sem sistema de toasts — feedback inline nos componentes (débito UX a resolver na Fase 15)

---

## 12. Regras críticas aprendidas em produção

| Problema | Solução |
|----------|---------|
| Queries admin retornam vazio | Usar `createAdminClient()` — RLS bloqueia com anon key |
| Câmera não funciona no tablet | HTTPS obrigatório; HTTP bloqueia API de câmera |
| `@zxing/browser` quebra SSR | `dynamic(..., { ssr: false })` só em Client Components |
| `pgcrypto` indisponível | Habilitar extensão explicitamente no Supabase |
| UIDs em SQL sem aspas | Sempre aspas simples corretas nos UUIDs |
| Middleware redireciona actions | Detectar header `next-action` antes de redirecionar |
| Perfil incompleto bypassa onboarding | Usar `user_metadata.onboarding` (não query ao DB — zero round-trips) |
| Enum `responsavel` em falta no DB | Adicionar ao enum Postgres antes de usar no código |
| Índice único em `aulas` incompleto | Incluir `horario` — mesmo dia com horas diferentes gerava conflito |
| Link de reset de password vai para `/login?erro=confirmacao` | `resetPasswordForEmail` usa fluxo OTP (`token_hash+type=recovery`), não PKCE — o callback tem de tratar ambos os casos com `verifyOtp` |
| Push de mensalidade não chega a dependentes | Dependentes (`sem_login=true`) não têm push subscription própria — buscar na tabela `dependentes` e substituir pelos IDs dos responsáveis antes de consultar `push_subscriptions` |
| `/api/push/send` bloqueada pelo middleware | Adicionar à lista de paths públicos — é chamada pelo Vercel Cron sem sessão de utilizador |
| `proxy.ts` não suportado no Vercel | Usar `middleware.ts` — o Vercel não reconhece `proxy.ts` como middleware Next.js |

---

## 13. Débitos técnicos conhecidos

| Débito | Impacto | Prioridade |
|--------|---------|------------|
| Testes E2E só cobrem 3 fluxos — sem testes unitários | Risco em refactors | Média |
| Cadastro sem rollback transaccional | Perfis parciais se mensalidades falharem | Média |
| Uploads de Storage não atómicos | Ficheiros órfãos se DB falhar a seguir | Média |
| Race condition na capacidade de aulas | Exceder lotação com utilizadores simultâneos | Baixa (academia pequena) |
| Componentes com 1000+ linhas | `AlunoEditView.tsx`, `CadastroForm.tsx` — difíceis de manter | Baixa |
| `window.confirm()` e banners inline | UX inconsistente (a resolver Fase 15) | Baixa |

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
| 16 | **Notificações push + WhatsApp** | Web Push via `web-push` + VAPID keys; tabelas `push_subscriptions` e `notificacoes_graduacao_enviadas`; Vercel Cron 09:00 mensalidades+graduações, 08:00 responsáveis; push de aviso fire-and-forget em `avisos-actions.ts`; botão WhatsApp em `/perfil` quando mensalidade atrasada |
| — | **Bloqueio financeiro em reservas** | Mensalidade atrasada ≥10 dias bloqueia QR, presença manual e reservas de aulas; helper RPC `verificar_bloqueio_financeiro`; `AulasView` mostra botão desabilitado com aviso âmbar |
| — | **Card "aptos a graduar" em /perfil** | Admin e professor vêem na sua página `/perfil` um card com alunos que cumprem requisitos de graduação |
| — | **Email no card do aluno** | `AlunoEditView` mostra campo email (read-only) buscado via `admin.getUserById`; ocultado para dependentes (`sem_login=true`) |
| — | **Push para dependentes via responsável** | `push-sender` faz lookup em `dependentes` para substituir IDs de dependentes pelos dos responsáveis antes de buscar subscriptions |
| — | **Push de avisos inclui professores** | Notificações de avisos publicados enviadas a alunos E professores |

### ❌ Por implementar

| Fase | Funcionalidade | Prioridade |
|------|---------------|------------|
| 15 | **UI/UX Polishing** — toast system, modais, skeletons, micro-interacções | — |
| 17 | **Gamificação** — ranking de presenças, streaks, badges | — |

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
