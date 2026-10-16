import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { AulaExperimentalForm, type SlotDisponivel } from "./AulaExperimentalForm";

export const dynamic = "force-dynamic";

interface TurmaRow {
  id: string;
  nome: string;
}

interface AulaRow {
  id: string;
  turma_id: string;
  data: string;
  horario: string;
  lotacao_maxima: number;
}

const SEMANAS_JANELA = 4;

export default async function AulaExperimentalPage() {
  const admin = createAdminClient();

  const { data: turmasRaw } = await admin
    .from("turmas")
    .select("id, nome")
    .eq("apenas_experimental", true)
    .eq("ativa", true);

  const turmas = (turmasRaw ?? []) as TurmaRow[];
  const turmaIds = turmas.map((t) => t.id);
  const turmaNomePorId = new Map(turmas.map((t) => [t.id, t.nome]));

  const hoje = new Date().toISOString().split("T")[0];
  const fim = new Date(Date.now() + SEMANAS_JANELA * 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: aulasRaw } =
    turmaIds.length > 0
      ? await admin
          .from("aulas")
          .select("id, turma_id, data, horario, lotacao_maxima")
          .in("turma_id", turmaIds)
          .eq("status", "agendada")
          .gte("data", hoje)
          .lte("data", fim)
          .order("data")
          .order("horario")
      : { data: [] as AulaRow[] };

  const aulas = (aulasRaw ?? []) as AulaRow[];
  const aulaIds = aulas.map((a) => a.id);

  const { data: agendamentosRaw } =
    aulaIds.length > 0
      ? await admin.from("agendamentos_experimental").select("aula_id").in("aula_id", aulaIds)
      : { data: [] as { aula_id: string }[] };

  const contagemPorAula = new Map<string, number>();
  for (const a of (agendamentosRaw ?? []) as { aula_id: string }[]) {
    contagemPorAula.set(a.aula_id, (contagemPorAula.get(a.aula_id) ?? 0) + 1);
  }

  const slots: SlotDisponivel[] = aulas.map((a) => ({
    aulaId: a.id,
    turmaNome: turmaNomePorId.get(a.turma_id) ?? "",
    data: a.data,
    horario: a.horario,
    lotacaoMaxima: a.lotacao_maxima,
    vagasRestantes: Math.max(0, a.lotacao_maxima - (contagemPorAula.get(a.id) ?? 0)),
  }));

  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-gb-black py-10 px-6 flex flex-col items-center">
        <Image src="/logo.webp" alt="Gracie Barra" width={93} height={80} priority className="h-20 w-auto mb-4 object-contain" />
        <h1 className="text-white font-black text-2xl tracking-wide flex flex-col items-center text-center">
          <span>GRACIE BARRA</span>
          <span>VILA NOVA DE FAMALICÃO</span>
        </h1>
        <p className="text-white/60 text-sm tracking-[0.25em] uppercase mt-1">Aula Experimental Grátis</p>
      </div>

      <div className="flex-1 bg-gb-gray flex items-start justify-center p-6 pt-8">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Agenda a tua aula</h2>
          <p className="text-gray-500 text-sm mb-8">
            Experimenta uma aula de Jiu-Jitsu grátis, sem compromisso.
          </p>
          <AulaExperimentalForm slots={slots} />
        </div>
      </div>
    </div>
  );
}
