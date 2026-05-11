# CLAUDE.md

Este ficheiro orienta o Claude Code ao trabalhar com este repositório.

## Visão geral

App de gestão de presença para academia de Jiu-Jitsu **Gracie Barra**, com três experiências distintas:

1. **App do aluno** — login, perfil com faixa/graus, gerar QR Code de presença, histórico, avisos, turmas, aulas, galeria
2. **App do tablet** — roda na academia com câmera aberta lendo QR Codes (`/tablet`)
3. **Painel admin/professor** — dashboard, CRUD de alunos, faixas/graus, turmas, avisos, galeria (`/admin`)

---

## Comandos

```bash
npm run dev      # servidor local em http://localhost:3000
npm run build    # build de produção (detecta erros de tipo e lint)
npm run lint     # ESLint
```

Não há testes automatizados no projeto.

---

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS** + shadcn/ui
- **Supabase** (Postgres + Auth + Storage + RLS)
- `qrcode` — gera QR Code no cliente
- `@zxing/browser` — lê QR Code via câmera (carregado com `import()` dinâmico + `ssr: false` em Client Components)
- `recharts` — gráfico de barras no dashboard admin
- `next-pwa` — service worker, manifest, suporte PWA
- Deploy: **Vercel**

---

## Variáveis de ambiente

```
NEXT_PUBLIC_SUPABASE_URL=https://fjqiyilzxxyoyposqsfz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_3wPqhs8SFm2_dvKrH_99Jw_8Nt2tIVR
SUPABASE_SERVICE_ROLE_KEY=<somente em .env.local, nunca expor ao cliente>
```

---

## Arquitetura

### Clientes Supabase (três variantes)

| Ficheiro | Uso |
|---|---|
| `src/lib/supabase/client.ts` | `createBrowserClient` — Client Components (`"use client"`) |
| `src/lib/supabase/server.ts` | `createServerClient` — Server Components e Server Actions (anon key, respeita RLS) |
| `src/lib/supabase/admin.ts` | `createClient` com `service_role` key — **apenas server-side**, ignora RLS; mutations admin e queries de dashboard |

### Autenticação e rotas protegidas

O middleware (`src/middleware.ts`) delega para `src/lib/supabase/middleware.ts` que:
- Redireciona não autenticados para `/login` (ou `/tablet/login` se path começa com `/tablet`)
- Paths públicos: `/login`, `/cadastro`, `/tablet/login`, `/esqueci-senha`, `/nova-senha`
- Autenticados em `/login` ou `/cadastro` são redirecionados para `/perfil`

O layout `src/app/admin/layout.tsx` verifica adicionalmente `profile.perfil === "admin" | "professor"`, redirecionando outros para `/perfil`.

Acesso ao tablet exige `profile.perfil === "tablet"`.

### Padrão de página (Server Component + View/Form)

Pages (`page.tsx`) são Server Components que buscam dados e os passam para componentes client (`*View.tsx`, `*Form.tsx`). Server Actions ficam em arquivos separados `*-actions.ts` com diretiva `"use server"`.

Server Actions retornam `{ ok: boolean; erro?: string; ... }` e chamam `revalidatePath()` após mutations.

Mutations admin usam `createAdminClient()` (service_role) para contornar RLS. Verificação do utilizador corrente usa `createClient()` (server) em paralelo.

### Fluxo de presença via QR Code

1. Aluno (opcionalmente com dependentes) chama RPC `gerar_qr_token()` → retorna `{ token, expira_em }` (60s de validade)
2. Se o aluno tiver dependentes, um modal "Registar para quem?" aparece antes — o QR pode conter array de IDs
3. App do aluno renderiza o QR e faz polling na tabela `presencas` a cada 2,5s para detectar registo
4. Tablet usa `@zxing/browser` para leitura contínua da câmera e chama RPC `registrar_presenca_por_token(p_token)`
5. Tablet exibe tela de confirmação com nome, foto e faixa do aluno após registo bem-sucedido
6. Presença única por aluno por dia garantida por índice único na tabela `presencas`
7. Bloqueio de re-registo: verifica se existe presença nas últimas 1h (via RPC)
8. **Bloqueio financeiro:** RPC verifica `data_vencimento_mensalidade` — rejeita QR se mensalidade vencida, retornando mensagem específica

### Banco de dados

**Tabelas:**
- `profiles` — dados do utilizador (faixa, graus, categoria, status, foto_url, mensalidade, etc.)
- `presencas` — registo diário de presenças (`aluno_id`, `dia_registro`)
- `qr_tokens` — tokens temporários de 60s para presença
- `avisos` — comunicados da academia (fixado, publicado)
- `albuns` / `fotos` — galeria de fotos (bucket `galeria` no Storage)
- `historico_graduacoes` — log de promoções de faixa/grau
- `mensalidades` — controlo financeiro por aluno/mês
- `turmas` — configuração de turmas recorrentes
- `aulas` — instâncias concretas de aulas (geradas a partir de turmas)
- `reservas` — inscrições de alunos em aulas
- `dependentes` — relação pai (responsavel_id) → filho (dependente_id)

**RPCs:**
- `gerar_qr_token()` — gera token temporário de 60s
- `registrar_presenca_por_token(p_token)` — valida token, verifica situação financeira, regista presença (suporta array de aluno_ids para dependentes)
- `limpar_tokens_expirados()` — manutenção periódica

Trigger no Supabase cria `profile` automaticamente no signup.

**Tipos TypeScript:** `src/lib/types.ts`
- `PerfilUsuario`: `"aluno" | "professor" | "admin" | "tablet"`
- `StatusAluno`: `"ativo" | "inativo" | "trancado"`
- `StatusMensalidade`: `"pendente" | "pago" | "atrasado"`
- `RecorrenciaTurma`: `"semanal" | "quinzenal" | "mensal" | "diario" | "personalizado"`
- `StatusAula`: `"agendada" | "cancelada" | "concluida"`
- `StatusReserva`: `"confirmada" | "cancelada" | "presente"`
- `CategoriaFaixa`: `"adulto" | "infantil"`
- `CorFaixa`: enum completo incluindo faixas infantis (cinza/branca, amarela, laranja, verde, etc.)
- Interfaces: `Profile`, `Mensalidade`, `Turma`, `Aula`, `Reserva`, `Aviso`, `Album`, `Foto`, `HistoricoGraduacao`, `DependentePerfil`, `Dependente`

### Utilitários (`src/lib/utils.ts`)

Funções de formatação: `mascararTelefonePT`, `formatarTelefonePT`, `formatarMoeda` (euros €), `formatarMes`, `formatarData`, `labelCorFaixa`.

### Cores e design

Variáveis Tailwind customizadas (prefixo `gb-`):
- `gb-blue` → `#CC0000` (vermelho Gracie Barra — o nome é histórico)
- `gb-blue-dark` → `#990000`
- `gb-black` → `#0A0A0A`
- `gb-gray` → `#F5F5F5` (background padrão)

Fonte: Inter (local) + Geist (Google). Interface em pt-PT. Código React em inglês. Mobile-first.

---

## Mapa completo de ecrãs e rotas

### App do aluno (autenticado)

| Rota | Ficheiro principal | Descrição |
|---|---|---|
| `/` | `src/app/page.tsx` | Redirect para `/perfil` |
| `/login` | `src/app/login/page.tsx` + `LoginForm.tsx` | Login com email/password. Redireciona para `/perfil` se autenticado. Link para cadastro e recuperação de senha. |
| `/cadastro` | `src/app/cadastro/page.tsx` + `CadastroForm.tsx` | Registo de novo aluno. Server action `cadastro-actions.ts`. Cria conta Supabase Auth + profile. |
| `/esqueci-senha` | `src/app/esqueci-senha/page.tsx` + `EsqueciSenhaForm.tsx` | Solicita email para recuperação de senha. |
| `/nova-senha` | `src/app/nova-senha/page.tsx` + `NovaSenhaForm.tsx` | Define nova senha após link de recuperação. |
| `/auth/callback` | `src/app/auth/callback/route.ts` | Route handler para callback OAuth/magic link do Supabase. |
| `/perfil` | `src/app/perfil/page.tsx` + `PerfilView.tsx` | Perfil completo do aluno. Secções em accordion: **Faixa atual** (FaixaBJJ visual + graus + timeline de graduações), **Dados pessoais** (editável: nome, telefone, data nascimento; upload de foto com compressão WebP), **Mensalidades** (histórico de pagamentos com status colorido), **Dependentes** (gestão de filhos: ver faixa, upload foto, abrir modal de detalhe). Cards de atalho: Registar Presença, Histórico, Aulas, Avisos (badge não lidos), Galeria, Dependentes. Estatísticas: total de aulas, aulas no mês, último treino. Banner financeiro se mensalidade vencida. |
| `/presenca` | `src/app/presenca/page.tsx` + `PresencaView.tsx` | Geração de QR Code de presença. Modal pré-QR "Registar para quem?" se o aluno tiver dependentes. QR com countdown de 60s. Polling a cada 2,5s para detectar registo. Tela verde de confirmação. Bloqueia se cooldown de 1h activo. |
| `/presencas` | `src/app/presencas/page.tsx` + `PresencasView.tsx` | Histórico de presenças do aluno. Calendário visual (`PresencasCalendario.tsx`) com dias de treino marcados. Filtro por mês. Resumo mensal (total de presenças no mês). |
| `/aulas` | `src/app/aulas/page.tsx` + `AulasView.tsx` | Vista semanal de aulas. Tabs por dia da semana. Vagas em tempo real. Botão reservar/cancelar reserva. Ações via `aulas-actions.ts`. Bloqueio se mensalidade vencida. |
| `/turmas` | `src/app/turmas/page.tsx` + `TurmasAlunoView.tsx` | Lista de turmas disponíveis para o aluno. Ações via `turmas-actions.ts`. |
| `/avisos` | `src/app/avisos/page.tsx` | Lista de avisos publicados. Cards com título, conteúdo, data formatada. Badge "Fixado". Marca timestamp de leitura em localStorage (via `AvisosMarkRead.tsx`). |
| `/galeria` | `src/app/galeria/page.tsx` | Grid de álbuns de fotos com capa e contagem. |
| `/galeria/[id]` | `src/app/galeria/[id]/page.tsx` + `GaleriaAlbumView.tsx` | Fotos de um álbum em grid. Lightbox com navegação prev/next. |
| `/offline` | `src/app/offline/page.tsx` | Página exibida pelo service worker quando sem conexão (PWA). |

### App do tablet

| Rota | Ficheiro principal | Descrição |
|---|---|---|
| `/tablet/login` | `src/app/tablet/login/page.tsx` + `TabletLoginForm.tsx` | Login específico para tablet. Apenas perfil `"tablet"` passa. |
| `/tablet` | `src/app/tablet/page.tsx` + `TabletScannerWrapper.tsx` + `TabletScanner.tsx` | Câmera aberta lendo QR Codes continuamente via `@zxing/browser`. Ao ler: chama RPC `registrar_presenca_por_token`. Exibe tela de confirmação verde com nome, foto e faixa do aluno. Exibe erro específico se mensalidade vencida ou token inválido. Wrapper usa `dynamic(..., { ssr: false })`. |

### Painel admin (`/admin`)

| Rota | Ficheiro principal | Descrição |
|---|---|---|
| `/admin` | `src/app/admin/page.tsx` + `PresencasChart.tsx` | **Dashboard.** Cards: total alunos (ativos/inativos/trancados), presenças do mês, frequência média/aluno, mensalidades atrasadas (só admin). Situação financeira: em dia / vence em 7 dias / atrasado (só admin). Gráfico de barras recharts com toggle semanas/meses. Secção "Alunos que sumiram" (sem presença 30+ dias). Últimas 5 graduações. Presenças recentes. Queries paralelas com `Promise.all()` via `createAdminClient()`. |
| `/admin/alunos` | `src/app/admin/alunos/page.tsx` + `AlunosView.tsx` | Lista paginada de alunos. Filtros: status, faixa, categoria. Busca por nome. Badge colorido de status. Link para perfil. |
| `/admin/alunos/novo` | `src/app/admin/alunos/novo/page.tsx` + `NovoAlunoForm.tsx` | Criar novo aluno (nome, email, telefone, faixa, graus, categoria, data nascimento, status). Cria conta Supabase Auth via API route `api/admin/delete-user`. |
| `/admin/alunos/[id]` | `src/app/admin/alunos/[id]/page.tsx` + `AlunoEditView.tsx` | Perfil completo do aluno no admin. Edição de todos os campos. Upload de foto. Modal de **graduação** (nova faixa, graus, observações) → `graduacao-actions.ts`. Gestão de **dependentes** → `dependentes-actions.ts`. Gestão de **mensalidades** → `mensalidades-actions.ts`. Histórico de presenças. Botão inativar/activar. |
| `/admin/turmas` | `src/app/admin/turmas/page.tsx` + `TurmasView.tsx` | Lista de turmas com horário, dia, professor, vagas. Activar/desactivar. |
| `/admin/turmas/nova` | `src/app/admin/turmas/nova/page.tsx` + `NovaTurmaForm.tsx` | Criar turma (nome, dia semana, horário, recorrência, lotação, categoria, professor). |
| `/admin/turmas/[id]` | `src/app/admin/turmas/[id]/page.tsx` + `TurmaEditView.tsx` | Editar turma. Gerar aulas (semanal, diária seg-sex, quinzenal, mensal, avulsa). Gerir reservas por aula. Ações via `turma-actions.ts`. |
| `/admin/financeiro` | `src/app/admin/financeiro/page.tsx` + `FinanceiroView.tsx` | Controlo de mensalidades de todos os alunos. Filtros por aluno, mês, status. Marcar pago/pendente. |
| `/admin/avisos` | `src/app/admin/avisos/page.tsx` + `AvisosView.tsx` | CRUD de avisos. Criar, editar, fixar, publicar/despublicar, apagar. Ações via `avisos-actions.ts`. |
| `/admin/albuns` | `src/app/admin/albuns/page.tsx` + `AlbunsView.tsx` | CRUD de álbuns de fotos. Criar álbum, editar título/descrição, apagar. Ações via `albuns-actions.ts`. |
| `/admin/albuns/[id]/fotos` | `src/app/admin/albuns/[id]/fotos/page.tsx` + `FotosView.tsx` | Upload múltiplo de fotos para um álbum (bucket `galeria`). Selecionar capa. Apagar fotos. Ações via `fotos-actions.ts`. |

### API Routes

| Rota | Descrição |
|---|---|
| `src/app/api/admin/delete-user/route.ts` | Elimina conta Supabase Auth de aluno (usa service_role). Chamado ao inativar/apagar aluno no admin. |

---

## Componentes partilhados (`src/components/`)

| Componente | Descrição |
|---|---|
| `FaixaBJJ.tsx` | Renderiza faixa BJJ visualmente com imagens `.webp` das pastas `/public/img/adulto/` e `/public/img/infantil/`. Props: `faixa`, `graus`, `categoria`, `tamanho`. Exporta também `inferCategoria()`. Mapeamento: enum `CorFaixa` → nome de ficheiro (ex: `roxa` → `roxo.webp`). |
| `FaixaBelt.tsx` | Versão alternativa de visualização de faixa (formato cinto horizontal). |
| `GBLogo.tsx` | Logo Gracie Barra em SVG. |
| `InstallPrompt.tsx` | Banner discreto de instalação PWA. Respeita localStorage para não repetir. Client Component. |
| `ServiceWorkerUpdater.tsx` | Detecta novo service worker disponível e exibe prompt de atualização. Client Component. |
| `PresencasCalendario.tsx` | Calendário mensal visual marcando dias com presença. Usado em `/presencas`. |
| `AvisosMarkRead.tsx` | Regista timestamp de leitura dos avisos em localStorage. |

### shadcn/ui primitivos (`src/components/ui/`)
`badge.tsx`, `button.tsx`, `card.tsx`, `input.tsx`, `label.tsx`, `input-otp.tsx`

---

## Server Actions (`*-actions.ts`)

| Ficheiro | Actions |
|---|---|
| `login/auth-actions.ts` | `loginAction`, `logoutAction` |
| `cadastro/cadastro-actions.ts` | `cadastrarAction` |
| `esqueci-senha/esqueci-senha-actions.ts` | `esqueciSenhaAction` |
| `nova-senha/nova-senha-actions.ts` | `novaSenhaAction` |
| `aulas/aulas-actions.ts` | `reservarAula`, `cancelarReserva` |
| `turmas/turmas-actions.ts` | Ações do aluno em turmas |
| `perfil/dependente-foto-actions.ts` | `atualizarFotoDependente` |
| `admin/alunos/[id]/graduacao-actions.ts` | `registrarGraduacao` |
| `admin/alunos/[id]/mensalidades-actions.ts` | `marcarPago`, `marcarPendente`, `criarMensalidade` |
| `admin/alunos/[id]/dependentes-actions.ts` | `adicionarDependente`, `removerDependente` |
| `admin/alunos/[id]/foto-actions.ts` | `atualizarFotoAluno` |
| `admin/turmas/[id]/turma-actions.ts` | `atualizarTurma`, `gerarAulas`, `atualizarReserva` |
| `admin/avisos/avisos-actions.ts` | `criarAviso`, `editarAviso`, `apagarAviso`, `toggleFixado`, `togglePublicado` |
| `admin/albuns/albuns-actions.ts` | `criarAlbum`, `editarAlbum`, `apagarAlbum` |
| `admin/albuns/[id]/fotos/fotos-actions.ts` | `uploadFotos`, `apagarFoto`, `definirCapa` |

---

## Sidebar do admin (`AdminSidebar.tsx`)

Links disponíveis no painel admin:
- Dashboard (`/admin`)
- Alunos (`/admin/alunos`)
- Turmas (`/admin/turmas`)
- Financeiro (`/admin/financeiro`)
- Avisos (`/admin/avisos`)
- Galeria (`/admin/albuns`)

---

## Padrões de desenvolvimento

- Admin dashboard usa `createAdminClient()` diretamente no Server Component para queries batch paralelas com `Promise.all()`
- `import()` dinâmico com `ssr: false` **apenas em Client Components**, nunca em Server Components
- A `service_role` key nunca deve aparecer em código client-side nem ser commitada
- Locale: **pt-PT** (Portugal) — moeda em euros (€), telefone com prefixo +351, datas em formato pt-PT
- shadcn/ui primitivos em `src/components/ui/`
- Fotos de perfil: comprimidas para WebP (max 500px) antes do upload para bucket `avatars`

---

## Regras críticas (aprendidas em produção)

| Problema | Solução |
|---|---|
| Queries admin retornando vazio | Usar `createAdminClient()` (service_role), não o client de sessão — RLS bloqueia |
| Câmera não funciona no tablet | HTTPS obrigatório — HTTP bloqueia acesso à câmera |
| `@zxing/browser` quebrando SSR | `dynamic(() => import(...), { ssr: false })` apenas em Client Components |
| `pgcrypto` não disponível | Extensão deve ser habilitada explicitamente no Supabase |
| UIDs do Supabase em SQL | Requerem aspas simples corretas — verificar quoting |
| Faixa `roxa` no FaixaBJJ | Ficheiro de imagem chama-se `roxo.webp`, não `roxa.webp` |
| Recorrência diária de turmas | Gera apenas seg-sex, não sábado/domingo |

---

## Roadmap de fases

### ✅ Concluídas (Fases 1–14)

| Fase | Descrição resumida |
|---|---|
| 1 | Auth + Perfil: login, cadastro, redirecionamentos, perfil básico |
| 2 | QR Code presença (base): rotas `/presenca`, `/tablet`, `/tablet/login` |
| 3 | Fluxo QR completo: cooldown 1h, polling, tela confirmação, foto no tablet |
| 4 | Perfil completo: upload foto, edição dados, histórico presenças, calendário |
| 5 | Painel admin: CRUD alunos, filtros, busca, visualizar presenças |
| 6 | Gestão financeira: `mensalidades`, status automático, `/admin/financeiro` |
| 7 | Turmas e reservas: `turmas`, `aulas`, `reservas`, vista semanal, CRUD admin, bloqueio financeiro no QR |
| 8 | Graduações: modal de promoção, `historico_graduacoes`, timeline visual, FaixaBJJ com imagens .webp |
| 9 | Dashboard admin: cards resumo, gráfico recharts, alunos sumidos, últimas graduações, situação financeira |
| 10 | ⚠️ **PENDENTE** — Relatórios (Excel/CSV + PDF) — não implementado ainda |
| 11 | Avisos: CRUD admin, página aluno, badge não lidos, fixar/publicar |
| 12 | Galeria: CRUD álbuns, upload múltiplo, lightbox, seleção de capa |
| 13 | Dependentes: tabela `dependentes`, modal "Registar para quem?", QR multi-ID, filho sem login |
| 14 | PWA: manifest, service worker NetworkFirst/CacheFirst, `/offline`, prompt instalação, splash iOS |

### 🔄 Próximas

**Fase 10 — Relatórios** *(pendente — implementar antes de avançar)*
- Página `/admin/relatorios`, seleção de mês
- Bloco 1: exportação Excel/CSV
- Bloco 2: geração PDF com logo

**Fase 15 — UI/UX Polishing**
- Redesign completo (perfil com accordion, hero alinhado à esquerda, grid de ações 2 colunas, "Registrar Presença" fullwidth)
- Revisão das restantes páginas
- Animações, micro-interações, acessibilidade

**Fase 16 — Notificações push**
- Web Push API + Supabase Edge Functions + cron jobs
- Avisos gerais, lembretes de mensalidade (3 dias antes, no dia, após vencimento), parabéns por graduação

**Fase 17 — Gamificação (bônus)**
- Ranking de presença mensal
- Streak de treinos consecutivos
- Badges ("10 treinos seguidos", "100 presenças total")

---

## Funcionalidades transversais implementadas

### Controle financeiro no QR
- `registrar_presenca_por_token()` verifica `data_vencimento_mensalidade` antes de registar
- Se vencida: rejeita com mensagem `"Autenticação não permitida. Mais informações falar com Simone."` + link WhatsApp
- Reserva de aula também bloqueada se mensalidade vencida

### Modal de pagamento (pendente)
- Botão "Pagar mensalidade" no app do aluno (a implementar)
- Modal com dados MBWay e IBAN da academia
- Solução manual no curto prazo; futuramente Stripe ou EuPago
