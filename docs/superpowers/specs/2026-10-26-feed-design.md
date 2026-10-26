# Feed da academia, Início novo e modo escuro — design

> Aprovado em 2026-10-26. Próximo passo: plano de implementação.
> Marcado **[decisão minha]** = escolha do Claude durante o brainstorming, não do dono — aceites na aprovação, mas revisíveis.

## 1. Contexto e porquê

A app hoje é sobretudo presenças + gestão. O dono quer torná-la única: uma **"semi-rede social" da academia**, onde professores publicam e alunos reagem. O diferencial: o feed também se alimenta sozinho do que só esta app sabe (graduações, ranking) — nenhuma rede genérica sabe a faixa de ninguém.

- **Feed = celebração e comunidade**: fotos de graduação, chamadas para competições, momentos do treino.
- **Avisos continua** para o administrativo (feriado, horário, mensalidade). Não se fundem.
- Referências visuais (3 imagens do utilizador): ecrãs escuros, cards arredondados, botões em pílula, contadores ♥/💬 em pílula, página de definições em grupos. Cor de destaque = vermelho GB (`brand` #CC0000) em vez do lima.

**Sucesso [palpite meu]:** alunos abrem a app fora dos dias de treino; professores publicam ≥1×/semana.

## 2. Objetivos

1. Início novo (layout B) com pílulas **Feed · Ranking · Conquistas · Galeria**.
2. Página nova **Minha conta** (engrenagem).
3. Feed: posts de professores/admins (texto + fotos), curtidas e comentários.
4. Posts automáticos: graduações e pódio do mês.
5. Modo escuro em todas as páginas do aluno.

## 3. Fora de âmbito / anti-objetivos

- **Vídeo — fora por agora.** Futuro: **Bunny Stream** (upload directo do telemóvel, transcodificação HEVC→todos os aparelhos, streaming adaptativo, ~1–5 €/mês). Rejeitados: Supabase Storage (50 MB/ficheiro no free, sem transcodificação) e links YouTube. Registar no `CLAUDE.md` (secção "Por implementar").
- Aluno publicar, partilhar, DMs/chat, seguidores/contagem de seguidores.
- Medalhas individuais no feed (100 aulas, sequências) — encheriam o feed.
- Denúncias/moderação automática, limites de taxa — academia pequena.
- Modo escuro no painel admin e no tablet — ficam claros.
- **Anti-objetivos:** virar Instagram genérico; feed barulhento; Início mais lento que hoje; partir o tablet (Safari 15).

## 4. Quem faz o quê

| Quem | Vê feed | Publica | Curte / comenta | Apaga |
|---|---|---|---|---|
| Admin, professor | sim | sim (texto + fotos) | sim | qualquer post e comentário |
| Aluno, responsável (têm login) | sim | não | sim | os próprios comentários |
| Dependente sem login | — | — | — (só aparece em fotos/posts) | — |
| Tablet | não | — | — | — |

- Todos veem **quem curtiu** (estilo Instagram). Só coração.
- Comentário até **300 caracteres** [decisão minha].
- Quem consegue abrir a app vê o feed, incluindo quem tem mensalidade em atraso [decisão minha].

## 5. Ecrãs

### 5.1 Início (`/perfil`) — layout B (mockup aprovado)
De cima para baixo:
1. Cabeçalho: logo "GRACIE BARRA FAMALICÃO", sino (notificações, como hoje), **engrenagem** → Minha conta.
2. Avatar (troca de foto como hoje) + nome + **faixa desenhada** (`FaixaBJJ`) com "Azul · 2 graus". Responsável puro sem faixa: só nome.
3. Pílulas **Feed · Ranking · Conquistas · Galeria** — trocam o conteúdo **no próprio Início**; Feed por defeito. Separador activo na URL (`?tab=ranking`) para o "voltar" funcionar [decisão minha].
4. Conteúdo do separador. Ranking/Conquistas/Galeria reutilizam as vistas existentes (`RankingView`, `ConquistasView`, galeria). As rotas `/ranking`, `/conquistas`, `/galeria`, `/galeria/[id]` continuam a funcionar (links de push, deep links).

**Sai do Início:** grelha de atalhos (Presença, Histórico, Aulas, Avisos já estão na `BottomNav`; Galeria vira pílula) e `CardGamificacao` (Ranking/Conquistas viram pílulas).
**Fica igual:** `MensalidadeVencidaBanner`, `MensalidadeAtrasoModal`, `NovaConquistaModal`, `GraduacaoAptosModal` (staff), `NotificacoesModal`, `BottomNav`.
Para staff: o card "aptos a graduar" passa para Minha conta junto ao Dashboard [decisão minha].

### 5.2 Minha conta (rota nova, ex.: `/conta`)
Inspirada na referência 3 (grupos de linhas, setas, pílula "Sair" clara com texto vermelho):
- Linha do perfil (avatar + nome) → **Dados pessoais** (edição como hoje).
- Grupo: **Faixa e graduação** (stats + histórico, como o accordion actual) · **Mensalidades** (com estado "Em dia/Em atraso") · **Dependentes** (escondido se não tiver).
- Grupo: **Modo escuro** (interruptor) · **Notificações** (push on/off, como hoje) · **Dashboard** (só staff) · aptos a graduar (só staff).
- **Sair**.
Os accordions do `PerfilView.tsx` actual mudam-se para aqui (sub-páginas ou secções — decisão do builder).

### 5.3 Feed (separador do Início)
- Lista de posts, mais recentes primeiro, paginação infinita (~10 por página) [decisão minha].
- **Card do post:** avatar + nome do autor + "há 3 h"; texto; fotos (até **10 por post**, deslizar com indicador de pontos) [decisão minha]; pílulas ♥ N e 💬 N.
- Tocar ♥ → curte/descurte com UI optimista. Tocar no número de curtidas → bottom sheet com a lista de quem curtiu.
- Tocar 💬 → comentários (sheet ou página do post — builder decide), campo com contador 0/300.
- **Staff:** botão "+" no separador Feed → compositor (texto + escolher fotos, compressão WebP no cliente antes do upload, como já se faz nos avatares). Menu "⋯" no post: editar (autor), apagar (autor/admin) com `confirmar()`.
- Estado vazio: convite, não desculpa ("A academia ainda não publicou nada").
- Posts automáticos têm autor **"Gracie Barra Famalicão"** com o logo [decisão minha].

## 6. Posts automáticos

### 6.1 Graduação
- Disparado em `registrarGraduacao` (`src/app/admin/alunos/[id]/graduacao-actions.ts`), depois do insert em `historico_graduacoes`.
- Conteúdo: "João Silva recebeu a faixa azul" (ou "o 2.º grau na faixa azul") + faixa desenhada. Professor pode depois **juntar fotos** editando o post.
- Alunos com `ocultar_ranking = true` não geram post.
- Nome do aluno no post: igual ao ranking (ex.: "Primeiro U." onde o ranking abrevia) [decisão minha].
- **Graduações retroactivas:** só gera post se `data_graduacao` estiver nos últimos 7 dias; mais antigas (backfill, correcções) não geram post nem push. Post ordenado pela hora em que foi registado [decisão minha].
- `excluirGraduacao` remove o post correspondente.
- **Só faixa nova gera post** (mudança de cor). Graus novos não geram post.
- **Um post por aluno, sem push.** Posts automáticos de graduação não notificam ninguém.

### 6.2 Pódio do mês
- Um post no início de cada mês com o Top 3 de **Adultos** e de **Kids** do mês anterior, mesmas regras do `/ranking` (categoria pela regra da graduação, empates 1,1,3, sem ocultos). Reutiliza `ranking_presencas` e `src/lib/gamificacao.ts`.
- Gerado pelo cron diário existente (`/api/push/send`, novo `type=feed_podio` em `vercel.json`), idempotente por mês.
- Manda push a todos (1×/mês).

## 7. Notificações (push)

- Post manual novo → push a todos os activos (aluno, responsável, professor), como `sendPushAviso` em `src/lib/push-sender.ts`. Fire-and-forget.
- Curtidas → ninguém.
- Comentário → push só ao autor do post (posts automáticos: ninguém) [o "ninguém" é decisão minha].
- Posts automáticos de graduação → sem push. Pódio do mês → push a todos.
- Dependentes não têm subscrição; não recebem (não são autores).

## 8. Modo escuro

- Todas as páginas do grupo `(app)` (aluno/responsável) + Minha conta + feed. Admin e `/tablet` ficam sempre claros.
- Começa a seguir o sistema; interruptor em Minha conta grava a escolha (por dispositivo). Sem "flash" de tema errado ao abrir.
- Tokens em `src/app/globals.css` já são canais RGB; acrescentar o conjunto escuro (`canvas`, `surface`, texto, bordas). **Nada de `oklch()`.** `tailwind.config.ts` já tem `darkMode: ["class"]`.
- ~260 cores fixas (`bg-white`, `text-gray-*`, `bg-gb-gray`…) em 18 ficheiros de `src/app/(app)` + componentes partilhados (`PageHeader`, `BottomNav`, `ui/dialog`, `skeletons`, banners/modais) passam para tokens semânticos.
- `theme-color` da PWA acompanha o tema [decisão minha].

## 9. Restrições técnicas (do projecto)

- Padrões do `CLAUDE.md`: Server Component → `*View.tsx` → `*-actions.ts` com `requireAdmin()`/guard, `createAdminClient()` para mutations, retorno `{ ok, erro }`, `revalidatePath`.
- RLS: `profiles` só deixa ler o próprio → nomes/fotos de autores, de quem curtiu e de quem comentou vêm do servidor com admin client e só as colunas necessárias.
- Fotos: novo bucket de Storage (ex.: `feed`), WebP comprimido no cliente; uploads não atómicos são débito conhecido — limpar ficheiros se o insert falhar.
- UI: `ui/dialog` (sheet no telemóvel), `confirmar()`, `toast` do sonner, `loading.tsx` com skeleton por rota nova, texto ≥12px, campos ≥16px, interface pt-PT. **Construir a UI com a skill `ui-ux-pro-max`** (e outras de design se necessário).
- Tablet = Safari 15: nada do tema escuro nem do feed pode chegar ao `/tablet`.
- Testes: `e2e/gamificacao.spec.ts` verifica o card no `/perfil` → actualizar para as pílulas. Lógica pura (pódio, agrupamentos, texto do post de graduação) com vitest.
- Actualizar `CLAUDE.md`: rotas, tabelas, componentes, nota do Bunny Stream.
- Fluxo git: ramo `feat/...` → PR para `master` em `renannsanches/gracie-barra-app`.

## 10. Perguntas abertas

Nenhuma. (Respondidas: só faixa nova gera post; um post por aluno, sem push.)

## 11. Entrega sugerida (PRs por ordem) [decisão minha]

Cada merge em `master` vai para produção, por isso nenhum PR pode deixar a app num estado meio-feito:
1. Início B + Minha conta + feed manual completo (tabelas, bucket, compositor, curtidas, comentários, push) — só tema claro, mas já com tokens semânticos nos ficheiros novos.
2. Posts automáticos (graduação + pódio).
3. Modo escuro completo de uma vez: tokens escuros, interruptor em Minha conta, migração das ~260 cores fixas. O tema escuro só é ligado neste PR.

## 12. Deixado ao builder

Esquema exacto das tabelas (posts, fotos, curtidas, comentários), políticas RLS, nome da rota de Minha conta, sub-páginas vs secções, componente de carrossel, paginação (cursor vs offset), biblioteca de tema (ex.: `next-themes`) ou solução própria.

## 13. Verificação

**Problema:** dev, e2e e produção partilham a mesma BD Supabase e as mesmas chaves de push. Regras para testar sem atingir alunos reais [decisão minha]:
- Push só é enviado quando `VERCEL_ENV === "production"`; fora disso regista em log e não envia (vale também para os pushes existentes).
- Testes e2e e verificação manual apagam os posts/comentários que criam no fim.
- Lógica dos posts automáticos (texto, regra dos 7 dias, `ocultar_ranking`, pódio) coberta por vitest; o e2e cobre o caminho "aluno de teste com `ocultar_ranking` → sem post". O caminho positivo é confirmado em produção com a primeira graduação real.

- `npm run lint`, `npm run build`, `npm test`, `npm run test:e2e` (referência: 2 falhas conhecidas em `financeiro.spec`).
- Dev server (`preview_start`): Início com as 4 pílulas e `?tab=`; Minha conta completa; alternar modo escuro sem flash, e em `mobile` preset; staff cria post com 3 fotos, edita, apaga; aluno curte (lista de quem curtiu), comenta 300/301 caracteres, apaga o próprio comentário; registar graduação de teste → post automático; aluno com `ocultar_ranking` → sem post; `/api/push/send?type=feed_podio` com `?dry=1`.
- `/tablet` e `/admin` continuam claros e inalterados.
