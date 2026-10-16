"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth-guard";
import { carregarEstadoGamificacao, sincronizarConquistas } from "@/lib/conquistas-sync";

/** O próprio e os dependentes — as únicas pessoas cujos dados o utilizador pode mexer. */
async function pessoasDoUtilizador(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<Set<string>> {
  const { data } = await admin.from("dependentes").select("dependente_id").eq("responsavel_id", userId);
  return new Set([userId, ...(data ?? []).map((d) => d.dependente_id as string)]);
}

export interface PosTreino {
  novas: { id: string; aluno_id: string; codigo: string; referencia: string }[];
  sequencias: { alunoId: string; nome: string; atual: number; semanaAulas: number }[];
}

/**
 * Depois de o QR ser lido: grava as medalhas novas de quem treinou e devolve-as,
 * com a sequência de cada um, para o ecrã de confirmação. As novas ficam vistas
 * (o ecrã de confirmação mostra-as — o modal do /perfil não as repete).
 */
export async function sincronizarMinhasConquistas(
  alunoIds: string[],
): Promise<{ ok: true; posTreino: PosTreino } | { ok: false; erro: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const admin = createAdminClient();

  const permitidas = await pessoasDoUtilizador(admin, auth.userId);
  const ids = alunoIds.filter((id) => permitidas.has(id));
  if (ids.length === 0) return { ok: false, erro: "Sem permissão." };

  try {
    const { novas } = await sincronizarConquistas(admin, { alunoIds: ids });
    if (novas.length > 0) {
      await admin.from("conquistas").update({ vista_em: new Date().toISOString() }).in("id", novas.map((n) => n.id));
    }

    const { data: perfis } = await admin.from("profiles").select("id, nome_completo, aulas_manual").in("id", ids);
    const estado = await carregarEstadoGamificacao(admin, perfis ?? []);
    return {
      ok: true,
      posTreino: {
        novas: novas.map(({ id, aluno_id, codigo, referencia }) => ({ id, aluno_id, codigo, referencia })),
        sequencias: (perfis ?? []).map((p) => ({
          alunoId: p.id,
          nome: (p.nome_completo as string).split(" ")[0],
          atual: estado[p.id]?.sequencia.atual ?? 0,
          semanaAulas: estado[p.id]?.sequencia.semanaAtual.aulas ?? 0,
        })),
      },
    };
  } catch (e) {
    console.error("[conquistas] sincronizarMinhasConquistas", e);
    return { ok: false, erro: "Não foi possível atualizar as medalhas." };
  }
}

export async function marcarConquistasVistas(ids: string[]): Promise<{ ok: boolean; erro?: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  if (ids.length === 0) return { ok: true };
  const admin = createAdminClient();

  const permitidas = await pessoasDoUtilizador(admin, auth.userId);
  const { error } = await admin
    .from("conquistas")
    .update({ vista_em: new Date().toISOString() })
    .in("id", ids)
    .in("aluno_id", [...permitidas])
    .is("vista_em", null);
  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}

export async function definirVisibilidadeRanking(
  alunoId: string,
  ocultar: boolean,
): Promise<{ ok: boolean; erro?: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const admin = createAdminClient();

  const permitidas = await pessoasDoUtilizador(admin, auth.userId);
  if (!permitidas.has(alunoId)) return { ok: false, erro: "Sem permissão." };

  const { error } = await admin.from("profiles").update({ ocultar_ranking: ocultar }).eq("id", alunoId);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/ranking");
  revalidatePath("/conquistas");
  return { ok: true };
}
