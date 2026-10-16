"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { HistoricoGraduacao } from "@/lib/types";

/**
 * Histórico de graduações de um dependente, com o nome do professor.
 * Corre no servidor porque o RLS de profiles só deixa ler o próprio perfil, o dos
 * dependentes e (staff) todos — o perfil do professor não é visível ao responsável.
 */
export async function historicoGraduacoesDependente(
  dependenteId: string,
): Promise<{ ok: boolean; erro?: string; historico?: HistoricoGraduacao[] }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Não autenticado" };

  const { data: rel } = await supabase
    .from("dependentes")
    .select("dependente_id")
    .eq("responsavel_id", user.id)
    .eq("dependente_id", dependenteId)
    .single();
  if (!rel) return { ok: false, erro: "Sem permissão" };

  const { data, error } = await createAdminClient()
    .from("historico_graduacoes")
    .select("*, professor:profiles!historico_graduacoes_graduado_por_fkey(nome_completo)")
    .eq("aluno_id", dependenteId)
    .order("data_graduacao", { ascending: false });
  if (error) return { ok: false, erro: error.message };

  return { ok: true, historico: (data ?? []) as HistoricoGraduacao[] };
}
