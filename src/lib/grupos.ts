import type { createAdminClient } from "@/lib/supabase/admin";
import type { GrupoAluno } from "@/lib/types";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Todos os grupos: padrão primeiro, depois activos, depois por nome. */
export async function listarGrupos(admin: AdminClient): Promise<GrupoAluno[]> {
  const { data } = await admin
    .from("grupos_alunos")
    .select("*")
    .order("padrao", { ascending: false })
    .order("ativo", { ascending: false })
    .order("nome", { ascending: true });
  return (data ?? []) as GrupoAluno[];
}

/** Id do grupo que recebe os registos feitos pela app, ou null se não existir. */
export async function grupoPadraoId(admin: AdminClient): Promise<string | null> {
  const { data } = await admin
    .from("grupos_alunos")
    .select("id")
    .eq("padrao", true)
    .eq("ativo", true)
    .maybeSingle();
  return data?.id ?? null;
}
