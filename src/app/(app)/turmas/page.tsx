import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StatusAula, StatusReserva, CategoriaFaixa } from "@/lib/types";
import { TurmasAlunoView, type AulaParaAluno } from "./TurmasAlunoView";

interface AulaRow {
  id: string;
  turma_id: string;
  data: string;
  horario: string;
  lotacao_maxima: number;
  status: string;
  turma: { id: string; nome: string; categoria: string; ativa: boolean } | null;
}

export default async function TurmasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin  = createAdminClient();
  const hoje   = new Date().toISOString().split("T")[0];
  const limite = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: aulasRaw } = await admin
    .from("aulas")
    .select("id, turma_id, data, horario, lotacao_maxima, status, turma:turmas(id, nome, categoria, ativa)")
    .gte("data", hoje)
    .lte("data", limite)
    .eq("status", "agendada")
    .order("data")
    .order("horario");

  const aulas = ((aulasRaw ?? []) as unknown as AulaRow[]).filter((a) => a.turma?.ativa);
  const aulaIds = aulas.map((a) => a.id);

  const [reservasResult, minhasResult] = await Promise.all([
    aulaIds.length > 0
      ? admin.from("reservas").select("aula_id").in("aula_id", aulaIds).eq("status", "confirmada")
      : { data: [] as { aula_id: string }[] },
    aulaIds.length > 0
      ? admin.from("reservas").select("id, aula_id, status").eq("aluno_id", user.id).in("aula_id", aulaIds)
      : { data: [] as { id: string; aula_id: string; status: string }[] },
  ]);

  const contagem: Record<string, number> = {};
  for (const r of (reservasResult.data ?? [])) {
    contagem[r.aula_id] = (contagem[r.aula_id] ?? 0) + 1;
  }

  const minhasMap: Record<string, { id: string; status: StatusReserva }> = {};
  for (const r of (minhasResult.data ?? [])) {
    minhasMap[r.aula_id] = { id: r.id, status: r.status as StatusReserva };
  }

  const aulasParaAluno: AulaParaAluno[] = aulas.map((a) => ({
    id:             a.id,
    turma_id:       a.turma_id,
    data:           a.data,
    horario:        a.horario,
    lotacao_maxima: a.lotacao_maxima,
    status:         a.status as StatusAula,
    criado_em:      "",
    turma:          a.turma
      ? { id: a.turma.id, nome: a.turma.nome, categoria: a.turma.categoria as CategoriaFaixa }
      : null,
    reservas_confirmadas: contagem[a.id] ?? 0,
    minha_reserva_id:     minhasMap[a.id]?.id ?? null,
    minha_reserva_status: minhasMap[a.id]?.status ?? null,
  }));

  return <TurmasAlunoView aulas={aulasParaAluno} />;
}
