# CHANGELOG — Gracie Barra Famalicão App

Histórico das alterações em produção (`renannsanches/gracie-barra-app`, ramo `master`), do mais recente para o mais antigo. O estado **actual** do produto está em [`CLAUDE.md`](../CLAUDE.md); este ficheiro conta **como lá chegámos**.

**Como manter:** cada PR que muda comportamento, dados ou infra acrescenta aqui uma entrada no topo (data de merge, `#PR`, o que mudou para o utilizador, migração de BD se houver) e actualiza o `CLAUDE.md` se algo descrito lá mudou.

**Notas de leitura**
- Datas = dia do merge em `master`. Os números `#N` são PRs do repo de produção, excepto onde se diz "repo `gb-famalicao`" (esse repo tem numeração própria).
- A história git de produção começa em **2026-05-08** ("Initial commit"), mas as migrations vão de **2026-04-24** e as Fases 1–14 do `CLAUDE.md` (auth, QR, perfil, admin, financeiro, turmas, graduações, dashboard, avisos, galeria, dependentes, PWA) já existiam. Não há registo PR a PR dessas fases.
- Alguns commits entraram em `master` directamente, sem PR (marcados "sem PR").
- ⚠️ A BD de produção **não** é reproduzível a partir de `supabase/migrations/` (ver `CLAUDE.md` §7, "Drift"). A coluna "Migração" indica o ficheiro incluído no PR, não que tenha sido aplicado por ele.

---

## Outubro 2026

### 2026-10-29
- **#72 — Reset de password à prova de dispositivo e de scanners de email.** `/nova-senha` com `?token_hash=&type=recovery` mostra um botão **Continuar**; só o clique faz o `verifyOtp` (server action `validarLinkRecuperacao`, com `Sentry.captureMessage` do código de erro). `/auth/callback` deixa de gastar o token num GET e reencaminha para essa página; falhas na recuperação vão para `/esqueci-senha?erro=link` em vez de `/login?erro=confirmacao`. Apagada a action morta `enviarResetSenha`. Spec `e2e/reset-senha.spec.ts`. Sem migração. **Configuração no Dashboard do Supabase (feita e testada no mesmo dia):** template "Reset Password" com o link `{{ .SiteURL }}/nova-senha?token_hash={{ .TokenHash }}&type=recovery` e Site URL corrigido de `http://localhost:3000` para o domínio de produção (ver `CLAUDE.md` §12). O PR #44 (só logging) foi fechado como superado.
- **#70 — Faixa de criança em alunos `adulto_infantil`.** `FaixaBJJ` procurava no mapa adulto, que não tem as faixas de criança, e o aluno aparecia sem faixa (ex.: `amarela_preta` no card "Aptos a graduar"). Agora usa o mapa infantil quando a faixa é de criança. Só `src/components/FaixaBJJ.tsx`.
- **#66 — Relatório de alunos.** Nova aba **Alunos** em `/admin/relatorios`: modal com mês, filtro Ativos / Inativos / Ativos e inativos e colunas escolhíveis (Nome fixo; Categoria, Vencimento, Valor, Plano, Alerta) → Excel/PDF, uma linha por aluno, alertas primeiro. Alertas: sem mensalidade, valor ≠ plano, kids (< 16 anos) com valor de adulto, vencimento diferente do habitual. Logo correcta nos PDFs (`public/logo-relatorio.jpg`). Regras em `src/lib/relatorio-alunos.ts` (testadas). *Esteve fora de produção por engano até hoje: o PR ficou sem merge enquanto o modo escuro seguia.*

### 2026-10-28
- **#69 — Modo escuro (PR 3 do feed).** Segue o sistema por defeito; interruptor em Minha conta › Preferências (`localStorage["tema"]`), sem flash no carregamento. Cobre as páginas do aluno, Minha conta e feed; `/admin` e `/tablet` ficam sempre claros. ~260 cores fixas passaram a tokens semânticos (`subtle`, `fg-subtle`, `line-strong`), com guarda em `tema-cores.test.ts`. `TemaScope`, `useTema`, `src/lib/tema.ts`. Sem migração.
- **#68 — Posts automáticos no feed (PR 2).** "X recebeu a faixa Y." ao registar graduação (só faixa nova que sobe, aluno visível no ranking, até 7 dias atrás) e **pódio do mês** (Top 3 Adultos/Kids) por cron `type=feed_podio`, com push. Cartões `PostGraduacao`/`PostPodio`. Migração `20261028120000_feed_dados.sql` (coluna `feed_posts.dados`).

### 2026-10-27
- **#67 — Feed da academia, Início novo e Minha conta (PR 1).** `/perfil` passa a ser o **Início** com pílulas Feed · Ranking · Conquistas · Galeria (`?tab=`); `/conta` é a nova **Minha conta**. Staff publica/edita/apaga (texto + até 10 fotos); aluno/responsável/professor põem gosto e comentam. Push de novo post e de comentário. Tabelas `feed_posts`, `feed_curtidas`, `feed_comentarios` + bucket `feed`. Migrações `20261026120000_feed.sql`, `20261027120000_feed_jpeg.sql`. Spec e planos em `docs/superpowers/`.

### 2026-10-16 — dia de recuperação e fecho de fases
- **#63 — UI: micro-interacções e consistência visual (Fase 15, partes 3–4).** Entrada de conteúdo discreta (`animar-entrada`/`animar-lista`), confirmação de presença com animação e vibração, 0 hex em classes, texto ≥ 12 px, logos em `next/image`. Fecha a Fase 15.
- **#62 — UI: toasts, diálogos e UI optimista (Fase 15, parte 2).** `sonner` para resultados, `ui/dialog` partilhado (center/sheet), `ConfirmDialog` em vez de `window.confirm()` (~37 usos), UI optimista nas listas.
- **#61 — UI: fundações e navegação instantânea (Fase 15, partes 0–1).** Tokens de cor em canais RGB, safe areas, zoom desbloqueado, `prefers-reduced-motion`, `loading.tsx`/skeletons, `BottomNav` e `PageHeader`.
- **#60 — Privacidade (RGPD).** A policy `profiles_select_all` deixava qualquer aluno ler IBAN, NIF, telefone e data de nascimento de todos. Passa a ler só o próprio, os dependentes e (staff) todos; dados de outras pessoas vêm do servidor. Migração `20261016120055_profiles_select_restrito.sql`.
- **#59 — Tablet: QR inválido/expirado/usado deixa de mostrar ecrã verde.** O RPC de produção devolve jsonb `{ sucesso, mensagem, alunos[] }` (diferente do repo); o tablet tratava qualquer resposta como sucesso. `src/app/tablet/resultado-qr.ts`.
- **#58 — Gamificação (Fase 17).** `/ranking` (mês/ano, Adultos/Kids, empates 1,1,3, ocultar-se), `/conquistas` (sequências semanais, medalhas de aulas/sequências/Mês perfeito/Top 3/anos), `NovaConquistaModal`, cron `type=conquistas`. Migração `20261016111817_gamificacao.sql` (+ as de modalidades que o #56 reintroduziu).
- **#57 — Segurança: aluno não pode alterar `perfil`, `status`, `faixa`…** Qualquer aluno podia fazer `update({perfil:"admin"})` no próprio perfil pela consola. Trigger `tg_profiles_proteger_colunas`: só `nome_completo`, `telefone`, `data_nascimento`, `foto_url`. Migração `20261016105957_profiles_proteger_colunas.sql`.
- **#56 — Repor modalidades, Colégio e descontos no `master`.** A produção corria um ramo (`feat/colegio-descontos`) deployado directamente em 08/10, nunca mergeado; o merge do #55 fez deploy do `master` e apagou essas funcionalidades. Este PR trouxe-as para o `master`. **Lição:** comparar o SHA do último deploy `production` com `master` antes de mergear (ver `CLAUDE.md` §2).
- **#54 — Colégio (13 €) e descontos.** Modalidade "Jiu-Jitsu · Colégio" com `desconta_noutro_local`; descontos mensais por aluno (`aluno_descontos`), local do aluno derivado das modalidades. Migração `20261008142639_locais_descontos.sql`.
- **#53 — Modalidades (Jiu-Jitsu, Capoeira…).** `/admin/modalidades`, mensalidade = soma das modalidades do aluno, composição em `mensalidades.itens`, `turmas.modalidade_id` filtra `/aulas`. Migração `20261008120018_modalidades.sql`.

### 2026-10-12
- **#55 — Aviso de aptos a graduar 2x por semana, por conta.** O controlo em `localStorage` fazia o modal aparecer quase em todos os logins; passa a `user_metadata.aviso_graduacao_janela` (segunda e quinta, hora de Lisboa).

### 2026-10-08
- **#51 — Grupos de alunos (Academia / Colégio).** `/admin/grupos`, filtro por grupo em Cadastros e Financeiro. Depois substituído na prática pelo local derivado das modalidades (`profiles.grupo_id` ficou obsoleto). Migrações `20261008093030_grupos_alunos.sql`, `20261008093605_grupos_alunos_staff.sql`.

### 2026-10-05
- **#50 — Modal de aptos a graduar: texto em 3 parágrafos** (inclui lembrete de registar graduações já feitas).
- **#49 — Modal semanal de alunos aptos a graduar (admin/professor)** — `GraduacaoAptosModal`.

### 2026-10-02
- **#48 — Docs: `CLAUDE.md`** com repositório de produção, lint e modal de atraso.
- **#47 — Repor `npm run lint`.** O Next 16 removeu `next lint`; novo `eslint.config.mjs` (ESLint 9 flat config), script `eslint .`.
- **#46 — Modal diário de mensalidade em atraso (≥ 2 dias)** — `MensalidadeAtrasoModal` com botão "Falar com Simone" (WhatsApp).

## Setembro 2026

### 2026-09-30
- **#45 — Login no iPad da recepção (Safari 15) + formulário sem JavaScript.** O tablet é um iPad Air em iPadOS 15. Login por route handler (`/api/auth/login`) + `window.location.assign()`, `.browserslistrc` com `safari >= 15`, `DebugConsole` (`?debug=1`). Trouxe para produção 4 commits que só existiam no repo `gb-famalicao`.

## Agosto 2026

### 2026-08-28 (merges do repo `gb-famalicao`, numeração própria)
- **repo gb-famalicao #4** — Reordena secções do formulário de novo aluno + política de senha; dependente sem login é sempre aluno (esconde o dropdown de perfil).
- **repo gb-famalicao #2** — Perfil **Responsável** no admin + telefone internacional em todos os formulários (`PhoneInput`, `src/lib/phone.ts`).
- **repo gb-famalicao #1** — Responsável puro deixa de poder marcar presença/reserva para si mesmo.

## Julho 2026

### 2026-07-31
- **#43 — Mensagens de erro específicas em vez de genéricas.** Varredura à app atrás do padrão "Tenta novamente" que escondia o erro real (cadastro distingue rate-limit de código errado/expirado, reenvio de código verifica erro, etc.).
- **#42 — Validação de senha do cadastro bate com a policy do Supabase.** O formulário aceitava 6+ caracteres; o Supabase exige 8+ com maiúscula, minúscula e número (erro `weak_password` escondido). `src/lib/senha.ts`.

### 2026-07-30
- **#41 — Reconciliar histórico de migrações local↔produção.** Traz para `supabase/migrations/` as versões que já existiam na tabela `schema_migrations` de produção (bookkeeping, **sem DDL**). Inclui, vindo do mesmo ramo, o **agendamento público de aula experimental** (`/aula-experimental`, tabela `agendamentos_experimental`, migração `20260720145247_aula_experimental_publica.sql`).

## Junho 2026

### 2026-06-11
- **#38 — Banner global de mensalidade vencida (≥ 5 dias).** Âmbar, fixo no topo das páginas do aluno, não fechável; desaparece quando o admin marca como pago. `MensalidadeVencidaBanner`.
- **#37 — `/perfil`: contagens e aptos a graduar.** Restaura Total / Esse mês / Último treino (a RLS bloqueava a contagem com a anon key → `createAdminClient()`); corrige contagem, ordem e layout dos aptos. Migração `20260611000001_grant_execute_rls_helpers.sql`.

### 2026-06-03
- **#33 — Restaurar modal de notificações e avatares de reservas em `/aulas`.** Dois commits do ramo `feat/notification-bell-modal` tinham sido promovidos a produção directamente na Vercel sem merge; o deploy seguinte (#32) apagou-os. (Mesmo padrão do #56.) Migrações incluídas: `20260520000001_bloqueio_financeiro.sql`, `20260530000001_notificacoes_mensalidade.sql`.
- *(sem PR)* **Módulo financeiro de lançamentos avulsos** — contas a pagar/receber com parcelamento (N parcelas, intervalo em dias), categorias hierárquicas ("Plano de contas"), formas de pagamento, fornecedores/clientes, filtros por mês/ano e período, aba Lançamentos nos relatórios (fluxo de caixa por categoria). Migrações `20260603000000_lancamentos_financeiros.sql`, `20260603000001_lancamentos_aluno_id.sql`.
- *(sem PR)* **Estado efectivo das mensalidades** — "atrasado" derivado do vencimento (`getEffectiveStatus`) e push com intervalos (30/05).

## Maio 2026

### 2026-05-28
- **#32 — Revisão geral: 11 bugs corrigidos.** Crítico: notificações de graduação partidas (coluna `dia_registro` pedida como `data`). Alto: mensalidades do cadastro iniciavam sempre no mês seguinte (agora regra dias 1–10 / 11+); reserva via `/turmas` não verificava bloqueio financeiro. (+ outros.)
- *(sem PR)* Docs: `CLAUDE.md` actualizado com as mudanças desde a Fase 16.

### 2026-05-26
- **#29 — Reset de password: tratar `token_hash` no callback.** `resetPasswordForEmail` gera links `token_hash + type=recovery` (OTP), não `code` (PKCE); o callback só tratava `code` e mandava para `/login?erro=confirmacao`. *Nota:* o template do email no Supabase continua por corrigir (ver `CLAUDE.md` §12).
- **#28 — Notificar responsáveis por mensalidades de dependentes** (dependentes `sem_login` não têm push próprio) + ignorar `worker-*.js` no git.

### 2026-05-25
- **#25 — `proxy.ts` + hidratação em `/perfil`.** Renomeou `middleware.ts` → `proxy.ts` (convenção do Next 16) e corrigiu o mismatch de hidratação (formatação de datas/moeda diferente entre Node e browser). O `proxy.ts` foi **revertido** no mesmo dia (a Vercel não o reconheceu) — ver commits sem PR abaixo.
- **#24 — Reset de password: códigos que caem em `/`** são reencaminhados para `/auth/callback`; detecção de origem do pedido melhorada.
- *(sem PR, mesmo dia)* revert `proxy.ts` → `middleware.ts`; `resetPasswordForEmail` passa ao cliente (cookie PKCE); correcções de estado em `/perfil`.

### 2026-05-20 (sem PR) — Fase 16
- **Notificações push + WhatsApp.** Web Push (VAPID), tabelas `push_subscriptions` e `notificacoes_graduacao_enviadas`, crons Vercel, push de avisos (incluindo professores), botão WhatsApp em mensalidade atrasada; `/api/push/send` pública no middleware.
- **Bloqueio por mensalidade em atraso ≥ 10 dias** em reservas e presenças.
- Card "Aptos a graduar" no `/perfil` para admin/professor; campo email (só leitura) na ficha do aluno.

### 2026-05-19
- **#19 — Etiquetas CSS nas turmas** (GB1, GB2, CMP, JNR…) em `/aulas` e `/turmas`. `turma-tags.ts`.
- **#16 — Elegibilidade automática para graduações.** `graduacao-rules.ts`: regras adulto/infantil, semanas qualificadas (≥ 2 presenças/semana desde a última graduação), idade e tempo mínimo; secção "Aptos a graduar" no dashboard.
- **#15 — Presenças em lote** na ficha do aluno (várias datas de uma vez).
- *(sem PR)* Sentry + testes E2E Playwright; edição do mês de referência e em lote de mensalidades; editar horário e excluir aula com reservas.

### 2026-05-18
- **#14 — Filtro por pessoa em `/presencas`** (responsável alterna entre si e cada dependente).
- *(sem PR)* Página de **relatórios** Excel e PDF; correcção de build em graduação.

### 2026-05-16
- **#13 — Criar a primeira mensalidade** quando o aluno não tem nenhuma.
- *(sem PR)* Cooldown de 30 min no QR e bloqueio de data futura no registo manual.

### 2026-05-15 (sem PR)
- **Cadastro com 3 tipos** (Aluno / Responsável / Aluno e Responsável), vários dependentes e 6 mensalidades automáticas; **email com PDF do contrato**.
- Categoria **`adulto_infantil`**; enum `responsavel`; edição inline de valor/vencimento e botão de apagar mensalidade.
- **Segurança:** `requireAdmin()`/`requireTablet()` em todas as Server Actions.

### 2026-05-14
- **#10, #8, #9 — Bloqueio do bypass a `/perfil` durante o cadastro** (`user_metadata.onboarding` em vez de query à BD no middleware) + caixa de aceitar termos + correcção de build.
- **#7 — Tablet:** câmara frontal por defeito, alternar frontal/traseira, presença manual sem QR.

### 2026-05-13
- **#6 — Validação de idade no cadastro** (< 17 anos não regista como Aluno; < 13 passa a Infantil; data de nascimento e telefone obrigatórios).
- **#5 — Campo NIF** no cadastro e no admin. Migração `20260513000001_add_nif.sql`.

### 2026-05-10
- **#4 — Correcção de build TypeScript em `/aulas`** (cast via `unknown`).
- **#3 — Responsável pode carregar fotos dos dependentes** (policies de Storage em `avatars/dependentes/{id}/` + `atualizarFotoDependente`).

### 2026-05-09
- **#2 — Navegação mobile do admin** (header em duas linhas, nav com scroll horizontal, "Voltar ao Perfil").
- *(sem PR)* Botão de apagar utilizador na lista de alunos; mensalidades dos dependentes no perfil do responsável; Next.js actualizado por vulnerabilidade e build forçado a `--webpack` no Next 16.

### 2026-05-08 (sem PR)
- Commit inicial da app (Next.js + Supabase) e correcções de utilitários de formatação PT.
