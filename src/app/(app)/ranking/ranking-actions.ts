"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth-guard";
import { hojeLisboa, limitesMes, limitesPeriodo, periodoRankingValido } from "@/lib/gamificacao";
import { paraLinhas, type RankingRow } from "./dados";
import type { LinhaRanking } from "./RankingView";

/** Ranking de outro período ("ano" ou um mês YYYY-MM do ano corrente), pedido ao escolher no selector. */
export async function carregarPeriodoRanking(
  periodo: string,
): Promise<{ ok: true; linhas: LinhaRanking[] } | { ok: false; erro: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;

  const hoje = hojeLisboa();
  if (!periodoRankingValido(periodo, hoje)) return { ok: false, erro: "Período inválido." };

  const { inicio, fim } = periodo === "ano" ? limitesPeriodo("ano", hoje) : limitesMes(periodo);
  const { data, error } = await createAdminClient().rpc("ranking_presencas", { p_inicio: inicio, p_fim: fim });
  if (error) {
    console.error("[ranking] carregarPeriodoRanking", error);
    return { ok: false, erro: "Não foi possível carregar o ranking." };
  }
  return { ok: true, linhas: paraLinhas(data as RankingRow[] | null) };
}
