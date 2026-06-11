import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  Users, CalendarCheck, TrendingUp, AlertTriangle, ChevronRight, UserX, Award, Star,
} from "lucide-react";
import Link from "next/link";
import { FaixaBJJ } from "@/components/FaixaBJJ";
import type { CorFaixa, CategoriaFaixa, HistoricoGraduacao } from "@/lib/types";
import { calcularElegibilidade } from "@/lib/graduacao-rules";
import { fetchAllPresencasDias } from "@/lib/fetch-all-presencas";
import { PresencasChart } from "./PresencasChart";
import type { ChartDataPoint } from "./PresencasChart";

const MESES_PT = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

interface UltimaGraduacao {
  id: string;
  aluno_id: string;
  nomeAluno: string;
  categoria: CategoriaFaixa;
  faixa_anterior: CorFaixa | null;
  graus_anterior: number;
  faixa_nova: CorFaixa;
  graus_nova: number;
  data_graduacao: string;
}

interface SumidoAluno {
  id: string;
  nome_completo: string;
  faixa: CorFaixa | null;
  graus: number;
  categoria: CategoriaFaixa;
  ultimaPresenca: string | null;
  diasAusente: number;
}

interface AptosGraduarAluno {
  id: string;
  nome_completo: string;
  faixa: CorFaixa;
  graus: number;
  categoria: CategoriaFaixa;
  proximaPromocao: { faixa: CorFaixa; graus: number };
  semanasQualificadas: number;
  semanasNecessarias: number;
}

function formatDate(dateStr: string): string {
  const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  const [y, m, d] = dateStr.split("-");
  return `${d} de ${meses[Number(m) - 1]} de ${y}`;
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function getDashboardData(isAdmin: boolean) {
  const admin = createAdminClient();

  const hoje = new Date();
  const ano  = hoje.getFullYear();
  const mes  = hoje.getMonth() + 1;
  const inicioMes = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const fimMes    = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;

  // Start of the 6-month chart window (1st of the month 5 months back)
  const sixMonthsAgoDate = new Date(ano, (mes - 1) - 5, 1);
  const sixMonthsAgoStr  = fmt(sixMonthsAgoDate);

  // Date window for "vence em breve" (hoje … hoje+7)
  const hojeStr      = fmt(new Date(ano, mes - 1, hoje.getDate()));
  const setesDiasStr = fmt(new Date(ano, mes - 1, hoje.getDate() + 7));

  // ── Batch 1: parallel queries ──────────────────────────────────────────────
  const [profilesRes, presencasCountRes, atrasadasRes, recentPresencasRes, chartRes, venceBreveRes, graduacoesRes] = await Promise.all([
    admin.from("profiles")
      .select("id, status, nome_completo, faixa, graus, categoria, data_nascimento, created_at")
      .eq("perfil", "aluno"),
    admin.from("presencas")
      .select("*", { count: "exact", head: true })
      .gte("dia_registro", inicioMes)
      .lte("dia_registro", fimMes),
    isAdmin
      ? admin.from("mensalidades")
          .select("aluno_id")
          .neq("status", "pago")
          .lt("data_vencimento", hojeStr)
      : Promise.resolve({ data: [] }),
    admin.from("presencas")
      .select("id, registrado_em, aluno_id")
      .order("registrado_em", { ascending: false })
      .limit(8),
    admin.from("presencas")
      .select("dia_registro")
      .gte("dia_registro", sixMonthsAgoStr),
    isAdmin
      ? admin.from("mensalidades")
          .select("aluno_id")
          .neq("status", "pago")
          .gte("data_vencimento", hojeStr)
          .lte("data_vencimento", setesDiasStr)
      : Promise.resolve({ data: [] }),
    admin.from("historico_graduacoes")
      .select("id, aluno_id, faixa_anterior, graus_anterior, faixa_nova, graus_nova, data_graduacao, profiles(nome_completo, categoria)")
      .order("data_graduacao", { ascending: false })
      .limit(5),
  ]);

  const allProfiles = profilesRes.data ?? [];
  const ativos      = allProfiles.filter((p) => p.status === "ativo").length;
  const inativos    = allProfiles.filter((p) => p.status === "inativo").length;
  const trancados   = allProfiles.filter((p) => p.status === "trancado").length;

  const presencasMes    = presencasCountRes.count ?? 0;
  const frequenciaMedia = ativos > 0 ? presencasMes / ativos : 0;
  const alunosAtrasados = new Set(atrasadasRes.data?.map((m) => m.aluno_id) ?? []).size;

  // Profile lookup map — reused for recent presences (avoids extra query)
  const profilesById: Record<string, string> = {};
  for (const a of allProfiles) profilesById[a.id] = a.nome_completo as string;

  const recentWithProfile = (recentPresencasRes.data ?? []).map((p) => ({
    ...p,
    aluno: profilesById[p.aluno_id] ? { nome_completo: profilesById[p.aluno_id] } : null,
  }));

  // ── Financial snapshot (active alunos only, mutually exclusive tiers) ─────
  const activeAlunoIdSet = new Set(
    allProfiles.filter((p) => p.status === "ativo").map((p) => p.id as string)
  );
  const atrasadoIdSet = new Set(
    (atrasadasRes.data ?? [])
      .filter((m) => activeAlunoIdSet.has(m.aluno_id as string))
      .map((m) => m.aluno_id as string)
  );
  const venceBreveIdSet = new Set(
    (venceBreveRes.data ?? [])
      .filter((m) => activeAlunoIdSet.has(m.aluno_id as string) && !atrasadoIdSet.has(m.aluno_id as string))
      .map((m) => m.aluno_id as string)
  );
  const finAtrasado   = atrasadoIdSet.size;
  const finVenceBreve = venceBreveIdSet.size;
  const finEmDia      = Math.max(ativos - finAtrasado - finVenceBreve, 0);

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartRaw = (chartRes.data ?? []).map((p) => p.dia_registro as string);

  // 6 months — oldest first (index 0 = 5 months ago, index 5 = current month)
  const mensalData: ChartDataPoint[] = Array.from({ length: 6 }, (_, i) => {
    const d       = new Date(ano, (mes - 1) - (5 - i), 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      label: MESES_PT[d.getMonth()].slice(0, 3),
      total: chartRaw.filter((s) => s.startsWith(monthStr)).length,
    };
  });

  // 4 weeks of 7 days each, oldest first
  const semanalData: ChartDataPoint[] = Array.from({ length: 4 }, (_, i) => {
    const weeksBack = 3 - i;
    const endDate   = new Date(ano, mes - 1, hoje.getDate() - weeksBack * 7);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    const endStr   = fmt(endDate);
    const startStr = fmt(startDate);
    return {
      label: `${String(startDate.getDate()).padStart(2, "0")}/${String(startDate.getMonth() + 1).padStart(2, "0")}`,
      total: chartRaw.filter((s) => s >= startStr && s <= endStr).length,
    };
  });

  // ── Últimas graduações ────────────────────────────────────────────────────
  const ultimasGraduacoes: UltimaGraduacao[] = (graduacoesRes.data ?? []).map((g) => {
    const prof = (Array.isArray(g.profiles) ? g.profiles[0] : g.profiles) as { nome_completo: string; categoria: string } | null;
    return {
      id:             g.id as string,
      aluno_id:       g.aluno_id as string,
      nomeAluno:      prof?.nome_completo ?? "—",
      categoria:      ((prof?.categoria ?? "adulto") as CategoriaFaixa),
      faixa_anterior: (g.faixa_anterior as CorFaixa | null) ?? null,
      graus_anterior: (g.graus_anterior as number) ?? 0,
      faixa_nova:     g.faixa_nova as CorFaixa,
      graus_nova:     (g.graus_nova as number) ?? 0,
      data_graduacao: g.data_graduacao as string,
    };
  });

  // ── Batch 2: presences for active alunos (sequential, needs activeIds) ─────
  const activosProfiles = allProfiles.filter((p) => p.status === "ativo");
  const activeIds       = activosProfiles.map((p) => p.id);

  const todayDate     = new Date(ano, mes - 1, hoje.getDate());
  const trintaAtras   = new Date(todayDate);
  trintaAtras.setDate(trintaAtras.getDate() - 30);
  const trintaAtrasStr = `${trintaAtras.getFullYear()}-${String(trintaAtras.getMonth() + 1).padStart(2, "0")}-${String(trintaAtras.getDate()).padStart(2, "0")}`;

  let sumiram: SumidoAluno[] = [];
  let aptosGraduar: AptosGraduarAluno[] = [];

  if (activeIds.length > 0) {
    const [presencasAtivos, { data: historicoAtivos }] = await Promise.all([
      fetchAllPresencasDias(admin, activeIds),
      admin.from("historico_graduacoes")
        .select("id, aluno_id, faixa_nova, faixa_anterior, graus_nova, graus_anterior, data_graduacao, graduado_por, observacoes, created_at")
        .in("aluno_id", activeIds)
        .order("data_graduacao", { ascending: false }),
    ]);

    const lastPresencaMap: Record<string, string> = {};
    const treinouRecenteSet = new Set<string>();
    const diasByAluno: Record<string, string[]> = {};

    for (const p of presencasAtivos) {
      const aid = p.aluno_id;
      const dia = p.dia_registro;
      if (!lastPresencaMap[aid]) lastPresencaMap[aid] = dia;
      if (dia >= trintaAtrasStr) treinouRecenteSet.add(aid);
      if (!diasByAluno[aid]) diasByAluno[aid] = [];
      diasByAluno[aid].push(dia);
    }

    const historicoByAluno: Record<string, HistoricoGraduacao[]> = {};
    for (const h of historicoAtivos ?? []) {
      const aid = h.aluno_id as string;
      if (!historicoByAluno[aid]) historicoByAluno[aid] = [];
      historicoByAluno[aid].push(h as HistoricoGraduacao);
    }

    sumiram = activosProfiles
      .filter((a) => !treinouRecenteSet.has(a.id as string))
      .map((a) => {
        const lastStr    = lastPresencaMap[a.id as string] ?? null;
        const refMs      = lastStr
          ? new Date(lastStr + "T12:00:00").getTime()
          : new Date((a.created_at as string).split("T")[0] + "T12:00:00").getTime();
        const diasAusente = Math.floor((todayDate.getTime() - refMs) / (1000 * 60 * 60 * 24));
        return {
          id:            a.id as string,
          nome_completo: a.nome_completo as string,
          faixa:         a.faixa as CorFaixa | null,
          graus:         (a.graus as number) ?? 0,
          categoria:     ((a.categoria as string) ?? "adulto") as CategoriaFaixa,
          ultimaPresenca: lastStr,
          diasAusente,
        };
      })
      .sort((a, b) => b.diasAusente - a.diasAusente);

    // ── Aptos a graduar ──────────────────────────────────────────────────────
    for (const a of activosProfiles) {
      if (!a.faixa) continue;
      const dias = diasByAluno[a.id as string] ?? [];
      const hist = historicoByAluno[a.id as string] ?? [];
      const eleg = calcularElegibilidade(
        {
          faixa:           a.faixa as CorFaixa,
          graus:           (a.graus as number) ?? 0,
          categoria:       ((a.categoria as string) ?? "adulto") as CategoriaFaixa,
          data_nascimento: (a.data_nascimento as string | null) ?? null,
          created_at:      a.created_at as string,
        },
        dias,
        hist,
      );
      if (eleg.elegivel && eleg.proximaPromocao) {
        aptosGraduar.push({
          id:               a.id as string,
          nome_completo:    a.nome_completo as string,
          faixa:            a.faixa as CorFaixa,
          graus:            (a.graus as number) ?? 0,
          categoria:        ((a.categoria as string) ?? "adulto") as CategoriaFaixa,
          proximaPromocao:  eleg.proximaPromocao,
          semanasQualificadas: eleg.semanasQualificadas,
          semanasNecessarias:  eleg.semanasNecessarias,
        });
      }
    }

    aptosGraduar.sort((a, b) =>
      (b.semanasQualificadas - b.semanasNecessarias) -
      (a.semanasQualificadas - a.semanasNecessarias)
    );
  }

  return {
    ativos, inativos, trancados,
    presencasMes, frequenciaMedia, alunosAtrasados,
    recentWithProfile,
    sumiram,
    aptosGraduar,
    ultimasGraduacoes,
    semanalData,
    mensalData,
    finEmDia, finVenceBreve, finAtrasado,
    mes: MESES_PT[mes - 1],
    ano,
  };
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("perfil").eq("id", user.id).single()
    : { data: null };
  const isAdmin = profile?.perfil === "admin";

  const {
    ativos, inativos, trancados,
    presencasMes, frequenciaMedia, alunosAtrasados,
    recentWithProfile,
    sumiram,
    aptosGraduar,
    ultimasGraduacoes,
    semanalData,
    mensalData,
    finEmDia, finVenceBreve, finAtrasado,
    mes, ano,
  } = await getDashboardData(isAdmin);

  const totalAlunos = ativos + inativos + trancados;

  return (
    <main className="p-6 md:p-8 max-w-6xl mx-auto w-full">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">{mes} de {ano}</p>
      </div>

      {/* ── Cards de resumo ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">

        {/* Card: Alunos */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total alunos</span>
            <span className="w-9 h-9 rounded-xl bg-gb-blue/10 flex items-center justify-center">
              <Users size={18} className="text-gb-blue" />
            </span>
          </div>
          <div className="text-4xl font-black text-gray-900">{totalAlunos}</div>
          <div className="flex gap-3 text-xs font-medium flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span className="text-gray-600">{ativos} ativos</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
              <span className="text-gray-400">{inativos} inativos</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              <span className="text-gray-400">{trancados} trancados</span>
            </span>
          </div>
        </div>

        {/* Card: Presenças este mês */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Presenças em {mes}</span>
            <span className="w-9 h-9 rounded-xl bg-gb-blue/10 flex items-center justify-center">
              <CalendarCheck size={18} className="text-gb-blue" />
            </span>
          </div>
          <div className="text-4xl font-black text-gray-900">{presencasMes}</div>
          <p className="text-xs text-gray-400">check-ins registrados no mês</p>
        </div>

        {/* Card: Frequência média */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Freq. média / aluno</span>
            <span className="w-9 h-9 rounded-xl bg-gb-blue/10 flex items-center justify-center">
              <TrendingUp size={18} className="text-gb-blue" />
            </span>
          </div>
          <div className="text-4xl font-black text-gray-900">
            {frequenciaMedia.toFixed(1)}
            <span className="text-lg font-semibold text-gray-400 ml-1">aulas</span>
          </div>
          <p className="text-xs text-gray-400">média por aluno ativo este mês</p>
        </div>

        {/* Card: Mensalidades atrasadas — apenas admin */}
        {isAdmin && (
          <div className={`rounded-2xl border shadow-sm p-5 flex flex-col gap-4 ${
            alunosAtrasados > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-100"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Mensalidades</span>
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                alunosAtrasados > 0 ? "bg-red-100" : "bg-gray-100"
              }`}>
                <AlertTriangle size={18} className={alunosAtrasados > 0 ? "text-red-500" : "text-gray-400"} />
              </span>
            </div>
            <div className={`text-4xl font-black ${alunosAtrasados > 0 ? "text-red-600" : "text-gray-900"}`}>
              {alunosAtrasados}
            </div>
            <p className={`text-xs ${alunosAtrasados > 0 ? "text-red-400" : "text-gray-400"}`}>
              {alunosAtrasados === 0
                ? "nenhum aluno com mensalidade atrasada"
                : `aluno${alunosAtrasados > 1 ? "s" : ""} com mensalidade atrasada`}
            </p>
          </div>
        )}

      </div>

      {/* ── Situação financeira — apenas admin ── */}
      {isAdmin && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-gray-700">Situação financeira</h2>
            <span className="text-xs text-gray-400">{mes}</span>
          </div>

          <div className="grid grid-cols-3 divide-x divide-gray-100">

            {/* Em dia */}
            <div className="flex flex-col items-center gap-2 px-4 py-1">
              <span className="text-4xl font-black text-emerald-600 tabular-nums leading-none">
                {finEmDia}
              </span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                Em dia
              </span>
            </div>

            {/* Vence em breve */}
            <div className="flex flex-col items-center gap-2 px-4 py-1">
              <span className={`text-4xl font-black tabular-nums leading-none ${
                finVenceBreve > 0 ? "text-amber-500" : "text-gray-300"
              }`}>
                {finVenceBreve}
              </span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  finVenceBreve > 0 ? "bg-amber-400" : "bg-gray-200"
                }`} />
                Vence em 7 dias
              </span>
            </div>

            {/* Atrasado */}
            <div className="flex flex-col items-center gap-2 px-4 py-1">
              <span className={`text-4xl font-black tabular-nums leading-none ${
                finAtrasado > 0 ? "text-red-600" : "text-gray-300"
              }`}>
                {finAtrasado}
              </span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  finAtrasado > 0 ? "bg-red-500" : "bg-gray-200"
                }`} />
                Atrasado
              </span>
            </div>

          </div>
        </div>
      )}

      {/* ── Aptos a Graduar ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <Star size={16} className="text-emerald-500" />
            <h2 className="text-sm font-bold text-gray-700">Aptos a Graduar</h2>
            {aptosGraduar.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                {aptosGraduar.length}
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400">presenças e tempo de faixa verificados</span>
        </div>

        {aptosGraduar.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-gray-400">Nenhum aluno apto a graduar de momento.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {aptosGraduar.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/admin/alunos/${a.id}`}
                  className="flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  {/* Faixa actual */}
                  <div className="shrink-0 flex items-center justify-center">
                    <FaixaBJJ faixa={a.faixa} graus={a.graus} categoria={a.categoria} tamanho="xs" />
                  </div>

                  {/* Nome + semanas */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{a.nome_completo}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {a.semanasQualificadas} semanas qualificadas
                    </p>
                  </div>

                  {/* Próxima promoção */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <ChevronRight size={14} className="text-gray-300" />
                    <FaixaBJJ faixa={a.proximaPromocao.faixa} graus={a.proximaPromocao.graus} categoria={a.categoria} tamanho="xs" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Gráfico de presenças ── */}
      <div className="mb-6">
        <PresencasChart semanalData={semanalData} mensalData={mensalData} />
      </div>

      {/* ── Alunos que sumiram ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <UserX size={16} className="text-gray-400" />
            <h2 className="text-sm font-bold text-gray-700">Alunos que sumiram</h2>
            {sumiram.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                {sumiram.length}
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400">sem presença nos últimos 30 dias</span>
        </div>

        {sumiram.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-emerald-600 font-medium">
              Todos os alunos ativos treinaram nos últimos 30 dias.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {sumiram.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/admin/alunos/${a.id}`}
                  className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  {/* Faixa */}
                  <div className="w-14 shrink-0 flex items-center justify-center">
                    {a.faixa ? (
                      <FaixaBJJ
                        faixa={a.faixa}
                        graus={a.graus}
                        categoria={a.categoria}
                        tamanho="sm"
                      />
                    ) : (
                      <div className="w-10 h-3 rounded-full bg-gray-200" />
                    )}
                  </div>

                  {/* Nome + última presença */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{a.nome_completo}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {a.ultimaPresenca
                        ? `Última aula: ${formatDate(a.ultimaPresenca)}`
                        : "Nunca treinou"}
                    </p>
                  </div>

                  {/* Dias ausente badge */}
                  <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${
                    a.diasAusente >= 60
                      ? "bg-red-100 text-red-600"
                      : "bg-amber-100 text-amber-600"
                  }`}>
                    {a.diasAusente}d
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Últimas graduações ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <Award size={16} className="text-gray-400" />
            <h2 className="text-sm font-bold text-gray-700">Últimas graduações</h2>
          </div>
        </div>

        {ultimasGraduacoes.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">
            Nenhuma graduação registrada ainda.
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {ultimasGraduacoes.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/admin/alunos/${g.aluno_id}`}
                  className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  {/* Nome + data */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{g.nomeAluno}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(g.data_graduacao)}</p>
                  </div>

                  {/* Faixa anterior → nova */}
                  <div className="flex items-center gap-2 shrink-0">
                    {g.faixa_anterior ? (
                      <FaixaBJJ faixa={g.faixa_anterior} graus={g.graus_anterior} categoria={g.categoria} tamanho="sm" />
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                    <ChevronRight size={14} className="text-gray-300 shrink-0" />
                    <FaixaBJJ faixa={g.faixa_nova} graus={g.graus_nova} categoria={g.categoria} tamanho="sm" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Presenças recentes ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-700">Presenças recentes</h2>
          <Link
            href="/admin/alunos"
            className="text-xs text-gb-blue font-semibold hover:underline flex items-center gap-1"
          >
            Ver alunos <ChevronRight size={14} />
          </Link>
        </div>

        {recentWithProfile.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">
            Nenhuma presença registrada ainda.
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {recentWithProfile.map((p) => {
              const dt      = new Date(p.registrado_em);
              const dataStr = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
              const horaStr = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
              return (
                <li key={p.id} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-gb-blue/10 flex items-center justify-center shrink-0">
                    <span className="text-gb-blue text-xs font-bold">
                      {p.aluno?.nome_completo?.[0]?.toUpperCase() ?? "?"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {p.aluno?.nome_completo ?? "Aluno removido"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-gray-700">{dataStr}</p>
                    <p className="text-xs text-gray-400">{horaStr}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

    </main>
  );
}
