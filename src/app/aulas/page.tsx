import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StatusAula, StatusReserva, CategoriaFaixa } from "@/lib/types";
import { AulasView, type AulaParaAluno, type DependenteOpcao } from "./AulasView";

interface AulaRow {
  id: string;
  turma_id: string;
  data: string;
  horario: string;
  lotacao_maxima: number;
  status: string;
  turma: { id: string; nome: string; categoria: string; ativa: boolean } | null;
}

export default async function AulasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const [profileRes, dependentesRes] = await Promise.all([
    admin.from("profiles").select("categoria").eq("id", user.id).single(),
    admin
      .from("dependentes")
      .select("dependente:profiles!dependentes_dependente_id_fkey(id, nome_completo, categoria)")
      .eq("responsavel_id", user.id),
  ]);

  const categoriaAluno: CategoriaFaixa = (profileRes.data?.categoria as CategoriaFaixa) ?? "adulto";

  const dependentes: DependenteOpcao[] = (
    (dependentesRes.data ?? []) as unknown as Array<{ dependente: { id: string; nome_completo: string; categoria: string } | null }>
  )
    .map((d) => d.dependente)
    .filter((d): d is { id: string; nome_completo: string; categoria: string } => d !== null)
    .map((d) => ({ id: d.id, nome_completo: d.nome_completo, categoria: d.categoria as CategoriaFaixa }));

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

  const [reservasRes, todasReservasRes] = await Promise.all([
    aulaIds.length > 0
      ? admin.from("reservas").select("aula_id").in("aula_id", aulaIds).eq("status", "confirmada")
      : { data: [] as { aula_id: string }[] },
    aulaIds.length > 0
      ? admin
          .from("reservas")
          .select("id, aula_id, status, aluno_id")
          .in("aluno_id", todosIds)
          .in("aula_id", aulaIds)
      : { data: [] as { id: string; aula_id: string; status: string; aluno_id: string }[] },
  ]);

  const contagem: Record<string, number> = {};
  for (const r of (reservasRes.data ?? [])) {
    contagem[r.aula_id] = (contagem[r.aula_id] ?? 0) + 1;
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
    reservas_confirmadas: contagem[a.id] ?? 0,
  }));

  return (
    <AulasView
      aulas={aulasParaAluno}
      reservasPorAluno={reservasPorAluno}
      categoriaAluno={categoriaAluno}
      userId={user.id}
      dependentes={dependentes}
    />
  );
}
