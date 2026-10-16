# Plano — Experiência mais fluida (Fase 15: UI/UX Polishing)

> Gerado com a skill `ui-ux-pro-max` + auditoria do código em 2026-10-16.
> Objectivo: a app **parecer instantânea** e **consistente** em todo o lado, sem mudar a identidade Gracie Barra.

---

## 1. Diagnóstico (o que trava a fluidez hoje)

| # | Problema | Evidência no código | Impacto |
|---|----------|---------------------|---------|
| 1 | **Zero `loading.tsx` / skeletons** — cada toque espera pelo Supabase com o ecrã congelado | 0 ficheiros `loading.tsx`, 0 `animate-pulse` | 🔴 Maior causa de "app lenta" |
| 2 | **Navegação hub-and-spoke** — aluno volta sempre a `/perfil` para ir a outro lado | 7 páginas com `← Perfil` copiado à mão | 🔴 2 toques por mudança de ecrã |
| 3 | **37 `window.confirm()` / `alert()`** — diálogos nativos cortam o fluxo | grep `confirm(\|alert(` | 🟠 |
| 4 | **15 modais feitos à mão** (`fixed inset-0`) — sem focus trap, Esc, animação ou scroll-lock consistentes | `DependenteModal`, `AvisosView`, `ContasView`, … | 🟠 |
| 5 | **Sem toasts** — sucesso/erro aparece inline, às vezes fora do ecrã | `@radix-ui/react-toast` instalado mas não usado | 🟠 |
| 6 | **Zoom bloqueado** — `maximumScale: 1` no viewport | `src/app/layout.tsx:90` | 🟠 Falha WCAG 1.4.4 |
| 7 | **Sem safe areas** — `statusBarStyle: black-translucent` põe conteúdo debaixo do notch no PWA iOS | 0 usos de `env(safe-area-*)` | 🟠 |
| 8 | **Sem `prefers-reduced-motion`** | 0 usos | 🟡 |
| 9 | **Tokens desalinhados** — shadcn `--primary` é quase-preto, a marca é vermelha; `--radius` definido 2× (0.75 e 0.625); `gb-blue` é vermelho | `globals.css`, `tailwind.config.ts` | 🟡 |
| 10 | **Cores soltas** — 80 hex hard-coded + 180 `red-*` misturados com `gb-blue` | grep | 🟡 |
| 11 | **Bugs no `Button`** — `size="lg"` usa `h-13` (não existe no Tailwind 3 → sem altura); `ghost` faz hover azul (`bg-blue-50`) | `src/components/ui/button.tsx` | 🟡 |
| 12 | **24 `<img>` cru** vs 7 `next/image` — sem lazy load nem reserva de espaço (CLS) | grep | 🟡 |
| 13 | **15 textos a 9–11px** (`text-[10px]` etc.) | grep | 🟡 Legibilidade |

**Restrição fixa:** o tablet da recepção é **Safari 15** (iPadOS 15). Tudo o que toca `/tablet` tem de funcionar lá:
- nada de `oklch()` (só Safari 15.4+) nos tokens usados pelo tablet → usar hex/rgb;
- nada de View Transitions API, `:has()` ou `dvh` sem fallback.

---

## 2. Direcção visual (o que a skill recomendou e o que foi aproveitado)

| Recomendação da skill | Decisão | Porquê |
|-----------------------|---------|--------|
| Paleta laranja `#F97316` + verde | ❌ Descartada | A marca GB é vermelha — não se mexe |
| Padrão "App Store landing" | ❌ Descartado | Não é landing page, é app de uso diário |
| Estilo "minimalismo com contraste alto" | ✅ Já é o caminho actual (header preto + cards brancos) | Manter, só tornar consistente |
| Motion 150–300 ms, ease-out a entrar / ease-in a sair, 1–2 elementos animados por ecrã | ✅ Adoptado | Regra base de toda a Fase 3 |
| Stagger leve em listas (≤ 6 itens, 40–60 ms) | ✅ Adoptado (CSS, sem GSAP) | GSAP é peso a mais para isto |
| Skeleton com as dimensões reais do conteúdo | ✅ Adoptado | Evita salto de layout |
| Sonner para toasts, AlertDialog para confirmações, Sheet para painéis | ✅ Adoptado | Padrão shadcn |
| Tipografia Barlow Condensed para títulos | ⚪ Opcional | Pode dar ar "atlético" a números/KPIs; SF Pro continua no corpo. Decidir antes da Fase 4 |

### Tokens alvo (Fase 0)

```css
:root {
  --brand:            #CC0000;  /* = gb-blue actual */
  --brand-dark:       #990000;
  --brand-light:      #E31E24;
  --surface:          #FFFFFF;
  --background:       #F5F5F5;  /* = gb-gray */
  --ink:              #0A0A0A;  /* = gb-black, headers */
  --muted-foreground: #6B7280;
  --success:          #16A34A;
  --warning:          #D97706;  /* âmbar dos avisos financeiros */
  --destructive:      #DC2626;
  --radius:           0.75rem;  /* uma só definição */
  --ease-out:         cubic-bezier(0.16, 1, 0.3, 1);
  --dur-fast:         150ms;
  --dur-base:         220ms;
}
```
`--primary` do shadcn passa a apontar para `--brand`. `gb-blue` fica como alias para não reescrever 356 usos de uma vez.

---

## 3. Plano por fases

Cada fase = 1 PR para `master` em `renannsanches/gracie-barra-app`, com preview Vercel verificado a 375 px.

> **Estado (2026-10-16):** Fases 0–1 no PR #61, Fase 2 no PR #62, Fases 3–4 em `feat/ui-polimento` (empilhados por esta ordem).

### Fase 0 — Fundações · ~2–3 h ✅
1. Tokens acima em `globals.css` + `tailwind.config.ts` (apagar o bloco shadcn neutro duplicado).
2. Remover `maximumScale: 1`; adicionar `viewportFit: "cover"`; garantir inputs ≥ 16 px (evita o zoom automático do iOS, motivo habitual deste bloqueio).
3. Utilitários `pt-safe` / `pb-safe` (`env(safe-area-inset-*)`) e aplicá-los aos headers.
4. Regra global `@media (prefers-reduced-motion: reduce)` que corta animações/transições.
5. Corrigir `Button`: `lg` → `h-12`; `ghost` → hover `bg-brand/10`; adicionar `active:scale-[0.98]` + `transition` de 150 ms.

### Fase 1 — Navegação instantânea · ~5–7 h ✅  ← maior ganho percebido
1. Componente `<Skeleton>` (shadcn) + **`loading.tsx` por rota**, com o formato real de cada página:
   `perfil`, `aulas`, `presencas`, `avisos`, `galeria`, `galeria/[id]`, `turmas`, `admin`, `admin/alunos`, `admin/alunos/[id]`, `admin/financeiro`, `admin/turmas/[id]`.
2. Componente `<PageHeader>` partilhado (header preto, título, voltar, safe area) → substitui os 7 headers copiados.
3. **Barra de navegação inferior para alunos** (5 itens): Início · Aulas · **Presença (QR, botão central)** · Histórico · Avisos (ponto de não lidos).
   Galeria, Conquistas, Ranking e Turmas abrem a partir do Início (contam como tab Início).
   Só existe no grupo `(app)` — não aparece em `/tablet`, `/admin`, `/login`, `/cadastro`. Conteúdo usa `pb-bottom-nav`.
   Os atalhos do Início passaram de `router.push` para `<Link>` (prefetch).
4. Admin mobile: a barra horizontal de 8 itens faz scroll até ao item activo ao abrir.

### Fase 2 — Feedback e diálogos · ~5–6 h ✅
1. `sonner` + `<FeedbackHosts>` nos layouts `(app)` e `admin` (não no `/tablet`). Toasts no topo, abaixo do notch → `toast.success` / `toast.error` em apagar/criar/editar (avisos, álbuns, fotos, financeiro, grupos, modalidades, alunos, turmas, perfil) e reservas. Erros de formulário continuam junto ao formulário.
2. `confirmar()` imperativo (Radix AlertDialog) → substituiu os 38 `confirm`/`alert`. Foco inicial em "Cancelar".
3. `<Dialog>` partilhado (`variant="center" | "sheet"`) → 16 modais migrados (9 admin, 7 aluno, incl. lightbox da galeria em ecrã inteiro).
4. UI optimista: `useOptimistic` em marcar/desmarcar pago (financeiro); reservar/cancelar aula aplica e reverte se o servidor recusar.
   Também: `apagarAviso`/`apagarAlbum`/`apagarFoto` deixaram de falhar em silêncio.

### Fase 3 — Micro-interacções · ~2–3 h ✅
1. Feedback de toque (`active:scale`, 150 ms) nos atalhos do Início, álbuns, fotos, acordeões e botões de reserva.
2. `.animar-entrada` / `.animar-lista` (globals.css): fade + 8 px a subir, 220 ms, cascata de 40 ms até 6 itens — em todas as páginas do aluno. Em `/aulas` a cascata repete ao trocar de dia ou de pessoa.
3. Presença confirmada: check com zoom + rotação, anel que pulsa uma vez e `navigator.vibrate(15)`.
4. Só `opacity`/`transform`; `prefers-reduced-motion` também zera os atrasos. O `/tablet` não foi tocado.

### Fase 4 — Consistência visual · ~3–4 h ✅
1. 0 hex em classes: `#1a1a1a`→`ink`, `#c8102e`→`brand`, `#a50d25`→`brand-dark`, WhatsApp → token `whatsapp`. O hex que sobra é dado (cores por pessoa no calendário) ou o contrato do cadastro.
   Os `red-*` de erro/estado ficam na escala do Tailwind (já consistentes e com contraste AA); só os usos de marca passaram a `brand`.
2. 0 textos < 12 px (25 passaram a `text-xs`).
3. Logos → `next/image` (admin, perfil, login, esqueci/nova senha, aula experimental). **Avatares ficam em `<img>`**: o upload sobrescreve o mesmo caminho e o cache do `next/image` (4 h) mostraria a foto antiga. Galeria já usava `next/image`.
4. Barlow Condensed — não feito (opcional, decisão de marca).

**Total estimado: ~17–23 h**, entregável em 5 PRs pequenos.

---

## 4. Fora de âmbito (de propósito)
- **Dark mode** — só 3 classes `dark:` no código; seria um projecto à parte.
- **Partir os componentes gigantes** (`CadastroForm` 2020 linhas, `AlunoEditView` 1445, `PerfilView` 1073) — só se tocam nas zonas que as fases acima exigem.
- **View Transitions API** — não corre no Safari 15 do tablet; pode entrar mais tarde como melhoria progressiva só na área do aluno.

---

## 5. Checklist antes de cada merge (da skill)
- [ ] Alvos de toque ≥ 44×44 px
- [ ] Contraste ≥ 4.5:1 no texto
- [ ] Foco visível em teclado
- [ ] `prefers-reduced-motion` respeitado
- [ ] Sem scroll horizontal a 375 px
- [ ] Nada debaixo do notch / home indicator no PWA iOS
- [ ] `/tablet` testado (ou pelo menos sem APIs fora do Safari 15)
- [ ] `npm run build` verde + `npm run test:e2e` sem novas falhas (7/9 é a referência actual)
