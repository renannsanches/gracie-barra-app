# Modo escuro (PR 3 do feed) — plano de implementação

> **Estado: implementado — PR #69, em produção desde 2026-10-28.** Mantido como registo; os checkboxes abaixo não foram actualizados.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tema escuro em todas as páginas do aluno (grupo `(app)`), a seguir o sistema por defeito, com interruptor em Minha conta, sem flash, e com admin/tablet sempre claros.

**Architecture:** A classe `dark` vai para o `<html>` só nas rotas do aluno: um script inline no `<head>` decide antes da primeira pintura (preferência em `localStorage.tema`, senão `prefers-color-scheme`), e um `TemaScope` no layout `(app)` liga/desliga a classe nas navegações client-side (sair para `/admin` limpa-a). Os tokens RGB de `globals.css` ganham um bloco `.dark`; as cores fixas dos ficheiros do aluno passam para tokens semânticos, que no admin continuam a resolver para os valores claros.

**Tech Stack:** Next.js App Router, Tailwind 3 (`darkMode: ["class"]`), tokens RGB em CSS, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-26-feed-design.md` §8 (e §3, §9, §11.3, §13).

## Global Constraints

- Admin (`/admin/*`) e tablet (`/tablet/*`) ficam sempre claros — nada do tema escuro chega lá (tablet = Safari 15).
- Cores em canais RGB `R G B`; **nada de `oklch()`**.
- Sem biblioteca nova (sem `next-themes`): solução própria em `src/lib/tema.ts` [decisão do builder, §12].
- Preferência por dispositivo: `localStorage["tema"]` = `"claro" | "escuro"`; ausente = segue o sistema. Todo o acesso a `localStorage` em `try/catch`.
- `theme-color`: claro `#ED1C24` (o actual), escuro `#0A0A0A`.
- Interface pt-PT; texto ≥12px; `confirmar()`/`toast` como já se usa.
- Rotas com tema: `/perfil`, `/conta`, `/presenca`, `/presencas`, `/aulas`, `/turmas`, `/avisos`, `/galeria`, `/ranking`, `/conquistas` (e sub-rotas). `/presenca` não pode apanhar `/presencasX` por prefixo solto: só `p === r || p.startsWith(r + "/")`.
- Fluxo git: ramo `feat/modo-escuro` a partir de `producao/master` → PR para `master` em `renannsanches/gracie-barra-app`.

## Review Focus

1. Recarregar `/perfil` com `tema=escuro` → `<html class="dark">` já no HTML antes da hidratação (sem flash claro).
2. `localStorage` a lançar excepção (modo privado/Safari) → segue o sistema, sem erro na consola.
3. `/conta` → Dashboard (`/admin`, navegação client-side) → admin claro; voltar → escuro outra vez.
4. `/tablet` com o sistema em escuro → continua claro.
5. QR Code em `/presenca` continua preto sobre branco no escuro (o tablet tem de o ler).

---

## Tokens (valores fixos para todas as tasks)

| Token (classe) | Claro | Escuro |
|---|---|---|
| `canvas` | 245 245 245 | 14 14 16 |
| `surface` | 255 255 255 | 28 28 30 |
| `subtle` **novo** (fundos internos, chips, hover) | 243 244 246 | 44 44 46 |
| `fg` | 17 24 39 | 244 244 245 |
| `fg-muted` | 107 114 128 | 161 161 170 |
| `fg-subtle` **novo** (≈ gray-400) | 156 163 175 | 113 113 122 |
| `line` | 229 231 235 | 52 52 56 |
| `line-strong` **novo** (≈ gray-300, bordas de campos) | 209 213 219 | 72 72 76 |
| `ink`, `brand*`, `success`, `warning`, `destructive` | iguais | iguais |
| shadcn `--background` / `--foreground` | #FFFFFF / #0A0A0A | #0E0E10 / #F4F4F5 |
| shadcn `--border` / `--input` | #E5E5E5 | #343438 |
| shadcn `--muted-foreground` | #737373 | #A1A1AA |

`.dark` também leva `color-scheme: dark`.

## Tabela de migração de cores (Tasks 4–6)

| De | Para |
|---|---|
| `bg-white` (sem opacidade) | `bg-surface` |
| `bg-gb-gray` | `bg-canvas` |
| `bg-gray-50`, `bg-gray-100` (+ `hover:`/`active:`) | `bg-subtle` |
| `bg-gray-200` | `bg-line` |
| `text-gray-900/800/700` | `text-fg` |
| `text-gray-600/500` | `text-fg-muted` |
| `text-gray-400/300/200`, `placeholder:text-gray-400` | `text-fg-subtle` |
| `border-gray-50/100/200`, `divide-gray-50/100` | `border-line` / `divide-line` |
| `border-gray-300` | `border-line-strong` |
| Tintas `bg-{cor}-50/100` | mantêm + `dark:bg-{cor}-500/15` |
| Bordas `border-{cor}-100/200` | mantêm + `dark:border-{cor}-500/30` |
| Texto `text-{cor}-700/800/900` | mantêm + `dark:text-{cor}-300` |

**Ficam como estão:** `text-white`, `*-white/NN`, `bg-black/NN`, `bg-gray-900/950` (overlays, headers `ink`, texto sobre fotos/vermelho), cores sólidas (`bg-green-500`…), cores de faixas e medalhas, o botão de interruptor (`bg-white` do botão). Uma linha que deve ficar fixa leva o comentário `tema: fixo` (JSX: `{/* tema: fixo */}` na linha ou na anterior) — o guard da Task 3 respeita-o. Caso obrigatório: o contentor do QR em `PresencaView` fica `bg-white`.

---

### Task 1: Núcleo do tema (lógica, tokens, script sem flash)

**Files:**
- Create: `src/lib/tema.ts`, `src/lib/tema.test.ts`, `src/components/TemaScope.tsx`
- Modify: `src/app/globals.css`, `tailwind.config.ts`, `src/app/layout.tsx`, `src/app/(app)/layout.tsx`

**Interfaces:**
- Produces (`src/lib/tema.ts`):
  - `type Tema = "claro" | "escuro"`
  - `const CHAVE_TEMA = "tema"`
  - `const ROTAS_COM_TEMA: readonly string[]` (lista das Global Constraints)
  - `rotaTemTema(pathname: string): boolean`
  - `resolverTema(preferencia: Tema | null, sistemaEscuro: boolean): Tema`
  - `lerPreferencia(): Tema | null` (try/catch; valor inválido → null)
  - `gravarPreferencia(tema: Tema): void` (try/catch)
  - `aplicarTema(tema: Tema): void` — põe/tira `dark` no `<html>` e acerta `<meta name="theme-color">`
  - `const THEME_COLOR: Record<Tema, string>` = `{ claro: "#ED1C24", escuro: "#0A0A0A" }`
  - `scriptTema(): string` — IIFE para o `<head>`, gerado a partir das constantes acima (sem duplicar a lista à mão)
  - evento `window` `"tema-mudou"` disparado por `gravarPreferencia`
- Produces (`TemaScope`): `export function TemaScope(): null` — no mount aplica `resolverTema(lerPreferencia(), matchMedia)`; ouve `change` do `matchMedia("(prefers-color-scheme: dark)")` (só conta se não houver preferência) e `"tema-mudou"`; no unmount tira `dark` e repõe `THEME_COLOR.claro`.

- [ ] **Step 1: Testes em `src/lib/tema.test.ts`**

```ts
expect(rotaTemTema("/perfil")).toBe(true);
expect(rotaTemTema("/galeria/abc")).toBe(true);
expect(rotaTemTema("/presencas")).toBe(true);
expect(rotaTemTema("/presencasx")).toBe(false);
expect(rotaTemTema("/admin")).toBe(false);
expect(rotaTemTema("/tablet")).toBe(false);
expect(rotaTemTema("/login")).toBe(false);
expect(resolverTema(null, true)).toBe("escuro");
expect(resolverTema(null, false)).toBe("claro");
expect(resolverTema("claro", true)).toBe("claro");
expect(resolverTema("escuro", false)).toBe("escuro");
// o script do <head> corre isolado e decide igual:
// executar scriptTema() com new Function e stubs de document/localStorage/matchMedia/location
// → path "/perfil", localStorage.tema="escuro" → classList contém "dark", meta = "#0A0A0A"
// → path "/admin", localStorage.tema="escuro" → sem "dark"
// → localStorage.getItem a lançar, sistema escuro, "/conta" → "dark", sem excepção
```

- [ ] **Step 2:** `npm test -- tema` → FAIL (módulo inexistente).
- [ ] **Step 3:** Implementar `src/lib/tema.ts`. O script não pode importar nada: serializar `ROTAS_COM_TEMA`, `CHAVE_TEMA` e `THEME_COLOR` com `JSON.stringify` dentro da string; tudo dentro de `try {} catch {}`.
- [ ] **Step 4:** `npm test -- tema` → PASS.
- [ ] **Step 5:** Tokens: em `globals.css` acrescentar `--subtle`, `--fg-subtle`, `--line-strong` ao `:root` e um bloco `.dark { … color-scheme: dark; }` com a tabela de tokens; `.gb-phone-input .PhoneInputCountry` passa a `background: rgb(var(--surface)); border-color: rgb(var(--line-strong))` e a seta a `rgb(var(--fg-muted))`. Em `tailwind.config.ts` acrescentar `subtle`, `"fg-subtle"`, `"line-strong"` com `rgb()`.
- [ ] **Step 6:** `src/app/layout.tsx`: `<head><script dangerouslySetInnerHTML={{ __html: scriptTema() }} /></head>` antes do `<body>`. `src/app/(app)/layout.tsx`: renderizar `<TemaScope />` nos dois `return` (com e sem utilizador).
- [ ] **Step 7:** `npm run build` → OK. Commit `feat(tema): núcleo do modo escuro (tokens, script sem flash, TemaScope)`.

### Task 2: Interruptor em Minha conta + toasts no tema

**Files:**
- Create: `src/components/useTema.ts`
- Modify: `src/app/(app)/conta/ContaView.tsx`, `src/components/FeedbackHosts.tsx`, `src/components/ui/switch.tsx`

**Interfaces:**
- Consumes: `lerPreferencia`, `gravarPreferencia`, `resolverTema`, `Tema` (Task 1).
- Produces: `useTemaAtivo(): Tema` — lê a classe `dark` do `<html>` e reage com `MutationObserver` (atributo `class`); `"claro"` no servidor.

- [ ] **Step 1:** `ContaView`: novo grupo "Preferências" (antes de "Academia", visível para todos) com uma linha "Modo escuro" + `Switch` (`checked = useTemaAtivo() === "escuro"`, `onCheckedChange` → `gravarPreferencia(v ? "escuro" : "claro")`). Descrição por baixo: `"Segue o sistema"` quando `lerPreferencia()` é `null`, senão nada. Linha com o mesmo visual de `LinhaLink` (ícone `Moon` do lucide em `bg-brand/10`). `aria-label="Modo escuro"` no switch.
- [ ] **Step 2:** `Switch`: `bg-gray-200` → `bg-line-strong` (o botão branco fica, `tema: fixo`).
- [ ] **Step 3:** `FeedbackHosts`: `<Toaster theme={useTemaAtivo() === "escuro" ? "dark" : "light"} …>` (mantém o resto das props).
- [ ] **Step 4:** Teste e2e `e2e/tema.spec.ts` (projecto aluno):
  - em `/conta`, clicar no switch "Modo escuro" → `html` tem classe `dark`; `localStorage.tema === "escuro"`;
  - `page.reload()` e, logo em `domcontentloaded`, `html` já tem `dark`;
  - voltar a clicar → sem `dark`, `localStorage.tema === "claro"`;
  - no fim, `localStorage.removeItem("tema")`.
- [ ] **Step 5:** `npm run test:e2e -- tema` → PASS (servidor a correr). Commit `feat(tema): interruptor de modo escuro em Minha conta`.

### Task 3: Guard das cores fixas + componentes partilhados

**Files:**
- Create: `src/lib/tema-cores.test.ts`
- Modify: `src/components/{PageHeader,BottomNav,skeletons,ConfirmDialog,MensalidadeVencidaBanner,MensalidadeAtrasoModal,NovaConquistaModal,GraduacaoAptosModal,AptosGraduarCard,Medalha,FaixaBJJ,ValorMensalidade,PhoneInput,PresencasCalendario,InstallPrompt}.tsx`, `src/components/ui/{dialog,button,card,badge,input,label,skeleton}.tsx`

**Interfaces:**
- Produces: `const ALVOS_TEMA: string[]` exportado do próprio teste (lista de ficheiros/pastas verificados) — Tasks 4–6 só lhe acrescentam entradas.

- [ ] **Step 1:** Teste `tema-cores.test.ts`: percorre `ALVOS_TEMA` (pastas recursivas, `.tsx`), e para cada linha sem `tema: fixo` (nem na linha anterior) falha se encontrar `/(?<![\w-])(?:[a-z-]+:)*(bg-white(?!\/)|bg-gb-gray|bg-gray-(?:50|100|200)|text-gray-\d+|border-gray-\d+|divide-gray-\d+)(?![\w\/-])/`. Mensagem: `ficheiro:linha classe`. Nesta task `ALVOS_TEMA` = os ficheiros de `src/components` listados acima.
- [ ] **Step 2:** `npm test -- tema-cores` → FAIL com a lista.
- [ ] **Step 3:** Migrar esses ficheiros pela tabela de migração. `PresencasCalendario`: hex inline de fundo/texto neutro → `rgb(var(--…))`; cores das pessoas ficam. `dialog`: overlay fica `bg-black/NN`; painel → `bg-surface`.
- [ ] **Step 4:** `npm test -- tema-cores` → PASS. Commit `refactor(tema): componentes partilhados com tokens semânticos`.

### Task 4: Início e Minha conta

**Files:** `src/app/(app)/perfil/**`, `src/app/(app)/conta/**`

- [ ] **Step 1:** Acrescentar as duas pastas a `ALVOS_TEMA`; `npm test -- tema-cores` → FAIL.
- [ ] **Step 2:** Migrar pela tabela (incl. `InicioView`, `NotificacoesModal`, `feed/*`, `DependenteModal`, `ContaView`, `loading.tsx`).
- [ ] **Step 3:** `npm test -- tema-cores` → PASS. Commit `refactor(tema): Início e Minha conta`.

### Task 5: Presença, histórico, aulas e turmas

**Files:** `src/app/(app)/{presenca,presencas,aulas,turmas}/**`

- [ ] **Step 1:** Acrescentar as pastas a `ALVOS_TEMA`; FAIL.
- [ ] **Step 2:** Migrar. `PresencaView`: contentor do QR fica `bg-white` com `tema: fixo`; o `qrcode` continua `dark "#0A0A0A" / light "#FFFFFF"`. Aviso âmbar de bloqueio em `AulasView` segue a regra das tintas.
- [ ] **Step 3:** PASS. Commit `refactor(tema): presença, histórico, aulas e turmas`.

### Task 6: Ranking, conquistas, galeria e avisos

**Files:** `src/app/(app)/{ranking,conquistas,galeria,avisos}/**`

- [ ] **Step 1:** Acrescentar as pastas a `ALVOS_TEMA` (fica a cobrir **todo** `src/app/(app)`: substituir as entradas de pasta por `src/app/(app)`); FAIL.
- [ ] **Step 2:** Migrar. Gradientes de medalhas/pódio (`from-yellow-200`, `from-slate-200`…) ficam. Lightbox da galeria já é preto — fica.
- [ ] **Step 3:** PASS. Commit `refactor(tema): ranking, conquistas, galeria e avisos`.

### Task 7: Verificação, documentação e PR

**Files:** `CLAUDE.md`

- [ ] **Step 1:** `npm run lint` (0 erros), `npm run build`, `npm test` → OK.
- [ ] **Step 2:** `npm run test:e2e` → só as 2 falhas de referência em `financeiro.spec`.
- [ ] **Step 3:** Preview (`preview_start`, preset `mobile`, `colorScheme: "dark"`): sem preferência → escuro; Início (4 pílulas), Minha conta, `/presenca` (QR branco), `/aulas`, `/presencas`, `/ranking`, `/conquistas`, `/galeria`, `/avisos`, um diálogo e um toast; screenshots. Depois `/admin` e `/tablet/login` claros com o sistema em escuro. Os 5 pontos do Review Focus.
- [ ] **Step 4:** `CLAUDE.md`: §10 tokens novos (`subtle`, `fg-subtle`, `line-strong`) + regra "ficheiros do aluno só com tokens; `tema: fixo` para excepções"; §9 `TemaScope`, `useTemaAtivo`; §14 mover "Modo escuro" de ❌ para ✅ (Fase 18, PR 3); §13 nada.
- [ ] **Step 5:** Commit `docs: modo escuro no CLAUDE.md`, push para `producao`, PR para `master` com resumo, screenshots e o plano de teste.
