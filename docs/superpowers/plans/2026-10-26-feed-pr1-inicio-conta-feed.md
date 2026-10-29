# Feed — PR 1: Início novo, Minha conta e feed manual — Implementation Plan

> **Estado: implementado — PR #67, em produção desde 2026-10-27.** Mantido como registo; os checkboxes abaixo não foram actualizados.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Professores e admins publicam texto + fotos num feed que abre no Início; alunos e responsáveis dão gosto e comentam; os dados pessoais passam para uma página nova "Minha conta".

**Architecture:** Três tabelas novas (`feed_posts`, `feed_curtidas`, `feed_comentarios`) com RLS ligada e sem políticas — só o servidor lê e escreve, com `createAdminClient()`, como em `conquistas`. Fotos num bucket público `feed`, enviadas por Server Action (como a galeria). O `/perfil` passa a ser uma casca (cabeçalho + pílulas) cujo separador activo vem de `?tab=` e é renderizado no servidor; Ranking, Conquistas e Galeria reutilizam as vistas existentes em modo "embutido".

**Tech Stack:** Next.js 16 App Router (searchParams assíncronos), React 19, Supabase (Postgres + Storage), Tailwind 3, sonner, Radix Dialog, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-26-feed-design.md` (este plano cobre o PR 1 da §11; posts automáticos e modo escuro têm planos próprios depois deste merge).

## Global Constraints

- Ramo `feat/feed-academia` → PR para `master` em `renannsanches/gracie-barra-app` (remote `producao`). Nunca push para `gb-famalicao`.
- A BD de dev/e2e **é a de produção**. Migrações só aditivas. Push só sai com `VERCEL_ENV === "production"` (Task 1) — fazer Task 1 antes de qualquer teste que publique.
- Só tema claro neste PR. Ficheiros **novos** usam tokens semânticos (`bg-canvas`, `bg-surface`, `text-ink`, `text-fg`, `text-fg-muted`, `border-line`, `bg-brand`); nada de `bg-white`/`text-gray-*` em ficheiros novos. Código movido mantém as classes (o PR 3 migra).
- Nada de `oklch()`. Texto ≥ 12px (`text-xs`). Campos de texto ≥ 16px (`text-base`). Interface em português europeu.
- Padrões do `CLAUDE.md`: Server Actions devolvem `{ ok: true, ... } | { ok: false, erro }`; guard como primeira instrução; dados de outras pessoas só via servidor com `createAdminClient()` e só as colunas necessárias; push via `after()` de `next/server`.
- UI: `<Dialog>` de `@/components/ui/dialog` (`variant="sheet"`), `confirmar()` de `@/components/ConfirmDialog`, `toast` do `sonner`. Rota nova = `loading.tsx` novo.
- **Tasks de UI (7, 8, 9, 10): invocar a skill `ui-ux-pro-max` antes de escrever o JSX** (referências visuais na spec §1: cards arredondados 16px, pílulas, contadores ♥/💬 em pílula, grupos de linhas).
- `/tablet` e `/admin` não mudam.
- Limites (spec + decisões aprovadas): comentário 300 caracteres; texto do post 2000; 10 fotos por post; 10 posts por página; fotos WebP lado maior 1600px, qualidade 0.82, ≤ 5 MB.

## Review Focus

1. **Comentário com emojis no limite** — "😀" × 300 tem de ser aceite (JS `.length` dá 600; o Postgres conta 300). Teste em Task 2 (`contarCaracteres`).
2. **Uma foto falha a meio de um post com 8** — nada fica publicado e nenhum ficheiro fica órfão no bucket. Passo de verificação em Task 5.
3. **Duplo toque rápido no coração** — o total nunca fica negativo nem duplica; o segundo toque espera pelo primeiro. Passo em Task 8 (`PostCard`).
4. **Dois posts com o mesmo `criado_em` na fronteira de página** — nenhum repetido nem saltado ao carregar mais. Cursor `(criado_em, id)` em Task 4; teste do cursor em Task 2.
5. **Publicação apagada enquanto alguém tem os comentários abertos** — acção devolve "Esta publicação já não existe." e a UI mostra toast, sem rebentar. Tratado em Task 4, verificado em Task 10.

---

## File Structure

| Ficheiro | Responsabilidade |
|---|---|
| `src/lib/push-ativo.ts` (+ `.test.ts`) | Decide se o push sai (só produção) |
| `src/lib/feed.ts` (+ `.test.ts`) | Tipos, limites, validação, tempo relativo, permissões, cursor, nome curto, caminho no bucket — lógica pura |
| `src/lib/inicio.ts` (+ `.test.ts`) | Separadores do Início (`separadorValido`) |
| `src/lib/comprimir-imagem.ts` | `comprimirParaWebP` (extraído do `PerfilView`) |
| `src/lib/aptos-graduar.ts` | `calcularAptosGraduar` (extraído de `perfil/page.tsx`) |
| `supabase/migrations/20261026120000_feed.sql` | Tabelas, RLS, bucket |
| `src/app/(app)/perfil/feed/dados.ts` | `carregarPaginaFeed` (servidor) |
| `src/app/(app)/perfil/feed/membro-actions.ts` | Gostos, comentários, carregar mais |
| `src/app/(app)/perfil/feed/staff-actions.ts` | Criar / editar / apagar post |
| `src/app/(app)/perfil/feed/*.tsx` | `FeedLista`, `PostCard`, `FotosCarrossel`, `CurtidasSheet`, `ComentariosSheet`, `PostComposer` |
| `src/app/(app)/perfil/page.tsx`, `InicioView.tsx`, `loading.tsx` | Início novo |
| `src/app/(app)/conta/page.tsx`, `ContaView.tsx`, `loading.tsx` | Minha conta |
| `src/app/(app)/{ranking,conquistas,galeria}/dados.ts` | Loaders partilhados entre a rota e o separador |

---

### Task 1: Push só em produção

**Files:**
- Create: `src/lib/push-ativo.ts`, `src/lib/push-ativo.test.ts`
- Modify: `src/lib/push-sender.ts` (`sendToSubscriptions`, linha ~19)

**Interfaces:**
- Produces: `pushAtivo(vercelEnv: string | undefined): boolean`

- [ ] **Step 1: Teste**

```ts
import { describe, it, expect } from "vitest";
import { pushAtivo } from "./push-ativo";

describe("pushAtivo", () => {
  it("só em produção", () => {
    expect(pushAtivo("production")).toBe(true);
    expect(pushAtivo("preview")).toBe(false);
    expect(pushAtivo("development")).toBe(false);
    expect(pushAtivo(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/push-ativo.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar `pushAtivo` (`vercelEnv === "production"`). Em `sendToSubscriptions`, primeira instrução: se `!pushAtivo(process.env.VERCEL_ENV)`, `console.info(\`[push] desligado fora de produção: ${subs.length} envio(s) — "${payload.title}"\`)` e `return`. Vale para todos os pushes existentes.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(push): só envia push em produção (VERCEL_ENV)`.

---

### Task 2: Regras puras do feed

**Files:**
- Create: `src/lib/feed.ts`, `src/lib/feed.test.ts`

**Interfaces:**
- Produces (exportados de `@/lib/feed`):
  - `LIMITE_COMENTARIO = 300`, `LIMITE_TEXTO_POST = 2000`, `LIMITE_FOTOS = 10`, `POSTS_POR_PAGINA = 10`, `BUCKET_FEED = "feed"`
  - `type TipoPost = "manual" | "graduacao" | "podio"`
  - `interface AutorFeed { id: string | null; nome: string; foto: string | null }`
  - `const AUTOR_ACADEMIA: AutorFeed = { id: null, nome: "Gracie Barra Famalicão", foto: "/logo.webp" }`
  - `interface PostFeed { id: string; tipo: TipoPost; texto: string; fotos: string[]; criadoEm: string; editadoEm: string | null; autor: AutorFeed; curtidas: number; curtiEu: boolean; comentarios: number }`
  - `interface PaginaFeed { posts: PostFeed[]; cursor: string | null }` (`cursor` null = não há mais)
  - `interface ComentarioFeed { id: string; texto: string; criadoEm: string; autor: AutorFeed; podeApagar: boolean }`
  - `interface Sessao { userId: string; perfil: PerfilUsuario }`
  - `contarCaracteres(texto: string): number` — conta code points (`[...texto].length`)
  - `validarComentario(texto: string): { ok: true; texto: string } | { ok: false; erro: string }`
  - `validarPost(texto: string, nFotos: number): { ok: true; texto: string } | { ok: false; erro: string }`
  - `tempoRelativo(iso: string, agora: Date): string`
  - `nomeCurto(nomeCompleto: string): string`
  - `eStaff(perfil: PerfilUsuario): boolean`, `podeApagarComentario(s: Sessao, autorComentarioId: string): boolean`, `podeEditarPost(s: Sessao, autorPostId: string | null): boolean`, `podeApagarPost(s: Sessao): boolean`
  - `codificarCursor(criadoEm: string, id: string): string`, `descodificarCursor(c: string): { criadoEm: string; id: string } | null`
  - `caminhoNoBucket(url: string): string | null`

- [ ] **Step 1: Testes** (valores exactos — são a especificação)

```ts
const agora = new Date("2026-10-26T12:00:00Z");

// contarCaracteres / validarComentario
expect(contarCaracteres("😀".repeat(300))).toBe(300);
expect(validarComentario("   ")).toEqual({ ok: false, erro: "Escreve um comentário." });
expect(validarComentario("  olá  ")).toEqual({ ok: true, texto: "olá" });
expect(validarComentario("a".repeat(300)).ok).toBe(true);
expect(validarComentario("😀".repeat(300)).ok).toBe(true);
expect(validarComentario("a".repeat(301))).toEqual({ ok: false, erro: "Máximo de 300 caracteres." });

// validarPost
expect(validarPost("  ", 0)).toEqual({ ok: false, erro: "Escreve um texto ou junta uma foto." });
expect(validarPost("", 1)).toEqual({ ok: true, texto: "" });
expect(validarPost("x", 11)).toEqual({ ok: false, erro: "Máximo de 10 fotos por publicação." });
expect(validarPost("a".repeat(2001), 0)).toEqual({ ok: false, erro: "Máximo de 2000 caracteres." });

// tempoRelativo (dias de calendário em Europe/Lisbon)
expect(tempoRelativo("2026-10-26T11:59:30Z", agora)).toBe("agora");
expect(tempoRelativo("2026-10-26T11:55:00Z", agora)).toBe("há 5 min");
expect(tempoRelativo("2026-10-26T09:00:00Z", agora)).toBe("há 3 h");
expect(tempoRelativo("2026-10-25T10:00:00Z", agora)).toBe("ontem");
expect(tempoRelativo("2026-10-22T12:00:00Z", agora)).toBe("há 4 dias");
expect(tempoRelativo("2026-10-12T12:00:00Z", agora)).toBe("12 out.");
expect(tempoRelativo("2025-12-01T12:00:00Z", agora)).toBe("1 dez. 2025");

// nomeCurto
expect(nomeCurto("Renan Silva Sanches")).toBe("Renan Sanches");
expect(nomeCurto("  Simone  ")).toBe("Simone");

// permissões
const aluno = { userId: "a", perfil: "aluno" } as const;
const resp = { userId: "r", perfil: "responsavel" } as const;
const prof = { userId: "p", perfil: "professor" } as const;
const admin = { userId: "d", perfil: "admin" } as const;
expect(podeApagarComentario(aluno, "a")).toBe(true);
expect(podeApagarComentario(aluno, "b")).toBe(false);
expect(podeApagarComentario(resp, "r")).toBe(true);
expect(podeApagarComentario(prof, "b")).toBe(true);
expect(podeEditarPost(prof, "p")).toBe(true);
expect(podeEditarPost(prof, "d")).toBe(false);
expect(podeEditarPost(admin, null)).toBe(true);   // post automático
expect(podeEditarPost(aluno, "a")).toBe(false);
expect(podeApagarPost(prof)).toBe(true);          // spec §4: staff apaga qualquer post
expect(podeApagarPost(admin)).toBe(true);
expect(podeApagarPost(aluno)).toBe(false);

// cursor
const c = codificarCursor("2026-10-26T12:00:00.123456+00:00", "4f1c…uuid");
expect(descodificarCursor(c)).toEqual({ criadoEm: "2026-10-26T12:00:00.123456+00:00", id: "4f1c…uuid" });
expect(descodificarCursor("lixo")).toBeNull();

// caminhoNoBucket
expect(caminhoNoBucket("https://x.supabase.co/storage/v1/object/public/feed/abc/1.webp")).toBe("abc/1.webp");
expect(caminhoNoBucket("https://x.supabase.co/storage/v1/object/public/galeria/abc/1.webp")).toBeNull();
```

- [ ] **Step 2:** `npx vitest run src/lib/feed.test.ts` → FAIL.
- [ ] **Step 3:** Implementar. `tempoRelativo`: < 60 s "agora"; < 60 min "há N min"; < 24 h "há N h"; depois pela diferença de dias de calendário em Lisboa (obter `YYYY-MM-DD` com `Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" })`): 1 → "ontem", 2–6 → "há N dias", senão `"<dia> <mês>"` com meses `["jan.","fev.","mar.","abr.","mai.","jun.","jul.","ago.","set.","out.","nov.","dez."]` e o ano acrescentado se diferente do de `agora` (não usar Intl para o mês — o formato pt-PT varia). Cursor: `${criadoEm}|${id}` em base64url; `descodificarCursor` devolve null se não descodificar, não tiver 2 partes ou a data for inválida. `caminhoNoBucket`: texto depois de `/object/public/feed/`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(feed): regras puras do feed (validação, tempo, permissões, cursor)`.

---

### Task 3: Migração — tabelas e bucket

**Files:**
- Create: `supabase/migrations/20261026120000_feed.sql`

- [ ] **Step 1: Escrever a migração** (esquema fixado aqui — PR 2 depende de `tipo`/`referencia`)

```sql
-- Feed da academia (spec 2026-10-26). Só o servidor (service_role) lê e escreve:
-- os nomes/fotos de autores e de quem comenta vêm de profiles, que o RLS não deixa
-- o aluno ler — por isso tudo passa pelo admin client, como em conquistas.
CREATE TABLE feed_posts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id    uuid        REFERENCES profiles(id) ON DELETE SET NULL, -- null = academia (posts automáticos)
  tipo        text        NOT NULL DEFAULT 'manual' CHECK (tipo IN ('manual', 'graduacao', 'podio')),
  texto       text        NOT NULL DEFAULT '' CHECK (char_length(texto) <= 2000),
  fotos       text[]      NOT NULL DEFAULT '{}' CHECK (cardinality(fotos) <= 10),
  referencia  text,       -- posts automáticos: id da graduação / mês do pódio
  criado_em   timestamptz NOT NULL DEFAULT now(),
  editado_em  timestamptz,
  UNIQUE (tipo, referencia)
);
CREATE INDEX feed_posts_ordem ON feed_posts (criado_em DESC, id DESC);

CREATE TABLE feed_curtidas (
  post_id   uuid        NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE feed_comentarios (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id   uuid        NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  autor_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  texto     text        NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 300),
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX feed_comentarios_post ON feed_comentarios (post_id, criado_em);

ALTER TABLE feed_posts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_curtidas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_comentarios ENABLE ROW LEVEL SECURITY;
-- Sem policies: só service_role.
REVOKE ALL ON feed_posts, feed_curtidas, feed_comentarios FROM anon;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('feed', 'feed', true, 5242880, ARRAY['image/webp'])
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: Aplicar** com a ferramenta Supabase MCP `apply_migration` (project_id `fjqiyilzxxyoyposqsfz`, name `feed`, query = conteúdo do ficheiro). É a BD de produção — só este SQL aditivo.
- [ ] **Step 3: Verificar** com `execute_sql`:
  `select relname, relrowsecurity from pg_class where relname in ('feed_posts','feed_curtidas','feed_comentarios');` → 3 linhas, todas `true`;
  `select id, public from storage.buckets where id = 'feed';` → `feed | true`.
- [ ] **Step 4:** Commit `feat(feed): tabelas feed_posts, feed_curtidas, feed_comentarios e bucket feed`.

---

### Task 4: Leitura do feed e acções de membro

**Files:**
- Modify: `src/lib/auth-guard.ts` (nova função)
- Create: `src/app/(app)/perfil/feed/dados.ts`, `src/app/(app)/perfil/feed/membro-actions.ts`
- Modify: `src/lib/push-sender.ts` (nova função)

**Interfaces:**
- Consumes: Task 2 (`PostFeed`, `PaginaFeed`, `ComentarioFeed`, `AutorFeed`, `AUTOR_ACADEMIA`, `validarComentario`, `podeApagarComentario`, `nomeCurto`, `codificarCursor`, `descodificarCursor`, `POSTS_POR_PAGINA`, `Sessao`).
- Produces:
  - `requireMembro(): Promise<{ ok: true; userId: string; perfil: PerfilUsuario } | { ok: false; erro: string }>` — sessão + perfil ∈ aluno, responsavel, professor, admin (senão "Sem permissão.").
  - `carregarPaginaFeed(admin: ReturnType<typeof createAdminClient>, userId: string, cursor: string | null): Promise<PaginaFeed>`
  - `membro-actions.ts` ("use server"):
    - `carregarMaisPosts(cursor: string): Promise<{ ok: true; pagina: PaginaFeed } | { ok: false; erro: string }>`
    - `alternarCurtida(postId: string): Promise<{ ok: true; curtiu: boolean; total: number } | { ok: false; erro: string }>`
    - `listarCurtidas(postId: string): Promise<{ ok: true; pessoas: AutorFeed[] } | { ok: false; erro: string }>`
    - `listarComentarios(postId: string): Promise<{ ok: true; comentarios: ComentarioFeed[] } | { ok: false; erro: string }>`
    - `comentar(postId: string, texto: string): Promise<{ ok: true; comentario: ComentarioFeed } | { ok: false; erro: string }>`
    - `apagarComentario(comentarioId: string): Promise<ActionResult>`
  - `sendPushComentario(postId: string, comentadorId: string, texto: string): Promise<void>`

- [ ] **Step 1: `requireMembro`** em `auth-guard.ts`, ao lado de `requireUser`.
- [ ] **Step 2: `carregarPaginaFeed`** em `dados.ts` (só importado por Server Components e Server Actions). Pede `POSTS_POR_PAGINA + 1` posts ordenados `criado_em desc, id desc`; com cursor, filtro keyset:

```ts
.or(`criado_em.lt.${c.criadoEm},and(criado_em.eq.${c.criadoEm},id.lt.${c.id})`)
```

  Depois, em paralelo: `profiles (id, nome_completo, foto_url)` dos `autor_id`; `feed_curtidas (post_id, user_id)` e `feed_comentarios (post_id)` dos ids da página. Autor null → `AUTOR_ACADEMIA`; nome do autor → `nomeCurto`. `cursor` = `codificarCursor` do último post mostrado se veio o 11.º, senão null.
- [ ] **Step 3: Acções** em `membro-actions.ts`, todas com `requireMembro()` primeiro e `createAdminClient()`:
  - Post inexistente em qualquer acção → `{ ok: false, erro: "Esta publicação já não existe." }`.
  - `alternarCurtida`: se a linha existe apaga, senão insere (`upsert` com `ignoreDuplicates: true`); devolve `total` contado depois da escrita (nunca calculado no cliente).
  - `listarCurtidas`: pessoas por ordem de `criado_em`, nome com `nomeCurto`.
  - `listarComentarios`: ordem ascendente; `podeApagar` = `podeApagarComentario(sessao, autor_id)`.
  - `comentar`: `validarComentario` → erro devolvido tal como vem; insert; `after(() => sendPushComentario(postId, userId, texto))`.
  - `apagarComentario`: lê `autor_id`; sem permissão → "Sem permissão."
  - Gostos e comentários **não** chamam `revalidatePath` (estado vive no cliente).
- [ ] **Step 4: `sendPushComentario`** em `push-sender.ts`: lê `autor_id` do post; se null ou igual ao comentador, sai. Payload `{ title: "Novo comentário", body: \`${nomeCurto(nome)}: ${texto}\` (texto cortado a 80 caracteres + "…"), url: "/perfil" }` só para `getSubscriptions([autor_id])`.
- [ ] **Step 5:** `npx tsc --noEmit` e `npm run lint` → 0 erros. (Comportamento verificado pelo e2e da Task 10.)
- [ ] **Step 6:** Commit `feat(feed): leitura paginada, gostos e comentários`.

---

### Task 5: Acções de staff — criar, editar e apagar posts

**Files:**
- Create: `src/app/(app)/perfil/feed/staff-actions.ts`
- Modify: `src/lib/push-sender.ts`

**Interfaces:**
- Consumes: Task 2 (`validarPost`, `podeEditarPost`, `podeApagarPost`, `caminhoNoBucket`, `BUCKET_FEED`), Task 4 (`requireMembro`).
- Produces (`"use server"`):
  - `criarPost(formData: FormData): Promise<ActionResult>` — campos `texto` (string) e `fotos` (File[], `image/webp`, ≤ 5 MB cada)
  - `editarPost(postId: string, formData: FormData): Promise<ActionResult>` — campos `texto`, `manter` (JSON `string[]` de URLs actuais a manter, pela ordem final) e `fotos` (novas, acrescentadas no fim)
  - `apagarPost(postId: string): Promise<ActionResult>`
  - `sendPushNovoPost(autorId: string, texto: string): Promise<void>`

- [ ] **Step 1: `criarPost`** — `requireMembro()` + `eStaff` (senão "Sem permissão."); `validarPost(texto, fotos.length)`; rejeitar ficheiro não-webp ou > 5 MB com "Foto inválida ou demasiado grande."; `postId = crypto.randomUUID()`; enviar cada foto para `feed/${postId}/${i}-${crypto.randomUUID()}.webp`. **Tudo ou nada:** se um upload falhar, remover os já enviados e devolver "Não foi possível enviar as fotos. Tenta outra vez."; se o insert falhar, remover todos. Sucesso: `revalidatePath("/perfil")` e `after(() => sendPushNovoPost(userId, texto))`.
- [ ] **Step 2: `editarPost`** — `podeEditarPost(sessao, autor_id)`; `manter` filtrado para URLs que o post já tem; `validarPost(texto, manter.length + novas.length)`; envia novas (mesma regra tudo-ou-nada); `update` de `texto`, `fotos`, `editado_em = now()`; **só depois** de sucesso remove do bucket as fotos que saíram. `revalidatePath("/perfil")`. Editar não manda push.
- [ ] **Step 3: `apagarPost`** — `podeApagarPost`; apaga a linha (cascata leva gostos e comentários); remove do bucket todas as fotos (`caminhoNoBucket`). `revalidatePath("/perfil")`.
- [ ] **Step 4: `sendPushNovoPost`** — como `sendPushAviso` (perfis activos `aluno`, `responsavel`, `professor`), excluindo o autor. Payload `{ title: "Nova publicação", body: texto cortado a 80 + "…" ou, se vazio, "A academia publicou fotos novas.", url: "/perfil" }`.
- [ ] **Step 5:** `npx tsc --noEmit`, `npm run lint` → 0 erros. (O tudo-ou-nada — Review Focus 2 — é verificado com a UI na Task 10, Step 5.)
- [ ] **Step 6:** Commit `feat(feed): publicar, editar e apagar posts (staff)`.

---

### Task 6: Loaders partilhados e modo embutido (Ranking, Conquistas, Galeria)

**Files:**
- Create: `src/app/(app)/ranking/dados.ts`, `src/app/(app)/conquistas/dados.ts`, `src/app/(app)/galeria/dados.ts`, `src/app/(app)/galeria/AlbunsGrid.tsx`
- Modify: as três `page.tsx`, `RankingView.tsx`, `ConquistasView.tsx`

**Interfaces:**
- Produces:
  - `type SupabaseServer = Awaited<ReturnType<typeof createClient>>` (de `@/lib/supabase/server`)
  - `carregarRanking(supabase: SupabaseServer, userId: string): Promise<RankingViewProps>` (exportar `RankingViewProps` de `RankingView.tsx`)
  - `carregarConquistas(supabase: SupabaseServer, userId: string): Promise<PessoaConquistas[]>`
  - `interface AlbumResumo { id: string; titulo: string; capa: string | null; total: number; created_at: string }`, `carregarAlbuns(supabase: SupabaseServer): Promise<AlbumResumo[]>`, `AlbunsGrid({ albuns }: { albuns: AlbumResumo[] })` (inclui o estado vazio)
  - `RankingView` e `ConquistasView` aceitam `embutido?: boolean`: sem `min-h-screen`, sem `PageHeader`; os controlos que hoje vivem dentro do `PageHeader` (segmentos Mês/Ano e Adultos/Kids) passam para o topo do corpo.

- [ ] **Step 1:** Mover o corpo de dados de cada `page.tsx` para o seu `dados.ts` sem mudar a lógica. As rotas continuam a renderizar exactamente o mesmo (`embutido` falso).
- [ ] **Step 2:** `npm run build` → OK. `npx playwright test e2e/gamificacao.spec.ts --project=aluno -g "conquistas|ranking"` → os 2 testes de `/conquistas` e `/ranking` PASS (rotas inalteradas).
- [ ] **Step 3:** Commit `refactor(app): loaders de ranking, conquistas e galeria reutilizáveis`.

---

### Task 7: Minha conta (`/conta`)

**Files:**
- Create: `src/lib/comprimir-imagem.ts`, `src/lib/aptos-graduar.ts`, `src/app/(app)/conta/page.tsx`, `src/app/(app)/conta/ContaView.tsx`, `src/app/(app)/conta/loading.tsx`
- Move (`git mv`): `perfil/DependenteModal.tsx`, `perfil/dependente-foto-actions.ts`, `perfil/dependente-historico-actions.ts` → `conta/`
- Modify: `src/app/(app)/perfil/PerfilView.tsx` (só imports), `src/app/(app)/perfil/page.tsx` (usa `calcularAptosGraduar`), `src/components/BottomNav.tsx` (linha 19: `extra` + `"/conta"`)

**Interfaces:**
- Produces:
  - `comprimirParaWebP(file: File, maxLado = 500, qualidade = 0.8): Promise<Blob>` — mesmo algoritmo de `PerfilView.tsx:67-115`, parametrizado; rejeita com `Error("Falha ao carregar imagem")` se o browser não ler o ficheiro.
  - `interface AptoGraduar` (forma actual de `AptosGraduarAluno`) e `calcularAptosGraduar(admin: ReturnType<typeof createAdminClient>): Promise<AptoGraduar[]>` — extraído de `perfil/page.tsx` (bloco `if (isAdminOrProfessor)`), mesma ordenação.

- [ ] **Step 1:** Extrair `comprimirParaWebP` e `calcularAptosGraduar`; `PerfilView`/`perfil/page.tsx` passam a importá-los. Mover os 3 ficheiros para `conta/` e corrigir imports (`rtk proxy grep -rn "DependenteModal\|dependente-foto-actions\|dependente-historico-actions" src`).
- [ ] **Step 2:** `conta/page.tsx` carrega o que as secções precisam (mesmas queries de `perfil/page.tsx`: profile, mensalidades, `historico_graduacoes` com professor, contagens de presenças, último treino, dependentes + mensalidades; staff → `calcularAptosGraduar`).
- [ ] **Step 3: `ContaView`** (skill `ui-ux-pro-max`; referência 3 da spec): `PageHeader` "Minha conta" com voltar para `/perfil`. Por esta ordem, reaproveitando o JSX dos accordions do `PerfilView` (copiar; o `PerfilView` só é apagado na Task 9): Dados pessoais · Faixa e graduação · Mensalidades · Dependentes (só se tiver) · Aptos a graduar (só staff). Depois um grupo de linhas: **Dashboard** (`/admin`, só staff). No fim, botão-pílula "Sair" (fundo `bg-surface`, texto `text-brand`, ícone `LogOut`) com a lógica actual de `handleLogout`.
  - **Desvio à spec §5.2, registar no PR:** não há linha "Notificações" — hoje não existe interruptor de push (o `usePushSubscription` subscreve sozinho); o sino continua no Início. A linha "Modo escuro" entra no PR 3.
- [ ] **Step 4:** `loading.tsx` com `AppPageSkeleton` (título "Minha conta") + `CardListSkeleton count={4}`.
- [ ] **Step 5:** `npm run build` OK. Preview (`preview_start`, preset `mobile`): `/conta` mostra as secções; editar telefone grava (toast "Dados guardados"); `/perfil` antigo continua a funcionar.
- [ ] **Step 6:** Commit `feat(conta): página Minha conta com dados, faixa, mensalidades e dependentes`.

---

### Task 8: Componentes do feed para membros

**Files:**
- Modify: `src/app/globals.css` (`:root`), `tailwind.config.ts` (`colors`)
- Create: `src/app/(app)/perfil/feed/FeedLista.tsx`, `PostCard.tsx`, `FotosCarrossel.tsx`, `CurtidasSheet.tsx`, `ComentariosSheet.tsx`

**Interfaces:**
- Consumes: Task 2 (tipos, `tempoRelativo`, `contarCaracteres`, `validarComentario`, `LIMITE_COMENTARIO`), Task 4 (acções de membro).
- Produces:
  - Tokens: `--fg: 17 24 39` (#111827), `--fg-muted: 107 114 128` (#6B7280), `--line: 229 231 235` (#E5E7EB) → classes `text-fg`, `text-fg-muted`, `border-line`. Só valores claros (o PR 3 acrescenta os escuros).
  - `FeedLista({ paginaInicial, sessao }: { paginaInicial: PaginaFeed; sessao: Sessao })` — `data-testid="feed"`
  - `PostCard({ post, sessao, onApagado }: { post: PostFeed; sessao: Sessao; onApagado: (id: string) => void })` — `data-testid="post"`
  - `FotosCarrossel({ fotos, alt }: { fotos: string[]; alt: string })`
  - `CurtidasSheet({ postId, aberto, onFechar }: { postId: string; aberto: boolean; onFechar: () => void })`
  - `ComentariosSheet({ postId, sessao, aberto, onFechar, onTotal }: { …; onTotal: (n: number) => void })`

- [ ] **Step 1:** Tokens em `globals.css` e `tailwind.config.ts`.
- [ ] **Step 2 (skill `ui-ux-pro-max`):** Componentes. Decisões fixas:
  - **Card:** `bg-surface rounded-2xl border border-line`; cabeçalho avatar 32px (`<img>`, iniciais se sem foto) + nome + `tempoRelativo` (+ " · editado" se `editadoEm`); texto com `whitespace-pre-line`; fotos; linha de pílulas.
  - **Gosto:** pílula com `Heart` (lucide; preenchido `fill-brand text-brand` quando `curtiEu`) + número. UI optimista; enquanto a acção corre o botão ignora toques (estado `aGuardar`) — **Review Focus 3**; no fim usa `total` devolvido pelo servidor; erro → reverte + `toast.error(erro)`. `aria-label="Gostar"` / `"Retirar gosto"`, `aria-pressed`.
  - **Número de gostos** abre `CurtidasSheet` (título "Gostos", lista avatar + nome). **Comentários:** pílula `MessageCircle` + número (`aria-label="Ver comentários"`) abre `ComentariosSheet` (título "Comentários", vazio: "Ainda não há comentários. Sê o primeiro.", `textarea` `text-base` com placeholder "Escreve um comentário…", contador `${contarCaracteres(t)}/300` a vermelho acima de 300, botão "Enviar"; erro de `validarComentario` inline por baixo do campo; apagar o próprio com `confirmar({ titulo: "Apagar comentário?", destrutivo: true })`).
  - **Carrossel:** `overflow-x-auto snap-x snap-mandatory`, cada foto `snap-center w-full aspect-[4/5] object-cover rounded-xl` com `next/image` (`sizes="(max-width: 640px) 100vw, 480px"`); pontos por baixo só se > 1 foto (activo `bg-brand`), sincronizados com o scroll.
  - **Lista:** paginação infinita com `IntersectionObserver` num sentinela → `carregarMaisPosts(cursor)`; para quando `cursor` é null. Estado vazio: título "A academia ainda não publicou nada", texto "Quando houver graduações, competições ou fotos do treino, aparecem aqui."
  - Acção que devolve "Esta publicação já não existe." → `toast.error` e o card sai da lista (`onApagado`) — **Review Focus 5**.
- [ ] **Step 3:** `npx tsc --noEmit`, `npm run lint` → 0 erros. (Montados na Task 9.)
- [ ] **Step 4:** Commit `feat(feed): lista, card, carrossel, gostos e comentários`.

---

### Task 9: Início novo (`/perfil` com pílulas)

**Files:**
- Create: `src/lib/inicio.ts`, `src/lib/inicio.test.ts`, `src/app/(app)/perfil/InicioView.tsx`
- Modify: `src/app/(app)/perfil/page.tsx` (reescrita), `src/app/(app)/perfil/loading.tsx`, `e2e/gamificacao.spec.ts`
- Delete: `src/app/(app)/perfil/PerfilView.tsx`

**Interfaces:**
- Consumes: Tasks 4, 6, 7, 8.
- Produces:
  - `SEPARADORES = ["feed", "ranking", "conquistas", "galeria"] as const`, `type Separador`, `separadorValido(v: string | undefined): Separador` (inválido/undefined → `"feed"`)
  - `InicioView({ pessoa, separador, mensalidades, avisosNotif, children })` com `pessoa: { id: string; nome: string; foto: string | null; faixa: CorFaixa | null; graus: number; categoria: CategoriaFaixa; perfil: PerfilUsuario }`

- [ ] **Step 1: Teste** `inicio.test.ts`: `separadorValido(undefined) === "feed"`, `separadorValido("ranking") === "ranking"`, `separadorValido("RANKING") === "feed"`, `separadorValido("x") === "feed"`.
- [ ] **Step 2:** `npx vitest run src/lib/inicio.test.ts` → FAIL; implementar; → PASS.
- [ ] **Step 3: `page.tsx`** — `export default async function PerfilPage({ searchParams }: { searchParams: Promise<{ tab?: string }> })`. Carrega só o que a casca precisa: profile (nome, foto, faixa, graus, categoria, perfil), mensalidades e avisos (sino), dependentes + mensalidades (para o cálculo de atraso que já decide o `NovaConquistaModal`), staff → `calcularAptosGraduar` para o `GraduacaoAptosModal`, conquistas por ver. Mantém exactamente as regras actuais de quando mostrar cada modal. O conteúdo do separador é um Server Component async dentro de `<Suspense fallback={<CardListSkeleton count={2} />}>`: feed → `carregarPaginaFeed(admin, user.id, null)` + `<FeedLista key={pagina.posts[0]?.id ?? "vazio"} …/>` (a `key` faz o `router.refresh()` após publicar remontar a lista); ranking → `<RankingView {...await carregarRanking(...)} embutido />`; conquistas → `<ConquistasView pessoas={…} embutido />`; galeria → `<AlbunsGrid albuns={…} />`. Só o separador activo carrega dados.
- [ ] **Step 4: `InicioView`** (skill `ui-ux-pro-max`; mockup aprovado "Início" da spec §5.1) — cabeçalho `bg-ink` como hoje: logo + "GRACIE BARRA FAMALICÃO", sino (lógica `hasUnread` + `NotificacoesModal` movida do `PerfilView`), engrenagem `<Link href="/conta" aria-label="Minha conta">`; avatar com troca de foto (mover `handleAvatarClick`/`handleAvatarChange` do `PerfilView`, agora com `comprimirParaWebP(file, 500)`); nome; `FaixaBJJ` `tamanho="sm"` + "Azul · 2 graus" (sem faixa → só nome). `usePushSubscription()` vem para aqui. Pílulas numa `<nav aria-label="Secções do início">` fixa no topo ao fazer scroll (`sticky top-0` com safe area), fundo `bg-canvas`: Feed, Ranking, Conquistas, Galeria com ícones lucide `LayoutList`, `Trophy`, `Medal`, `Images`; cada uma é `<Link href={tab === "feed" ? "/perfil" : \`/perfil?tab=${tab}\`} scroll={false}>`, activa com `aria-current="page"` e `bg-brand text-white`, inactivas `bg-surface border border-line text-fg`; altura ≥ 40px; scroll horizontal se não couberem.
- [ ] **Step 5:** `loading.tsx`: cabeçalho como hoje + 4 pílulas `Skeleton rounded-full h-10 w-24` + 2 cards de post (círculo + 2 linhas + bloco `aspect-[4/5]`).
- [ ] **Step 6:** Apagar `PerfilView.tsx` (e o `CardGamificacao` e o `ResumoGamificacao` que só ele usava). `rtk proxy grep -rn "PerfilView\|ResumoGamificacao\|card-gamificacao" src e2e` → só o e2e a actualizar.
- [ ] **Step 7: e2e** — substituir o 1.º teste de `gamificacao.spec.ts` por:

```ts
test("Início mostra as pílulas e troca de separador", async ({ page }) => {
  await page.goto("/perfil");
  const nav = page.getByRole("navigation", { name: "Secções do início" });
  await expect(nav.getByRole("link", { name: "Feed" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("feed")).toBeVisible({ timeout: 10_000 });
  await nav.getByRole("link", { name: "Ranking" }).click();
  await expect(page).toHaveURL(/\/perfil\?tab=ranking/);
  await expect(page.getByTestId("ranking-oculto")).toBeVisible();
  await nav.getByRole("link", { name: "Galeria" }).click();
  await expect(page).toHaveURL(/tab=galeria/);
});
```

- [ ] **Step 8:** `npm test`, `npm run build` OK; com `npm run dev` a correr, `npx playwright test --project=aluno` → PASS (cadastro, presenca, gamificacao).
- [ ] **Step 9:** Commit `feat(inicio): Início com pílulas Feed, Ranking, Conquistas e Galeria`.

---

### Task 10: Compositor e gestão de posts (staff) + e2e

**Files:**
- Create: `src/app/(app)/perfil/feed/PostComposer.tsx`, `e2e/feed.spec.ts`
- Modify: `FeedLista.tsx`, `PostCard.tsx`, `playwright.config.ts` (projecto `admin`: `testMatch` + `"**/feed.spec.ts"`)

**Interfaces:**
- Consumes: Task 5 (`criarPost`, `editarPost`, `apagarPost`), Task 7 (`comprimirParaWebP`), Task 2 (`validarPost`, `podeEditarPost`, `podeApagarPost`, `LIMITE_FOTOS`).
- Produces: `PostComposer({ aberto, onFechar, post }: { aberto: boolean; onFechar: () => void; post?: PostFeed })`

- [ ] **Step 1 (skill `ui-ux-pro-max`):** `FeedLista` mostra a staff, no topo, o botão "Nova publicação" (ícone `Plus`). `PostComposer` (`Dialog variant="sheet"`): título "Nova publicação" / "Editar publicação"; `textarea` `text-base` placeholder "Escreve algo para a academia…" com contador `/2000`; botão "Juntar fotos" (`<input type="file" multiple accept="image/*">`); grelha de miniaturas com botão remover (`aria-label="Remover foto"`); acima de 10 → erro inline "Máximo de 10 fotos por publicação."; ao submeter comprime cada ficheiro novo com `comprimirParaWebP(file, 1600, 0.82)` — ficheiro ilegível → erro inline `Não foi possível ler "${file.name}". Usa JPG ou PNG.` e nada é enviado; monta o `FormData` (Task 5); botão "Publicar"/"Guardar" com spinner; sucesso → `toast.success("Publicado")` / `"Publicação actualizada"`, fecha, `router.refresh()`.
- [ ] **Step 2:** `PostCard`: menu "⋯" (`DropdownMenu` de `radix-ui`, já dependência; trigger `aria-label="Opções da publicação"`) para staff — "Editar" se `podeEditarPost`, "Apagar" se `podeApagarPost` → `confirmar({ titulo: "Apagar publicação?", descricao: "Os gostos e os comentários também são apagados.", destrutivo: true })` → `apagarPost` → `toast.success("Publicação apagada")` + `onApagado`.
- [ ] **Step 3: e2e** `e2e/feed.spec.ts` (projecto admin; push desligado localmente pela Task 1):

```ts
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("staff publica, dá gosto, comenta e apaga", async ({ page }) => {
  const marca = `e2e-feed-${Date.now()}`;
  await page.goto("/perfil");
  await page.getByRole("button", { name: "Nova publicação" }).click();
  await page.getByPlaceholder("Escreve algo para a academia…").fill(marca);
  await page.locator('input[type="file"]').setInputFiles({ name: "f.png", mimeType: "image/png", buffer: PNG_1PX });
  await page.getByRole("button", { name: "Publicar" }).click();
  const post = page.getByTestId("post").filter({ hasText: marca });
  await expect(post).toBeVisible({ timeout: 15_000 });

  await post.getByRole("button", { name: "Gostar" }).click();
  await expect(post.getByRole("button", { name: "Retirar gosto" })).toHaveAttribute("aria-pressed", "true");

  await post.getByRole("button", { name: "Ver comentários" }).click();
  const campo = page.getByPlaceholder("Escreve um comentário…");
  await campo.fill("a".repeat(301));
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("Máximo de 300 caracteres.")).toBeVisible();
  await campo.fill("comentário e2e");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("comentário e2e")).toBeVisible();
  await page.keyboard.press("Escape");

  await post.getByRole("button", { name: "Opções da publicação" }).click();
  await page.getByRole("menuitem", { name: "Apagar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Apagar" }).click(); // label por defeito de confirmar({ destrutivo: true })
  await expect(post).toHaveCount(0);
});
```

  `test.afterAll`: com `@supabase/supabase-js` e `SUPABASE_SERVICE_ROLE_KEY`, `delete from feed_posts where texto like 'e2e-feed-%'` (rede de segurança se o teste falhar a meio; a BD é a de produção).
- [ ] **Step 4:** `npx playwright test e2e/feed.spec.ts --project=admin` → PASS.
- [ ] **Step 5: Review Focus 2 e 5 à mão** (preview, conta admin de teste): (a) publicar com 3 fotos e confirmar carrossel + pontos; (b) forçar falha de upload (desligar a rede no meio, ou ficheiro > 5 MB entre os válidos) → nenhum post novo e nenhuma pasta nova em `storage.objects` (`execute_sql: select name from storage.objects where bucket_id = 'feed' order by created_at desc limit 5`); (c) abrir comentários numa aba, apagar o post noutra, comentar → toast "Esta publicação já não existe." e o card sai. Apagar no fim tudo o que foi criado.
- [ ] **Step 6:** Commit `feat(feed): compositor de publicações e gestão por staff`.

---

### Task 11: Documentação, verificação final e PR

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: `CLAUDE.md`** — §2 tabela E2E: `feed.spec.ts` (staff publica, gosto, comentário, apaga). §5: `/perfil` passa a "Início com pílulas Feed · Ranking · Conquistas · Galeria (`?tab=`)", nova `/conta`. §7: tabelas `feed_posts`, `feed_curtidas`, `feed_comentarios` (só service_role) e bucket `feed`. §9: `InicioView`, `FeedLista`, `PostCard`, `FotosCarrossel`, `CurtidasSheet`, `ComentariosSheet`, `PostComposer`, `ContaView`. §10: tokens `fg`, `fg-muted`, `line`. §12: "Push só sai com `VERCEL_ENV=production` — dev/e2e partilham a BD de produção". §14: linha "Feed (PR 1)"; em "Por implementar": posts automáticos (PR 2), modo escuro (PR 3) e **vídeo no feed via Bunny Stream** (decisão do dono; ver spec §3).
- [ ] **Step 2:** `npm run lint` (0 erros), `npm test`, `npm run build` → OK. `npm run test:e2e` → tudo PASS excepto as 2 falhas conhecidas de `financeiro.spec.ts`.
- [ ] **Step 3: Preview final** (preset `mobile`): `/perfil` nas 4 pílulas e voltar do browser entre separadores; `/conta`; publicar/editar/apagar como staff; gostos e comentários como aluno; `/tablet` e `/admin` iguais. Screenshot do Início com um post para o PR.
- [ ] **Step 4:** Commit `docs: feed, Minha conta e regra de push no CLAUDE.md`.
- [ ] **Step 5:** Com OK do dono: `git push -u producao feat/feed-academia` e PR para `master` (descrição: resumo, desvio "sem linha Notificações", migração já aplicada em produção, screenshot).
