import type { SupabaseClient } from "@supabase/supabase-js";

export interface PresencaDia {
  aluno_id: string;
  dia_registro: string;
}

export async function fetchAllPresencasDias(
  admin: SupabaseClient,
  alunoIds: string[],
): Promise<PresencaDia[]> {
  if (alunoIds.length === 0) return [];
  const all: PresencaDia[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await admin
      .from("presencas")
      .select("aluno_id, dia_registro")
      .in("aluno_id", alunoIds)
      .order("dia_registro", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...(data as PresencaDia[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}
