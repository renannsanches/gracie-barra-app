import { createAdminClient } from "@/lib/supabase/admin";
import { listarGrupos } from "@/lib/grupos";
import { GruposView, type ContagemGrupo } from "./GruposView";

export const dynamic = "force-dynamic";

export default async function GruposPage() {
  const admin = createAdminClient();
  const [grupos, { data: inscricoes }, { data: modalidades }] = await Promise.all([
    listarGrupos(admin),
    // O local de cada aluno vem das modalidades em que está inscrito
    admin.from("aluno_modalidades").select("aluno_id, modalidade:modalidades(grupo_id), aluno:profiles(status)"),
    admin.from("modalidades").select("grupo_id"),
  ]);

  const contagens: Record<string, ContagemGrupo> = {};
  const conta = (id: string) => (contagens[id] ??= { total: 0, ativos: 0, modalidades: 0 });

  // Um aluno conta uma vez por local, mesmo com várias modalidades no mesmo local
  const vistos = new Set<string>();
  type Inscricao = { aluno_id: string; modalidade: { grupo_id: string } | null; aluno: { status: string } | null };
  for (const i of (inscricoes ?? []) as unknown as Inscricao[]) {
    const g = i.modalidade?.grupo_id;
    if (!g || vistos.has(`${g}|${i.aluno_id}`)) continue;
    vistos.add(`${g}|${i.aluno_id}`);
    const c = conta(g);
    c.total += 1;
    if (i.aluno?.status === "ativo") c.ativos += 1;
  }
  for (const m of modalidades ?? []) conta(m.grupo_id as string).modalidades += 1;

  return <GruposView grupos={grupos} contagens={contagens} />;
}
