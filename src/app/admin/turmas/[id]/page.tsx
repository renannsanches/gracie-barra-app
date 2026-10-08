import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Turma, StatusAula } from "@/lib/types";
import type { AulaComContagem } from "./turma-actions";
import { TurmaEditView } from "./TurmaEditView";
import { listarModalidades } from "@/lib/modalidades";

interface Props { params: Promise<{ id: string }>; }

export default async function TurmaDetailPage({ params }: Props) {
  const { id } = await params;
  const admin = createAdminClient();

  const [turmaRes, professorRes, aulaRes, modalidades] = await Promise.all([
    admin.from("turmas").select("*, professor:profiles(id, nome_completo)").eq("id", id).single(),
    admin.from("profiles").select("id, nome_completo").in("perfil", ["professor", "admin"]).order("nome_completo"),
    admin.from("aulas").select("*").eq("turma_id", id).order("data", { ascending: false }),
    listarModalidades(admin),
  ]);

  if (!turmaRes.data) notFound();

  const aulas = (aulaRes.data ?? []) as Omit<AulaComContagem, "reservas_confirmadas">[];
  const aulaIds = aulas.map((a) => a.id);

  const contagem: Record<string, number> = {};
  if (aulaIds.length > 0) {
    const { data: reservas } = await admin
      .from("reservas")
      .select("aula_id")
      .in("aula_id", aulaIds)
      .eq("status", "confirmada");

    for (const r of (reservas ?? [])) {
      contagem[r.aula_id] = (contagem[r.aula_id] ?? 0) + 1;
    }
  }

  const aulasComContagem: AulaComContagem[] = aulas.map((a) => ({
    ...a,
    status: a.status as StatusAula,
    reservas_confirmadas: contagem[a.id] ?? 0,
  }));

  return (
    <TurmaEditView
      turma={turmaRes.data as Turma}
      professores={(professorRes.data ?? []) as { id: string; nome_completo: string }[]}
      aulas={aulasComContagem}
      modalidades={modalidades}
    />
  );
}
