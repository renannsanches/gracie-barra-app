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

> **Estado (2026-10-16):** Fases 0 e 1 implementadas no ramo `feat/ui-fluidez`. Fases 2–4 por fazer.

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

### Fase 2 — Feedback e diálogos · ~5–6 h
1. `sonner` + `<Toaster>` no layout raiz → `toast.success` / `toast.error` nas Server Actions (avisos, financeiro, alunos, reservas).
2. `<ConfirmDialog>` (Radix AlertDialog, já incluído no pacote `radix-ui`) → substituir os 37 `confirm`/`alert`.
3. Migrar os 15 modais para `<Dialog>` / `<Sheet side="bottom">` partilhados: focus trap, Esc, scroll-lock, scrim 50 %, animação 200 ms.
4. UI optimista (`useOptimistic`, React 19) em **reservar/cancelar aula** e **marcar mensalidade paga**.

### Fase 3 — Micro-interacções · ~2–3 h
1. Feedback de toque em cards e linhas clicáveis (opacidade/escala, 80–150 ms).
2. Entrada de conteúdo: fade + 8 px slide-up, 220 ms; stagger nas listas de aulas/avisos (máx. 6 itens).
3. Ecrã de presença confirmada: check animado + `navigator.vibrate(10)` (Android; iOS ignora sem erro).
4. Tablet: transições só com `opacity`/`transform` (seguro em Safari 15).

### Fase 4 — Consistência visual · ~3–4 h
1. Trocar os 80 hex e 180 `red-*` por tokens (`brand`, `destructive`, `success`, `warning`).
2. Escala tipográfica fixa (12 / 14 / 16 / 18 / 22 / 28 px) — eliminar os 15 textos < 12 px.
3. `<img>` → `next/image` com `sizes` e `loading="lazy"`, a começar pela galeria.
4. (Opcional) Barlow Condensed nos números grandes (contagem de treinos, KPIs do dashboard).

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
