import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StatusAula, StatusReserva, CategoriaFaixa } from "@/lib/types";
import { AulasView, type AulaParaAluno, type DependenteOpcao, type ReservanteDaAula } from "./AulasView";

interface AulaRow {
  id: string;
  turma_id: string;
  data: string;
  horario: string;
  lotacao_maxima: number;
  status: string;
  turma: { id: string; nome: string; categoria: string; ativa: boolean } | null;
}

interface ReservaRichRow {
  aula_id: string;
  aluno: { id: string; nome_completo: string; foto_url: string | null } | null;
}

export default async function AulasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const [profileRes, dependentesRes] = await Promise.all([
    admin.from("profiles").select("categoria, nome_completo, foto_url").eq("id", user.id).single(),
    admin
      .from("dependentes")
      .select("dependente:profiles!dependentes_dependente_id_fkey(id, nome_completo, categoria, foto_url)")
      .eq("responsavel_id", user.id),
  ]);

  const categoriaAluno: CategoriaFaixa = (profileRes.data?.categoria as CategoriaFaixa) ?? "adulto";
  const nomeCompleto: string = profileRes.data?.nome_completo ?? "";
  const fotoUrl: string | null = profileRes.data?.foto_url ?? null;

  const dependentes: DependenteOpcao[] = (
    (dependentesRes.data ?? []) as unknown as Array<{ dependente: { id: string; nome_completo: string; categoria: string; foto_url: string | null } | null }>
  )
    .map((d) => d.dependente)
    .filter((d): d is { id: string; nome_completo: string; categoria: string; foto_url: string | null } => d !== null)
    .map((d) => ({ id: d.id, nome_completo: d.nome_completo, categoria: d.categoria as CategoriaFaixa, foto_url: d.foto_url ?? null }));

  const hoje = new Date().toISOString().split("T")[0];
  const fim  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: aulasRaw } = await admin
    .from("aulas")
    .select("id, turma_id, data, horario, lotacao_maxima, status, turma:turmas(id, nome, categoria, ativa)")
    .gte("data", hoje)
    .lte("data", fim)
    .eq("status", "agendada")
    .order("data")
    .order("horario");

  const aulas = ((aulasRaw ?? []) as unknown as AulaRow[]).filter((a) => a.turma?.ativa);

  const aulaIds = aulas.map((a) => a.id);
  const todosIds = [user.id, ...dependentes.map((d) => d.id)];

  const dezDiasAtras = new Date();
  dezDiasAtras.setDate(dezDiasAtras.getDate() - 10);

  const [richReservasRes, todasReservasRes, bloqueadosRes] = await Promise.all([
    aulaIds.length > 0
      ? admin
          .from("reservas")
          .select("aula_id, aluno:profiles!reservas_aluno_id_fkey(id, nome_completo, foto_url)")
          .in("aula_id", aulaIds)
          .eq("status", "confirmada")
      : { data: [] as ReservaRichRow[] },
    aulaIds.length > 0
      ? admin
          .from("reservas")
          .select("id, aula_id, status, aluno_id")
          .in("aluno_id", todosIds)
          .in("aula_id", aulaIds)
      : { data: [] as { id: string; aula_id: string; status: string; aluno_id: string }[] },
    admin
      .from("mensalidades")
      .select("aluno_id")
      .in("aluno_id", todosIds)
      .neq("status", "pago")
      .lte("data_vencimento", dezDiasAtras.toISOString().split("T")[0]),
  ]);

  const bloqueadosPorFinanceiro = [
    ...new Set(((bloqueadosRes.data ?? []) as { aluno_id: string }[]).map((b) => b.aluno_id)),
  ];

  const reservantesPorAula: Record<string, ReservanteDaAula[]> = {};
  for (const r of ((richReservasRes.data ?? []) as ReservaRichRow[])) {
    if (!r.aluno) continue;
    if (!reservantesPorAula[r.aula_id]) reservantesPorAula[r.aula_id] = [];
    reservantesPorAula[r.aula_id].push(r.aluno as ReservanteDaAula);
  }

  const reservasPorAluno: Record<string, Record<string, { id: string; status: StatusReserva }>> = {};
  for (const r of ((todasReservasRes.data ?? []) as { id: string; aula_id: string; status: string; aluno_id: string }[])) {
    if (!reservasPorAluno[r.aluno_id]) reservasPorAluno[r.aluno_id] = {};
    reservasPorAluno[r.aluno_id][r.aula_id] = { id: r.id, status: r.status as StatusReserva };
  }

  const aulasParaAluno: AulaParaAluno[] = aulas.map((a) => ({
    id:             a.id,
    turma_id:       a.turma_id,
    data:           a.data,
    horario:        a.horario,
    lotacao_maxima: a.lotacao_maxima,
    status:         a.status as StatusAula,
    turma:          a.turma ? { id: a.turma.id, nome: a.turma.nome, categoria: a.turma.categoria as CategoriaFaixa } : null,
    reservas_confirmadas: reservantesPorAula[a.id]?.length ?? 0,
  }));

  return (
    <AulasView
      aulas={aulasParaAluno}
      reservasPorAluno={reservasPorAluno}
      categoriaAluno={categoriaAluno}
      userId={user.id}
      nomeCompleto={nomeCompleto}
      fotoUrl={fotoUrl}
      dependentes={dependentes}
      bloqueadosPorFinanceiro={bloqueadosPorFinanceiro}
      reservantesPorAula={reservantesPorAula}
    />
  );
}
