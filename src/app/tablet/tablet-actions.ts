"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireTablet } from "@/lib/auth-guard";
import type { CorFaixa } from "@/lib/types";

export interface AlunoOpcao {
  id: string;
  nome_completo: string;
  faixa: CorFaixa | null;
  graus: number;
  foto_url: string | null;
}

export interface AulaOpcao {
  id: string;
  horario: string;
  turma: { nome: string } | null;
}

export async function buscarAlunos(): Promise<AlunoOpcao[]> {
  const auth = await requireTablet();
  if (!auth.ok) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, nome_completo, faixa, graus, foto_url")
    .eq("perfil", "aluno")
    .eq("status", "ativo")
    .order("nome_completo");
  return (data ?? []) as AlunoOpcao[];
}

export async function buscarAulasDisponiveis(): Promise<AulaOpcao[]> {
  const auth = await requireTablet();
  if (!auth.ok) return [];
  const admin = createAdminClient();
  const hoje = new Date().toISOString().split("T")[0];
  const { data } = await admin
    .from("aulas")
    .select("id, horario, turma:turmas(nome)")
    .eq("data", hoje)
    .eq("status", "agendada")
    .order("horario");

  const agora = new Date();
  const horaAtual = agora.getHours() * 60 + agora.getMinutes();

  return ((data ?? []) as unknown as AulaOpcao[]).filter((a) => {
    const [h, m] = a.horario.split(":").map(Number);
    return Math.abs(h * 60 + m - horaAtual) <= 120;
  });
}

interface PresencaManualResult {
  ok: boolean;
  erro?: string;
  aluno?: {
    nome_completo: string;
    foto_url: string | null;
    faixa: CorFaixa | null;
    graus: number;
  };
}

async function estaBloqueadoFinanceiramente(
  alunoId: string,
  admin: ReturnType<typeof createAdminClient>
): Promise<boolean> {
  const dez = new Date();
  dez.setDate(dez.getDate() - 10);
  const { data } = await admin
    .from("mensalidades")
    .select("id")
    .eq("aluno_id", alunoId)
    .neq("status", "pago")
    .lte("data_vencimento", dez.toISOString().split("T")[0])
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export async function registrarPresencaManual(
  alunoId: string,
  aulaId: string
): Promise<PresencaManualResult> {
  const auth = await requireTablet();
  if (!auth.ok) return auth;
  const admin = createAdminClient();

  if (await estaBloqueadoFinanceiramente(alunoId, admin)) {
    return { ok: false, erro: "Não foi possível registar presença. Falar com Simone." };
  }

  const umaHoraAtras = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: recente } = await admin
    .from("presencas")
    .select("id")
    .eq("aluno_id", alunoId)
    .gte("registrado_em", umaHoraAtras)
    .maybeSingle();

  if (recente) {
    return { ok: false, erro: "Este aluno já registou presença na última hora." };
  }

  const { error } = await admin
    .from("presencas")
    .insert({ aluno_id: alunoId, registrado_em: new Date().toISOString() });

  if (error) return { ok: false, erro: error.message };

  const { data: aluno } = await admin
    .from("profiles")
    .select("nome_completo, foto_url, faixa, graus")
    .eq("id", alunoId)
    .single();

  return {
    ok: true,
    aluno: aluno
      ? {
          nome_completo: aluno.nome_completo as string,
          foto_url: (aluno.foto_url as string | null) ?? null,
          faixa: (aluno.faixa as CorFaixa | null) ?? null,
          graus: (aluno.graus as number) ?? 0,
        }
      : undefined,
  };
}
