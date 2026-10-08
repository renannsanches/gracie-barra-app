import { createAdminClient } from "@/lib/supabase/admin";
import { listarGrupos } from "@/lib/grupos";
import { GruposView, type ContagemGrupo } from "./GruposView";

export const dynamic = "force-dynamic";

export default async function GruposPage() {
  const admin = createAdminClient();
  const [grupos, { data: membros }] = await Promise.all([
    listarGrupos(admin),
    admin.from("profiles").select("grupo_id, status").not("grupo_id", "is", null),
  ]);

  const contagens: Record<string, ContagemGrupo> = {};
  for (const m of membros ?? []) {
    const c = (contagens[m.grupo_id as string] ??= { total: 0, ativos: 0 });
    c.total += 1;
    if (m.status === "ativo") c.ativos += 1;
  }

  return <GruposView grupos={grupos} contagens={contagens} />;
}
