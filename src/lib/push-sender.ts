import webpush from "web-push";
import { createAdminClient } from "./supabase/admin";
import { calcularElegibilidade } from "./graduacao-rules";
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
) {
  await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      )
    )
  );
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

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function sendPushMensalidade() {
  const admin = createAdminClient();
  const today = new Date();
  const todayStr = toDateStr(today);
  const minus2 = toDateStr(addDays(today, -2));
  const minus5 = toDateStr(addDays(today, -5));

  const { data: rows } = await admin
    .from("mensalidades")
    .select("aluno_id, data_vencimento, status")
    .neq("status", "pago")
    .in("data_vencimento", [todayStr, minus2, minus5]);

  if (!rows || rows.length === 0) return;

  const byDate: Record<string, string[]> = { [todayStr]: [], [minus2]: [], [minus5]: [] };
  for (const r of rows) {
    if (byDate[r.data_vencimento]) byDate[r.data_vencimento].push(r.aluno_id);
  }

  const messages: Record<string, { title: string; body: string }> = {
    [todayStr]: {
      title: "Mensalidade a vencer",
      body: "A tua mensalidade vence hoje. Fala com a Simone para regularizar.",
    },
    [minus2]: {
      title: "Mensalidade em atraso",
      body: "A tua mensalidade está em atraso há 2 dias. Contacta a academia.",
    },
    [minus5]: {
      title: "⚠️ Mensalidade em atraso",
      body: "A tua mensalidade está em atraso há 5 dias. O acesso pode ser bloqueado. Fala com a Simone.",
    },
  };

  for (const [dateStr, userIds] of Object.entries(byDate)) {
    if (userIds.length === 0) continue;
    const subs = await getSubscriptions(userIds);
    if (subs.length === 0) continue;
    await sendToSubscriptions(subs, { ...messages[dateStr], url: "/perfil" });
  }
}

export async function sendPushAviso() {
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id")
    .eq("status", "ativo")
    .in("perfil", ["aluno", "responsavel"]);

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
      .select("data")
      .eq("aluno_id", aluno.id);

    const { data: historico } = await admin
      .from("historico_graduacoes")
      .select("*")
      .eq("aluno_id", aluno.id)
      .order("data_graduacao", { ascending: false });

    const resultado = calcularElegibilidade(
      aluno as Parameters<typeof calcularElegibilidade>[0],
      (presencas ?? []).map((p) => p.data),
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
