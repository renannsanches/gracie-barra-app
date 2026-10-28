# Feed — PR 2: Posts automáticos (graduação e pódio do mês) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O feed passa a publicar sozinho: um post quando um aluno recebe faixa nova, e um post com o pódio do mês anterior (Adultos e Kids) no início de cada mês.

**Architecture:** As regras ficam em lógica pura testada com vitest (`src/lib/feed-automatico.ts`). A escrita fica num módulo de servidor (`src/lib/feed-servidor.ts`), chamado de `registrarGraduacao`/`excluirGraduacao` e de um novo `type=feed_podio` no cron existente `/api/push/send`. Os dados que o card precisa para desenhar (faixa, pódio) ficam numa coluna nova `feed_posts.dados jsonb`. O `PostCard` desenha um bloco próprio para `tipo` `graduacao` e `podio`. Os posts automáticos têm `autor_id = null`, ou seja autor "Gracie Barra Famalicão", e `UNIQUE (tipo, referencia)` garante um só post por graduação e por mês.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase (Postgres + Storage), Tailwind 3, vitest, Playwright, Vercel Cron.

**Spec:** `docs/superpowers/specs/2026-10-26-feed-design.md` — §6 (posts automáticos), §7 (push), §11 item 2, §13.

## Global Constraints

- Ramo `feat/feed-posts-automaticos` (já criado a partir de `producao/master`) → PR para `master` em `renannsanches/gracie-barra-app`. Push e PR só com OK do dono.
- A BD de dev/e2e **é a de produção**: migrações só aditivas, aplicadas pelo controller depois da revisão. Posts de teste com texto `e2e-feed-` e apagados no fim. Push só sai com `VERCEL_ENV === "production"` (já é assim).
- **Graduação** (spec §6.1):
  - Só **faixa nova** gera post. Só graus não gera, nem o primeiro registo de faixa (`faixaAnterior` null).
  - Aluno com `ocultar_ranking = true` não gera post.
  - Só gera post se `data_graduacao` estiver entre hoje e 7 dias atrás, em dias de calendário de Lisboa.
  - Um post por aluno, **sem push**. O nome é igual ao do ranking (`nomeRanking`).
  - `excluirGraduacao` apaga o post e as fotos dele.
- **Pódio** (spec §6.2):
  - Top 3 de Adultos e de Kids do mês anterior, com as regras do `/ranking`: grupo por `grupoRanking`, empates 1, 1, 3 (`ordenarRanking`), sem ocultos (o RPC `ranking_presencas` já os exclui).
  - Mínimo de aulas `MIN_AULAS_TOP3` (4), o mesmo da medalha "Top 3 do mês".
  - Um post por mês (idempotente) e **push a todos**: aluno, responsável e professor activos.
  - Primeiro mês com pódio: `"2026-10"`.
- Autor dos posts automáticos: `AUTOR_ACADEMIA` (já existe em `@/lib/feed`). Staff pode editá-los e juntar fotos (`podeEditarPost` já o permite).
- Não usar `oklch()`. Texto ≥ 12px. Interface em pt-PT. Ficheiros novos só com tokens semânticos (`bg-surface`, `text-fg`, `text-fg-muted`, `border-line`, `bg-brand`…).
- A Task 5 (UI) invoca a skill `ui-ux-pro-max` antes de escrever JSX.
- Commits terminam com o trailer `Co-Authored-By` do harness.

## Review Focus

1. **Graduação lançada com data antiga** (backfill ou correcção de ficha) → nenhum post. Teste em Task 1 (`deveCriarPostGraduacao`).
2. **Cron do pódio corre duas vezes no mesmo dia ou em paralelo** → um só post e um só push. O push só sai quando o insert deste pedido teve sucesso; um conflito `23505` conta como "já existe". Verificado em Task 4, Step 4.
3. **Falha a criar o post de graduação** (BD, nome em falta) → a graduação fica registada na mesma; só fica um `console.error`. Task 3.
4. **Grupo sem ninguém com ≥ 4 aulas**: a secção desse grupo não aparece. Com os dois grupos vazios não há post nem push. **Empate no 3.º lugar**: aparecem todos os empatados. Teste em Task 1 (`montarPodio`).
5. **Apagar uma graduação cujo post o professor já editou com fotos** → o post e as fotos saem do bucket. Task 3, verificado no e2e da Task 6.

---

## File Structure

| Ficheiro | Responsabilidade |
|---|---|
| `src/lib/feed.ts` | Tipos `DadosGraduacao`, `DadosPodio`, `EntradaPodio`, campo `PostFeed.dados` |
| `src/lib/feed-automatico.ts` (+ `.test.ts`) | Regras puras: quando há post de graduação, texto da graduação, mês do pódio, montar o pódio, texto do pódio, nome do mês |
| `supabase/migrations/20261028120000_feed_dados.sql` | `ALTER TABLE feed_posts ADD COLUMN dados jsonb` |
| `src/lib/feed-servidor.ts` | Escrita no servidor: `apagarPostEFotos`, `publicarPostGraduacao`, `apagarPostGraduacao`, `gerarPostPodio` |
| `src/app/admin/alunos/[id]/graduacao-actions.ts` | Chama publicar/apagar o post |
| `src/app/(app)/perfil/feed/staff-actions.ts` | `apagarPost` passa a usar `apagarPostEFotos` |
| `src/app/(app)/perfil/feed/dados.ts` | Selecciona `dados` |
| `src/lib/push-sender.ts` | `sendPushPodio` |
| `src/app/api/push/send/route.ts`, `vercel.json` | `type=feed_podio` (+ `?dry=1`) |
| `src/app/(app)/perfil/feed/PostGraduacao.tsx`, `PostPodio.tsx`, `PostCard.tsx` | Desenho dos posts automáticos |

---

### Task 1: Regras puras dos posts automáticos

**Files:**
- Modify: `src/lib/feed.ts` (tipos)
- Create: `src/lib/feed-automatico.ts`, `src/lib/feed-automatico.test.ts`

**Interfaces:**
- Consumes: `grupoRanking`, `nomeRanking`, `ordenarRanking`, `MIN_AULAS_TOP3`, `addDias`, `GrupoRanking` de `@/lib/gamificacao`; `labelCorFaixa` de `@/lib/utils`; `CorFaixa`, `CategoriaFaixa` de `@/lib/types`.
- Produces (em `@/lib/feed`):
  - `interface DadosGraduacao { kind: "graduacao"; alunoId: string; nome: string; faixa: CorFaixa; graus: number; categoria: CategoriaFaixa }`
  - `interface EntradaPodio { alunoId: string; nome: string; foto: string | null; faixa: string | null; graus: number; categoria: string | null; aulas: number; posicao: number }`
  - `interface DadosPodio { kind: "podio"; mes: string /* "YYYY-MM" */; adultos: EntradaPodio[]; kids: EntradaPodio[] }`
  - `PostFeed` ganha `dados: DadosGraduacao | DadosPodio | null`.
- Produces (em `@/lib/feed-automatico`):
  - `PRIMEIRO_MES_PODIO = "2026-10"`
  - `deveCriarPostGraduacao(e: { faixaAnterior: CorFaixa | null; faixaNova: CorFaixa; dataGraduacao: string; ocultarRanking: boolean; hoje: string }): boolean`
  - `textoGraduacao(nome: string, faixa: CorFaixa): string`
  - `nomeMes(mes: string): string` → `"outubro"` (array fixo de meses em minúsculas, sem Intl)
  - `mesDoPodio(hoje: string): string | null` → mês anterior se for ≥ `PRIMEIRO_MES_PODIO`, senão null
  - `montarPodio(linhas: (Omit<EntradaPodio, "posicao" | "nome"> & { nomeCompleto: string })[], mes: string): DadosPodio | null` → agrupa com `grupoRanking`, filtra `aulas >= MIN_AULAS_TOP3`, ordena com `ordenarRanking`, fica com `posicao <= 3`, nome com `nomeRanking`; devolve null se os dois grupos ficarem vazios
  - `textoPodio(d: DadosPodio): string`

- [ ] **Step 1: Testes** (valores exactos)

```ts
const hoje = "2026-10-27";
const base = { faixaAnterior: "branca", faixaNova: "azul", dataGraduacao: hoje, ocultarRanking: false, hoje } as const;
expect(deveCriarPostGraduacao(base)).toBe(true);
expect(deveCriarPostGraduacao({ ...base, dataGraduacao: "2026-10-20" })).toBe(true);   // 7 dias
expect(deveCriarPostGraduacao({ ...base, dataGraduacao: "2026-10-19" })).toBe(false);  // 8 dias
expect(deveCriarPostGraduacao({ ...base, dataGraduacao: "2026-10-28" })).toBe(false);  // futuro
expect(deveCriarPostGraduacao({ ...base, faixaNova: "branca" })).toBe(false);          // só graus
expect(deveCriarPostGraduacao({ ...base, faixaAnterior: null })).toBe(false);          // 1.º registo
expect(deveCriarPostGraduacao({ ...base, ocultarRanking: true })).toBe(false);

expect(textoGraduacao("João Silva", "azul")).toBe("João Silva recebeu a faixa azul.");
expect(textoGraduacao("Ana P.", "cinza_branca")).toBe("Ana P. recebeu a faixa cinza/branca.");

expect(nomeMes("2026-10")).toBe("outubro");
expect(mesDoPodio("2026-11-01")).toBe("2026-10");
expect(mesDoPodio("2027-01-03")).toBe("2026-12");
expect(mesDoPodio("2026-10-27")).toBeNull();   // setembro < PRIMEIRO_MES_PODIO

const l = (id: string, nomeCompleto: string, aulas: number, faixa = "azul", categoria = "adulto") =>
  ({ alunoId: id, nomeCompleto, foto: null, faixa, graus: 0, categoria, aulas });
const p = montarPodio([
  l("a", "Ana Costa", 18), l("b", "Bruno Dias", 14), l("c", "Carla Reis", 14),
  l("d", "Duarte Lopes", 12), l("e", "Eva Mota", 12), l("f", "Filipe Sá", 3),
  l("k", "Kiko Neves", 9, "cinza", "infantil"),
], "2026-10")!;
expect(p.adultos.map((x) => [x.alunoId, x.posicao])).toEqual([["a", 1], ["b", 2], ["c", 2]]);
expect(p.kids.map((x) => [x.nome, x.posicao])).toEqual([["Kiko N.", 1]]);
expect(montarPodio([l("f", "Filipe Sá", 3)], "2026-10")).toBeNull();
// empate no 3.º: todos aparecem
const e = montarPodio([l("a","A A",10), l("b","B B",9), l("c","C C",8), l("d","D D",8)], "2026-10")!;
expect(e.adultos.map((x) => x.posicao)).toEqual([1, 2, 3, 3]);

expect(textoPodio({ kind: "podio", mes: "2026-10", adultos: p.adultos, kids: p.kids })).toBe(
  "Pódio de outubro 🏆\nAdultos: 1.º Ana Costa, 2.º Bruno Dias, 2.º Carla Reis\nKids: 1.º Kiko N."
);
// grupo vazio: a linha não aparece
expect(textoPodio({ kind: "podio", mes: "2026-10", adultos: p.adultos, kids: [] })).toBe(
  "Pódio de outubro 🏆\nAdultos: 1.º Ana Costa, 2.º Bruno Dias, 2.º Carla Reis"
);
```

- [ ] **Step 2:** `npx vitest run src/lib/feed-automatico.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar.
  - "Dentro de 7 dias" significa `addDias(hoje, -7) <= dataGraduacao <= hoje` (strings `YYYY-MM-DD`).
  - Rótulo da faixa: `labelCorFaixa(faixa).toLowerCase()`.
- [ ] **Step 4:** `npm test` → PASS. `npx tsc --noEmit` → 0 erros. Os sítios que constroem `PostFeed` (`dados.ts`) ainda não têm `dados`; pôr `dados: null` provisório se o tsc o exigir (a Task 2 troca pelo valor real).
- [ ] **Step 5:** Commit `feat(feed): regras dos posts automáticos (graduação e pódio)`.

---

### Task 2: Coluna `dados` e leitura no feed

**Files:**
- Create: `supabase/migrations/20261028120000_feed_dados.sql`
- Modify: `src/app/(app)/perfil/feed/dados.ts`

- [ ] **Step 1:** Migração (comentário pt-PT de uma linha):
  `ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS dados jsonb;`
  O implementador **não** a aplica: o controller aplica-a depois da revisão (Supabase MCP `apply_migration`, name `feed_dados`) e verifica com `select column_name, data_type from information_schema.columns where table_name='feed_posts' and column_name='dados'`.
- [ ] **Step 2:** `carregarPaginaFeed` passa a seleccionar `dados` e põe-no no `PostFeed` (`null` quando a coluna vier vazia).
- [ ] **Step 3:** `npx tsc --noEmit`, `npm run lint` → 0 erros.
- [ ] **Step 4:** Commit `feat(feed): coluna dados para os posts automáticos`.

---

### Task 3: Post de graduação (servidor)

**Files:**
- Create: `src/lib/feed-servidor.ts` (sem `"use server"`; recebe o admin client)
- Modify: `src/app/(app)/perfil/feed/staff-actions.ts` (`apagarPost`), `src/app/admin/alunos/[id]/graduacao-actions.ts`

**Interfaces:**
- Consumes: Task 1 (`deveCriarPostGraduacao`, `textoGraduacao`, `DadosGraduacao`), `nomeRanking`, `grupoRanking`, `hojeLisboa`, `caminhoNoBucket`, `BUCKET_FEED`.
- Produces:
  - `type Admin = ReturnType<typeof createAdminClient>`
  - `apagarPostEFotos(admin: Admin, postId: string): Promise<{ ok: true } | { ok: false; erro: string }>`
    - lê `fotos` da linha e apaga a linha;
    - depois remove do bucket só os caminhos `${postId}/…`, a mesma regra que hoje está dentro de `apagarPost`, que passa a chamar esta função sem mudar de comportamento.
  - `publicarPostGraduacao(admin: Admin, g: { graduacaoId: string; alunoId: string; faixaAnterior: CorFaixa | null; faixaNova: CorFaixa; graus: number; categoria: CategoriaFaixa; dataGraduacao: string }): Promise<void>`
    - lê `nome_completo` e `ocultar_ranking` do aluno e aplica `deveCriarPostGraduacao`;
    - insere `{ tipo: "graduacao", autor_id: null, referencia: graduacaoId, texto: textoGraduacao(nome, faixaNova), dados }`, com o nome de `nomeRanking(nome_completo, grupoRanking(faixaNova, categoria))`;
    - um conflito `23505` é ignorado;
    - **nunca lança**: qualquer erro fica em `console.error("[feed] post de graduação:", …)`.
  - `apagarPostGraduacao(admin: Admin, graduacaoId: string): Promise<void>`
    - procura o post `tipo='graduacao'` com essa `referencia` e chama `apagarPostEFotos`;
    - nunca lança.

- [ ] **Step 1:** `apagarPostEFotos` + refactor de `apagarPost`. O e2e `feed.spec.ts` (`--project=admin`) continua a passar.
- [ ] **Step 2:** `registrarGraduacao`: depois do insert com sucesso, `await publicarPostGraduacao(admin, {...})` e `revalidatePath("/perfil")`. Sem push.
- [ ] **Step 3:** `excluirGraduacao`: depois do delete com sucesso, `await apagarPostGraduacao(admin, id)` e `revalidatePath("/perfil")`.
- [ ] **Step 4:** `npx tsc --noEmit`, `npm run lint` → 0 erros; `npm test`. O caminho completo é verificado no e2e da Task 6.
- [ ] **Step 5:** Commit `feat(feed): post automático de faixa nova`.

---

### Task 4: Pódio do mês (servidor + cron)

**Files:**
- Modify: `src/lib/feed-servidor.ts`, `src/lib/push-sender.ts`, `src/app/api/push/send/route.ts`, `vercel.json`

**Interfaces:**
- Consumes: Task 1 (`mesDoPodio`, `montarPodio`, `textoPodio`, `nomeMes`, `DadosPodio`), `limitesPeriodo`, `hojeLisboa`, RPC `ranking_presencas(p_inicio, p_fim)` (colunas `aluno_id, nome_completo, foto_url, faixa, graus, categoria, aulas`, como em `src/app/(app)/ranking/dados.ts`).
- Produces:
  - `gerarPostPodio(admin: Admin, opts: { dry: boolean; hoje?: string }): Promise<{ mes: string | null; publicado: boolean; jaExistia: boolean; podio: DadosPodio | null }>`
    - `mes = mesDoPodio(hoje)`: null → `{ mes: null, publicado: false, jaExistia: false, podio: null }`;
    - se já existe post `tipo='podio'` com `referencia = mes` → `jaExistia: true`;
    - senão corre o RPC com `limitesPeriodo("mes", \`${mes}-01\`)` e depois `montarPodio`;
    - `dry` ou pódio null → não insere;
    - senão insere `{ tipo: "podio", autor_id: null, referencia: mes, texto: textoPodio(podio), dados: podio }`; um `23505` conta como `jaExistia: true`.
  - `sendPushPodio(mes: string): Promise<void>`
    - mesmos destinatários de `sendPushNovoPost` (aluno, responsável e professor activos), sem excluir ninguém;
    - payload `{ title: \`Pódio de ${nomeMes(mes)}\`, body: \`Vê quem mais treinou em ${nomeMes(mes)}.\`, url: "/perfil" }`;
    - envia por `sendToSubscriptions` (só em produção).

- [ ] **Step 1:** `gerarPostPodio` e `sendPushPodio`.
- [ ] **Step 2:** `route.ts`: novo ramo `type === "feed_podio"`.
  - Ler `dry = searchParams.get("dry") === "1"`. Com `dry`, aceitar também `hoje=YYYY-MM-DD` (validado por regex), para testar sem esperar pelo dia 1; sem `dry`, ignorar `hoje`.
  - Chamar `const r = await gerarPostPodio(createAdminClient(), { dry, hoje })`.
  - `if (r.publicado) await sendPushPodio(r.mes!)`: só quem inseriu manda push.
  - Responder `Response.json({ dry, mes: r.mes, publicado: r.publicado, jaExistia: r.jaExistia, adultos: r.podio?.adultos.length ?? 0, kids: r.podio?.kids.length ?? 0 })`.
- [ ] **Step 3:** `vercel.json`: `{ "path": "/api/push/send?type=feed_podio", "schedule": "0 9 * * *" }`. Diário e idempotente: se o dia 1 falhar, o dia 2 publica.
- [ ] **Step 4 (Review Focus 2):** verificar contra produção, sem escrever.
  - Com o dev server a correr, chamar `GET http://localhost:3000/api/push/send?type=feed_podio&dry=1&hoje=2026-11-01` com `Authorization: Bearer $CRON_SECRET` do `.env.local`.
  - Esperado: `{ dry: true, mes: "2026-10", publicado: false, … }` com as contagens de Adultos e Kids. Confirmar que batem com o `/ranking` (separador Mês) de outubro.
  - Se o `.env.local` não tiver `CRON_SECRET`, não o criar: dizê-lo no relatório. O controller verifica.
  - Confirmar no código que o push depende de `publicado`, que só é `true` quando o insert deste pedido teve sucesso.
- [ ] **Step 5:** `npx tsc --noEmit`, `npm run lint`, `npm test`. Commit `feat(feed): pódio do mês publicado pelo cron`.

---

### Task 5: Desenho dos posts automáticos

**Files:**
- Create: `src/app/(app)/perfil/feed/PostGraduacao.tsx`, `src/app/(app)/perfil/feed/PostPodio.tsx`
- Modify: `src/app/(app)/perfil/feed/PostCard.tsx`

**Interfaces:**
- Consumes: `DadosGraduacao`, `DadosPodio`, `nomeMes` (Tasks 1–2); `FaixaBJJ` (`src/components/FaixaBJJ`).
- Produces: `PostGraduacao({ dados }: { dados: DadosGraduacao })`, `PostPodio({ dados }: { dados: DadosPodio })`.

- [ ] **Step 1 (skill `ui-ux-pro-max`):**
  - `PostCard` mostra o bloco especial entre o texto e as fotos quando `post.dados?.kind` é `"graduacao"` ou `"podio"`. Os posts manuais ficam iguais.
  - **Graduação:** faixa desenhada (`FaixaBJJ`, `tamanho="md"`, com graus e categoria) centrada num cartão interno `bg-canvas rounded-xl`, e por baixo "Faixa {rótulo}" em `text-fg-muted`. O texto do post já diz quem foi.
  - **Pódio:** título "Pódio de {mês}". Até duas secções, "Adultos" e "Kids", só as que têm gente. Em cada uma, linhas com:
    - medalha pela posição: 1 dourado, 2 prateado, 3 bronze, com número visível e `aria-label` "1.º lugar";
    - avatar `<img>` com iniciais se não houver foto;
    - nome, faixa `xs` e "N aulas".

    O `texto` do post fica escondido visualmente (`sr-only`), porque repete a lista para leitores de ecrã. Os empates mostram a mesma posição.
- [ ] **Step 2:** Ver os dois blocos de verdade.
  - Um script descartável insere dois posts de teste com `texto` começado por `e2e-feed-`: um `tipo: "graduacao"`, `referencia: "e2e-…"`, com `dados` de graduação; e um `tipo: "podio"`, `referencia: "e2e-…"`, com `dados` de pódio de 2 + 1 pessoas.
  - Fazer screenshot Pixel 5 como aluno de teste (`e2e/.auth/aluno.json`).
  - Apagar os dois no fim e confirmar `count = 0`. O `texto` visível vai ser `e2e-feed-…` só nestes posts de teste; não interessa ao desenho.
- [ ] **Step 3:** `npx tsc --noEmit`, `npm run lint`. Commit `feat(feed): cartões de graduação e pódio no feed`.

---

### Task 6: e2e, documentação e verificação final

**Files:**
- Modify: `e2e/feed.spec.ts`, `CLAUDE.md`

- [ ] **Step 1: e2e da graduação** (projecto admin) — novo teste em `feed.spec.ts`. O aluno de teste tem `ocultar_ranking = true`, posto pelo `global-setup`.
  1. Ler a faixa e os graus actuais do aluno de teste (service role).
  2. Pôr temporariamente `ocultar_ranking = false` nele.
  3. Registar uma graduação com faixa diferente e data de hoje, chamando a acção pela UI da ficha `/admin/alunos/[id]`.
  4. Confirmar que no `/perfil` aparece um post com "recebeu a faixa".
  5. Apagar a graduação pela UI e confirmar que o post desaparece.
  6. Repetir com `ocultar_ranking = true` e confirmar que **não** aparece post.
  7. `afterAll`: repor faixa, graus e `ocultar_ranking = true`, e apagar graduações e posts `tipo='graduacao'` desse aluno.

  Se a UI da ficha for difícil de automatizar, a alternativa aceitável é chamar `publicarPostGraduacao`/`apagarPostGraduacao` através de um script com service role, desde que o registo e a exclusão pela UI fiquem verificados à mão na Step 3. Dizer no relatório qual foi o caminho.
- [ ] **Step 2: `CLAUDE.md`:**
  - §7: coluna `dados` e posts `graduacao`/`podio`.
  - §12: o pódio só manda push quando insere.
  - §14: linha "Feed (PR 2) — posts automáticos"; tirar os posts automáticos de "Por implementar".
  - Crons: `type=feed_podio` (`?dry=1` só calcula).
- [ ] **Step 3:** `npm run lint` (0 erros), `npm test`, `npm run build`. Antes do build, o controller pára o dev server e volta a ligá-lo depois.
  - `npm run test:e2e` → tudo passa excepto as 2 falhas conhecidas de `financeiro.spec.ts`.
  - Confirmar 0 posts `e2e-feed-%` e 0 posts `graduacao` do aluno de teste.
- [ ] **Step 4:** Commit `docs: posts automáticos no CLAUDE.md`. Push e PR só com OK do dono. A descrição do PR diz que a migração já está aplicada e lembra que o primeiro pódio sai a 1 de novembro.
