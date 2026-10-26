import webpush from "web-push";
import { createAdminClient } from "./supabase/admin";
import { calcularElegibilidade } from "./graduacao-rules";
import { CONQUISTAS_POR_CODIGO } from "./gamificacao";
import { pushAtivo } from "./push-ativo";
import type { CorFaixa } from "./types";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function sendToSubscriptions(
  subs: PushSubscriptionRow[],
  payload: { title: string; body: string; url: string },
): Promise<boolean> {
  if (!pushAtivo(process.env.VERCEL_ENV)) {
    console.info(`[push] desligado fora de produção: ${subs.length} envio(s) — "${payload.title}"`);
    return false;
  }
  await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      )
    )
  );
  return true;
}

async function getSubscriptions(userIds: string[]): Promise<PushSubscriptionRow[]> {
  if (userIds.length === 0) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", userIds);
  return data ?? [];
}

/**
 * Dependentes sem login não têm subscrição própria: devolve dependente_id → responsavel_id
 * para notificar o responsável. Quem não estiver no mapa é notificado directamente.
 */
async function mapearDependentesParaResponsaveis(
  admin: ReturnType<typeof createAdminClient>,
  alunoIds: string[],
): Promise<Record<string, string>> {
  const idMap: Record<string, string> = {};
  if (alunoIds.length === 0) return idMap;
  const { data: semLoginProfiles } = await admin
    .from("profiles")
    .select("id")
    .in("id", alunoIds)
    .eq("sem_login", true);
  if (semLoginProfiles?.length) {
    const { data: deps } = await admin
      .from("dependentes")
      .select("dependente_id, responsavel_id")
      .in("dependente_id", semLoginProfiles.map((p) => p.id));
    for (const d of deps ?? []) idMap[d.dependente_id] = d.responsavel_id;
  }
  return idMap;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

type TipoNotifMens =
  | "vence_amanha"
  | "vence_hoje"
  | "atraso_3d"
  | "atraso_7d"
  | "atraso_bloqueio";

const MENSAGENS_MENS: Record<TipoNotifMens, { title: string; body: string }> = {
  vence_amanha: {
    title: "Mensalidade vence amanhã",
    body: "A tua mensalidade vence amanhã. Não te esqueças de regularizar.",
  },
  vence_hoje: {
    title: "Mensalidade vence hoje",
    body: "A tua mensalidade vence hoje. Fala com a Simone para regularizar.",
  },
  atraso_3d: {
    title: "Mensalidade em atraso",
    body: "A tua mensalidade está vencida há 3 dias. Contacta a academia.",
  },
  atraso_7d: {
    title: "⚠️ Mensalidade em atraso",
    body: "A tua mensalidade está vencida há mais de 1 semana. Regulariza para evitar bloqueio.",
  },
  atraso_bloqueio: {
    title: "🚫 Acesso pode ser bloqueado",
    body: "Mensalidade vencida há ≥10 dias. O acesso ao QR e às reservas pode ser bloqueado. Fala com a Simone.",
  },
};

/**
 * Classifica uma mensalidade em qual tipo de notificação deve receber HOJE.
 * Usa ranges (não pontos exatos) para tolerar cron a falhar um dia.
 * O dedup table garante que cada (mensalidade, tipo) só envia uma vez.
 */
function classificarMensalidade(
  vencimento: string,
  todayStr: string,
  amanhaStr: string,
): TipoNotifMens | null {
  if (vencimento === amanhaStr) return "vence_amanha";
  if (vencimento === todayStr) return "vence_hoje";
  // só vencidas (vencimento < hoje) entram nas tiers de atraso
  if (vencimento >= todayStr) return null;
  const diff = Math.floor(
    (new Date(todayStr).getTime() - new Date(vencimento).getTime()) / 86400000,
  );
  if (diff >= 10) return "atraso_bloqueio";
  if (diff >= 7)  return "atraso_7d";
  if (diff >= 3)  return "atraso_3d";
  return null;
}

export async function sendPushMensalidade() {
  const admin = createAdminClient();
  const today = new Date();
  const todayStr = toDateStr(today);
  const amanhaStr = toDateStr(addDays(today, 1));
  const limiteSuperior = amanhaStr;            // até amanhã (lembrete)
  const limiteInferior = toDateStr(addDays(today, -60)); // ignora mensalidades muito antigas

  const { data: rows } = await admin
    .from("mensalidades")
    .select("id, aluno_id, data_vencimento, status")
    .neq("status", "pago")
    .gte("data_vencimento", limiteInferior)
    .lte("data_vencimento", limiteSuperior);

  if (!rows || rows.length === 0) return;

  // classifica cada mensalidade
  type Pending = { mensalidadeId: string; alunoId: string; tipo: TipoNotifMens };
  const pendings: Pending[] = [];
  for (const r of rows) {
    const tipo = classificarMensalidade(r.data_vencimento, todayStr, amanhaStr);
    if (!tipo) continue;
    pendings.push({ mensalidadeId: r.id, alunoId: r.aluno_id, tipo });
  }
  if (pendings.length === 0) return;

  // dedup: remove (mensalidade, tipo) já enviados
  const { data: jaEnviados } = await admin
    .from("notificacoes_mensalidade_enviadas")
    .select("mensalidade_id, tipo")
    .in("mensalidade_id", pendings.map((p) => p.mensalidadeId));
  const enviadosSet = new Set(
    (jaEnviados ?? []).map((e) => `${e.mensalidade_id}::${e.tipo}`),
  );
  const aEnviar = pendings.filter(
    (p) => !enviadosSet.has(`${p.mensalidadeId}::${p.tipo}`),
  );
  if (aEnviar.length === 0) return;

  // dependentes (sem_login) → notificar o responsável
  const idMap = await mapearDependentesParaResponsaveis(
    admin,
    [...new Set(aEnviar.map((p) => p.alunoId))],
  );

  // agrupa por tipo → conjunto de userIds resolvidos
  const porTipo: Record<TipoNotifMens, Set<string>> = {
    vence_amanha:    new Set(),
    vence_hoje:      new Set(),
    atraso_3d:       new Set(),
    atraso_7d:       new Set(),
    atraso_bloqueio: new Set(),
  };
  for (const p of aEnviar) {
    porTipo[p.tipo].add(idMap[p.alunoId] ?? p.alunoId);
  }

  // envia + marca dedup
  for (const [tipo, userIds] of Object.entries(porTipo) as [TipoNotifMens, Set<string>][]) {
    if (userIds.size === 0) continue;
    const subs = await getSubscriptions([...userIds]);
    if (subs.length === 0) continue;
    await sendToSubscriptions(subs, { ...MENSAGENS_MENS[tipo], url: "/perfil" });
  }

  // fora de produção não grava "já enviado": a BD é partilhada e o cron de produção ainda tem de enviar
  if (!pushAtivo(process.env.VERCEL_ENV)) return;
  // marca todos como enviados (mesmo se push não chegou — evita re-tentativa diária)
  await admin
    .from("notificacoes_mensalidade_enviadas")
    .insert(
      aEnviar.map((p) => ({ mensalidade_id: p.mensalidadeId, tipo: p.tipo })),
    );
}

export async function sendPushAviso() {
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id")
    .eq("status", "ativo")
    .in("perfil", ["aluno", "responsavel", "professor"]);

  if (!profiles || profiles.length === 0) return;

  const subs = await getSubscriptions(profiles.map((p) => p.id));
  if (subs.length === 0) return;

  await sendToSubscriptions(subs, {
    title: "Novo aviso",
    body: "Novo aviso disponível. Acede ao app Gracie Barra Famalicão para ver.",
    url: "/avisos",
  });
}

export async function sendPushResponsavelAula() {
  const admin = createAdminClient();
  const todayStr = toDateStr(new Date());

  // aulas de hoje com turmas infantil
  const { data: aulas } = await admin
    .from("aulas")
    .select("turma_id, turmas!inner(categoria)")
    .eq("data", todayStr)
    .eq("status", "agendada")
    .eq("turmas.categoria", "infantil");

  if (!aulas || aulas.length === 0) return;

  // todos os responsaveis com dependentes
  const { data: dependentes } = await admin
    .from("dependentes")
    .select("responsavel_id");

  if (!dependentes || dependentes.length === 0) return;

  const responsavelIds = [...new Set(dependentes.map((d) => d.responsavel_id))];
  const subs = await getSubscriptions(responsavelIds);
  if (subs.length === 0) return;

  await sendToSubscriptions(subs, {
    title: "Aula hoje",
    body: "Não se esqueça de reservar a aula de hoje para o vosso filho. As vagas são limitadas.",
    url: "/aulas",
  });
}

export async function sendPushGraduacao() {
  const admin = createAdminClient();

  // fetch all active alunos with faixa
  const { data: alunos } = await admin
    .from("profiles")
    .select("id, faixa, graus, categoria, data_nascimento, created_at")
    .eq("status", "ativo")
    .eq("perfil", "aluno")
    .not("faixa", "is", null);

  if (!alunos || alunos.length === 0) return;

  // fetch admin/professor push subscriptions once
  const { data: staffProfiles } = await admin
    .from("profiles")
    .select("id")
    .in("perfil", ["admin", "professor"]);

  const staffSubs = await getSubscriptions((staffProfiles ?? []).map((p) => p.id));
  if (staffSubs.length === 0) return;

  for (const aluno of alunos) {
    const { data: presencas } = await admin
      .from("presencas")
      .select("dia_registro")
      .eq("aluno_id", aluno.id);

    const { data: historico } = await admin
      .from("historico_graduacoes")
      .select("*")
      .eq("aluno_id", aluno.id)
      .order("data_graduacao", { ascending: false });

    const resultado = calcularElegibilidade(
      aluno as Parameters<typeof calcularElegibilidade>[0],
      (presencas ?? []).map((p) => p.dia_registro),
      historico ?? [],
    );

    if (!resultado.elegivel || !resultado.proximaPromocao) continue;

    const faixaAlvo = resultado.proximaPromocao.faixa as CorFaixa;

    // check if already notified for this target belt
    const { data: jaNotificado } = await admin
      .from("notificacoes_graduacao_enviadas")
      .select("id")
      .eq("aluno_id", aluno.id)
      .eq("faixa", faixaAlvo)
      .maybeSingle();

    if (jaNotificado) continue;

    // fora de produção não grava o registo de dedup (BD partilhada com a produção)
    if (!pushAtivo(process.env.VERCEL_ENV)) {
      console.info(`[push] desligado fora de produção: graduação não registada (aluno ${aluno.id}, faixa ${faixaAlvo})`);
      return;
    }

    // insert dedup record
    await admin
      .from("notificacoes_graduacao_enviadas")
      .insert({ aluno_id: aluno.id, faixa: faixaAlvo });

    // fetch aluno name
    const { data: profile } = await admin
      .from("profiles")
      .select("nome_completo")
      .eq("id", aluno.id)
      .single();

    const nome = profile?.nome_completo ?? "Aluno";

    await sendToSubscriptions(staffSubs, {
      title: "Aluno apto a graduar",
      body: `${nome} está apto para ser promovido. Verifica o perfil.`,
      url: `/admin/alunos/${aluno.id}`,
    });
  }
}

/**
 * Medalhas ganhas que o aluno ainda não viu na app: 1 push por pessoa (dependentes → responsável).
 * Marca notificada_em em todas, mesmo sem subscrição, para não repetir no dia seguinte.
 */
export async function sendPushConquistas() {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("conquistas")
    .select("id, aluno_id, codigo")
    .is("vista_em", null)
    .is("notificada_em", null)
    .limit(1000);
  if (!rows || rows.length === 0) return;

  const alunoIds = [...new Set(rows.map((r) => r.aluno_id as string))];
  const [idMap, { data: perfis }] = await Promise.all([
    mapearDependentesParaResponsaveis(admin, alunoIds),
    admin.from("profiles").select("id, nome_completo").in("id", alunoIds),
  ]);
  const primeiroNome: Record<string, string> = Object.fromEntries(
    (perfis ?? []).map((p) => [p.id, (p.nome_completo as string).split(" ")[0]]),
  );

  // destinatário → medalhas (com o nome do dependente, quando é o caso)
  const porDestino = new Map<string, { codigo: string; dependente?: string }[]>();
  for (const r of rows) {
    const destino = idMap[r.aluno_id] ?? r.aluno_id;
    const lista = porDestino.get(destino) ?? [];
    lista.push({ codigo: r.codigo, dependente: idMap[r.aluno_id] ? primeiroNome[r.aluno_id] : undefined });
    porDestino.set(destino, lista);
  }

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .in("user_id", [...porDestino.keys()]);

  for (const [destino, medalhas] of porDestino) {
    const subsDestino = (subs ?? []).filter((s) => s.user_id === destino);
    if (subsDestino.length === 0) continue;
    const quem = [...new Set(medalhas.map((m) => m.dependente).filter(Boolean))];
    const titulo = CONQUISTAS_POR_CODIGO[medalhas[0].codigo]?.titulo ?? "Nova medalha";
    const body =
      medalhas.length === 1
        ? `${medalhas[0].dependente ? `${medalhas[0].dependente}: ` : ""}${titulo}`
        : quem.length > 0
          ? `${medalhas.length} novas medalhas (${quem.join(", ")}). Vê na app!`
          : `Ganhaste ${medalhas.length} medalhas. Vê na app!`;
    await sendToSubscriptions(subsDestino, { title: "Nova medalha! 🏅", body, url: "/conquistas" });
  }

  // fora de produção não marca notificada_em (BD partilhada com a produção)
  if (!pushAtivo(process.env.VERCEL_ENV)) return;
  const ids = rows.map((r) => r.id as string);
  const agora = new Date().toISOString();
  for (let i = 0; i < ids.length; i += 200) {
    await admin.from("conquistas").update({ notificada_em: agora }).in("id", ids.slice(i, i + 200));
  }
}
